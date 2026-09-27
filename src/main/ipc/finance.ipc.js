// Finance & Reports IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');

function registerFinanceIpc(ipcMain) {
    // 1. Get Financial Overview & Profit Statements
    ipcMain.handle('finance:get-summary', async (event, { period = 'month', dateFrom, dateTo } = {}) => {
        const db = getDb();

        let dateCondition = "date(created_at) >= date('now', 'start of month')";
        let expenseDateCondition = "date(expense_date) >= date('now', 'start of month')";

        if (period === 'today') {
            dateCondition = "date(created_at) = date('now')";
            expenseDateCondition = "date(expense_date) = date('now')";
        } else if (period === 'year') {
            dateCondition = "date(created_at) >= date('now', 'start of year')";
            expenseDateCondition = "date(expense_date) >= date('now', 'start of year')";
        } else if (dateFrom && dateTo) {
            dateCondition = `date(created_at) BETWEEN date('${dateFrom}') AND date('${dateTo}')`;
            expenseDateCondition = `date(expense_date) BETWEEN date('${dateFrom}') AND date('${dateTo}')`;
        }

        // Sales Revenue & Cost
        const salesRow = db.prepare(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as sales_revenue,
                COALESCE(SUM(cost_total), 0) as sales_cost,
                COALESCE(SUM(profit), 0) as sales_profit,
                COUNT(id) as sales_count
            FROM sales 
            WHERE ${dateCondition} AND payment_status != 'voided'
        `).get();

        // Repairs Revenue & Profit
        const repairsRow = db.prepare(`
            SELECT 
                COALESCE(SUM(total_price), 0) as repairs_revenue,
                COALESCE(SUM(spare_parts_cost), 0) as repairs_cost,
                COALESCE(SUM(profit), 0) as repairs_profit,
                COUNT(id) as repairs_count
            FROM repairs
            WHERE ${dateCondition} AND payment_status = 'paid'
        `).get();

        // Expenses
        const expensesRow = db.prepare(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_expenses,
                COUNT(id) as expenses_count
            FROM expenses
            WHERE ${expenseDateCondition}
        `).get();

        // Consolidated Math
        const totalRevenue = salesRow.sales_revenue + repairsRow.repairs_revenue;
        const totalCostOfGoods = salesRow.sales_cost + repairsRow.repairs_cost;
        const grossProfit = totalRevenue - totalCostOfGoods;
        const totalExpenses = expensesRow.total_expenses;
        const netProfit = grossProfit - totalExpenses;
        const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

        // Liquidity Current Balances
        const cashSales = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE payment_method = 'cash' AND payment_status != 'voided'").get().s;
        const cashRepairs = db.prepare("SELECT COALESCE(SUM(total_price), 0) as s FROM repairs WHERE payment_method = 'cash' AND payment_status = 'paid'").get().s;
        const cashExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE payment_method = 'cash'").get().s;
        const cashDrawer = 100000 + cashSales + cashRepairs - cashExpenses;

        const bmSales = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE payment_method = 'baridimob' AND payment_status != 'voided'").get().s;
        const bmRepairs = db.prepare("SELECT COALESCE(SUM(total_price), 0) as s FROM repairs WHERE payment_method = 'baridimob' AND payment_status = 'paid'").get().s;
        const bmExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE payment_method = 'baridimob'").get().s;
        const baridimob = 500000 + bmSales + bmRepairs - bmExpenses;

        const bnaSales = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE payment_method = 'bank' AND payment_status != 'voided'").get().s;
        const bna = 1800000 + bnaSales;

        // 6-Month Comparison Data
        const monthlyStats = db.prepare(`
            WITH RECURSIVE months(m) AS (
                SELECT date('now', 'start of month', '-5 months')
                UNION ALL
                SELECT date(m, '+1 month') FROM months WHERE m < date('now', 'start of month')
            )
            SELECT 
                strftime('%Y-%m', m) as month_key,
                strftime('%m', m) as month_num,
                COALESCE((
                    SELECT SUM(total_amount) FROM sales 
                    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', m) AND payment_status != 'voided'
                ), 0) as revenue,
                COALESCE((
                    SELECT SUM(cost_total) FROM sales 
                    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', m) AND payment_status != 'voided'
                ), 0) + COALESCE((
                    SELECT SUM(amount) FROM expenses 
                    WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', m)
                ), 0) as costs,
                COALESCE((
                    SELECT SUM(profit) FROM sales 
                    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', m) AND payment_status != 'voided'
                ), 0) - COALESCE((
                    SELECT SUM(amount) FROM expenses 
                    WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', m)
                ), 0) as net_profit
            FROM months
            ORDER BY m ASC
        `).all();

        return {
            financials: {
                totalRevenue,
                totalCostOfGoods,
                grossProfit,
                totalExpenses,
                netProfit,
                profitMargin
            },
            liquidity: {
                cashDrawer,
                baridimob,
                bna,
                totalLiquidity: cashDrawer + baridimob + bna
            },
            monthlyStats
        };
    });

    // 2. List Expenses
    ipcMain.handle('expenses:list', async (event, { category = 'all', paymentMethod = 'all', page = 1, limit = 50 } = {}) => {
        const db = getDb();
        const offset = (page - 1) * limit;

        let whereClauses = ['1=1'];
        const params = {};

        if (category && category !== 'all') {
            whereClauses.push('ex.category = @category');
            params.category = category;
        }

        if (paymentMethod && paymentMethod !== 'all') {
            whereClauses.push('ex.payment_method = @paymentMethod');
            params.paymentMethod = paymentMethod;
        }

        const whereSql = whereClauses.join(' AND ');

        const totalRow = db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount FROM expenses ex WHERE ${whereSql}`).get(params);
        const expenses = db.prepare(`
            SELECT ex.*, e.name as employee_name
            FROM expenses ex
            LEFT JOIN employees e ON ex.employee_id = e.id
            WHERE ${whereSql}
            ORDER BY ex.expense_date DESC
            LIMIT @limit OFFSET @offset
        `).all({ ...params, limit, offset });

        return {
            items: expenses,
            total: totalRow.total,
            totalAmount: totalRow.total_amount,
            page,
            totalPages: Math.ceil(totalRow.total / limit)
        };
    });

    // 3. Create Expense
    ipcMain.handle('expenses:create', async (event, { title, category, paymentMethod = 'cash', amount, employeeId = 1, notes = '' }) => {
        const cleanAmount = Number(amount);
        if (!cleanAmount || cleanAmount <= 0) throw new Error('يرجى إدخال مبلغ صالح للمصروف');

        const db = getDb();
        const year = new Date().getFullYear();
        const count = db.prepare('SELECT COUNT(*) as count FROM expenses').get().count;
        const code = `#EXP-${year}-${String(count + 1).padStart(3, '0')}`;

        db.prepare(`
            INSERT INTO expenses (expense_code, title, category, payment_method, amount, employee_id, notes)
            VALUES (@code, @title, @category, @paymentMethod, @amount, @employeeId, @notes)
        `).run({
            code,
            title,
            category: category || 'other',
            paymentMethod,
            amount: cleanAmount,
            employeeId,
            notes
        });

        logAudit({
            employeeId,
            actionType: 'expense_added',
            targetEntity: 'expenses',
            targetId: code,
            oldValues: null,
            newValues: { title, amount: cleanAmount, category, paymentMethod },
            notes: `تسجيل سند صرف جديد ${code}: ${title} بمبلغ ${cleanAmount} د.ج`
        });

        return { success: true, code };
    });

    // 4. Delete Expense (Mandatory Audit)
    ipcMain.handle('expenses:delete', async (event, { id, employeeId = 1 }) => {
        const db = getDb();
        const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
        if (!expense) throw new Error('سند الصرف غير موجود');

        db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

        logAudit({
            employeeId,
            actionType: 'expense_deleted',
            targetEntity: 'expenses',
            targetId: expense.expense_code,
            oldValues: expense,
            newValues: null,
            notes: `حذف سند صرف معتمد: ${expense.expense_code} بمبلغ ${expense.amount} د.ج`
        });

        return { success: true };
    });
}

module.exports = { registerFinanceIpc };
