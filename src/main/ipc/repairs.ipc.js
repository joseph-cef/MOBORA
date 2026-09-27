// Repairs Workshop & Kanban IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');

function registerRepairsIpc(ipcMain) {
    // 1. Get Repairs Kanban Board Columns
    ipcMain.handle('repairs:list-kanban', async (event, { technicianId = 'all', issueCategory = 'all', urgentOnly = false, search = '' } = {}) => {
        const db = getDb();

        let whereClauses = ['1=1'];
        const params = {};

        if (technicianId && technicianId !== 'all') {
            whereClauses.push('r.technician_id = @technicianId');
            params.technicianId = technicianId;
        }

        if (issueCategory && issueCategory !== 'all') {
            whereClauses.push('r.issue_category = @issueCategory');
            params.issueCategory = issueCategory;
        }

        if (urgentOnly) {
            whereClauses.push("r.priority = 'urgent'");
        }

        if (search && search.trim() !== '') {
            whereClauses.push(`(
                r.ticket_number LIKE @search OR
                r.customer_name LIKE @search OR
                r.customer_phone LIKE @search OR
                r.device_model LIKE @search OR
                r.imei LIKE @search
            )`);
            params.search = `%${search.trim()}%`;
        }

        const whereSql = whereClauses.join(' AND ');

        const allRepairs = db.prepare(`
            SELECT r.*, e.name as technician_name,
                   (SELECT COUNT(*) FROM repair_parts rp WHERE rp.repair_id = r.id) as parts_count
            FROM repairs r
            LEFT JOIN employees e ON r.technician_id = e.id
            WHERE ${whereSql}
            ORDER BY r.priority = 'urgent' DESC, r.created_at DESC
        `).all(params);

        // Group into Kanban Columns
        const columns = {
            received: allRepairs.filter(r => r.status === 'received'),
            diagnosing: allRepairs.filter(r => r.status === 'diagnosing'),
            in_progress: allRepairs.filter(r => r.status === 'in_progress'),
            ready: allRepairs.filter(r => r.status === 'ready'),
            delivered: allRepairs.filter(r => r.status === 'delivered')
        };

        return {
            columns,
            counts: {
                received: columns.received.length,
                diagnosing: columns.diagnosing.length,
                in_progress: columns.in_progress.length,
                ready: columns.ready.length,
                delivered: columns.delivered.length,
                total: allRepairs.length
            }
        };
    });

    // 2. Get Single Repair Details + Attached Parts
    ipcMain.handle('repairs:get-by-id', async (event, identifier) => {
        const db = getDb();
        const isNumeric = !isNaN(identifier);

        const repair = db.prepare(`
            SELECT r.*, e.name as technician_name, e.phone as technician_phone
            FROM repairs r
            LEFT JOIN employees e ON r.technician_id = e.id
            WHERE ${isNumeric ? 'r.id = ?' : 'r.ticket_number = ?'}
        `).get(identifier);

        if (!repair) return null;

        const parts = db.prepare(`
            SELECT rp.*, p.name as part_name, p.barcode as part_code, p.current_stock as remaining_stock
            FROM repair_parts rp
            JOIN products p ON rp.product_id = p.id
            WHERE rp.repair_id = ?
        `).all(repair.id);

        return { ...repair, parts };
    });

    // 3. Create New Repair Intake Ticket
    ipcMain.handle('repairs:create', async (event, data) => {
        const db = getDb();

        // Generate Ticket Number: REP-XXXX
        const countRow = db.prepare('SELECT COUNT(*) as count FROM repairs').get();
        const ticketNumber = `REP-${2000 + countRow.count + 1}`;

        const insertStmt = db.prepare(`
            INSERT INTO repairs (
                ticket_number, customer_name, customer_phone, device_model, device_color,
                lock_code, imei, issue_category, issue_description, inspection_photos,
                status, priority, storage_slot, technician_id, labor_cost, total_price,
                profit, warranty_days
            ) VALUES (
                @ticket_number, @customer_name, @customer_phone, @device_model, @device_color,
                @lock_code, @imei, @issue_category, @issue_description, @inspection_photos,
                'received', @priority, @storage_slot, @technician_id, @labor_cost, @labor_cost,
                @labor_cost, @warranty_days
            )
        `);

        const laborCost = Number(data.labor_cost) || 0;

        const result = insertStmt.run({
            ticket_number: ticketNumber,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            device_model: data.device_model,
            device_color: data.device_color || null,
            lock_code: data.lock_code || null,
            imei: data.imei || null,
            issue_category: data.issue_category || 'other',
            issue_description: data.issue_description,
            inspection_photos: data.inspection_photos ? JSON.stringify(data.inspection_photos) : null,
            priority: data.priority || 'normal',
            storage_slot: data.storage_slot || 'صندوق الاستلام',
            technician_id: data.technician_id ? Number(data.technician_id) : null,
            labor_cost: laborCost,
            warranty_days: Number(data.warranty_days) || 30
        });

        const created = db.prepare('SELECT * FROM repairs WHERE id = ?').get(result.lastInsertRowid);
        return { success: true, ticket: created };
    });

    // 4. Update Status (Kanban Drag & Drop)
    ipcMain.handle('repairs:update-status', async (event, { id, status, storageSlot = null }) => {
        const db = getDb();
        const repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(id);
        if (!repair) throw new Error('أمر الصيانة غير موجود');

        let readyAt = repair.ready_at;
        let deliveredAt = repair.delivered_at;

        if (status === 'ready' && !readyAt) {
            readyAt = new Date().toISOString();
        } else if (status === 'delivered' && !deliveredAt) {
            deliveredAt = new Date().toISOString();
        }

        db.prepare(`
            UPDATE repairs 
            SET status = @status,
                storage_slot = COALESCE(@storageSlot, storage_slot),
                ready_at = @readyAt,
                delivered_at = @deliveredAt
            WHERE id = @id
        `).run({
            id,
            status,
            storageSlot,
            readyAt,
            deliveredAt
        });

        return { success: true };
    });

    // 5. Attach Spare Part from Inventory (Automatic Stock Deduction)
    ipcMain.handle('repairs:add-part', async (event, { repairId, productId, quantity = 1 }) => {
        const db = getDb();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        if (!product) throw new Error('القطعة غير موجودة في المخزن');

        if (product.current_stock < quantity) {
            throw new Error(`الكمية المطلوبة (${quantity}) غير متوفرة في المخزن. المتوفر حالياً: ${product.current_stock}`);
        }

        const attachTx = db.transaction(() => {
            // Deduct stock from inventory
            db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(quantity, productId);

            // Add to repair_parts
            db.prepare(`
                INSERT INTO repair_parts (repair_id, product_id, quantity, unit_cost, unit_price, is_deducted)
                VALUES (@repairId, @productId, @quantity, @unitCost, @unitPrice, 1)
            `).run({
                repairId,
                productId,
                quantity,
                unitCost: product.cost_price,
                unitPrice: product.sell_price
            });

            // Recalculate repair totals
            const totals = db.prepare(`
                SELECT 
                    COALESCE(SUM(unit_cost * quantity), 0) as spare_cost,
                    COALESCE(SUM(unit_price * quantity), 0) as spare_price
                FROM repair_parts 
                WHERE repair_id = ?
            `).get(repairId);

            const repair = db.prepare('SELECT labor_cost FROM repairs WHERE id = ?').get(repairId);
            const totalPrice = totals.spare_price + repair.labor_cost;
            const profit = totalPrice - totals.spare_cost;

            db.prepare(`
                UPDATE repairs 
                SET spare_parts_cost = @spareCost,
                    spare_parts_price = @sparePrice,
                    total_price = @totalPrice,
                    profit = @profit
                WHERE id = @repairId
            `).run({
                repairId,
                spareCost: totals.spare_cost,
                sparePrice: totals.spare_price,
                totalPrice,
                profit
            });
        });

        attachTx();
        return { success: true };
    });

    // 6. Remove Spare Part from Repair (Restores Inventory)
    ipcMain.handle('repairs:remove-part', async (event, partRecordId) => {
        const db = getDb();
        const partRecord = db.prepare('SELECT * FROM repair_parts WHERE id = ?').get(partRecordId);
        if (!partRecord) throw new Error('سجل القطعة غير موجود');

        const removeTx = db.transaction(() => {
            // Restore inventory
            db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(partRecord.quantity, partRecord.product_id);

            // Delete part from repair
            db.prepare('DELETE FROM repair_parts WHERE id = ?').run(partRecordId);

            // Recalculate repair totals
            const totals = db.prepare(`
                SELECT 
                    COALESCE(SUM(unit_cost * quantity), 0) as spare_cost,
                    COALESCE(SUM(unit_price * quantity), 0) as spare_price
                FROM repair_parts 
                WHERE repair_id = ?
            `).get(partRecord.repair_id);

            const repair = db.prepare('SELECT labor_cost FROM repairs WHERE id = ?').get(partRecord.repair_id);
            const totalPrice = totals.spare_price + repair.labor_cost;
            const profit = totalPrice - totals.spare_cost;

            db.prepare(`
                UPDATE repairs 
                SET spare_parts_cost = @spareCost,
                    spare_parts_price = @sparePrice,
                    total_price = @totalPrice,
                    profit = @profit
                WHERE id = @repairId
            `).run({
                repairId: partRecord.repair_id,
                spareCost: totals.spare_cost,
                sparePrice: totals.spare_price,
                totalPrice,
                profit
            });
        });

        removeTx();
        return { success: true };
    });

    // 7. Complete & Pay Repair (Generates Warranty Record)
    ipcMain.handle('repairs:complete-and-pay', async (event, { id, paymentMethod = 'cash' }) => {
        const db = getDb();
        const repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(id);
        if (!repair) throw new Error('أمر الصيانة غير موجود');

        const payTx = db.transaction(() => {
            db.prepare(`
                UPDATE repairs 
                SET status = 'delivered',
                    payment_status = 'paid',
                    payment_method = @paymentMethod,
                    delivered_at = CURRENT_TIMESTAMP
                WHERE id = @id
            `).run({ id, paymentMethod });

            // Generate warranty if device has IMEI and warranty_days > 0
            if (repair.imei && repair.warranty_days > 0) {
                const months = Math.ceil(repair.warranty_days / 30);
                db.prepare(`
                    INSERT INTO warranties (
                        imei, product_name, customer_name, customer_phone,
                        repair_id, start_date, end_date, duration_months, status, coverage_details
                    ) VALUES (
                        @imei, @product_name, @customer_name, @customer_phone,
                        @repair_id, date('now'), date('now', '+' || @days || ' days'),
                        @months, 'active', @coverage_details
                    )
                `).run({
                    imei: repair.imei,
                    product_name: `${repair.device_model} (صيانة: ${repair.issue_description})`,
                    customer_name: repair.customer_name,
                    customer_phone: repair.customer_phone,
                    repair_id: id,
                    days: repair.warranty_days,
                    months,
                    coverage_details: `ضمان صيانة الورشة لمدة ${repair.warranty_days} يوماً`
                });
            }

            // Audit
            logAudit({
                employeeId: repair.technician_id || 1,
                actionType: 'sale_created',
                targetEntity: 'repairs',
                targetId: repair.ticket_number,
                oldValues: { status: repair.status, payment: 'unpaid' },
                newValues: { status: 'delivered', payment: 'paid', amount: repair.total_price },
                notes: `تسليم وقبض أمر الصيانة ${repair.ticket_number} بمبلغ ${repair.total_price} د.ج (${paymentMethod})`
            });
        });

        payTx();
        return { success: true };
    });
}

module.exports = { registerRepairsIpc };
