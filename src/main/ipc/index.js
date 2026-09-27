// Master IPC Registrar
const { registerDashboardIpc } = require('./dashboard.ipc');
const { registerProductsIpc } = require('./products.ipc');
const { registerSalesIpc } = require('./sales.ipc');
const { registerRepairsIpc } = require('./repairs.ipc');
const { registerSuppliersIpc } = require('./suppliers.ipc');
const { registerWarrantyIpc } = require('./warranty.ipc');
const { registerFinanceIpc } = require('./finance.ipc');
const { registerEmployeesIpc } = require('./employees.ipc');
const { registerSettingsIpc } = require('./settings.ipc');
const { registerTelegramIpc } = require('./telegram.ipc');

function registerAllIpc(ipcMain) {
    console.log('[IPC] Registering all domain IPC handlers...');
    registerDashboardIpc(ipcMain);
    registerProductsIpc(ipcMain);
    registerSalesIpc(ipcMain);
    registerRepairsIpc(ipcMain);
    registerSuppliersIpc(ipcMain);
    registerWarrantyIpc(ipcMain);
    registerFinanceIpc(ipcMain);
    registerEmployeesIpc(ipcMain);
    registerSettingsIpc(ipcMain);
    registerTelegramIpc(ipcMain);
    console.log('[IPC] All domain IPC handlers successfully registered.');
}

module.exports = { registerAllIpc };
