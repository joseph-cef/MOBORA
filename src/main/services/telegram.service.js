// Telegram Bot Service (Direct Telegram Bot API via axios/fetch)
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

    // If it's a URL or if local file
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

module.exports = {
    getBotToken,
    testBotConnection,
    sendTelegramMessage,
    sendTelegramPhoto,
    editMessageCaption
};
