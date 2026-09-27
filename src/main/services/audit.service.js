// Mobora Audit Logging Service
const { getDb } = require('../db');

function logAudit({ employeeId = null, actionType, targetEntity, targetId, oldValues = null, newValues = null, notes = null, ipOrDevice = 'Local POS' }) {
    try {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO audit_logs (
                employee_id, action_type, target_entity, target_id,
                old_values, new_values, notes, ip_or_device
            ) VALUES (
                @employeeId, @actionType, @targetEntity, @targetId,
                @oldValues, @newValues, @notes, @ipOrDevice
            )
        `);

        return stmt.run({
            employeeId,
            actionType,
            targetEntity,
            targetId: String(targetId),
            oldValues: oldValues ? (typeof oldValues === 'string' ? oldValues : JSON.stringify(oldValues)) : null,
            newValues: newValues ? (typeof newValues === 'string' ? newValues : JSON.stringify(newValues)) : null,
            notes,
            ipOrDevice
        });
    } catch (err) {
        console.error('[Audit Service Error]', err);
        // Never break execution if audit logging fails, but log loudly
        return null;
    }
}

module.exports = {
    logAudit
};
