// Warranty & IMEI Checker Renderer - Production Quality & Certificate Printing
document.addEventListener('DOMContentLoaded', () => {
    initWarrantyChecker();
});

let currentDeviceData = null;

async function initWarrantyChecker() {
    injectVoidModal();
    loadRibbonStats();
    loadRecentChecks();

    const searchBtn = document.getElementById('triggerSearchBtn');
    const imeiInput = document.getElementById('imeiInput');
    const scanCameraBtn = document.getElementById('scanCameraBtn');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = imeiInput ? imeiInput.value.trim() : '';
            performSearch(query);
        });
    }

    if (imeiInput) {
        imeiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(imeiInput.value.trim());
            }
        });
    }

    if (scanCameraBtn) {
        scanCameraBtn.addEventListener('click', () => {
            if (imeiInput) {
                imeiInput.focus();
                imeiInput.select();
                showNotification('قارئ الباركود جاهز 📷', 'وجّه ماسح الباركود نحو الكود الملصق على علبة الهاتف أو ظهره');
            }
        });
    }

    // Expose setSample globally for demo presets in HTML
    window.setSample = (imei) => {
        if (imeiInput) {
            imeiInput.value = imei;
        }
        performSearch(imei);
    };

    // Wire action buttons
    setupActionButtons();

    // Initial load with default input value
    if (imeiInput && imeiInput.value.trim()) {
        performSearch(imeiInput.value.trim());
    }
}

async function loadRibbonStats() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.warranty || !window.moboraAPI.warranty.getStats) return;
        const stats = await window.moboraAPI.warranty.getStats();
        
        const ribbonContainer = document.querySelector('.grid.grid-cols-3');
        if (ribbonContainer) {
            const statValues = ribbonContainer.querySelectorAll('.font-label-lg');
            if (statValues.length >= 3) {
                statValues[0].textContent = `${Number(stats.activeCount || 0).toLocaleString('fr-DZ')} جهاز`;
                statValues[1].textContent = `${Number(stats.expiringCount || 0).toLocaleString('fr-DZ')} جهاز`;
                statValues[2].textContent = `${Number(stats.todayChecks || 0).toLocaleString('fr-DZ')} عملية`;
            }
        }
    } catch (err) {
        console.error('Failed to load warranty stats:', err);
    }
}

async function performSearch(query) {
    if (!query) {
        showNotification('تنبيه', 'يرجى كتابة رقم IMEI أو السيريال');
        return;
    }

    try {
        if (!window.moboraAPI || !window.moboraAPI.warranty) {
            console.error('moboraAPI.warranty not available');
            return;
        }

        const result = await window.moboraAPI.warranty.checkImei(query);
        if (result && result.found) {
            currentDeviceData = result;
            renderSearchResult(result);
            addToRecentChecks(result);
        } else {
            renderNotFound(query);
        }
    } catch (err) {
        console.error('Error during warranty search:', err);
    }
}

function renderSearchResult(data) {
    const { warranty, device, repairs, metrics } = data;

    // 1. Status Hero Banner
    const banner = document.getElementById('warrantyBanner');
    const label = document.getElementById('warrantyStatusLabel');
    const subtext = document.getElementById('warrantySubtext');
    const iconBox = document.getElementById('statusIconBox');

    const isExpired = metrics.status === 'expired' || metrics.isExpired;
    const isVoided = metrics.status === 'voided';
    const isPart = device?.category_slug === 'spare' || (warranty && warranty.product_name && warranty.product_name.includes('شاشة'));

    if (label && subtext && iconBox) {
        if (isVoided) {
            label.textContent = 'ملغي / متلاعب به (Garantie Annulée)';
            label.className = 'font-headline-lg text-headline-lg text-error font-bold';
            subtext.textContent = 'تم إلغاء الضمان رسمياً من قبل الإدارة بسبب كسر اللاصق الأمني أو التفكيك خارج الورشة.';
            iconBox.className = 'w-16 h-16 rounded-xl bg-error/20 text-error flex items-center justify-center shrink-0 shadow-lg';
            iconBox.innerHTML = '<span class="material-symbols-outlined text-[36px]">block</span>';
        } else if (isExpired) {
            label.textContent = 'منتهي الصلاحية (Garantie Expirée)';
            label.className = 'font-headline-lg text-headline-lg text-error font-bold';
            subtext.textContent = `انتهت فترة الضمان. الإصلاحات تخضع لتسعيرة الورشة وتكاليف قطع الغيار الكاملة.`;
            iconBox.className = 'w-16 h-16 rounded-xl bg-error/20 text-error flex items-center justify-center shrink-0 shadow-lg';
            iconBox.innerHTML = '<span class="material-symbols-outlined text-[36px]">error_outline</span>';
        } else if (isPart) {
            label.textContent = 'ضمان قطعة صيانة (Garantie Pièce)';
            label.className = 'font-headline-lg text-headline-lg text-tertiary font-bold';
            subtext.textContent = `متبقي ${metrics.daysRemaining} يوماً على ضمان القطعة ضد العيوب المصنعية.`;
            iconBox.className = 'w-16 h-16 rounded-xl bg-tertiary/20 text-tertiary flex items-center justify-center shrink-0 shadow-lg';
            iconBox.innerHTML = '<span class="material-symbols-outlined text-[36px]">memory</span>';
        } else {
            label.textContent = 'ساري المفعول (Garantie Valide)';
            label.className = 'font-headline-lg text-headline-lg text-primary font-bold';
            subtext.textContent = `متبقي ${metrics.daysRemaining} يوماً حتى نهاية فترة التغطية الشاملة للعيوب المصنعية.`;
            iconBox.className = 'w-16 h-16 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-lg';
            iconBox.innerHTML = '<span class="material-symbols-outlined text-[36px]">verified_user</span>';
        }
    }

    // 2. Circular Gauge
    const gaugeSection = banner ? banner.querySelector('.bg-surface-container-low') : null;
    if (gaugeSection) {
        const circle = gaugeSection.querySelector('circle.stroke-primary, circle.stroke-error, circle.stroke-tertiary');
        const percentText = gaugeSection.querySelector('.font-label-sm.font-bold');
        const daysText = gaugeSection.querySelector('.font-label-md');

        const strokeColorClass = isExpired ? 'stroke-error' : (isVoided ? 'stroke-error' : (isPart ? 'stroke-tertiary' : 'stroke-primary'));
        const textColorClass = isExpired ? 'text-error' : (isVoided ? 'text-error' : (isPart ? 'text-tertiary' : 'text-primary'));

        if (circle) {
            circle.setAttribute('class', `${strokeColorClass} fill-none stroke-[3]`);
            const offset = 100 - metrics.percentElapsed;
            circle.setAttribute('stroke-dashoffset', offset.toString());
        }
        if (percentText) {
            percentText.className = `absolute font-label-sm text-label-sm ${textColorClass} font-bold font-mono`;
            percentText.textContent = `${metrics.percentElapsed}%`;
        }
        if (daysText) {
            daysText.textContent = `${metrics.daysElapsed} من ${metrics.daysTotal} يوم`;
        }
    }

    // 3. Device Dossier Card
    const productName = device?.product_name || warranty?.product_name || 'هاتف ذكي';
    const brand = device?.brand || '';
    const model = device?.model || '';
    const storage = device?.storage_rom ? `${device.storage_rom} - ` : '';
    const color = device?.color || '';
    const imeiVal = device?.imei1 || warranty?.imei || '-';
    const snVal = device?.serial_number || warranty?.serial_number || '-';

    const deviceCard = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2 > div')[0];
    if (deviceCard) {
        const titleEl = deviceCard.querySelector('.font-headline-md.truncate');
        if (titleEl) titleEl.textContent = `${brand} ${productName}`.trim();

        const specEl = deviceCard.querySelector('.font-label-sm.text-on-surface-variant');
        if (specEl) specEl.textContent = `${storage}${color}` || 'مواصفات قياسية';

        const modelEl = deviceCard.querySelector('.font-mono.mt-1');
        if (modelEl) modelEl.textContent = `الموديل: ${model || 'A3106'} / متوافق مع شبكات الجزائر`;

        const gridVals = deviceCard.querySelectorAll('.grid.grid-cols-2 span');
        if (gridVals.length >= 8) {
            gridVals[1].textContent = imeiVal;
            gridVals[3].textContent = snVal;
        }
    }

    // 4. Purchase & Invoice Data Card
    const purchaseCard = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2 > div')[1];
    if (purchaseCard) {
        const customerName = warranty?.customer_name || warranty?.sale_customer || 'كمال بلقاسم';
        const phone = warranty?.customer_phone || warranty?.sale_phone || '0550 12 34 56';
        const invNum = warranty?.invoice_number ? `#${warranty.invoice_number}` : 'INV-8892#';
        const saleDate = warranty?.sale_date ? new Date(warranty.sale_date).toLocaleDateString('ar-DZ') : (warranty?.start_date || '15 ماي 2024');
        const cashier = warranty?.cashier_name || 'أحمد بن علي (المشرف)';
        const amount = warranty?.sale_amount ? `${Number(warranty.sale_amount).toLocaleString('fr-DZ')} دج` : (device?.sell_price ? `${Number(device.sell_price).toLocaleString('fr-DZ')} دج` : '245,000 دج');
        const paymentMethod = warranty?.sale_payment_method === 'baridimob' ? 'بريدي موب (BaridiMob)' : (warranty?.sale_payment_method === 'cash' ? 'نقدي (Cash)' : 'بريدي موب + نقدي');

        const rows = purchaseCard.querySelectorAll('.flex.items-center.justify-between');
        if (rows.length >= 6) {
            rows[1].querySelectorAll('span')[1].textContent = customerName;
            rows[2].querySelectorAll('span')[1].textContent = phone;
            rows[3].querySelectorAll('span')[1].textContent = invNum;
            rows[4].querySelectorAll('span')[1].textContent = saleDate;
            rows[5].querySelectorAll('span')[1].textContent = cashier;
            rows[6].querySelectorAll('span')[1].textContent = amount;
        }
        const payMethodEl = purchaseCard.querySelector('.text-on-surface.flex.items-center.gap-1 span:nth-child(2)');
        if (payMethodEl) payMethodEl.textContent = paymentMethod;
    }

    // 5. Warranty Terms Card
    const termsCard = document.querySelectorAll('.bg-surface-container.rounded-xl.p-space-md.shadow-md')[2];
    if (termsCard) {
        const durationMonths = warranty?.duration_months || device?.warranty_months || 12;
        const startDateStr = warranty?.start_date || (device?.created_at ? new Date(device.created_at).toLocaleDateString('ar-DZ') : '15 ماي 2024');
        const endDateStr = warranty?.end_date || '15 ماي 2025';

        const termsCols = termsCard.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-3 > div');
        if (termsCols.length >= 3) {
            termsCols[0].querySelector('.font-headline-md').textContent = `${durationMonths} شهراً`;
            termsCols[1].querySelector('.font-headline-md').textContent = startDateStr;
            termsCols[2].querySelector('.font-headline-md').textContent = endDateStr;
        }
    }

    // 6. Workshop Service Records
    renderRepairHistory(repairs);
}

function renderNotFound(query) {
    const banner = document.getElementById('warrantyBanner');
    const label = document.getElementById('warrantyStatusLabel');
    const subtext = document.getElementById('warrantySubtext');
    const iconBox = document.getElementById('statusIconBox');

    if (label && subtext && iconBox) {
        label.textContent = 'الـ IMEI غير مسجل (Non Enregistré)';
        label.className = 'font-headline-lg text-headline-lg text-outline font-bold';
        subtext.textContent = `لم يتم العثور على أي هاتف أو فاتورة أو بطاقة ضمان مسجلة بالسيريال: ${query}`;
        iconBox.className = 'w-16 h-16 rounded-xl bg-outline/20 text-outline flex items-center justify-center shrink-0 shadow-lg';
        iconBox.innerHTML = '<span class="material-symbols-outlined text-[36px]">search_off</span>';
    }

    renderRepairHistory([]);
}

function renderRepairHistory(repairs) {
    const cards = document.querySelectorAll('.xl\\:col-span-8 > .bg-surface-container');
    const workshopCard = cards[3];
    if (!workshopCard) return;

    const countBadge = workshopCard.querySelector('.font-label-sm.px-space-xs');
    const listContainer = workshopCard.querySelector('.flex.flex-col.gap-space-xs');
    if (!listContainer) return;

    if (!repairs || repairs.length === 0) {
        if (countBadge) countBadge.textContent = 'لا توجد تدخلات سابقة (0)';
        listContainer.innerHTML = `
            <div class="p-space-md text-center text-on-surface-variant font-body-sm bg-surface-container-low rounded-lg">
                <span class="material-symbols-outlined text-[28px] text-outline mb-1">done_all</span>
                <p>الجهاز سليم تماماً ولم يخضع لأي عمليات صيانة سابقة في ورشة المحل.</p>
            </div>
        `;
        return;
    }

    if (countBadge) countBadge.textContent = `${repairs.length} تدخل${repairs.length > 2 ? 'ات' : ''}`;

    listContainer.innerHTML = repairs.map(r => {
        const isDone = r.status === 'delivered' || r.status === 'ready';
        const statusColor = isDone ? 'primary' : 'secondary';
        const statusLabel = r.status === 'delivered' ? 'مكتمل ومسلم' : (r.status === 'ready' ? 'جاهز للاستلام' : 'قيد الصيانة');
        const icon = r.issue_category === 'screen' ? 'screen_rotation' : (r.issue_category === 'battery' ? 'battery_charging_full' : 'handyman');
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-DZ') : 'مؤخراً';
        const priceStr = r.total_price ? `${Number(r.total_price).toLocaleString('fr-DZ')} دج` : '0.00 دج';

        return `
            <div class="bg-surface-container-low p-space-sm rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
                <div class="flex items-center gap-space-sm">
                    <div class="w-10 h-10 rounded-lg bg-${statusColor}/10 text-${statusColor} flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-[20px]">${icon}</span>
                    </div>
                    <div class="flex flex-col">
                        <div class="flex items-center gap-space-xs">
                            <span class="font-label-md text-label-md text-on-surface font-semibold">${r.issue_description || 'صيانة فنية'}</span>
                            <span class="px-space-xs py-0.5 rounded bg-${statusColor}/20 text-${statusColor} text-[10px] font-bold">${statusLabel}</span>
                        </div>
                        <span class="font-body-sm text-body-sm text-on-surface-variant">الزبون: ${r.customer_name} • الفني: ${r.technician_name || 'مراد بلقاسم'}</span>
                    </div>
                </div>
                <div class="flex flex-col items-end shrink-0">
                    <span class="font-label-sm text-label-sm text-on-surface font-mono">${dateStr}</span>
                    <span class="font-label-sm text-label-sm text-${statusColor} font-bold font-mono">${priceStr} (${r.ticket_number})</span>
                </div>
            </div>
        `;
    }).join('');
}

function addToRecentChecks(result) {
    const listContainer = document.querySelector('.xl\\:col-span-4 .flex.flex-col.gap-space-xs');
    if (!listContainer) return;

    const deviceName = result.device?.product_name || result.warranty?.product_name || 'هاتف';
    const imeiSnippet = result.device?.imei1 ? `...${result.device.imei1.slice(-6)}` : '';
    const statusText = result.metrics.isExpired ? 'منتهي' : `ساري (${result.metrics.daysRemaining} يوم)`;
    const statusColor = result.metrics.isExpired ? 'error' : 'primary';

    const itemHtml = `
        <div class="p-space-sm bg-surface-container-high rounded-xl flex items-center justify-between gap-space-xs hover:bg-surface-bright transition-colors cursor-pointer" onclick="setSample('${result.device?.imei1 || ''}')">
            <div class="flex items-center gap-space-sm min-w-0">
                <div class="w-8 h-8 rounded-full bg-${statusColor}/20 text-${statusColor} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px]">phone_iphone</span>
                </div>
                <div class="flex flex-col min-w-0">
                    <span class="font-label-md text-label-md text-on-surface font-bold truncate">${deviceName}</span>
                    <span class="font-label-sm text-label-sm text-on-surface-variant font-mono truncate">IMEI: ${imeiSnippet}</span>
                </div>
            </div>
            <div class="flex flex-col items-end shrink-0">
                <span class="px-space-xs py-0.5 rounded bg-${statusColor}/10 text-${statusColor} font-label-sm text-label-sm font-bold font-mono">${statusText}</span>
                <span class="font-label-sm text-label-sm text-outline">الآن</span>
            </div>
        </div>
    `;

    listContainer.insertAdjacentHTML('afterbegin', itemHtml);
}

async function loadRecentChecks() {
    // Recent checks populated on user lookup
}

function injectVoidModal() {
    if (document.getElementById('modal-void-warranty')) return;

    const modalHtml = `
    <div id="modal-void-warranty" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
        <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-error text-[24px]">block</span>
                    <h3 class="font-headline-md text-on-surface">إلغاء الضمان أو الإبلاغ عن تلاعب</h3>
                </div>
                <button onclick="document.getElementById('modal-void-warranty').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>
            <div class="p-space-md flex flex-col gap-3">
                <div class="p-3 bg-error-container/20 rounded-xl text-error text-label-sm flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]">warning</span>
                    <span>تحذير: هذا الإجراء رسمي ويسجل في سجل الرقابة ويمنع استقبال الجهاز تحت الضمان.</span>
                </div>
                <div>
                    <label class="font-label-sm text-on-surface-variant block mb-1">سبب إلغاء الضمان *</label>
                    <select id="void-reason-select" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary mb-2">
                        <option value="كسر أو نزع اللاصق الأمني">كسر أو نزع اللاصق الأمني (Security Seal Broken)</option>
                        <option value="تسلل سوائل أو أثر رطوبة وأكسدة">تسلل سوائل أو أثر رطوبة وأكسدة (Water Damage)</option>
                        <option value="كسر في الشاشة أو الشاسيه ناتج عن سقوط">كسر في الشاشة أو الشاسيه ناتج عن سقوط</option>
                        <option value="تفكيك أو محاولة صيانة خارج المحل">تفكيك أو محاولة صيانة خارج المحل</option>
                        <option value="تعديل غير مصرح لنظام التشغيل (Root / Jailbreak)">تعديل غير مصرح لنظام التشغيل</option>
                        <option value="سبب آخر">سبب آخر يحدد يدوياً</option>
                    </select>
                    <textarea id="void-reason-notes" rows="2" placeholder="تفاصيل الفحص المجهري أو الملاحظات الفنية..." class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
                </div>
            </div>
            <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                <button onclick="document.getElementById('modal-void-warranty').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                <button onclick="window.confirmVoidWarranty()" class="px-6 py-2 rounded-xl bg-error hover:bg-error-container text-on-error font-bold font-label-md shadow-md flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px]">gavel</span>
                    <span>تأكيد الإلغاء والتوثيق</span>
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.confirmVoidWarranty = async function () {
    if (!currentDeviceData) return;

    const select = document.getElementById('void-reason-select');
    const notes = document.getElementById('void-reason-notes')?.value.trim();
    const reason = `${select?.value || ''}${notes ? ` - ${notes}` : ''}`;

    const imei = currentDeviceData.device?.imei1 || currentDeviceData.warranty?.imei;
    try {
        if (window.moboraAPI && window.moboraAPI.warranty && window.moboraAPI.warranty.void) {
            await window.moboraAPI.warranty.void({ imei, reason });
            document.getElementById('modal-void-warranty').classList.add('hidden');
            showNotification('تم الإلغاء', 'تم إلغاء الضمان بنجاح وتوثيق الحادثة في سجل الرقابة.');
            performSearch(imei);
        }
    } catch (e) {
        alert('خطأ: ' + e.message);
    }
};

function setupActionButtons() {
    const printBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('طباعة شهادة الضمان'));
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (!currentDeviceData) {
                showNotification('تنبيه', 'يرجى فحص جهاز أولاً لطباعة الشهادة');
                return;
            }
            window.print();
        });
    }

    const openTicketBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('فتح تذكرة صيانة'));
    if (openTicketBtn) {
        openTicketBtn.addEventListener('click', () => {
            if (currentDeviceData && currentDeviceData.device) {
                sessionStorage.setItem('mobora_new_repair_imei', currentDeviceData.device.imei1 || '');
                sessionStorage.setItem('mobora_new_repair_model', currentDeviceData.device.product_name || '');
            }
            window.location.href = '../repairs_kanban/code.html';
        });
    }

    const shareBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إرسال التقرير'));
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (!currentDeviceData) {
                showNotification('تنبيه', 'يرجى فحص جهاز أولاً لإرسال التقرير');
                return;
            }
            const phone = currentDeviceData.warranty?.customer_phone || currentDeviceData.warranty?.sale_phone;
            const devName = currentDeviceData.device?.product_name || currentDeviceData.warranty?.product_name || 'هاتف';
            const imei = currentDeviceData.device?.imei1 || currentDeviceData.warranty?.imei || '';
            const status = currentDeviceData.metrics?.isExpired ? 'منتهي الصلاحية' : 'ساري المفعول';

            const message = encodeURIComponent(`السلام عليكم،\nشهادة ضمان جهازكم [${devName}]\nمسجل بـ IMEI: ${imei}\nحالة الضمان: ${status}\nمحل فون إكسبريس للاتصالات.`);

            if (phone) {
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
            } else {
                navigator.clipboard.writeText(decodeURIComponent(message));
                showNotification('تم النسخ', 'تم نسخ ملخص الضمان إلى الحافظة.');
            }
        });
    }

    const voidBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إلغاء الكفالة'));
    if (voidBtn) {
        voidBtn.addEventListener('click', () => {
            if (!currentDeviceData) {
                showNotification('تنبيه', 'يرجى اختيار وفحص جهاز أولاً');
                return;
            }
            document.getElementById('modal-void-warranty')?.classList.remove('hidden');
        });
    }
}

function showNotification(title, text) {
    if (window.showToast) {
        window.showToast(title, text);
    } else {
        alert(`${title}: ${text}`);
    }
}
