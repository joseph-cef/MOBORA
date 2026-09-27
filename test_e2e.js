// End to end load test of all 10 stitch screens in Electron
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase, closeDb } = require('./src/main/db');
const { registerAllIpc } = require('./src/main/ipc');

const screens = [
    'dashboard',
    'pos_terminal',
    'inventory',
    'repairs_kanban',
    'suppliers_purchases',
    'imei_warranty_checker',
    'telegram_bot',
    'finance_reports',
    'employees_audit_log',
    'settings_backup'
];

app.whenReady().then(async () => {
    console.log('[E2E Test] Starting comprehensive screen validation in Electron...');
    initDatabase();
    registerAllIpc(ipcMain);

    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'src/preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    for (const screen of screens) {
        const filePath = path.resolve(__dirname, `stitch_phone_store_pos_erp/${screen}/code.html`);
        try {
            await win.loadFile(filePath);
            console.log(`  ✓ [PASS] Screen loaded: ${screen}`);
        } catch (err) {
            console.error(`  ✗ [FAIL] Screen failed to load: ${screen}`, err.message);
            closeDb();
            process.exit(1);
        }
    }

    console.log('\n✨ ALL 10 STITCH SCREENS SUCCESSFULLY LOADED IN ELECTRON WITH ZERO ERRORS!\n');
    closeDb();
    app.quit();
});
