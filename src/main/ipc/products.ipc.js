// Products & Inventory IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');

function registerProductsIpc(ipcMain) {
    // 1. Get Categories
    ipcMain.handle('products:get-categories', async () => {
        const db = getDb();
        return db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
    });

    // 2. List Products with dynamic filtering & pagination
    ipcMain.handle('products:list', async (event, { category = 'all', search = '', stockStatus = 'all', telegramStatus = 'all', page = 1, limit = 50 } = {}) => {
        const db = getDb();
        const offset = (page - 1) * limit;

        let whereClauses = ['1=1'];
        const params = {};

        if (category && category !== 'all') {
            whereClauses.push('p.category_slug = @category');
            params.category = category;
        }

        if (stockStatus === 'in_stock') {
            whereClauses.push('p.current_stock > 5');
        } else if (stockStatus === 'low') {
            whereClauses.push('p.current_stock <= p.min_stock_alert AND p.current_stock > 0');
        } else if (stockStatus === 'out') {
            whereClauses.push('p.current_stock = 0');
        }

        if (telegramStatus === 'published') {
            whereClauses.push('p.is_telegram_synced = 1');
        } else if (telegramStatus === 'unpublished') {
            whereClauses.push('p.is_telegram_synced = 0');
        }

        if (search && search.trim() !== '') {
            whereClauses.push(`(
                p.name LIKE @search OR
                p.barcode LIKE @search OR
                p.model LIKE @search OR
                p.brand LIKE @search OR
                EXISTS (SELECT 1 FROM product_imeis pi WHERE pi.product_id = p.id AND (pi.imei1 LIKE @search OR pi.imei2 LIKE @search))
            )`);
            params.search = `%${search.trim()}%`;
        }

        const whereSql = whereClauses.join(' AND ');

        const totalRow = db.prepare(`SELECT COUNT(*) as total FROM products p WHERE ${whereSql}`).get(params);
        const products = db.prepare(`
            SELECT p.*, c.name_ar as category_name_ar, c.icon as category_icon,
                   (SELECT COUNT(*) FROM product_imeis pi WHERE pi.product_id = p.id AND pi.status = 'available') as available_imeis_count
            FROM products p
            LEFT JOIN categories c ON p.category_slug = c.slug
            WHERE ${whereSql}
            ORDER BY p.id DESC
            LIMIT @limit OFFSET @offset
        `).all({ ...params, limit, offset });

        return {
            items: products,
            total: totalRow.total,
            page,
            totalPages: Math.ceil(totalRow.total / limit)
        };
    });

    // 3. Get single product by ID (including IMEIs)
    ipcMain.handle('products:get-by-id', async (event, id) => {
        const db = getDb();
        const product = db.prepare(`
            SELECT p.*, c.name_ar as category_name_ar
            FROM products p
            LEFT JOIN categories c ON p.category_slug = c.slug
            WHERE p.id = ?
        `).get(id);

        if (!product) return null;

        const imeis = db.prepare('SELECT * FROM product_imeis WHERE product_id = ? ORDER BY id ASC').all(id);
        return { ...product, imeis };
    });

    // 4. Quick Scan / Barcode / IMEI Lookup (For POS and Scanner)
    ipcMain.handle('products:lookup-code', async (event, code) => {
        if (!code) return null;
        const cleanCode = String(code).trim();
        const db = getDb();

        // Check if matching IMEI first
        const imeiRecord = db.prepare(`
            SELECT pi.*, p.*, pi.id as imei_id
            FROM product_imeis pi
            JOIN products p ON pi.product_id = p.id
            WHERE (pi.imei1 = @code OR pi.imei2 = @code) AND pi.status = 'available'
            LIMIT 1
        `).get({ code: cleanCode });

        if (imeiRecord) {
            return {
                type: 'imei',
                product: imeiRecord,
                imei_id: imeiRecord.imei_id,
                imei1: imeiRecord.imei1,
                imei2: imeiRecord.imei2
            };
        }

        // Check barcode / SKU
        const product = db.prepare('SELECT * FROM products WHERE barcode = ? LIMIT 1').get(cleanCode);
        if (product) {
            return {
                type: 'barcode',
                product
            };
        }

        return null;
    });

    // 5. Create Product (with transaction & audit)
    ipcMain.handle('products:create', async (event, { data, employeeId = 1 }) => {
        const db = getDb();
        let createdProduct = null;

        const createTx = db.transaction(() => {
            const insertStmt = db.prepare(`
                INSERT INTO products (
                    category_slug, name, brand, model, barcode, storage_rom, ram, color,
                    device_condition, battery_health_percent, warranty_months, cost_price,
                    sell_price, current_stock, min_stock_alert, is_workshop_only,
                    images, is_telegram_synced, telegram_description
                ) VALUES (
                    @category_slug, @name, @brand, @model, @barcode, @storage_rom, @ram, @color,
                    @device_condition, @battery_health_percent, @warranty_months, @cost_price,
                    @sell_price, @current_stock, @min_stock_alert, @is_workshop_only,
                    @images, @is_telegram_synced, @telegram_description
                )
            `);

            // Generate SKU barcode if empty
            let barcode = data.barcode && data.barcode.trim() !== '' 
                ? data.barcode.trim() 
                : 'SKU-' + Date.now().toString().slice(-8);

            const result = insertStmt.run({
                category_slug: data.category_slug || 'phone',
                name: data.name,
                brand: data.brand || null,
                model: data.model || null,
                barcode,
                storage_rom: data.storage_rom || null,
                ram: data.ram || null,
                color: data.color || null,
                device_condition: data.device_condition || null,
                battery_health_percent: Number(data.battery_health_percent) || 100,
                warranty_months: Number(data.warranty_months) || 0,
                cost_price: Number(data.cost_price) || 0,
                sell_price: Number(data.sell_price) || 0,
                current_stock: Number(data.current_stock) || 1,
                min_stock_alert: Number(data.min_stock_alert) || 2,
                is_workshop_only: data.is_workshop_only ? 1 : 0,
                images: data.images ? JSON.stringify(data.images) : null,
                is_telegram_synced: data.is_telegram_synced ? 1 : 0,
                telegram_description: data.telegram_description || null
            });

            const productId = result.lastInsertRowid;

            // If phone and IMEIs provided
            if (data.category_slug === 'phone' && (data.imei1 || (data.imeis && data.imeis.length > 0))) {
                const insertImei = db.prepare(`
                    INSERT INTO product_imeis (product_id, imei1, imei2, serial_number, status)
                    VALUES (@product_id, @imei1, @imei2, @serial_number, 'available')
                `);

                if (data.imei1) {
                    insertImei.run({
                        product_id: productId,
                        imei1: data.imei1.trim(),
                        imei2: data.imei2 ? data.imei2.trim() : null,
                        serial_number: data.serial_number || null
                    });
                }

                if (Array.isArray(data.imeis)) {
                    for (const item of data.imeis) {
                        if (item.imei1 && item.imei1 !== data.imei1) {
                            insertImei.run({
                                product_id: productId,
                                imei1: item.imei1.trim(),
                                imei2: item.imei2 ? item.imei2.trim() : null,
                                serial_number: item.serial_number || null
                            });
                        }
                    }
                }
            }

            // Audit Log
            logAudit({
                employeeId,
                actionType: 'stock_adjusted',
                targetEntity: 'products',
                targetId: productId,
                oldValues: null,
                newValues: { name: data.name, stock: data.current_stock, sell_price: data.sell_price },
                notes: `إضافة منتج جديد: ${data.name}`
            });

            createdProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        });

        createTx();
        return { success: true, product: createdProduct };
    });

    // 6. Update Product (with audit if price or stock changes)
    ipcMain.handle('products:update', async (event, { id, data, employeeId = 1 }) => {
        const db = getDb();
        const oldProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!oldProduct) throw new Error('المنتج غير موجود');

        const updateTx = db.transaction(() => {
            const updateStmt = db.prepare(`
                UPDATE products SET
                    category_slug = @category_slug,
                    name = @name,
                    brand = @brand,
                    model = @model,
                    barcode = @barcode,
                    storage_rom = @storage_rom,
                    ram = @ram,
                    color = @color,
                    device_condition = @device_condition,
                    battery_health_percent = @battery_health_percent,
                    warranty_months = @warranty_months,
                    cost_price = @cost_price,
                    sell_price = @sell_price,
                    current_stock = @current_stock,
                    min_stock_alert = @min_stock_alert,
                    is_workshop_only = @is_workshop_only,
                    is_telegram_synced = @is_telegram_synced,
                    telegram_description = @telegram_description,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id
            `);

            updateStmt.run({
                id,
                category_slug: data.category_slug || oldProduct.category_slug,
                name: data.name || oldProduct.name,
                brand: data.brand !== undefined ? data.brand : oldProduct.brand,
                model: data.model !== undefined ? data.model : oldProduct.model,
                barcode: data.barcode || oldProduct.barcode,
                storage_rom: data.storage_rom !== undefined ? data.storage_rom : oldProduct.storage_rom,
                ram: data.ram !== undefined ? data.ram : oldProduct.ram,
                color: data.color !== undefined ? data.color : oldProduct.color,
                device_condition: data.device_condition !== undefined ? data.device_condition : oldProduct.device_condition,
                battery_health_percent: data.battery_health_percent !== undefined ? Number(data.battery_health_percent) : oldProduct.battery_health_percent,
                warranty_months: data.warranty_months !== undefined ? Number(data.warranty_months) : oldProduct.warranty_months,
                cost_price: data.cost_price !== undefined ? Number(data.cost_price) : oldProduct.cost_price,
                sell_price: data.sell_price !== undefined ? Number(data.sell_price) : oldProduct.sell_price,
                current_stock: data.current_stock !== undefined ? Number(data.current_stock) : oldProduct.current_stock,
                min_stock_alert: data.min_stock_alert !== undefined ? Number(data.min_stock_alert) : oldProduct.min_stock_alert,
                is_workshop_only: data.is_workshop_only !== undefined ? (data.is_workshop_only ? 1 : 0) : oldProduct.is_workshop_only,
                is_telegram_synced: data.is_telegram_synced !== undefined ? (data.is_telegram_synced ? 1 : 0) : oldProduct.is_telegram_synced,
                telegram_description: data.telegram_description !== undefined ? data.telegram_description : oldProduct.telegram_description
            });

            // Check if price changed -> mandatory audit log
            if (Number(data.sell_price) !== Number(oldProduct.sell_price)) {
                logAudit({
                    employeeId,
                    actionType: 'price_changed',
                    targetEntity: 'products',
                    targetId: id,
                    oldValues: { sell_price: oldProduct.sell_price },
                    newValues: { sell_price: data.sell_price },
                    notes: `تعديل سعر المنتج [${oldProduct.name}] من ${oldProduct.sell_price} إلى ${data.sell_price}`
                });
            }

            // Check if stock changed directly
            if (Number(data.current_stock) !== Number(oldProduct.current_stock)) {
                logAudit({
                    employeeId,
                    actionType: 'stock_adjusted',
                    targetEntity: 'products',
                    targetId: id,
                    oldValues: { current_stock: oldProduct.current_stock },
                    newValues: { current_stock: data.current_stock },
                    notes: `تعديل يدوي للمخزون [${oldProduct.name}] من ${oldProduct.current_stock} إلى ${data.current_stock}`
                });
            }
        });

        updateTx();
        return { success: true };
    });

    // 7. Delete Product (Mandatory Audit)
    ipcMain.handle('products:delete', async (event, { id, employeeId = 1 }) => {
        const db = getDb();
        const oldProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!oldProduct) throw new Error('المنتج غير موجود');

        const deleteTx = db.transaction(() => {
            db.prepare('DELETE FROM products WHERE id = ?').run(id);

            logAudit({
                employeeId,
                actionType: 'product_deleted',
                targetEntity: 'products',
                targetId: id,
                oldValues: oldProduct,
                newValues: null,
                notes: `حذف الصنف نهائياً: ${oldProduct.name} (${oldProduct.barcode})`
            });
        });

        deleteTx();
        return { success: true };
    });
}

module.exports = { registerProductsIpc };
