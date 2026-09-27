// Test and Verify Mobora Database Schema & Seeds
const { initDatabase, closeDb } = require('./src/main/db/index');
const path = require('path');
const fs = require('fs');

try {
    const testDbPath = path.resolve(__dirname, 'data/test_mobora.db');
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }

    const db = initDatabase(testDbPath);
    console.log('--- Database Verification Test ---');

    // 1. Check all tables created
    const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).all();

    console.log(`\n[✓] Tables Created (${tables.length}):`);
    tables.forEach(t => console.log(`   - ${t.name}`));

    // 2. Check counts
    const checks = [
        { table: 'categories', expected: 4 },
        { table: 'employees', expected: 4 },
        { table: 'system_settings', expected: 13 },
        { table: 'products', expected: 10 },
        { table: 'product_imeis', expected: 3 },
        { table: 'suppliers', expected: 4 },
        { table: 'repairs', expected: 5 },
        { table: 'repair_parts', expected: 2 },
        { table: 'telegram_channels', expected: 2 },
        { table: 'expenses', expected: 2 },
        { table: 'audit_logs', expected: 1 }
    ];

    console.log('\n[✓] Record Count & Integrity Check:');
    let allPassed = true;
    for (const check of checks) {
        const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${check.table}`).get();
        const passed = row.cnt === check.expected;
        console.log(`   - ${check.table}: ${row.cnt} rows (expected: ${check.expected}) ${passed ? '✓ PASS' : '✗ FAIL'}`);
        if (!passed) allPassed = false;
    }

    // 3. Test Foreign Key Enforcement
    console.log('\n[✓] Testing Foreign Key Constraints:');
    try {
        db.prepare(`
            INSERT INTO products (category_slug, name, sell_price) 
            VALUES ('non_existent_category', 'Ghost Product', 100)
        `).run();
        console.log('   ✗ Foreign key test FAILED (non-existent category accepted)');
        allPassed = false;
    } catch (err) {
        console.log('   ✓ Foreign key enforcement works (rejected invalid category_slug)');
    }

    // 4. Test Audit Log insertion
    console.log('\n[✓] Testing Audit Log Mechanism:');
    db.prepare(`
        INSERT INTO audit_logs (employee_id, action_type, target_entity, target_id, old_values, new_values, notes)
        VALUES (1, 'price_changed', 'products', '1', '{"sell_price": 224000}', '{"sell_price": 220000}', 'تخفيض ترويجي للآيفون')
    `).run();
    const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
    console.log(`   ✓ Audit log inserted successfully (Total entries: ${auditCount})`);

    closeDb();

    // Clean up test db
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    const walFile = testDbPath + '-wal';
    const shmFile = testDbPath + '-shm';
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

    if (allPassed) {
        console.log('\n=========================================');
        console.log('🎉 PHASE 1 DATABASE SCHEMA FULLY VERIFIED!');
        console.log('=========================================');
        process.exit(0);
    } else {
        console.error('Some checks failed.');
        process.exit(1);
    }
} catch (err) {
    console.error('Test encountered error:', err);
    process.exit(1);
}
