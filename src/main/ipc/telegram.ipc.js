// Telegram Bot & Channels IPC Handlers
const { getDb } = require('../db');
const { logAudit } = require('../services/audit.service');
const { 
    testBotConnection, 
    sendTelegramMessage, 
    sendTelegramPhoto, 
    editMessageCaption, 
    getBotToken,
    broadcastNewProduct,
    syncPriceChangeOnTelegram,
    syncSoldOutOnTelegram,
    retryPendingTelegramPosts
} = require('../services/telegram.service');

function registerTelegramIpc(ipcMain) {
    // 1. Test Bot Token
    ipcMain.handle('telegram:test-token', async (event, token) => {
        return await testBotConnection(token);
    });

    // 2. List Configured Channels
    ipcMain.handle('telegram:get-channels', async () => {
        const db = getDb();
        return db.prepare('SELECT * FROM telegram_channels ORDER BY id ASC').all();
    });

    // 3. Add Channel
    ipcMain.handle('telegram:add-channel', async (event, data) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO telegram_channels (
                channel_title, channel_username, chat_id, channel_type,
                is_active, auto_post_new, auto_update_price, auto_sold_out
            ) VALUES (
                @channel_title, @channel_username, @chat_id, @channel_type,
                @is_active, @auto_post_new, @auto_update_price, @auto_sold_out
            )
        `);

        const res = stmt.run({
            channel_title: data.channel_title,
            channel_username: data.channel_username || null,
            chat_id: data.chat_id,
            channel_type: data.channel_type || 'channel',
            is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
            auto_post_new: data.auto_post_new !== undefined ? (data.auto_post_new ? 1 : 0) : 1,
            auto_update_price: data.auto_update_price !== undefined ? (data.auto_update_price ? 1 : 0) : 1,
            auto_sold_out: data.auto_sold_out !== undefined ? (data.auto_sold_out ? 1 : 0) : 1
        });

        return { success: true, id: res.lastInsertRowid };
    });

    // 4. Delete Channel
    ipcMain.handle('telegram:delete-channel', async (event, id) => {
        const db = getDb();
        db.prepare('DELETE FROM telegram_channels WHERE id = ?').run(id);
        return { success: true };
    });

    // 5. Send Test Message to Channel
    ipcMain.handle('telegram:send-test-message', async (event, chatId) => {
        try {
            await sendTelegramMessage(chatId, `🔔 <b>PhoneHub OS — رسالة فحص الاتصال</b>\nتم فحص اتصال البوت بالقناة بنجاح في ${new Date().toLocaleTimeString('ar-DZ')}!`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // 6. List Posts History
    ipcMain.handle('telegram:list-posts', async (event, { status = 'all', page = 1, limit = 50 } = {}) => {
        const db = getDb();
        const offset = (page - 1) * limit;

        let whereSql = '1=1';
        const params = {};

        if (status && status !== 'all') {
            whereSql = 'tp.status = @status';
            params.status = status;
        }

        const total = db.prepare(`SELECT COUNT(*) as count FROM telegram_posts tp WHERE ${whereSql}`).get(params).count;
        const posts = db.prepare(`
            SELECT tp.*, p.name as product_name, p.sell_price, p.current_stock, tc.channel_title, tc.channel_username
            FROM telegram_posts tp
            JOIN products p ON tp.product_id = p.id
            JOIN telegram_channels tc ON tp.channel_id = tc.id
            WHERE ${whereSql}
            ORDER BY tp.posted_at DESC
            LIMIT @limit OFFSET @offset
        `).all({ ...params, limit, offset });

        return { items: posts, total, page, totalPages: Math.ceil(total / limit) };
    });

    // 7. Publish Product Post to Channel
    ipcMain.handle('telegram:publish-product', async (event, { productId, channelId, customCaption, price }) => {
        const db = getDb();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        if (!product) throw new Error('المنتج غير موجود');

        const channel = db.prepare('SELECT * FROM telegram_channels WHERE id = ?').get(channelId);
        if (!channel) throw new Error('القناة غير موجودة');

        const finalPrice = price ? Number(price) : product.sell_price;
        const defaultCaption = `🔥 <b>${product.name}</b>\n\n` +
            `💰 <b>السعر:</b> ${finalPrice.toLocaleString('fr-DZ')} د.ج\n` +
            (product.storage_rom ? `💾 <b>السعة:</b> ${product.storage_rom}\n` : '') +
            (product.ram ? `⚡ <b>الرام:</b> ${product.ram}\n` : '') +
            (product.battery_health_percent ? `🔋 <b>صحة البطارية:</b> ${product.battery_health_percent}%\n` : '') +
            (product.warranty_months ? `🛡️ <b>الضمان:</b> ${product.warranty_months} شهر\n` : '') +
            `\n${customCaption || 'متوفر حالياً لدى محلنا. التوصيل متوفر لـ 58 ولاية!'}\n\n` +
            `📞 للطلب والاستفسار: 0550123456`;

        const captionToSend = defaultCaption;
        let photoUrl = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=600'; // Default tech photo
        if (product.images) {
            try {
                const parsed = JSON.parse(product.images);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].startsWith('http')) {
                    photoUrl = parsed[0];
                }
            } catch (e) {}
        }

        try {
            const result = await sendTelegramPhoto(channel.chat_id, photoUrl, captionToSend);
            const messageId = result.result ? result.result.message_id : null;

            db.prepare(`
                INSERT INTO telegram_posts (product_id, channel_id, telegram_message_id, posted_caption, status)
                VALUES (@productId, @channelId, @messageId, @caption, 'posted')
            `).run({
                productId,
                channelId,
                messageId,
                caption: captionToSend
            });

            db.prepare('UPDATE products SET is_telegram_synced = 1 WHERE id = ?').run(productId);

            return { success: true, messageId };
        } catch (err) {
            // Queue as pending retry for offline resilience
            db.prepare(`
                INSERT INTO telegram_posts (product_id, channel_id, posted_caption, status, last_error)
                VALUES (@productId, @channelId, @caption, 'pending_retry', @error)
            `).run({
                productId,
                channelId,
                caption: captionToSend,
                error: err.message
            });

            return { success: false, queued: true, error: err.message };
        }
    });

    // 8. Retry pending offline posts
    ipcMain.handle('telegram:retry-pending', async () => {
        return await retryPendingTelegramPosts();
    });

    // 9. Manual broadcast product to active auto channels
    ipcMain.handle('telegram:broadcast-product', async (event, productId) => {
        return await broadcastNewProduct(productId);
    });

    // 10. Sync sold out badge
    ipcMain.handle('telegram:sync-sold-out', async (event, productId) => {
        await syncSoldOutOnTelegram(productId);
        return { success: true };
    });

    // 11. Sync price change
    ipcMain.handle('telegram:sync-price', async (event, { productId, newPrice }) => {
        await syncPriceChangeOnTelegram(productId, newPrice);
        return { success: true };
    });
}

module.exports = { registerTelegramIpc };
