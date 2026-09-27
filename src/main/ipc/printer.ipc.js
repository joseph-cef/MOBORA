// Thermal Printer & PDF Receipt IPC Handlers
const { getDb } = require('../db');
const { 
    getStoreSettings, 
    generateInvoiceHtml, 
    generateRepairTicketHtml, 
    printHtml, 
    exportHtmlToPdf, 
    getAvailablePrinters 
} = require('../services/printer.service');
const { logAudit } = require('../services/audit.service');

function registerPrinterIpc(ipcMain) {
    // 1. Get OS Printers List
    ipcMain.handle('printer:get-list', async () => {
        try {
            return await getAvailablePrinters();
        } catch (err) {
            console.error('[Printer List Error]', err);
            return [];
        }
    });

    // 2. Print POS Sale Receipt
    ipcMain.handle('printer:print-sale', async (event, { saleId, invoiceNumber, width, silent = true, printerName }) => {
        const db = getDb();
        let sale = null;

        if (saleId) {
            sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        } else if (invoiceNumber) {
            sale = db.prepare('SELECT * FROM sales WHERE invoice_number = ?').get(invoiceNumber);
        }

        if (!sale) throw new Error('بيانات الفاتورة غير موجودة للطباعة');

        const items = db.prepare(`
            SELECT si.*, p.name as product_name, pi.imei1, pi.imei2
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            LEFT JOIN product_imeis pi ON si.imei_id = pi.id
            WHERE si.sale_id = ?
        `).all(sale.id);

        const store = getStoreSettings();
        const paperWidth = width || store.defaultWidth || 80;
        const targetPrinter = printerName || store.printerName;

        const html = generateInvoiceHtml(sale, items, store, paperWidth);
        const printResult = await printHtml(html, paperWidth, silent, targetPrinter);

        logAudit({
            employeeId: sale.cashier_id || 1,
            actionType: 'sale_created',
            targetEntity: 'sales',
            targetId: sale.invoice_number,
            notes: `طباعة وصل مبيعات برقم: ${sale.invoice_number}`
        });

        return printResult;
    });

    // 3. Print Repair Voucher
    ipcMain.handle('printer:print-repair', async (event, { repairId, ticketNumber, width, silent = true, printerName }) => {
        const db = getDb();
        let repair = null;

        if (repairId) {
            repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(repairId);
        } else if (ticketNumber) {
            repair = db.prepare('SELECT * FROM repairs WHERE ticket_number = ?').get(ticketNumber);
        }

        if (!repair) throw new Error('بيانات بطاقة الصيانة غير موجودة للطباعة');

        const store = getStoreSettings();
        const paperWidth = width || store.defaultWidth || 80;
        const targetPrinter = printerName || store.printerName;

        const html = generateRepairTicketHtml(repair, store, paperWidth);
        const printResult = await printHtml(html, paperWidth, silent, targetPrinter);

        return printResult;
    });

    // 4. Export Sale Receipt to PDF
    ipcMain.handle('printer:export-pdf', async (event, { saleId, outputPath, width = 80 }) => {
        const db = getDb();
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        if (!sale) throw new Error('الفاتورة غير موجودة');

        const items = db.prepare(`
            SELECT si.*, p.name as product_name, pi.imei1
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            LEFT JOIN product_imeis pi ON si.imei_id = pi.id
            WHERE si.sale_id = ?
        `).all(sale.id);

        const store = getStoreSettings();
        const html = generateInvoiceHtml(sale, items, store, width);
        return await exportHtmlToPdf(html, outputPath);
    });

    // 5. Test Print
    ipcMain.handle('printer:test-print', async (event, { width = 80, printerName } = {}) => {
        const store = getStoreSettings();
        const mockSale = {
            invoice_number: 'TEST-0001',
            customer_name: 'تجربة طباعة',
            subtotal: 15000,
            discount: 0,
            total_amount: 15000,
            payment_method: 'cash',
            created_at: new Date().toISOString()
        };
        const mockItems = [
            { product_name: 'شاحن أصلي Type-C 25W', quantity: 1, subtotal: 3500 },
            { product_name: 'واقي شاشة زجاجي Privacy', quantity: 1, subtotal: 1500 },
            { product_name: 'سماعات بلوتوث لاسلكية', quantity: 1, subtotal: 10000 }
        ];

        const html = generateInvoiceHtml(mockSale, mockItems, store, width);
        return await printHtml(html, width, true, printerName || store.printerName);
    });
}

module.exports = { registerPrinterIpc };
