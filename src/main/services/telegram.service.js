// Telegram Bot Service (Direct Telegram Bot API via axios)
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

function getBotToken() {
    const db = getDb();
    const tokenRow = db.prepare("SELECT value FROM system_settings WHERE key = 'telegram_bot_token'").get();
    return tokenRow ? tokenRow.value.trim() : '';
}

async function testBotConnection(token = null) {
    const botToken = token || getBotToken();
    if (!botToken) {
        return { success: false, message: 'لم يتم إدخال رمز البوت (Bot Token)' };
    }

    try {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, { timeout: 10000 });
        if (response.data && response.data.ok) {
            return { success: true, bot: response.data.result };
        }
        return { success: false, message: 'استجابة غير صحيحة من تيليجرام' };
    } catch (err) {
        return { success: false, message: err.response ? err.response.data.description : err.message };
    }
}

async function sendTelegramMessage(chatId, text, token = null) {
    const botToken = token || getBotToken();
    if (!botToken) throw new Error('Bot token is not configured.');

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
    }, { timeout: 15000 });

    return response.data;
}

async function sendTelegramPhoto(chatId, photoUrlOrPath, caption, token = null) {
    const botToken = token || getBotToken();
    if (!botToken) throw new Error('Bot token is not configured.');

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        chat_id: chatId,
        photo: photoUrlOrPath,
        caption,
        parse_mode: 'HTML'
    }, { timeout: 15000 });

    return response.data;
}

async function editMessageCaption(chatId, messageId, newCaption, token = null) {
    const botToken = token || getBotToken();
    if (!botToken) throw new Error('Bot token is not configured.');

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
        chat_id: chatId,
        message_id: messageId,
        caption: newCaption,
        parse_mode: 'HTML'
    }, { timeout: 15000 });

    return response.data;
}

function formatProductCaption(product, customCaption = '', price = null) {
    const finalPrice = price !== null && price !== undefined ? Number(price) : (product.sell_price || 0);
    const storePhone = '+213 550 12 34 56';
    
    return `🔥 <b>${product.name}</b>\n\n` +
        `💰 <b>السعر:</b> ${finalPrice.toLocaleString('fr-DZ')} د.ج\n` +
        (product.storage_rom ? `💾 <b>السعة:</b> ${product.storage_rom}\n` : '') +
        (product.ram ? `⚡ <b>الرام:</b> ${product.ram}\n` : '') +
        (product.color ? `🎨 <b>اللون:</b> ${product.color}\n` : '') +
        (product.battery_health_percent ? `🔋 <b>صحة البطارية:</b> ${product.battery_health_percent}%\n` : '') +
        (product.warranty_months ? `🛡️ <b>الضمان:</b> ${product.warranty_months} شهر\n` : '') +
        `\n${customCaption || product.telegram_description || 'متوفر حالياً لدى محلنا. التوصيل متوفر لـ 58 ولاية والدفع عند الاستلام!'}\n\n` +
        `📞 للطلب والاستفسار أو الدفع بـ BaridiMob: ${storePhone}`;
}

async function broadcastNewProduct(productId) {
    const db = getDb();
    const token = getBotToken();
    if (!token) return { success: false, reason: 'no_token' };

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return { success: false, reason: 'product_not_found' };

    const channels = db.prepare('SELECT * FROM telegram_channels WHERE is_active = 1 AND auto_post_new = 1').all();
    if (!channels || channels.length === 0) return { success: false, reason: 'no_auto_channels' };

    const caption = formatProductCaption(product);
    let photoUrl = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=600';
    if (product.images) {
        try {
            const parsed = JSON.parse(product.images);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].startsWith('http')) {
                photoUrl = parsed[0];
            }
        } catch (e) {}
    }

    const results = [];
    for (const ch of channels) {
        try {
            const apiRes = await sendTelegramPhoto(ch.chat_id, photoUrl, caption, token);
            const msgId = apiRes && apiRes.result ? apiRes.result.message_id : null;
            db.prepare(`
                INSERT INTO telegram_posts (product_id, channel_id, telegram_message_id, posted_caption, status)
                VALUES (?, ?, ?, ?, 'posted')
            `).run(productId, ch.id, msgId, caption);
            results.push({ channelId: ch.id, success: true, messageId: msgId });
        } catch (err) {
            // Queue for offline retry
            db.prepare(`
                INSERT INTO telegram_posts (product_id, channel_id, posted_caption, status, last_error)
                VALUES (?, ?, ?, 'pending_retry', ?)
            `).run(productId, ch.id, caption, err.message);
            results.push({ channelId: ch.id, success: false, queued: true, error: err.message });
        }
    }
    return { success: true, results };
}

async function syncPriceChangeOnTelegram(productId, newPrice) {
    const db = getDb();
    const token = getBotToken();
    if (!token) return;

    const posts = db.prepare(`
        SELECT tp.*, tc.chat_id, tc.auto_update_price, p.name, p.storage_rom, p.ram, p.color, p.battery_health_percent, p.warranty_months, p.telegram_description
        FROM telegram_posts tp
        JOIN telegram_channels tc ON tp.channel_id = tc.id
        JOIN products p ON tp.product_id = p.id
        WHERE tp.product_id = ? AND tp.status = 'posted' AND tp.telegram_message_id IS NOT NULL AND tc.auto_update_price = 1
    `).all(productId);

    for (const post of posts) {
        try {
            const newCaption = formatProductCaption(post, null, newPrice);
            await editMessageCaption(post.chat_id, post.telegram_message_id, newCaption, token);
            db.prepare('UPDATE telegram_posts SET posted_caption = ? WHERE id = ?').run(newCaption, post.id);
        } catch (err) {
            console.error('[Telegram Price Sync Error]', err.message);
        }
    }
}

async function syncSoldOutOnTelegram(productId) {
    const db = getDb();
    const token = getBotToken();

    const posts = db.prepare(`
        SELECT tp.*, tc.chat_id, tc.auto_sold_out
        FROM telegram_posts tp
        JOIN telegram_channels tc ON tp.channel_id = tc.id
        WHERE tp.product_id = ? AND tp.status = 'posted' AND tc.auto_sold_out = 1
    `).all(productId);

    for (const post of posts) {
        db.prepare("UPDATE telegram_posts SET status = 'sold_out', sold_out_at = CURRENT_TIMESTAMP WHERE id = ?").run(post.id);
        if (token && post.telegram_message_id) {
            try {
                const soldOutBadge = '\n\n🔴 <b>[نفدت الكمية من المتجر - SOLD OUT]</b>';
                const updatedCaption = (post.posted_caption || '') + soldOutBadge;
                await editMessageCaption(post.chat_id, post.telegram_message_id, updatedCaption, token);
            } catch (err) {
                console.error('[Telegram Sold Out Sync Error]', err.message);
            }
        }
    }
}

async function retryPendingTelegramPosts() {
    const db = getDb();
    const token = getBotToken();
    if (!token) return { count: 0 };

    const pending = db.prepare(`
        SELECT tp.*, tc.chat_id, p.name, p.sell_price, p.storage_rom, p.ram, p.color, p.battery_health_percent, p.warranty_months, p.images
        FROM telegram_posts tp
        JOIN telegram_channels tc ON tp.channel_id = tc.id
        JOIN products p ON tp.product_id = p.id
        WHERE tp.status = 'pending_retry'
    `).all();

    let syncedCount = 0;
    for (const post of pending) {
        try {
            let photoUrl = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=600';
            if (post.images) {
                try {
                    const parsed = JSON.parse(post.images);
                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].startsWith('http')) {
                        photoUrl = parsed[0];
                    }
                } catch (e) {}
            }
            const res = await sendTelegramPhoto(post.chat_id, photoUrl, post.posted_caption, token);
            const msgId = res && res.result ? res.result.message_id : null;
            db.prepare("UPDATE telegram_posts SET status = 'posted', telegram_message_id = ?, last_error = NULL WHERE id = ?").run(msgId, post.id);
            syncedCount++;
        } catch (err) {
            db.prepare('UPDATE telegram_posts SET last_error = ? WHERE id = ?').run(err.message, post.id);
        }
    }
    return { count: syncedCount, remaining: pending.length - syncedCount };
}

module.exports = {
    getBotToken,
    testBotConnection,
    sendTelegramMessage,
    sendTelegramPhoto,
    editMessageCaption,
    formatProductCaption,
    broadcastNewProduct,
    syncPriceChangeOnTelegram,
    syncSoldOutOnTelegram,
    retryPendingTelegramPosts
};
