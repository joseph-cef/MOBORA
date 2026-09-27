// System Settings & Backup IPC Handlers
const { getDb, getDbPath, closeDb, initDatabase } = require('../db');
const { logAudit } = require('../services/audit.service');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function registerSettingsIpc(ipcMain) {
    // 1. Get All Settings
    ipcMain.handle('settings:get-all', async () => {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM system_settings').all();
        const settingsMap = {};
        for (const row of rows) {
            settingsMap[row.key] = row.value;
        }
        return settingsMap;
    });

    // 2. Update Settings
    ipcMain.handle('settings:update', async (event, settingsMap) => {
        const db = getDb();
        const stmt = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');

        const updateTx = db.transaction(() => {
            for (const [key, value] of Object.entries(settingsMap)) {
                stmt.run(key, String(value));
            }

            logAudit({
                employeeId: 1,
                actionType: 'pin_verified',
                targetEntity: 'system_settings',
                targetId: 'ALL',
                oldValues: null,
                newValues: settingsMap,
                notes: 'تحديث إعدادات النظام وتفضيلات المتجر'
            });
        });

        updateTx();
        return { success: true };
    });

    // 3. Create Local SQLite Backup
    ipcMain.handle('backup:create-now', async (event, { type = 'manual' } = {}) => {
        const db = getDb();
        const liveDbPath = getDbPath();

        const backupDir = path.resolve(path.dirname(liveDbPath), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `mobora_backup_${timestamp}.db`;
        const backupFilePath = path.join(backupDir, backupFileName);

        // Safe online SQLite backup using better-sqlite3 .backup API
        await db.backup(backupFilePath);

        const stats = fs.statSync(backupFilePath);
        const fileBuffer = fs.readFileSync(backupFilePath);
        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Log into backup_logs table
        db.prepare(`
            INSERT INTO backup_logs (file_name, file_path, file_size_bytes, backup_type, sha256_checksum, status)
            VALUES (@name, @path, @size, @type, @checksum, 'verified')
        `).run({
            name: backupFileName,
            path: backupFilePath,
            size: stats.size,
            type,
            checksum
        });

        logAudit({
            employeeId: 1,
            actionType: 'backup_restored',
            targetEntity: 'backup_logs',
            targetId: backupFileName,
            oldValues: null,
            newValues: { size: stats.size, checksum },
            notes: `إنشاء نسخة احتياطية محلية ناجحة: ${backupFileName}`
        });

        return {
            success: true,
            fileName: backupFileName,
            filePath: backupFilePath,
            sizeBytes: stats.size,
            checksum
        };
    });

    // 4. List Backups
    ipcMain.handle('backup:list', async () => {
        const db = getDb();
        return db.prepare('SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 20').all();
    });

    // 5. Restore Database from Backup File
    ipcMain.handle('backup:restore', async (event, { filePath, employeeId = 1 } = {}) => {
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('ملف النسخة الاحتياطية غير موجود');
        }

        const liveDbPath = getDbPath();
        const backupDir = path.resolve(path.dirname(liveDbPath), 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        // Safety backup of current DB before overwriting
        const safetyBackupPath = path.join(backupDir, `safety_pre_restore_${Date.now()}.db`);
        try {
            fs.copyFileSync(liveDbPath, safetyBackupPath);
        } catch (e) {
            console.warn('[Backup Restore] Could not create pre-restore safety copy:', e.message);
        }

        // Close DB, copy backup file over live db, reopen DB
        closeDb();
        fs.copyFileSync(filePath, liveDbPath);
        initDatabase();

        logAudit({
            employeeId,
            actionType: 'backup_restored',
            targetEntity: 'database',
            targetId: path.basename(filePath),
            notes: `تمت استعادة قاعدة البيانات بنجاح من النسخة الاحتياطية: ${path.basename(filePath)}`
        });

        return { success: true, restoredFile: path.basename(filePath) };
    });
}

module.exports = { registerSettingsIpc };
