// Thermal Receipt & Ticket Printing Service (80mm & 58mm ESC/POS / Electron Print)
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');

function getStoreSettings() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    for (const r of rows) {
        settings[r.key] = r.value;
    }
    return {
        name: settings.store_name || 'محل موبورا للهواتف والملحقات',
        phone: settings.store_phone || '0550 12 34 56',
        address: settings.store_address || 'الجزائر العاصمة — شارع ديدوش مراد',
        header: settings.receipt_header || 'أهلاً وسهلاً بكم في متجرنا',
        footer: settings.receipt_footer || 'شكراً لزيارتكم! يرجى الاحتفاظ بالوصل للاستفادة من الضمان.',
        defaultWidth: Number(settings.printer_paper_width) || 80,
        printerName: settings.thermal_printer_name || ''
    };
}

function generateInvoiceHtml(sale, items, store, width = 80) {
    const paperWidthPx = width === 58 ? '190px' : '280px';
    const fontSizeBase = width === 58 ? '10px' : '12px';
    const formattedDate = new Date(sale.created_at || Date.now()).toLocaleString('ar-DZ');

    const itemsHtml = items.map(item => `
        <tr style="border-bottom: 1px dashed #ccc;">
            <td style="padding: 4px 0; text-align: right;">
                <div style="font-weight: bold;">${item.product_name}</div>
                ${item.imei1 ? `<div style="font-size: 8px; color: #555;" dir="ltr">IMEI: ${item.imei1}</div>` : ''}
                ${item.warranty_months ? `<div style="font-size: 9px; color: #2e7d32;">ضمان: ${item.warranty_months} شهر</div>` : ''}
            </td>
            <td style="padding: 4px 0; text-align: center;">${item.quantity}</td>
            <td style="padding: 4px 0; text-align: left; font-weight: bold;">${Number(item.subtotal).toLocaleString()} دج</td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="utf-8">
        <style>
            @page { margin: 0; size: auto; }
            body {
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                margin: 0;
                padding: 8px;
                width: ${paperWidthPx};
                font-size: ${fontSizeBase};
                color: #000;
                background: #fff;
                line-height: 1.3;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px solid #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-box {
                background: #f0f0f0;
                border: 1px solid #000;
                padding: 6px;
                margin: 6px 0;
                text-align: center;
            }
            .total-amount { font-size: 16px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: inherit; }
            th { border-bottom: 1px solid #000; padding: 3px 0; text-align: right; }
        </style>
    </head>
    <body>
        <div class="text-center">
            <h2 style="margin: 0; font-size: 15px;">${store.name}</h2>
            <div style="font-size: 10px; margin-top: 2px;">${store.address}</div>
            <div style="font-size: 10px;">هاتف: ${store.phone}</div>
            <div class="divider"></div>
            <div style="font-size: 11px; font-weight: bold;">فاتورة بيع رسمية</div>
            <div style="font-size: 9px; color: #333;" dir="ltr"><b>${sale.invoice_number}</b></div>
            <div style="font-size: 9px;">التاريخ: ${formattedDate}</div>
            ${sale.customer_name ? `<div style="font-size: 9px;">العميل: ${sale.customer_name}</div>` : ''}
        </div>

        <div class="divider"></div>

        <table>
            <thead>
                <tr>
                    <th style="text-align: right;">الصنف</th>
                    <th style="text-align: center; width: 25px;">الكمية</th>
                    <th style="text-align: left; width: 60px;">المبلغ</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="divider"></div>

        <div class="row">
            <span>المجموع الفرعي:</span>
            <span>${Number(sale.subtotal).toLocaleString()} دج</span>
        </div>
        ${sale.discount > 0 ? `
        <div class="row" style="color: #c62828;">
            <span>الخصم الممنوح:</span>
            <span>-${Number(sale.discount).toLocaleString()} دج</span>
        </div>
        ` : ''}

        <div class="total-box">
            <div>المجموع الإجمالي الواجب دفعه</div>
            <div class="total-amount">${Number(sale.total_amount).toLocaleString()} دج</div>
            <div style="font-size: 9px; margin-top: 2px;">طريقة الدفع: ${sale.payment_method === 'cash' ? 'نقداً (كاش)' : sale.payment_method}</div>
        </div>

        <div class="divider"></div>

        <div class="text-center" style="font-size: 9px; color: #444; margin-top: 6px;">
            <div>${store.footer}</div>
            <div style="margin-top: 4px; font-weight: bold;">*** Mobora Phone Store OS ***</div>
        </div>
    </body>
    </html>
    `;
}

function generateRepairTicketHtml(repair, store, width = 80) {
    const paperWidthPx = width === 58 ? '190px' : '280px';
    const fontSizeBase = width === 58 ? '10px' : '12px';
    const formattedDate = new Date(repair.created_at || Date.now()).toLocaleString('ar-DZ');

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="utf-8">
        <style>
            @page { margin: 0; size: auto; }
            body {
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                margin: 0;
                padding: 8px;
                width: ${paperWidthPx};
                font-size: ${fontSizeBase};
                color: #000;
                background: #fff;
                line-height: 1.3;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .box { border: 1px solid #000; padding: 6px; margin: 6px 0; }
        </style>
    </head>
    <body>
        <div class="text-center">
            <h2 style="margin: 0; font-size: 15px;">${store.name}</h2>
            <div style="font-size: 10px;">ورشة الصيانة والدعم الفني</div>
            <div style="font-size: 10px;">هاتف: ${store.phone}</div>
            <div class="divider"></div>
            <div style="font-size: 12px; font-weight: bold;">وصل استلام جهاز للصيانة</div>
            <div style="font-size: 11px; font-weight: bold;" dir="ltr"><b>${repair.ticket_number}</b></div>
            <div style="font-size: 9px;">تاريخ الاستلام: ${formattedDate}</div>
        </div>

        <div class="divider"></div>

        <div class="row"><b>العميل:</b> <span>${repair.customer_name}</span></div>
        <div class="row"><b>الهاتف:</b> <span dir="ltr">${repair.customer_phone || '---'}</span></div>
        <div class="row"><b>الجهاز:</b> <span>${repair.device_brand} ${repair.device_model}</span></div>
        ${repair.imei_or_sn ? `<div class="row"><b>IMEI / SN:</b> <span dir="ltr" style="font-size: 9px;">${repair.imei_or_sn}</span></div>` : ''}
        ${repair.device_passcode ? `<div class="row"><b>كلمة السر:</b> <span>${repair.device_passcode}</span></div>` : ''}

        <div class="box">
            <b>العطل المشخص / شكوى العميل:</b>
            <div style="font-size: 10px; margin-top: 2px;">${repair.issue_description || 'فحص عام وإصلاح'}</div>
        </div>

        <div class="row">
            <span>التكلفة التقديرية:</span>
            <b>${Number(repair.estimated_cost || 0).toLocaleString()} دج</b>
        </div>
        <div class="row">
            <span>العربون المدفوع مسبقاً:</span>
            <b>${Number(repair.deposit_prepaid || 0).toLocaleString()} دج</b>
        </div>
        <div class="row" style="color: #c62828;">
            <span>المبلغ المتبقي عند الاستلام:</span>
            <b>${Number((repair.estimated_cost || 0) - (repair.deposit_prepaid || 0)).toLocaleString()} دج</b>
        </div>

        <div class="divider"></div>

        <div style="font-size: 8px; color: #555; text-align: justify;">
            * تنبيه: المحل غير مسؤول عن فقدان البيانات الشخصية. يرجى إحضار هذا الوصل أصلياً لاستلام جهازك. الأجهزة غير المستلمة بعد 45 يوماً يتم التصرف فيها لتغطية تكاليف الفحص.
        </div>

        <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 9px;">
            <span>توقيع العميل: .................</span>
            <span>ختم المحل: .................</span>
        </div>
    </body>
    </html>
    `;
}

async function printHtml(html, width = 80, silent = true, printerName = null) {
    return new Promise(async (resolve, reject) => {
        let win = null;
        try {
            win = new BrowserWindow({
                show: false,
                width: 350,
                height: 600,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

            const printOptions = {
                silent: silent,
                printBackground: true,
                margins: { marginType: 'none' }
            };

            if (printerName && printerName.trim() !== '') {
                printOptions.deviceName = printerName.trim();
            }

            win.webContents.print(printOptions, (success, failureReason) => {
                if (win && !win.isDestroyed()) win.close();
                if (success) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, reason: failureReason });
                }
            });
        } catch (err) {
            if (win && !win.isDestroyed()) win.close();
            reject(err);
        }
    });
}

async function exportHtmlToPdf(html, outputPath) {
    const win = new BrowserWindow({
        show: false,
        width: 350,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    try {
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: 'none' }
        });
        fs.writeFileSync(outputPath, pdfData);
        return { success: true, path: outputPath };
    } finally {
        if (!win.isDestroyed()) win.close();
    }
}

async function getAvailablePrinters() {
    const win = new BrowserWindow({ show: false });
    try {
        const printers = await win.webContents.getPrintersAsync();
        return printers;
    } finally {
        if (!win.isDestroyed()) win.close();
    }
}

module.exports = {
    getStoreSettings,
    generateInvoiceHtml,
    generateRepairTicketHtml,
    printHtml,
    exportHtmlToPdf,
    getAvailablePrinters
};
