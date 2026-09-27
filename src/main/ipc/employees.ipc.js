// Employees & Audit Log IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');

function registerEmployeesIpc(ipcMain) {
    // 1. List Employees
    ipcMain.handle('employees:list', async (event, { role = 'all', search = '' } = {}) => {
        const db = getDb();
        let whereClauses = ['1=1'];
        const params = {};

        if (role && role !== 'all') {
            whereClauses.push('role = @role');
            params.role = role;
        }

        if (search && search.trim() !== '') {
            whereClauses.push('(name LIKE @search OR email LIKE @search OR phone LIKE @search)');
            params.search = `%${search.trim()}%`;
        }

        const whereSql = whereClauses.join(' AND ');
        return db.prepare(`SELECT id, name, email, phone, role, is_active, avatar_url, created_at, last_active FROM employees WHERE ${whereSql} ORDER BY id ASC`).all(params);
    });

    // 2. Verify Employee / Supervisor PIN
    ipcMain.handle('employees:verify-pin', async (event, { pin, requiredRole = null }) => {
        const db = getDb();
        const employee = db.prepare('SELECT id, name, role, is_active FROM employees WHERE pin_code = ? AND is_active = 1').get(pin);

        if (!employee) {
            // Check fallback supervisor pin in system_settings
            const fallbackPin = db.prepare("SELECT value FROM system_settings WHERE key = 'cashier_supervisor_pin'").get();
            if (fallbackPin && fallbackPin.value === pin) {
                return { success: true, employee: { id: 1, name: 'المشرف العام (PIN عام)', role: 'owner' } };
            }
            return { success: false, message: 'رمز PIN غير صحيح' };
        }

        if (requiredRole && requiredRole === 'owner' && employee.role !== 'owner') {
            return { success: false, message: 'هذه العملية تتطلب صلاحية المالك أو المشرف العام' };
        }

        return { success: true, employee };
    });

    // 3. Create Employee
    ipcMain.handle('employees:create', async (event, data) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO employees (name, email, phone, role, pin_code, is_active)
            VALUES (@name, @email, @phone, @role, @pin_code, 1)
        `);

        const res = stmt.run({
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            role: data.role || 'seller',
            pin_code: data.pin_code || '0000'
        });

        logAudit({
            employeeId: 1,
            actionType: 'pin_verified',
            targetEntity: 'employees',
            targetId: res.lastInsertRowid,
            oldValues: null,
            newValues: { name: data.name, role: data.role },
            notes: `إضافة موظف جديد: ${data.name} بدور ${data.role}`
        });

        return { success: true, id: res.lastInsertRowid };
    });

    // 4. Update Employee
    ipcMain.handle('employees:update', async (event, { id, data }) => {
        const db = getDb();
        db.prepare(`
            UPDATE employees SET
                name = @name,
                email = @email,
                phone = @phone,
                role = @role,
                pin_code = COALESCE(@pin_code, pin_code),
                is_active = @is_active
            WHERE id = @id
        `).run({
            id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            pin_code: data.pin_code || null,
            is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
        });

        return { success: true };
    });

    // 5. List Audit Logs (Feed)
    ipcMain.handle('audit:list', async (event, { actionType = 'all', page = 1, limit = 50 } = {}) => {
        const db = getDb();
        const offset = (page - 1) * limit;

        let whereSql = '1=1';
        const params = {};

        if (actionType && actionType !== 'all') {
            whereSql = 'a.action_type = @actionType';
            params.actionType = actionType;
        }

        const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs a WHERE ${whereSql}`).get(params).count;
        const logs = db.prepare(`
            SELECT a.*, e.name as employee_name, e.role as employee_role
            FROM audit_logs a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE ${whereSql}
            ORDER BY a.created_at DESC
            LIMIT @limit OFFSET @offset
        `).all({ ...params, limit, offset });

        return { items: logs, total, page, totalPages: Math.ceil(total / limit) };
    });
}

module.exports = { registerEmployeesIpc };
