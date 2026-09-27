// Mobora — Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase, closeDb } = require('./db');
const { registerAllIpc } = require('./ipc');
const { startAutomatedBackupScheduler, stopAutomatedBackupScheduler } = require('./services/backup.service');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1200,
        minHeight: 768,
        title: 'Mobora — Phone Store OS',
        backgroundColor: '#0b1326',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false // Allows loading local file assets / stitch resources smoothly
        }
    });

    // Remove default menu bar for clean modern POS kiosk look
    mainWindow.setMenuBarVisibility(false);

    // Initial page load: Dashboard
    const initialPage = path.resolve(__dirname, '../../stitch_phone_store_pos_erp/dashboard/code.html');
    mainWindow.loadFile(initialPage);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App Lifecycle
app.whenReady().then(() => {
    console.log('[Mobora] Starting Phone Store OS Main Process...');
    
    // 1. Initialize SQLite Database
    initDatabase();

    // 2. Register all domain IPC Handlers
    registerAllIpc(ipcMain);

    // 3. Start Background Automated Backup Scheduler
    startAutomatedBackupScheduler();

    // 4. Create Main Window
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopAutomatedBackupScheduler();
    closeDb();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
