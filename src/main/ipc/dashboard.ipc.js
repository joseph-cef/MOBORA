// Dashboard IPC Handlers
const { getDb } = require('../db');

function registerDashboardIpc(ipcMain) {
    ipcMain.handle('dashboard:get-metrics', async () => {
        const db = getDb();

        // 1. Daily sales total, profit, order count
        const todaySales = db.prepare(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(SUM(profit), 0) as total_profit,
                COUNT(id) as total_orders
            FROM sales 
            WHERE date(created_at) = date('now')
        `).get();

        // 2. Total Stock Valuation and stats
        const stockStats = db.prepare(`
            SELECT 
                COALESCE(SUM(sell_price * current_stock), 0) as valuation,
                COUNT(id) as total_items,
                COALESCE(SUM(current_stock), 0) as total_units
            FROM products
        `).get();

        // Count phones with registered IMEI available
        const activePhones = db.prepare(`
            SELECT COUNT(id) as count FROM product_imeis WHERE status = 'available'
        `).get().count;

        // 3. Low stock alerts
        const lowStock = db.prepare(`
            SELECT COUNT(id) as count 
            FROM products 
            WHERE current_stock <= min_stock_alert
        `).get().count;

        // Out of stock
        const outOfStock = db.prepare(`
            SELECT COUNT(id) as count 
            FROM products 
            WHERE current_stock = 0
        `).get().count;

        // 4. Repairs in workshop
        const repairCounts = db.prepare(`
            SELECT 
                COUNT(CASE WHEN status = 'received' THEN 1 END) as received,
                COUNT(CASE WHEN status = 'diagnosing' THEN 1 END) as diagnosing,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready,
                COUNT(CASE WHEN status = 'delivered' AND date(delivered_at) = date('now') THEN 1 END) as delivered_today,
                COUNT(CASE WHEN status IN ('received', 'diagnosing', 'in_progress') THEN 1 END) as total_active
            FROM repairs
        `).get();

        // 5. Telegram live synced posts count
        const telegramStats = db.prepare(`
            SELECT 
                COUNT(CASE WHEN status = 'posted' THEN 1 END) as live_posts,
                COUNT(CASE WHEN status = 'sold_out' THEN 1 END) as sold_out_posts
            FROM telegram_posts
        `).get();

        // 6. Cash liquidity breakdown
        const cashDrawerSales = db.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) as amount 
            FROM sales WHERE payment_method = 'cash'
        `).get().amount;
        const cashDrawerRepairs = db.prepare(`
            SELECT COALESCE(SUM(total_price), 0) as amount 
            FROM repairs WHERE payment_status = 'paid' AND payment_method = 'cash'
        `).get().amount;
        const cashDrawerExpenses = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as amount 
            FROM expenses WHERE payment_method = 'cash'
        `).get().amount;
        const initialCash = 100000; // Baseline float
        const currentCashDrawer = initialCash + cashDrawerSales + cashDrawerRepairs - cashDrawerExpenses;

        const baridimobSales = db.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) as amount 
            FROM sales WHERE payment_method = 'baridimob'
        `).get().amount;
        const baridimobRepairs = db.prepare(`
            SELECT COALESCE(SUM(total_price), 0) as amount 
            FROM repairs WHERE payment_status = 'paid' AND payment_method = 'baridimob'
        `).get().amount;
        const baridimobExpenses = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as amount 
            FROM expenses WHERE payment_method = 'baridimob'
        `).get().amount;
        const currentBaridiMob = 500000 + baridimobSales + baridimobRepairs - baridimobExpenses;

        const bankSales = db.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) as amount 
            FROM sales WHERE payment_method = 'bank'
        `).get().amount;
        const currentBank = 1800000 + bankSales;

        // 7. Recent 5 Sales
        const recentSales = db.prepare(`
            SELECT s.*, e.name as cashier_name
            FROM sales s
            LEFT JOIN employees e ON s.cashier_id = e.id
            ORDER BY s.created_at DESC
            LIMIT 5
        `).all();

        // 8. Recent 5 Repairs
        const recentRepairs = db.prepare(`
            SELECT r.*, e.name as technician_name
            FROM repairs r
            LEFT JOIN employees e ON r.technician_id = e.id
            ORDER BY r.created_at DESC
            LIMIT 5
        `).all();

        // 9. 7-Day Sales Trend
        const last7Days = db.prepare(`
            SELECT 
                date(created_at) as sale_date,
                COALESCE(SUM(total_amount), 0) as daily_total,
                COALESCE(SUM(profit), 0) as daily_profit,
                COUNT(id) as count
            FROM sales
            WHERE created_at >= date('now', '-7 days')
            GROUP BY date(created_at)
            ORDER BY sale_date ASC
        `).all();

        return {
            success: true,
            data: {
                today: {
                    revenue: todaySales.total_revenue,
                    profit: todaySales.total_profit,
                    orders: todaySales.total_orders,
                    margin_percent: todaySales.total_revenue > 0 
                        ? ((todaySales.total_profit / todaySales.total_revenue) * 100).toFixed(1) 
                        : '0.0'
                },
                stock: {
                    valuation: stockStats.valuation,
                    total_items: stockStats.total_items,
                    total_units: stockStats.total_units,
                    active_phones: activePhones,
                    low_stock_count: lowStock,
                    out_of_stock_count: outOfStock
                },
                repairs: {
                    active: repairCounts.total_active,
                    received: repairCounts.received,
                    diagnosing: repairCounts.diagnosing,
                    in_progress: repairCounts.in_progress,
                    ready: repairCounts.ready,
                    delivered_today: repairCounts.delivered_today
                },
                telegram: {
                    live_posts: telegramStats.live_posts,
                    sold_out_posts: telegramStats.sold_out_posts
                },
                liquidity: {
                    cash_drawer: currentCashDrawer,
                    baridimob: currentBaridiMob,
                    bank: currentBank
                },
                recentSales,
                recentRepairs,
                trend7Days: last7Days
            }
        };
    });
}

module.exports = { registerDashboardIpc };
