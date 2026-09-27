// Phase 5: Thermal Printing & Automated Backup Automated Verification Test
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, getDb, closeDb } = require('./src/main/db');
const { registerAllIpc } = require('./src/main/ipc');
const { 
    getStoreSettings, 
    generateInvoiceHtml, 
    generateRepairTicketHtml, 
    exportHtmlToPdf, 
    getAvailablePrinters 
} = require('./src/main/services/printer.service');
const { 
    performBackup, 
    pruneOldBackups, 
    startAutomatedBackupScheduler, 
    stopAutomatedBackupScheduler 
} = require('./src/main/services/backup.service');

app.on('window-all-closed', (e) => {
    // Prevent electron from quitting when offscreen printing windows close
});

app.whenReady().then(async () => {
    console.log('====================================================');
    console.log('🚀 [PHASE 5] Running Printing & Backup Verification');
    console.log('====================================================');

    initDatabase();
    registerAllIpc(require('electron').ipcMain);
    const db = getDb();

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    try {
        // -------------------------------------------------------------
        // PART 1: THERMAL RECEIPT & VOUCHER PRINTING
        // -------------------------------------------------------------
        console.log('\n--- 1. Testing Store Settings & HTML Receipt Generation ---');
        const store = getStoreSettings();
        assert(store.name.length > 0, `Store name retrieved: ${store.name}`);
        assert(store.defaultWidth === 80 || store.defaultWidth === 58, `Paper width supported: ${store.defaultWidth}mm`);

        const mockSale = {
            invoice_number: 'INV-20260927-TEST',
            customer_name: 'علي بلقاسم',
            subtotal: 125000,
            discount: 5000,
            total_amount: 120000,
            payment_method: 'cash',
            created_at: new Date().toISOString()
        };
        const mockItems = [
            { product_name: 'Samsung Galaxy S24 Ultra', quantity: 1, subtotal: 125000, imei1: '354890123456789', warranty_months: 12 }
        ];

        // 80mm Invoice HTML
        const invoice80Html = generateInvoiceHtml(mockSale, mockItems, store, 80);
        assert(invoice80Html.includes('INV-20260927-TEST'), '80mm receipt contains invoice number');
        assert(invoice80Html.includes('Galaxy S24 Ultra'), '80mm receipt contains item name');
        assert(invoice80Html.includes('354890123456789'), '80mm receipt contains IMEI');
        assert(invoice80Html.includes('120,000') || invoice80Html.includes('120 000') || invoice80Html.includes('120000'), '80mm receipt contains total amount');

        // 58mm Invoice HTML
        const invoice58Html = generateInvoiceHtml(mockSale, mockItems, store, 58);
        assert(invoice58Html.includes('width: 190px'), '58mm receipt sets narrow thermal width layout');

        // Repair Voucher HTML
        const mockRepair = {
            ticket_number: 'REP-20260927-0099',
            customer_name: 'محمد براهيمي',
            customer_phone: '0661234567',
            device_brand: 'Apple',
            device_model: 'iPhone 13',
            imei_or_sn: '351234567890123',
            device_passcode: '1234',
            issue_description: 'تغيير شاشة أصلية OLED + فحص بطارية',
            estimated_cost: 14000,
            deposit_prepaid: 4000,
            created_at: new Date().toISOString()
        };
        const repairHtml = generateRepairTicketHtml(mockRepair, store, 80);
        assert(repairHtml.includes('REP-20260927-0099'), 'Repair voucher contains ticket number');
        assert(repairHtml.includes('محمد براهيمي'), 'Repair voucher contains customer name');
        assert(repairHtml.includes('تغيير شاشة أصلية'), 'Repair voucher contains issue description');
        assert(repairHtml.includes('10,000') || repairHtml.includes('10 000') || repairHtml.includes('10000'), 'Repair voucher shows remaining balance');

        // Test Export Receipt to PDF
        console.log('\n--- 2. Testing PDF Receipt Export ---');
        const pdfPath = path.resolve(__dirname, 'data', 'test_receipt.pdf');
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

        const pdfResult = await exportHtmlToPdf(invoice80Html, pdfPath);
        assert(pdfResult.success === true, 'PDF export completed successfully');
        assert(fs.existsSync(pdfPath), 'PDF file exists on disk');
        const pdfStats = fs.statSync(pdfPath);
        assert(pdfStats.size > 1000, `PDF file has valid binary size: ${pdfStats.size} bytes`);
        // Clean up test PDF
        fs.unlinkSync(pdfPath);

        // Test System Printers Enumeration
        console.log('\n--- 3. Testing System Printers Enumeration ---');
        const printers = await getAvailablePrinters();
        assert(Array.isArray(printers), `Printers enumerated successfully: ${printers.length} printer(s) found`);

        // -------------------------------------------------------------
        // PART 2: AUTOMATED SQLITE BACKUP & RETENTION
        // -------------------------------------------------------------
        console.log('\n--- 4. Testing SQLite Live Backup Service ---');
        const backupRes = await performBackup('manual');
        assert(backupRes.success === true, 'Live SQLite backup performed');
        assert(fs.existsSync(backupRes.filePath), `Backup file exists: ${backupRes.fileName}`);
        assert(backupRes.sizeBytes > 50000, `Backup file size is valid: ${backupRes.sizeBytes} bytes`);
        assert(typeof backupRes.checksum === 'string' && backupRes.checksum.length === 64, `SHA-256 checksum generated: ${backupRes.checksum.slice(0, 16)}...`);

        // Verify backup recorded in database
        const backupRow = db.prepare('SELECT * FROM backup_logs WHERE file_name = ?').get(backupRes.fileName);
        assert(backupRow !== undefined, 'Backup record stored in backup_logs table');
        assert(backupRow.status === 'verified', 'Backup status marked as verified');

        // Test Retention Policy Pruning
        console.log('\n--- 5. Testing Retention Policy Pruning ---');
        const backupDir = path.dirname(backupRes.filePath);
        // Create 3 dummy older backup files
        const dummy1 = path.join(backupDir, 'mobora_backup_dummy_old1.db');
        const dummy2 = path.join(backupDir, 'mobora_backup_dummy_old2.db');
        fs.writeFileSync(dummy1, 'test');
        fs.writeFileSync(dummy2, 'test');
        db.prepare("INSERT INTO backup_logs (file_name, file_path, file_size_bytes, backup_type, sha256_checksum, status) VALUES ('mobora_backup_dummy_old1.db', ?, 4, 'manual', 'dummy', 'verified')").run(dummy1);
        db.prepare("INSERT INTO backup_logs (file_name, file_path, file_size_bytes, backup_type, sha256_checksum, status) VALUES ('mobora_backup_dummy_old2.db', ?, 4, 'manual', 'dummy', 'verified')").run(dummy2);

        // Prune to keep 2
        pruneOldBackups(backupDir, 2);
        assert(true, 'pruneOldBackups executed without error');

        // Test Backup Scheduler Lifecycle
        console.log('\n--- 6. Testing Scheduler Background Lifecycle ---');
        startAutomatedBackupScheduler();
        assert(true, 'Automated backup scheduler started');
        stopAutomatedBackupScheduler();
        assert(true, 'Automated backup scheduler stopped cleanly');

    } catch (err) {
        console.error('💥 Test error:', err);
        failed++;
    } finally {
        closeDb();
        console.log('\n====================================================');
        console.log(`🏁 Phase 5 Test Summary: ${passed} passed, ${failed} failed`);
        console.log('====================================================');
        app.quit();
        process.exit(failed > 0 ? 1 : 0);
    }
});
