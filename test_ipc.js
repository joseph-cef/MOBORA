// Automated Integration Test for All Phase 2 IPC Handlers
const path = require('path');
const fs = require('fs');

// Create mock ipcMain to register and invoke handlers directly in test
const handlers = new Map();
const mockIpcMain = {
    handle: (channel, fn) => {
        handlers.set(channel, fn);
    }
};

const invoke = async (channel, ...args) => {
    const fn = handlers.get(channel);
    if (!fn) throw new Error(`Handler not found for channel: ${channel}`);
    return await fn({ sender: {} }, ...args);
};

// Use clean test database
const testDbPath = path.resolve(__dirname, 'data/test_ipc_mobora.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
const wal = testDbPath + '-wal';
const shm = testDbPath + '-shm';
if (fs.existsSync(wal)) fs.unlinkSync(wal);
if (fs.existsSync(shm)) fs.unlinkSync(shm);

const { initDatabase, closeDb } = require('./src/main/db/index');
initDatabase(testDbPath);

const { registerAllIpc } = require('./src/main/ipc/index');
registerAllIpc(mockIpcMain);

async function runAllTests() {
    console.log('\n=================================================');
    console.log('🧪 RUNNING PHASE 2 BACKEND / IPC INTEGRATION TESTS');
    console.log('=================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, name) => {
        if (condition) {
            console.log(`  ✓ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`  ✗ [FAIL] ${name}`);
            failed++;
        }
    };

    try {
        // 1. Dashboard IPC
        console.log('[1/10] Testing Dashboard IPC...');
        const dash = await invoke('dashboard:get-metrics');
        assert(dash.success === true, 'dashboard:get-metrics returned success');
        assert(dash.data.stock.total_items > 0, 'dashboard stock has items');
        assert(dash.data.repairs.received >= 1, 'dashboard repairs has received tickets');
        assert(dash.data.liquidity.cash_drawer > 0, 'dashboard liquidity calculated');

        // 2. Products IPC
        console.log('\n[2/10] Testing Products IPC...');
        const cats = await invoke('products:get-categories');
        assert(cats.length === 4, 'products:get-categories returned 4 categories');

        const prodList = await invoke('products:list', { category: 'all' });
        assert(prodList.total >= 10, 'products:list returned seeded products');

        // Create new accessory
        const newProd = await invoke('products:create', {
            data: {
                category_slug: 'accessory',
                name: 'شاحن سيارة سريع Ugreen 36W',
                brand: 'Ugreen',
                barcode: 'UGR-CAR-36W',
                cost_price: 1500,
                sell_price: 2500,
                current_stock: 15,
                min_stock_alert: 3
            },
            employeeId: 1
        });
        assert(newProd.success && newProd.product.name.includes('Ugreen'), 'products:create inserted product with barcode');

        // Barcode lookup
        const lookup = await invoke('products:lookup-code', 'UGR-CAR-36W');
        assert(lookup && lookup.product.barcode === 'UGR-CAR-36W', 'products:lookup-code found product by barcode');

        // Update product price & stock (testing audit log)
        const updateRes = await invoke('products:update', {
            id: newProd.product.id,
            data: { sell_price: 2800 },
            employeeId: 1
        });
        assert(updateRes.success, 'products:update updated price');

        // 3. Sales / POS IPC
        console.log('\n[3/10] Testing Sales & POS IPC...');
        // Lookup iPhone to sell
        const iphone = prodList.items.find(p => p.barcode === 'APL-IP15PM-256NT');
        const initialStock = iphone.current_stock;
        
        // Find an available IMEI
        const imeiLookup = await invoke('products:lookup-code', '354891102938471');
        assert(imeiLookup && imeiLookup.type === 'imei', 'products:lookup-code found phone by IMEI');

        const saleRes = await invoke('sales:create', {
            items: [
                { product_id: iphone.id, imei_id: imeiLookup.imei_id, quantity: 1, unit_price: 224000 },
                { product_id: newProd.product.id, quantity: 2, unit_price: 2800 }
            ],
            customerName: 'مشتري تجريبي',
            customerPhone: '0555112233',
            discount: 1600,
            paymentMethod: 'cash',
            cashierId: 1
        });

        assert(saleRes.success && saleRes.sale.invoice_number.startsWith('INV-'), 'sales:create generated valid invoice');
        assert(saleRes.sale.total_amount === (224000 + 5600 - 1600), 'sales:create calculated correct total amount after discount');
        assert(saleRes.sale.items.length === 2, 'sales:create recorded both items');

        // Verify stock deducted
        const updatedIphone = await invoke('products:get-by-id', iphone.id);
        assert(updatedIphone.current_stock === initialStock - 1, 'sales:create deducted stock by 1');

        // 4. Warranty IPC
        console.log('\n[4/10] Testing Warranty & IMEI Checker IPC...');
        const warrantyCheck = await invoke('warranty:check-imei', '354891102938471');
        assert(warrantyCheck && warrantyCheck.found === true, 'warranty:check-imei found sold phone IMEI');
        assert(warrantyCheck.metrics.daysRemaining > 0, 'warranty:check-imei calculated remaining warranty days');
        assert(warrantyCheck.warranty.customer_name === 'مشتري تجريبي', 'warranty linked to sale customer');

        // 5. Repairs IPC
        console.log('\n[5/10] Testing Repairs Workshop IPC...');
        const kanban = await invoke('repairs:list-kanban');
        assert(kanban.columns.received.length >= 1, 'repairs:list-kanban loaded received cards');

        // Create intake ticket
        const intake = await invoke('repairs:create', {
            customer_name: 'جمال قاسم',
            customer_phone: '0661998877',
            device_model: 'Google Pixel 7 Pro',
            issue_category: 'screen',
            issue_description: 'تغيير شاشة OLED بعد الكسر',
            labor_cost: 3500,
            priority: 'urgent'
        });
        assert(intake.success && intake.ticket.ticket_number.startsWith('REP-'), 'repairs:create opened intake ticket');

        // Update status to in_progress
        const statusRes = await invoke('repairs:update-status', { id: intake.ticket.id, status: 'in_progress', storageSlot: 'ورشة 3' });
        assert(statusRes.success, 'repairs:update-status moved ticket to in_progress');

        // Attach spare part from inventory (e.g. waterproof adhesive)
        const adhesive = prodList.items.find(p => p.barcode === 'ADH-WTR-13P');
        const initialAdhesiveStock = adhesive.current_stock;
        const addPartRes = await invoke('repairs:add-part', {
            repairId: intake.ticket.id,
            productId: adhesive.id,
            quantity: 2
        });
        assert(addPartRes.success, 'repairs:add-part attached spare part');

        // Verify stock deducted
        const updatedAdhesive = await invoke('products:get-by-id', adhesive.id);
        assert(updatedAdhesive.current_stock === initialAdhesiveStock - 2, 'repairs:add-part deducted spare part stock');

        // Complete & Pay
        const completeRes = await invoke('repairs:complete-and-pay', { id: intake.ticket.id, paymentMethod: 'cash' });
        assert(completeRes.success, 'repairs:complete-and-pay marked repair delivered & paid');

        // 6. Suppliers IPC
        console.log('\n[6/10] Testing Suppliers IPC...');
        const sups = await invoke('suppliers:list');
        assert(sups.length >= 4, 'suppliers:list returned suppliers');

        const sup1 = sups[0];
        const oldDebt = sup1.current_debt;

        // Record Purchase Invoice
        const purchaseRes = await invoke('suppliers:record-purchase', {
            supplierId: sup1.id,
            items: [{ product_id: newProd.product.id, quantity: 10, unit_cost: 1400 }],
            totalAmount: 14000,
            paidAmount: 4000
        });
        assert(purchaseRes.success, 'suppliers:record-purchase recorded invoice');

        // Check debt increased by 10,000 (14000 - 4000)
        const updatedSup = await invoke('suppliers:get-by-id', sup1.id);
        assert(updatedSup.current_debt === oldDebt + 10000, 'suppliers:record-purchase updated supplier debt');

        // Record Debt Payment
        const payDebtRes = await invoke('suppliers:record-payment', {
            supplierId: sup1.id,
            amount: 5000,
            paymentMethod: 'cash',
            notes: 'دفعة نقدية'
        });
        assert(payDebtRes.success, 'suppliers:record-payment registered debt repayment');

        // 7. Finance & Reports IPC
        console.log('\n[7/10] Testing Finance & Reports IPC...');
        const finance = await invoke('finance:get-summary', { period: 'month' });
        assert(finance.financials.totalRevenue > 0, 'finance:get-summary calculated total revenue');
        assert(finance.financials.netProfit !== undefined, 'finance:get-summary calculated net profit');
        assert(finance.liquidity.totalLiquidity > 0, 'finance:get-summary calculated liquidity');

        // Create expense
        const expRes = await invoke('expenses:create', {
            title: 'شراء كاوية لحام سريعة T12',
            category: 'workshop_supplies',
            paymentMethod: 'cash',
            amount: 6500,
            employeeId: 2,
            notes: 'أدوات صيانة الورشة'
        });
        assert(expRes.success && expRes.code.startsWith('#EXP-'), 'expenses:create generated expense code');

        // 8. Employees & Security IPC
        console.log('\n[8/10] Testing Employees & Security PIN IPC...');
        const emps = await invoke('employees:list');
        assert(emps.length >= 4, 'employees:list returned staff');

        const pinCheck = await invoke('employees:verify-pin', { pin: '1234' });
        assert(pinCheck.success === true && pinCheck.employee.role === 'owner', 'employees:verify-pin verified admin PIN');

        const wrongPin = await invoke('employees:verify-pin', { pin: '9999' });
        assert(wrongPin.success === false, 'employees:verify-pin rejected wrong PIN');

        // 9. Audit Logs Feed
        console.log('\n[9/10] Testing Audit Logs Feed...');
        const audits = await invoke('audit:list', { limit: 10 });
        assert(audits.items.length >= 5, 'audit:list captured sensitive actions (sales, price change, expenses)');

        // 10. Settings & Backup IPC
        console.log('\n[10/10] Testing Settings & Backup IPC...');
        const settings = await invoke('settings:get-all');
        assert(settings.store_name_ar === 'محل فون إكسبريس للاتصالات', 'settings:get-all returned store name');

        const backupRes = await invoke('backup:create-now', { type: 'manual' });
        assert(backupRes.success && backupRes.checksum.length === 64, 'backup:create-now produced verified SHA-256 backup');

        closeDb();

        // Cleanup test db
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
        if (fs.existsSync(wal)) fs.unlinkSync(wal);
        if (fs.existsSync(shm)) fs.unlinkSync(shm);

        console.log('\n=================================================');
        console.log(`🎯 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log('=================================================\n');

        if (failed === 0) {
            console.log('✨ ALL PHASE 2 BACKEND IPC HANDLERS FULLY FUNCTIONAL!\n');
            if (process.versions.electron) {
                const { app } = require('electron');
                if (app) app.exit(0);
            }
            process.exit(0);
        } else {
            if (process.versions.electron) {
                const { app } = require('electron');
                if (app) app.exit(1);
            }
            process.exit(1);
        }
    } catch (err) {
        console.error('Test execution crashed:', err);
        if (process.versions.electron) {
            const { app } = require('electron');
            if (app) app.exit(1);
        }
        process.exit(1);
    }
}

runAllTests();
