// Warranty & IMEI Checker IPC Handlers
const { getDb } = require('../db');

function registerWarrantyIpc(ipcMain) {
    // 1. Search Warranty & Full Device Dossier by IMEI or Serial Number
    ipcMain.handle('warranty:check-imei', async (event, query) => {
        if (!query || query.trim() === '') return null;
        const cleanQuery = query.trim();
        const db = getDb();

        // 1. Search in warranties table
        const warranty = db.prepare(`
            SELECT w.*,
                   s.invoice_number, s.customer_name as sale_customer, s.customer_phone as sale_phone,
                   s.total_amount as sale_amount, s.payment_method as sale_payment_method, s.created_at as sale_date,
                   e.name as cashier_name
            FROM warranties w
            LEFT JOIN sales s ON w.sale_id = s.id
            LEFT JOIN employees e ON s.cashier_id = e.id
            WHERE w.imei = @query OR w.serial_number = @query
            ORDER BY w.id DESC
            LIMIT 1
        `).get({ query: cleanQuery });

        // 2. Also look up in product_imeis & products
        const imeiRecord = db.prepare(`
            SELECT pi.*, p.name as product_name, p.brand, p.model, p.storage_rom, p.ram, p.color,
                   p.device_condition, p.battery_health_percent, p.warranty_months, p.sell_price
            FROM product_imeis pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.imei1 = @query OR pi.imei2 = @query OR pi.serial_number = @query
            LIMIT 1
        `).get({ query: cleanQuery });

        if (!warranty && !imeiRecord) {
            return null;
        }

        // Calculate days elapsed and progress percentage
        let daysTotal = 365;
        let daysElapsed = 0;
        let daysRemaining = 0;
        let percentElapsed = 0;
        let isExpired = false;

        const startDate = warranty ? new Date(warranty.start_date) : (imeiRecord ? new Date(imeiRecord.created_at) : new Date());
        const endDate = warranty 
            ? new Date(warranty.end_date) 
            : new Date(startDate.getTime() + (imeiRecord && imeiRecord.warranty_months ? imeiRecord.warranty_months : 12) * 30 * 24 * 3600 * 1000);
        
        const now = new Date();
        const totalMs = endDate.getTime() - startDate.getTime();
        const elapsedMs = now.getTime() - startDate.getTime();

        if (totalMs > 0) {
            daysTotal = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)));
            daysElapsed = Math.min(daysTotal, Math.max(0, Math.round(elapsedMs / (1000 * 60 * 60 * 24))));
            daysRemaining = Math.max(0, daysTotal - daysElapsed);
            percentElapsed = Math.min(100, Math.max(0, Math.round((daysElapsed / daysTotal) * 100)));
            isExpired = now > endDate;
        }

        return {
            found: true,
            warranty: warranty || null,
            device: imeiRecord || {
                product_name: warranty.product_name,
                imei1: warranty.imei,
                serial_number: warranty.serial_number
            },
            metrics: {
                daysTotal,
                daysElapsed,
                daysRemaining,
                percentElapsed,
                isExpired,
                status: isExpired ? 'expired' : (warranty ? warranty.status : 'active')
            }
        };
    });

    // 2. List All Active Warranties
    ipcMain.handle('warranty:list', async (event, { page = 1, limit = 50, status = 'all' } = {}) => {
        const db = getDb();
        const offset = (page - 1) * limit;

        let whereSql = '1=1';
        if (status !== 'all') {
            whereSql = 'status = @status';
        }

        const total = db.prepare(`SELECT COUNT(*) as count FROM warranties WHERE ${whereSql}`).get({ status }).count;
        const items = db.prepare(`
            SELECT * FROM warranties
            WHERE ${whereSql}
            ORDER BY id DESC
            LIMIT @limit OFFSET @offset
        `).all({ status, limit, offset });

        return { items, total, page, totalPages: Math.ceil(total / limit) };
    });
}

module.exports = { registerWarrantyIpc };
