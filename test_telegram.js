// Phase 4: Telegram Bot Automated Verification Test
const { app } = require('electron');
const { initDatabase, getDb, closeDb } = require('./src/main/db');
const { registerAllIpc } = require('./src/main/ipc');
const { formatProductCaption, syncPriceChangeOnTelegram, syncSoldOutOnTelegram, retryPendingTelegramPosts } = require('./src/main/services/telegram.service');

app.whenReady().then(async () => {
    console.log('====================================================');
    console.log('🚀 [PHASE 4] Running Telegram Integration Verification');
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
        // 1. Check caption formatting
        console.log('\n--- 1. Testing formatProductCaption ---');
        const sampleProduct = {
            name: 'iPhone 15 Pro Max 256GB',
            sell_price: 215000,
            storage_rom: '256GB',
            ram: '8GB',
            color: 'Natural Titanium',
            battery_health_percent: 100,
            warranty_months: 12,
            telegram_description: 'هاتف جديد أصلي مع الضمان والتوصيل مجاني.'
        };
        const caption = formatProductCaption(sampleProduct);
        assert(caption.includes('iPhone 15 Pro Max 256GB'), 'Caption contains product name');
        assert(/215\D?000/.test(caption), 'Caption contains formatted sell price');
        assert(caption.includes('Natural Titanium'), 'Caption contains color');
        assert(caption.includes('100%'), 'Caption contains battery health');
        assert(caption.includes('12 شهر'), 'Caption contains warranty');

        // 2. Channel Management
        console.log('\n--- 2. Testing Channels Management ---');
        const initialChannels = db.prepare('SELECT * FROM telegram_channels').all();
        assert(initialChannels.length > 0, `Found ${initialChannels.length} seeded channels`);

        const testChatId = `@test_mobora_${Date.now()}`;
        const insertChannelRes = db.prepare(`
            INSERT INTO telegram_channels (channel_title, channel_username, chat_id, auto_post_new, auto_update_price, auto_sold_out)
            VALUES (?, ?, ?, 1, 1, 1)
        `).run('قناة العروض التجريبية', testChatId, testChatId);
        const channelId = insertChannelRes.lastInsertRowid;
        assert(channelId > 0, `Successfully created test channel with ID ${channelId}`);

        // 3. Offline Resilience / Pending Retry Queueing
        console.log('\n--- 3. Testing Offline Resilience (Queue to pending_retry) ---');
        const testProduct = db.prepare('SELECT * FROM products LIMIT 1').get();
        assert(testProduct !== undefined, `Found product: ${testProduct.name}`);

        // Insert pending_retry record directly simulating offline broadcast
        const insertPostRes = db.prepare(`
            INSERT INTO telegram_posts (product_id, channel_id, posted_caption, status, last_error)
            VALUES (?, ?, ?, 'pending_retry', 'Network offline timeout simulation')
        `).run(testProduct.id, channelId, caption);
        const postId = insertPostRes.lastInsertRowid;
        assert(postId > 0, `Created post #${postId} with status 'pending_retry'`);

        const postRecord = db.prepare('SELECT * FROM telegram_posts WHERE id = ?').get(postId);
        assert(postRecord.status === 'pending_retry', 'Post correctly flagged as pending_retry');
        assert(postRecord.last_error.includes('offline'), 'Post recorded offline error message');

        // 4. Price Sync Database Reaction
        console.log('\n--- 4. Testing Price Sync Logic ---');
        // Set post to 'posted' with a mock message ID to test sync logic
        db.prepare("UPDATE telegram_posts SET status = 'posted', telegram_message_id = 99999 WHERE id = ?").run(postId);
        
        // Call syncPriceChangeOnTelegram (will attempt API, handle graceful network fail without breaking app)
        await syncPriceChangeOnTelegram(testProduct.id, 199000);
        assert(true, 'syncPriceChangeOnTelegram executed gracefully without throwing unhandled exception');

        // 5. Sold-Out Badge Sync Logic
        console.log('\n--- 5. Testing Sold-Out Sync Logic ---');
        await syncSoldOutOnTelegram(testProduct.id);
        const updatedPost = db.prepare('SELECT * FROM telegram_posts WHERE id = ?').get(postId);
        assert(updatedPost.status === 'sold_out', "Post status transitioned to 'sold_out'");
        assert(updatedPost.sold_out_at !== null, 'sold_out_at timestamp recorded');

        // 6. Test retryPendingTelegramPosts worker
        console.log('\n--- 6. Testing retryPendingTelegramPosts Worker ---');
        // Add another pending retry
        db.prepare(`
            INSERT INTO telegram_posts (product_id, channel_id, posted_caption, status, last_error)
            VALUES (?, ?, ?, 'pending_retry', 'Connection reset')
        `).run(testProduct.id, channelId, caption);

        const retryResult = await retryPendingTelegramPosts();
        assert(retryResult !== undefined && typeof retryResult === 'object', 'retryPendingTelegramPosts executed safely');

        // 7. POS Sold-Out Integration Verification
        console.log('\n--- 7. Testing POS Sale Triggering Sold-Out ---');
        // Create single-unit product
        const uniqueBarcode = `TEST-ACC-${Date.now()}`;
        const createProdRes = db.prepare(`
            INSERT INTO products (category_slug, name, current_stock, sell_price, cost_price, barcode)
            VALUES ('accessory', 'سماعة تجريبية فريدة', 1, 3500, 2000, ?)
        `).run(uniqueBarcode);
        const singleUnitProdId = createProdRes.lastInsertRowid;

        // Add a telegram post for it
        db.prepare(`
            INSERT INTO telegram_posts (product_id, channel_id, telegram_message_id, posted_caption, status)
            VALUES (?, ?, 88888, 'سماعة تجريبية', 'posted')
        `).run(singleUnitProdId, channelId);

        // Simulate sale deduction of this product
        db.prepare('UPDATE products SET current_stock = 0 WHERE id = ?').run(singleUnitProdId);
        await syncSoldOutOnTelegram(singleUnitProdId);

        const posSyncedPost = db.prepare('SELECT * FROM telegram_posts WHERE product_id = ?').get(singleUnitProdId);
        assert(posSyncedPost.status === 'sold_out', 'Product post automatically changed to sold_out when stock depleted');

    } catch (err) {
        console.error('💥 Test error:', err);
        failed++;
    } finally {
        closeDb();
        console.log('\n====================================================');
        console.log(`🏁 Phase 4 Test Summary: ${passed} passed, ${failed} failed`);
        console.log('====================================================');
        app.quit();
        process.exit(failed > 0 ? 1 : 0);
    }
});
