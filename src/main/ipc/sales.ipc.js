// POS & Sales IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');
const { syncSoldOutOnTelegram } = require('../services/telegram.service');

function registerSalesIpc(ipcMain) {
    // 1. Create Sale (POS Checkout)
    ipcMain.handle('sales:create', async (event, { items, customerName, customerPhone, discount = 0, paymentMethod = 'cash', cashierId = 1, notes = '' }) => {
        if (!items || items.length === 0) {
            throw new Error('السلة فارغة. يرجى إضافة منتج واحد على الأقل.');
        }

        const db = getDb();
        let saleResult = null;

        const saleTx = db.transaction(() => {
            // 1. Calculate totals
            let subtotal = 0;
            let costTotal = 0;

            const preparedItems = [];
            for (const item of items) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                if (!product) throw new Error(`المنتج رقم ${item.product_id} غير موجود`);

                if (product.current_stock < item.quantity) {
                    throw new Error(`الكمية المطلوبة (${item.quantity}) غير متوفرة في المخزن للمنتج "${product.name}" (المتوفر: ${product.current_stock})`);
                }

                const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : product.sell_price;
                const unitCost = product.cost_price;
                const itemSubtotal = unitPrice * item.quantity;
                const itemCostTotal = unitCost * item.quantity;

                subtotal += itemSubtotal;
                costTotal += itemCostTotal;

                preparedItems.push({
                    product,
                    product_id: product.id,
                    imei_id: item.imei_id || null,
                    quantity: item.quantity,
                    unit_price: unitPrice,
                    unit_cost: unitCost,
                    subtotal: itemSubtotal,
                    warranty_months: product.warranty_months || 0
                });
            }

            const cleanDiscount = Math.max(0, Number(discount) || 0);
            const totalAmount = Math.max(0, subtotal - cleanDiscount);
            const profit = totalAmount - costTotal;

            // Generate Invoice Number: INV-YYYYMMDD-XXXX
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const countRow = db.prepare("SELECT COUNT(*) as count FROM sales WHERE date(created_at) = date('now')").get();
            const seq = String(countRow.count + 1).padStart(4, '0');
            const invoiceNumber = `INV-${todayStr}-${seq}`;

            // Insert into sales
            const insertSaleStmt = db.prepare(`
                INSERT INTO sales (
                    invoice_number, cashier_id, customer_name, customer_phone,
                    subtotal, discount, total_amount, cost_total, profit,
                    payment_method, payment_status, notes
                ) VALUES (
                    @invoice_number, @cashier_id, @customer_name, @customer_phone,
                    @subtotal, @discount, @total_amount, @cost_total, @profit,
                    @payment_method, 'paid', @notes
                )
            `);

            const saleRes = insertSaleStmt.run({
                invoice_number: invoiceNumber,
                cashier_id: cashierId,
                customer_name: customerName || 'عميل عام / زبون المتجر',
                customer_phone: customerPhone || null,
                subtotal,
                discount: cleanDiscount,
                total_amount: totalAmount,
                cost_total: costTotal,
                profit,
                payment_method: paymentMethod,
                notes
            });

            const saleId = saleRes.lastInsertRowid;

            // Insert items, deduct inventory, and track IMEIs & Warranties
            const insertItemStmt = db.prepare(`
                INSERT INTO sale_items (
                    sale_id, product_id, imei_id, quantity, unit_cost, unit_price, subtotal, warranty_months
                ) VALUES (
                    @sale_id, @product_id, @imei_id, @quantity, @unit_cost, @unit_price, @subtotal, @warranty_months
                )
            `);

            const deductStockStmt = db.prepare(`
                UPDATE products 
                SET current_stock = current_stock - @quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @product_id
            `);

            const markImeiSoldStmt = db.prepare(`
                UPDATE product_imeis 
                SET status = 'sold', sold_at = CURRENT_TIMESTAMP 
                WHERE id = @imei_id
            `);

            const insertWarrantyStmt = db.prepare(`
                INSERT INTO warranties (
                    imei, serial_number, product_name, customer_name, customer_phone,
                    sale_id, start_date, end_date, duration_months, status, coverage_details
                ) VALUES (
                    @imei, @serial_number, @product_name, @customer_name, @customer_phone,
                    @sale_id, date('now'), date('now', '+' || @months || ' months'),
                    @months, 'active', @coverage_details
                )
            `);

            for (const pi of preparedItems) {
                insertItemStmt.run({
                    sale_id: saleId,
                    product_id: pi.product_id,
                    imei_id: pi.imei_id,
                    quantity: pi.quantity,
                    unit_cost: pi.unit_cost,
                    unit_price: pi.unit_price,
                    subtotal: pi.subtotal,
                    warranty_months: pi.warranty_months
                });

                // Deduct stock
                deductStockStmt.run({
                    quantity: pi.quantity,
                    product_id: pi.product_id
                });

                // If specific IMEI sold
                if (pi.imei_id) {
                    markImeiSoldStmt.run({ imei_id: pi.imei_id });

                    const imeiRecord = db.prepare('SELECT * FROM product_imeis WHERE id = ?').get(pi.imei_id);
                    if (imeiRecord && pi.warranty_months > 0) {
                        insertWarrantyStmt.run({
                            imei: imeiRecord.imei1,
                            serial_number: imeiRecord.serial_number,
                            product_name: pi.product.name,
                            customer_name: customerName || 'عميل المتجر',
                            customer_phone: customerPhone || null,
                            sale_id: saleId,
                            months: pi.warranty_months,
                            coverage_details: 'ضمان قطع الغيار والعطل الفني المصنعي'
                        });
                    }
                }

                // Check if remaining stock reached 0 -> mark telegram post as sold out
                const updatedProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(pi.product_id);
                if (updatedProduct && updatedProduct.current_stock === 0) {
                    db.prepare(`
                        UPDATE telegram_posts 
                        SET status = 'sold_out', sold_out_at = CURRENT_TIMESTAMP
                        WHERE product_id = ? AND status = 'posted'
                    `).run(pi.product_id);
                }
            }

            // Audit log for sale
            logAudit({
                employeeId: cashierId,
                actionType: 'sale_created',
                targetEntity: 'sales',
                targetId: invoiceNumber,
                oldValues: null,
                newValues: { total_amount: totalAmount, items_count: preparedItems.length, payment_method: paymentMethod },
                notes: `إتمام عملية بيع برقم فاتورة: ${invoiceNumber} بمبلغ ${totalAmount} د.ج`
            });

            // Fetch created sale with details for receipt
            saleResult = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
            saleResult.items = db.prepare(`
                SELECT si.*, p.name as product_name, p.barcode, pi.imei1, pi.imei2
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                LEFT JOIN product_imeis pi ON si.imei_id = pi.id
                WHERE si.sale_id = ?
            `).all(saleId);
        });

        saleTx();

        // Phase 4: Async sync sold-out status to Telegram channels
        if (saleResult && saleResult.items) {
            for (const item of saleResult.items) {
                try {
                    const currentProd = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product_id);
                    if (currentProd && currentProd.current_stock <= 0) {
                        syncSoldOutOnTelegram(item.product_id).catch(err => {
                            console.warn('[Telegram Sold-Out Sync POS Warning]', err.message);
                        });
                    }
                } catch (e) {
                    // Non-blocking
                }
            }
        }

        return { success: true, sale: saleResult };
    });

    // 2. List Sales
    ipcMain.handle('sales:list', async (event, { page = 1, limit = 50, dateFrom, dateTo, search } = {}) => {
        const db = getDb();
        const offset = (page - 1) * limit;

        let whereClauses = ['1=1'];
        const params = {};

        if (dateFrom) {
            whereClauses.push("date(s.created_at) >= date(@dateFrom)");
            params.dateFrom = dateFrom;
        }
        if (dateTo) {
            whereClauses.push("date(s.created_at) <= date(@dateTo)");
            params.dateTo = dateTo;
        }
        if (search) {
            whereClauses.push("(s.invoice_number LIKE @search OR s.customer_name LIKE @search OR s.customer_phone LIKE @search)");
            params.search = `%${search.trim()}%`;
        }

        const whereSql = whereClauses.join(' AND ');

        const totalRow = db.prepare(`SELECT COUNT(*) as total FROM sales s WHERE ${whereSql}`).get(params);
        const sales = db.prepare(`
            SELECT s.*, e.name as cashier_name,
                   (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
            FROM sales s
            LEFT JOIN employees e ON s.cashier_id = e.id
            WHERE ${whereSql}
            ORDER BY s.created_at DESC
            LIMIT @limit OFFSET @offset
        `).all({ ...params, limit, offset });

        return {
            items: sales,
            total: totalRow.total,
            page,
            totalPages: Math.ceil(totalRow.total / limit)
        };
    });

    // 3. Get Sale Details by ID or Invoice Number
    ipcMain.handle('sales:get-by-invoice', async (event, invoiceNumber) => {
        const db = getDb();
        const sale = db.prepare(`
            SELECT s.*, e.name as cashier_name
            FROM sales s
            LEFT JOIN employees e ON s.cashier_id = e.id
            WHERE s.invoice_number = ?
        `).get(invoiceNumber);

        if (!sale) return null;

        const items = db.prepare(`
            SELECT si.*, p.name as product_name, p.barcode, pi.imei1, pi.imei2
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            LEFT JOIN product_imeis pi ON si.imei_id = pi.id
            WHERE si.sale_id = ?
        `).all(sale.id);

        return { ...sale, items };
    });

    // 4. Void Sale (Requires Supervisor PIN & Restores Inventory & Audit)
    ipcMain.handle('sales:void', async (event, { invoiceNumber, supervisorPin, reason = 'إلغاء الفاتورة من المشرف' }) => {
        const db = getDb();

        // Verify supervisor PIN
        const supervisor = db.prepare("SELECT * FROM employees WHERE pin_code = ? AND role IN ('owner', 'supervisor') AND is_active = 1").get(supervisorPin);
        if (!supervisor) {
            const fallbackPin = db.prepare("SELECT value FROM system_settings WHERE key = 'cashier_supervisor_pin'").get();
            if (!fallbackPin || fallbackPin.value !== supervisorPin) {
                throw new Error('رمز PIN للمشرف غير صحيح أو ليس لديك صلاحية إلغاء الفواتير.');
            }
        }

        const sale = db.prepare('SELECT * FROM sales WHERE invoice_number = ?').get(invoiceNumber);
        if (!sale) throw new Error('الفاتورة غير موجودة');
        if (sale.payment_status === 'voided') throw new Error('هذه الفاتورة ملغاة مسبقاً');

        const voidTx = db.transaction(() => {
            // Restore inventory
            const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
            for (const item of items) {
                db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(item.quantity, item.product_id);
                if (item.imei_id) {
                    db.prepare("UPDATE product_imeis SET status = 'available', sold_at = NULL WHERE id = ?").run(item.imei_id);
                }
            }

            // Void warranties attached
            db.prepare("UPDATE warranties SET status = 'voided' WHERE sale_id = ?").run(sale.id);

            // Mark sale voided
            db.prepare("UPDATE sales SET payment_status = 'voided', notes = coalesce(notes, '') || ' [ملغاة: ' || ? || ']' WHERE id = ?").run(reason, sale.id);

            // Audit Log
            logAudit({
                employeeId: supervisor ? supervisor.id : 1,
                actionType: 'sale_voided',
                targetEntity: 'sales',
                targetId: invoiceNumber,
                oldValues: { total: sale.total_amount, status: 'paid' },
                newValues: { status: 'voided' },
                notes: `إلغاء فاتورة البيع ${invoiceNumber}، السبب: ${reason}`
            });
        });

        voidTx();
        return { success: true };
    });
}

module.exports = { registerSalesIpc };
