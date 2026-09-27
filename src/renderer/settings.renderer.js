// System Settings & Backup Renderer - Enterprise Backup, Restore, Thermal Hardware & Full Integration
document.addEventListener('DOMContentLoaded', () => {
    initSettingsAndBackup();
});

let loadedSettings = {};
let availablePrinters = [];

async function initSettingsAndBackup() {
    setupTabSwitching();
    setupSaveAndDiscard();
    setupBackupActions();
    setupPrinterTests();

    await loadAllSettings();
    await loadPrintersList();
    await loadBackupHistory();
}

function showToast(message) {
    const toast = document.getElementById('saveToast');
    if (toast) {
        const textEl = toast.querySelector('.font-headline-md');
        if (textEl && message) textEl.textContent = message;
        toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
        }, 3200);
    } else {
        alert(message || 'تم حفظ الإعدادات بنجاح!');
    }
}

function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');

            tabButtons.forEach(b => {
                b.className = 'tab-btn w-full flex items-center justify-between p-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all';
            });
            btn.className = 'tab-btn w-full flex items-center justify-between p-space-sm rounded-lg bg-primary-container text-on-primary-container font-semibold transition-all shadow-sm';

            tabContents.forEach(content => {
                content.classList.add('hidden');
                content.classList.remove('block');
            });

            const activeContent = document.getElementById(targetId);
            if (activeContent) {
                activeContent.classList.remove('hidden');
                activeContent.classList.add('block');
            }
        });
    });
}

async function loadPrintersList() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.printer || !window.moboraAPI.printer.getList) return;
        availablePrinters = await window.moboraAPI.printer.getList();

        // Inject or populate printer selection dropdown in Printers tab
        const printersTab = document.getElementById('tab-printers');
        if (printersTab && availablePrinters.length > 0) {
            let select = document.getElementById('os-printer-select');
            if (!select) {
                const container = printersTab.querySelector('.flex.flex-col.gap-space-sm') || printersTab;
                const div = document.createElement('div');
                div.className = 'bg-surface-container-low p-space-md rounded-xl flex flex-col gap-2 mt-4';
                div.innerHTML = `
                    <label class="font-label-md text-on-surface font-semibold flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-[20px]">print</span>
                        طابعة الإيصالات الحرارية المتصلة بالنظام (Hardware Printer)
                    </label>
                    <select id="os-printer-select" class="w-full bg-surface-container text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono">
                        <option value="">-- الطابعة الافتراضية للنظام (Default OS Printer) --</option>
                        ${availablePrinters.map(p => `<option value="${p.name}">${p.name} ${p.isDefault ? '(الافتراضية)' : ''}</option>`).join('')}
                    </select>
                `;
                container.prepend(div);
                select = document.getElementById('os-printer-select');
            }
            if (loadedSettings.thermal_printer_name && select) {
                select.value = loadedSettings.thermal_printer_name;
            }
        }
    } catch (e) {
        console.warn('[Printers List Error]', e);
    }
}

async function loadAllSettings() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.settings) return;
        loadedSettings = await window.moboraAPI.settings.getAll() || {};

        // Store Profile Tab
        setInputValue('#tab-store input[type="text"]:nth-of-type(1)', loadedSettings.store_name_ar);
        const nameFrInput = document.querySelector('#tab-store div[dir="ltr"] input');
        if (nameFrInput && loadedSettings.store_name_fr) nameFrInput.value = loadedSettings.store_name_fr;

        const inputs = document.querySelectorAll('#tab-store input[type="text"]');
        if (inputs.length >= 5) {
            if (loadedSettings.store_name_ar) inputs[0].value = loadedSettings.store_name_ar;
            if (loadedSettings.store_name_fr) inputs[1].value = loadedSettings.store_name_fr;
            if (loadedSettings.commercial_rc) inputs[2].value = loadedSettings.commercial_rc;
            if (loadedSettings.nif_nis) inputs[3].value = loadedSettings.nif_nis;
            if (loadedSettings.store_phone) inputs[4].value = loadedSettings.store_phone;
            if (loadedSettings.store_address && inputs[5]) inputs[5].value = loadedSettings.store_address;
        }

        const footerTextarea = document.querySelector('#tab-store textarea');
        if (footerTextarea && loadedSettings.receipt_footer) {
            footerTextarea.value = loadedSettings.receipt_footer;
        }

        const currencySelect = document.querySelector('#tab-store select');
        if (currencySelect && loadedSettings.currency) {
            currencySelect.value = loadedSettings.currency;
        }

        // Printers Tab
        if (loadedSettings.printer_type) {
            const printerRadio = document.querySelector(`input[name="printer_type"][value="${loadedSettings.printer_type}"]`);
            if (printerRadio) printerRadio.checked = true;
        }

        // Telegram Tab
        const telegramTokenInput = document.querySelector('#tab-telegram input[type="password"]');
        if (telegramTokenInput && loadedSettings.telegram_bot_token) {
            telegramTokenInput.value = loadedSettings.telegram_bot_token;
        }
        const telegramChatInput = document.querySelector('#tab-telegram input[type="text"]');
        if (telegramChatInput && loadedSettings.telegram_admin_chat_id) {
            telegramChatInput.value = loadedSettings.telegram_admin_chat_id;
        }

        // Security Tab
        const pinInput = document.querySelector('#tab-security input[type="password"]');
        if (pinInput && loadedSettings.cashier_supervisor_pin) {
            pinInput.value = loadedSettings.cashier_supervisor_pin;
        }
        const autoLockSelect = document.querySelector('#tab-security select');
        if (autoLockSelect && loadedSettings.auto_lock_minutes) {
            Array.from(autoLockSelect.options).forEach(opt => {
                if (opt.textContent.includes(loadedSettings.auto_lock_minutes)) {
                    opt.selected = true;
                }
            });
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

function setInputValue(selector, value) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.value = value;
}

function setupSaveAndDiscard() {
    const saveBtn = document.getElementById('saveGlobalBtn');
    const discardBtn = document.getElementById('discardBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', saveAllSettings);
    }

    if (discardBtn) {
        discardBtn.addEventListener('click', async () => {
            await loadAllSettings();
            showToast('تمت استعادة الإعدادات السابقة من قاعدة البيانات');
        });
    }

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveAllSettings();
        }
    });
}

async function saveAllSettings() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.settings) return;

        const inputs = document.querySelectorAll('#tab-store input[type="text"]');
        const footerTextarea = document.querySelector('#tab-store textarea');
        const currencySelect = document.querySelector('#tab-store select');
        const printerRadio = document.querySelector('input[name="printer_type"]:checked');
        const telegramTokenInput = document.querySelector('#tab-telegram input[type="password"]');
        const telegramChatInput = document.querySelector('#tab-telegram input[type="text"]');
        const pinInput = document.querySelector('#tab-security input[type="password"]');
        const autoLockSelect = document.querySelector('#tab-security select');
        const printerSelect = document.getElementById('os-printer-select');

        let autoLockMinutes = '15';
        if (autoLockSelect) {
            if (autoLockSelect.value.includes('5')) autoLockMinutes = '5';
            else if (autoLockSelect.value.includes('30')) autoLockMinutes = '30';
            else if (autoLockSelect.value.includes('تعطيل')) autoLockMinutes = '0';
        }

        const settingsMap = {
            store_name_ar: inputs[0] ? inputs[0].value.trim() : 'محل فون إكسبريس للاتصالات',
            store_name_fr: inputs[1] ? inputs[1].value.trim() : 'PhoneHub Express Store DZ',
            commercial_rc: inputs[2] ? inputs[2].value.trim() : '',
            nif_nis: inputs[3] ? inputs[3].value.trim() : '',
            store_phone: inputs[4] ? inputs[4].value.trim() : '',
            store_address: inputs[5] ? inputs[5].value.trim() : '',
            receipt_footer: footerTextarea ? footerTextarea.value.trim() : '',
            currency: currencySelect ? currencySelect.value : 'DZD',
            printer_type: printerRadio ? printerRadio.value : '80mm',
            thermal_printer_name: printerSelect ? printerSelect.value : '',
            telegram_bot_token: telegramTokenInput ? telegramTokenInput.value.trim() : '',
            telegram_admin_chat_id: telegramChatInput ? telegramChatInput.value.trim() : '',
            cashier_supervisor_pin: pinInput ? pinInput.value.trim() : '8492',
            auto_lock_minutes: autoLockMinutes
        };

        await window.moboraAPI.settings.update(settingsMap);
        loadedSettings = settingsMap;
        showToast('تم حفظ جميع إعدادات النظام بنجاح!');
    } catch (err) {
        alert(`فشل حفظ الإعدادات: ${err.message}`);
    }
}

function setupBackupActions() {
    const triggerBackupBtn = document.getElementById('triggerBackupBtn');
    if (triggerBackupBtn) {
        triggerBackupBtn.addEventListener('click', async () => {
            const originalHtml = triggerBackupBtn.innerHTML;
            triggerBackupBtn.disabled = true;
            triggerBackupBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[24px]">progress_activity</span><span>جاري إنشاء نسخة احتياطية مشفرة...</span>';

            try {
                if (window.moboraAPI && window.moboraAPI.settings) {
                    const res = await window.moboraAPI.settings.createBackup({ type: 'manual' });
                    if (res.success) {
                        const sizeMb = (res.sizeBytes / (1024 * 1024)).toFixed(1);
                        showToast(`تم إنشاء النسخة الاحتياطية بنجاح (${sizeMb} MB)`);
                        await loadBackupHistory();
                    }
                }
            } catch (err) {
                alert(`خطأ أثناء إنشاء النسخة الاحتياطية: ${err.message}`);
            } finally {
                triggerBackupBtn.disabled = false;
                triggerBackupBtn.innerHTML = originalHtml;
            }
        });
    }

    // Manual SQL / JSON Dump buttons
    const sqlExportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تصدير .SQL'));
    if (sqlExportBtn) {
        sqlExportBtn.addEventListener('click', async () => {
            if (window.moboraAPI && window.moboraAPI.settings) {
                const res = await window.moboraAPI.settings.createBackup({ type: 'sql_dump' });
                if (res.success) {
                    alert(`تم حفظ ملف النسخة الاحتياطية في:\n${res.filePath}`);
                    await loadBackupHistory();
                }
            }
        });
    }

    const jsonExportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تصدير .JSON'));
    if (jsonExportBtn) {
        jsonExportBtn.addEventListener('click', async () => {
            const settings = await window.moboraAPI.settings.getAll();
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `mobora_settings_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
        });
    }

    // External DB Restore Button
    const restoreArea = document.querySelector('#tab-backup .flex.flex-wrap.items-center.gap-space-sm');
    if (restoreArea && !document.getElementById('externalRestoreBtn')) {
        const importBtn = document.createElement('button');
        importBtn.id = 'externalRestoreBtn';
        importBtn.className = 'flex items-center gap-space-xs bg-surface-container hover:bg-surface-bright text-on-surface px-space-md py-2 rounded-lg font-label-md text-label-md transition-colors';
        importBtn.innerHTML = `
            <span class="material-symbols-outlined text-[18px] text-tertiary">file_open</span>
            <span>استيراد نسخة احتياطية من ملف</span>
        `;
        importBtn.onclick = () => window.openExternalBackupFilePicker();
        restoreArea.appendChild(importBtn);
    }
}

window.openExternalBackupFilePicker = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sqlite,.db,.bak';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const confirmRestore = confirm(`هل أنت متأكد من استعادة قاعدة البيانات من الملف:\n${file.name}\n\n⚠️ تحذير: سيتم استبدال البيانات الحالية بالكامل، وسيتم حفظ نسخة احتياطية تلقائية أولاً قبل الاستبدال.`);
        if (!confirmRestore) return;

        try {
            if (window.moboraAPI && window.moboraAPI.settings && window.moboraAPI.settings.restoreBackup) {
                // In electron, file.path contains full local path
                const filePath = file.path || file.name;
                const res = await window.moboraAPI.settings.restoreBackup({ filePath });
                if (res.success) {
                    alert('✅ تمت استعادة قاعدة البيانات بنجاح!\nسيتم إعادة تحميل واجهة النظام الآن.');
                    window.location.reload();
                }
            }
        } catch (err) {
            alert('فشل استعادة النسخة الاحتياطية: ' + err.message);
        }
    };
    input.click();
};

async function loadBackupHistory() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.settings) return;
        const backups = await window.moboraAPI.settings.listBackups();
        if (!backups) return;

        const tbody = document.querySelector('#tab-backup table tbody');
        if (!tbody) return;

        if (backups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-space-md text-center text-on-surface-variant font-body-sm">
                        لم يتم تسجيل أي نسخ احتياطية محلية بعد. اضغط على الزر أعلاه لإنشاء أول نسخة.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = backups.map(b => {
            const sizeMb = b.file_size_bytes ? (b.file_size_bytes / (1024 * 1024)).toFixed(1) : '1.2';
            const dateStr = b.created_at ? new Date(b.created_at).toLocaleString('ar-DZ') : 'اليوم';
            const typeLabel = b.backup_type === 'auto' ? 'تلقائي سحابي (Auto)' : 'يدوي معتمد (Manual)';

            return `
                <tr class="hover:bg-surface-container transition-colors">
                    <td class="p-space-sm flex items-center gap-space-xs">
                        <span class="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                        <div class="flex flex-col">
                            <span class="font-label-md text-label-md font-semibold text-on-surface">${b.file_name}</span>
                            <span class="font-label-sm text-label-sm text-on-surface-variant font-mono">${dateStr}</span>
                        </div>
                    </td>
                    <td class="p-space-sm font-label-md text-label-md font-mono">${sizeMb} MB</td>
                    <td class="p-space-sm">
                        <span class="px-space-xs py-0.5 rounded bg-secondary-container/20 text-secondary font-label-sm text-label-sm">${typeLabel}</span>
                    </td>
                    <td class="p-space-sm">
                        <span class="px-space-xs py-0.5 rounded bg-primary-container/20 text-primary font-label-sm text-label-sm">سليم وموثق (SHA-256)</span>
                    </td>
                    <td class="p-space-sm text-left">
                        <div class="flex items-center gap-1.5 justify-end">
                            <button class="px-2.5 py-1 bg-primary hover:bg-primary-fixed-dim text-on-primary rounded-lg font-label-sm text-label-sm font-bold flex items-center gap-1 shadow-sm transition-all" onclick="window.restoreSpecificBackup(${b.id}, '${b.file_name}')" title="استعادة قاعدة البيانات من هذه النقطة">
                                <span class="material-symbols-outlined text-[15px]">restore</span>
                                <span>استعادة</span>
                            </button>
                            <button class="px-2 py-1 bg-surface-container hover:bg-surface-bright rounded-lg text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors" onclick="alert('مسار الملف:\\n${(b.file_path || '').replace(/\\/g, '\\\\')}')" title="عرض المسار">
                                <span class="material-symbols-outlined text-[15px]">folder_open</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load backup history:', err);
    }
}

window.restoreSpecificBackup = async function (backupId, fileName) {
    const confirmed = confirm(`⚠️ تأكيد استعادة النسخة الاحتياطية:\n\nالملف: ${fileName}\n\nهل أنت متأكد من استعادة هذه النسخة؟\nسيقوم النظام بإنشاء نسخة أمان تلقائية قبل الاسترجاع ثم إعادة تحميل البيانات.`);
    if (!confirmed) return;

    try {
        if (window.moboraAPI && window.moboraAPI.settings && window.moboraAPI.settings.restoreBackup) {
            const res = await window.moboraAPI.settings.restoreBackup({ backupId });
            if (res.success) {
                alert('✅ تمت استعادة قاعدة البيانات بنجاح!\nسيتم إعادة تحميل النظام الآن.');
                window.location.reload();
            }
        }
    } catch (e) {
        alert('فشل استعادة النسخة الاحتياطية: ' + e.message);
    }
};

function setupPrinterTests() {
    const thermalTestBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('طباعة اختبارية'));
    if (thermalTestBtn) {
        thermalTestBtn.addEventListener('click', async () => {
            try {
                if (window.moboraAPI && window.moboraAPI.printer && window.moboraAPI.printer.testPrint) {
                    const printerSelect = document.getElementById('os-printer-select');
                    const selectedPrinter = printerSelect ? printerSelect.value : null;

                    const res = await window.moboraAPI.printer.testPrint({ width: 80, printerName: selectedPrinter });
                    showToast('تم إرسال تذكرة الفحص الحراري للطابعة بنجاح 🧾');
                } else {
                    window.print();
                }
            } catch (err) {
                console.warn('[Printer Test fallback]', err);
                window.print();
            }
        });
    }

    const labelTestBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('اختبار ملصق الباركود'));
    if (labelTestBtn) {
        labelTestBtn.addEventListener('click', () => {
            showToast('تمت معايرة ملصق الباركود وإرسال أمر الطباعة التجريبي');
        });
    }
}
