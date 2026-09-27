// Suppliers & Purchases IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');

function registerSuppliersIpc(ipcMain) {
    // 1. List Suppliers
    ipcMain.handle('suppliers:list', async (event, { search = '' } = {}) => {
        const db = getDb();
        if (search && search.trim() !== '') {
            return db.prepare(`
                SELECT s.*,
                       (SELECT COUNT(*) FROM supplier_purchases sp WHERE sp.supplier_id = s.id) as purchases_count
                FROM suppliers s
                WHERE s.company_name LIKE @search OR s.contact_person LIKE @search OR s.phone LIKE @search OR s.code LIKE @search
                ORDER BY s.current_debt DESC
            `).all({ search: `%${search.trim()}%` });
        }

        return db.prepare(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM supplier_purchases sp WHERE sp.supplier_id = s.id) as purchases_count
            FROM suppliers s
            ORDER BY s.current_debt DESC
        `).all();
    });

    // 2. Get Single Supplier with Full Ledger (Purchases & Payments)
    ipcMain.handle('suppliers:get-by-id', async (event, id) => {
        const db = getDb();
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
        if (!supplier) return null;

        const purchases = db.prepare(`
            SELECT sp.*,
                   (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = sp.id) as items_count
            FROM supplier_purchases sp
            WHERE sp.supplier_id = ?
            ORDER BY sp.invoice_date DESC, sp.created_at DESC
        `).all(id);

        const payments = db.prepare(`
            SELECT * FROM supplier_payments
            WHERE supplier_id = ?
            ORDER BY payment_date DESC
        `).all(id);

        return { ...supplier, purchases, payments };
    });

    // 3. Create Supplier
    ipcMain.handle('suppliers:create', async (event, data) => {
        const db = getDb();

        // Generate supplier code if not given: SUP-XXX
        let code = data.code;
        if (!code || code.trim() === '') {
            const count = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
            code = `SUP-${String(count + 1).padStart(3, '0')}`;
        }

        const stmt = db.prepare(`
            INSERT INTO suppliers (
                code, company_name, contact_person, phone, whatsapp, address, supply_type,
                total_purchases, current_debt, notes
            ) VALUES (
                @code, @company_name, @contact_person, @phone, @whatsapp, @address, @supply_type,
                @total_purchases, @current_debt, @notes
            )
        `);

        const result = stmt.run({
            code,
            company_name: data.company_name,
            contact_person: data.contact_person || null,
            phone: data.phone,
            whatsapp: data.whatsapp || null,
            address: data.address || null,
            supply_type: data.supply_type || 'توريد عام',
            total_purchases: Number(data.total_purchases) || 0,
            current_debt: Number(data.current_debt) || 0,
            notes: data.notes || null
        });

        const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
        return { success: true, supplier: created };
    });

    // 4. Update Supplier
    ipcMain.handle('suppliers:update', async (event, { id, data }) => {
        const db = getDb();
        db.prepare(`
            UPDATE suppliers SET
                company_name = @company_name,
                contact_person = @contact_person,
                phone = @phone,
                whatsapp = @whatsapp,
                address = @address,
                supply_type = @supply_type,
                notes = @notes
            WHERE id = @id
        `).run({
            id,
            company_name: data.company_name,
            contact_person: data.contact_person,
            phone: data.phone,
            whatsapp: data.whatsapp,
            address: data.address,
            supply_type: data.supply_type,
            notes: data.notes
        });

        return { success: true };
    });

    // 5. Record Purchase Invoice (Adds to stock & tracks debt)
    ipcMain.handle('suppliers:record-purchase', async (event, { supplierId, invoiceNumber, invoiceDate, items, totalAmount, paidAmount = 0, invoiceImage = null, notes = '' }) => {
        const db = getDb();
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
        if (!supplier) throw new Error('المورد غير موجود');

        const cleanTotal = Number(totalAmount) || 0;
        const cleanPaid = Number(paidAmount) || 0;
        const debtIncrease = Math.max(0, cleanTotal - cleanPaid);

        let finalInvoiceNumber = invoiceNumber;
        if (!finalInvoiceNumber || finalInvoiceNumber.trim() === '') {
            const count = db.prepare('SELECT COUNT(*) as count FROM supplier_purchases').get().count;
            finalInvoiceNumber = `PINV-${String(count + 1).padStart(4, '0')}`;
        }

        const purchaseTx = db.transaction(() => {
            // 1. Insert Purchase
            const pRes = db.prepare(`
                INSERT INTO supplier_purchases (
                    invoice_number, supplier_id, total_amount, paid_amount, remaining_debt,
                    invoice_date, invoice_image, notes
                ) VALUES (
                    @invoice_number, @supplier_id, @total_amount, @paid_amount, @remaining_debt,
                    @invoice_date, @invoice_image, @notes
                )
            `).run({
                invoice_number: finalInvoiceNumber,
                supplier_id: supplierId,
                total_amount: cleanTotal,
                paid_amount: cleanPaid,
                remaining_debt: debtIncrease,
                invoice_date: invoiceDate || new Date().toISOString().slice(0, 10),
                invoice_image: invoiceImage,
                notes
            });

            const purchaseId = pRes.lastInsertRowid;

            // 2. Insert Items & Increment Stock
            if (Array.isArray(items)) {
                const insertItem = db.prepare(`
                    INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal)
                    VALUES (@purchase_id, @product_id, @quantity, @unit_cost, @subtotal)
                `);
                const updateStock = db.prepare(`
                    UPDATE products 
                    SET current_stock = current_stock + @quantity,
                        cost_price = @unit_cost,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @product_id
                `);

                for (const item of items) {
                    const sub = Number(item.quantity) * Number(item.unit_cost);
                    insertItem.run({
                        purchase_id: purchaseId,
                        product_id: item.product_id,
                        quantity: Number(item.quantity),
                        unit_cost: Number(item.unit_cost),
                        subtotal: sub
                    });

                    updateStock.run({
                        quantity: Number(item.quantity),
                        unit_cost: Number(item.unit_cost),
                        product_id: item.product_id
                    });
                }
            }

            // 3. Update Supplier Totals & Debt
            db.prepare(`
                UPDATE suppliers 
                SET total_purchases = total_purchases + @totalAmount,
                    current_debt = current_debt + @debtIncrease
                WHERE id = @supplierId
            `).run({ totalAmount: cleanTotal, debtIncrease, supplierId });

            // 4. If paid amount > 0, log in supplier_payments
            if (cleanPaid > 0) {
                db.prepare(`
                    INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_method, notes)
                    VALUES (@supplierId, @purchaseId, @amount, 'cash', 'دفعة فورية مع الفاتورة')
                `).run({ supplierId, purchaseId, amount: cleanPaid });
            }

            // Audit
            logAudit({
                employeeId: 1,
                actionType: 'stock_adjusted',
                targetEntity: 'supplier_purchases',
                targetId: finalInvoiceNumber,
                oldValues: null,
                newValues: { total: cleanTotal, paid: cleanPaid, debt: debtIncrease },
                notes: `تسجيل فاتورة شراء من المورد [${supplier.company_name}] برقم ${finalInvoiceNumber}`
            });
        });

        purchaseTx();
        return { success: true, invoiceNumber: finalInvoiceNumber };
    });

    // 6. Record Debt Payment to Supplier
    ipcMain.handle('suppliers:record-payment', async (event, { supplierId, amount, paymentMethod = 'cash', notes = '' }) => {
        const cleanAmount = Number(amount);
        if (!cleanAmount || cleanAmount <= 0) throw new Error('يرجى تحديد مبلغ صالح');

        const db = getDb();
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
        if (!supplier) throw new Error('المورد غير موجود');

        const payTx = db.transaction(() => {
            db.prepare(`
                INSERT INTO supplier_payments (supplier_id, amount, payment_method, notes)
                VALUES (@supplierId, @amount, @paymentMethod, @notes)
            `).run({
                supplierId,
                amount: cleanAmount,
                paymentMethod,
                notes: notes || 'تسديد دفعة حساب'
            });

            db.prepare(`
                UPDATE suppliers 
                SET current_debt = MAX(0, current_debt - @amount)
                WHERE id = @supplierId
            `).run({ amount: cleanAmount, supplierId });

            logAudit({
                employeeId: 1,
                actionType: 'expense_added',
                targetEntity: 'supplier_payments',
                targetId: supplierId,
                oldValues: { debt: supplier.current_debt },
                newValues: { debt: Math.max(0, supplier.current_debt - cleanAmount), paid: cleanAmount },
                notes: `تسديد دفعة للمورد [${supplier.company_name}] بمبلغ ${cleanAmount} د.ج`
            });
        });

        payTx();
        return { success: true };
    });
}

module.exports = { registerSuppliersIpc };
