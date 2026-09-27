// Automated SQLite Backup Scheduler & Retention Manager
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb, getDbPath } = require('../db');
const { logAudit } = require('./audit.service');

let backupIntervalTimer = null;

async function performBackup(type = 'scheduled') {
    const db = getDb();
    const liveDbPath = getDbPath();
    const backupDir = path.resolve(path.dirname(liveDbPath), 'backups');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `mobora_backup_${type}_${timestamp}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Safe live SQLite backup via better-sqlite3
    await db.backup(backupFilePath);

    const stats = fs.statSync(backupFilePath);
    const fileBuffer = fs.readFileSync(backupFilePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Record in backup_logs
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
        newValues: { size: stats.size, checksum, type },
        notes: `تم إنشاء نسخة احتياطية (${type}): ${backupFileName}`
    });

    // Enforce retention policy (keep last 15 backups)
    pruneOldBackups(backupDir, 15);

    return {
        success: true,
        fileName: backupFileName,
        filePath: backupFilePath,
        sizeBytes: stats.size,
        checksum
    };
}

function pruneOldBackups(backupDir, maxToKeep = 15) {
    try {
        if (!fs.existsSync(backupDir)) return;
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('mobora_backup_') && f.endsWith('.db'))
            .map(f => {
                const fullPath = path.join(backupDir, f);
                return {
                    name: f,
                    path: fullPath,
                    mtime: fs.statSync(fullPath).mtime.getTime()
                };
            })
            .sort((a, b) => b.mtime - a.mtime); // Newest first

        if (files.length > maxToKeep) {
            const toDelete = files.slice(maxToKeep);
            const db = getDb();
            for (const item of toDelete) {
                try {
                    fs.unlinkSync(item.path);
                    db.prepare('DELETE FROM backup_logs WHERE file_name = ?').run(item.name);
                    console.log(`[Backup Retention] Pruned old backup: ${item.name}`);
                } catch (e) {
                    console.warn(`[Backup Retention Warning] Could not delete ${item.name}:`, e.message);
                }
            }
        }
    } catch (err) {
        console.error('[Backup Retention Error]', err.message);
    }
}

function startAutomatedBackupScheduler() {
    if (backupIntervalTimer) {
        clearInterval(backupIntervalTimer);
    }

    console.log('[Backup Scheduler] Initialized automated backup background worker.');

    // Check backup settings every 30 minutes
    const CHECK_INTERVAL_MS = 30 * 60 * 1000;
    backupIntervalTimer = setInterval(async () => {
        try {
            const db = getDb();
            const autoSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'backup_auto_daily'").get();
            const isAutoEnabled = autoSetting ? autoSetting.value === '1' : true;

            if (!isAutoEnabled) return;

            // Check when the last backup was taken
            const lastBackup = db.prepare("SELECT created_at FROM backup_logs ORDER BY created_at DESC LIMIT 1").get();
            const now = Date.now();
            let shouldBackup = false;

            if (!lastBackup) {
                shouldBackup = true;
            } else {
                const lastTime = new Date(lastBackup.created_at).getTime();
                const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);
                if (hoursSinceLast >= 24) {
                    shouldBackup = true;
                }
            }

            if (shouldBackup) {
                console.log('[Backup Scheduler] 24 hours elapsed since last backup. Triggering automated backup...');
                await performBackup('scheduled');
            }
        } catch (err) {
            console.error('[Backup Scheduler Error]', err.message);
        }
    }, CHECK_INTERVAL_MS);
}

function stopAutomatedBackupScheduler() {
    if (backupIntervalTimer) {
        clearInterval(backupIntervalTimer);
        backupIntervalTimer = null;
    }
}

module.exports = {
    performBackup,
    pruneOldBackups,
    startAutomatedBackupScheduler,
    stopAutomatedBackupScheduler
};
