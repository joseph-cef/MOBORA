// Suppliers & Purchases Renderer Logic - Production Ready & Interactive
(function () {
    let allSuppliers = [];
    let displayedSuppliers = [];
    let selectedSupplier = null;
    let currentFilter = 'all'; // 'all' | 'debt' | 'cleared'
    let searchQuery = '';
    let inventoryProducts = [];

    // Initialize
    async function init() {
        injectModals();
        bindHeaderActions();
        await loadSuppliers();
        loadInventoryProducts();
    }

    async function loadInventoryProducts() {
        if (window.moboraAPI && window.moboraAPI.inventory) {
            try {
                inventoryProducts = await window.moboraAPI.inventory.list();
            } catch (e) {
                console.error('[Inventory Load for Purchases Failed]', e);
            }
        }
    }

    async function loadSuppliers() {
        if (!window.moboraAPI || !window.moboraAPI.suppliers) return;

        try {
            allSuppliers = await window.moboraAPI.suppliers.list();
            applyFilterAndSearch();

            if (allSuppliers.length > 0) {
                // If previously selected supplier exists, refresh it; otherwise pick first
                const targetId = selectedSupplier ? selectedSupplier.id : allSuppliers[0].id;
                const stillExists = allSuppliers.some(s => s.id === targetId);
                window.selectSupplier(stillExists ? targetId : allSuppliers[0].id);
            } else {
                selectedSupplier = null;
                renderEmptyDossier();
            }
        } catch (e) {
            console.error('[Suppliers Load Error]', e);
        }
    }

    function applyFilterAndSearch() {
        displayedSuppliers = allSuppliers.filter(s => {
            // Filter tab
            if (currentFilter === 'debt' && s.current_debt <= 0) return false;
            if (currentFilter === 'cleared' && s.current_debt > 0) return false;

            // Search query
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const matchCompany = s.company_name && s.company_name.toLowerCase().includes(q);
                const matchContact = s.contact_person && s.contact_person.toLowerCase().includes(q);
                const matchPhone = s.phone && s.phone.includes(q);
                const matchCode = s.code && s.code.toLowerCase().includes(q);
                const matchType = s.supply_type && s.supply_type.toLowerCase().includes(q);
                return matchCompany || matchContact || matchPhone || matchCode || matchType;
            }

            return true;
        });

        updateFilterTabCounts();
        renderSuppliersTable();
    }

    function updateFilterTabCounts() {
        const totalCount = allSuppliers.length;
        const debtCount = allSuppliers.filter(s => s.current_debt > 0).length;
        const clearedCount = allSuppliers.filter(s => s.current_debt <= 0).length;

        const tabs = document.querySelectorAll('.flex.items-center.bg-surface-container-low button');
        if (tabs && tabs.length >= 3) {
            tabs[0].innerText = `الكل (${totalCount})`;
            tabs[1].innerText = `عليهم ديون (${debtCount})`;
            tabs[2].innerText = `خالص / مسدد (${clearedCount})`;
        }

        const countLabel = document.querySelector('.bg-surface-container-high\\/40 span');
        if (countLabel && countLabel.innerText.includes('إظهار')) {
            countLabel.innerText = `إظهار ${displayedSuppliers.length} من أصل ${totalCount} مورد مسجل`;
        }
    }

    function renderSuppliersTable() {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        if (displayedSuppliers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-12 text-center text-on-surface-variant">
                        <div class="flex flex-col items-center gap-2">
                            <span class="material-symbols-outlined text-[36px] text-outline">search_off</span>
                            <span class="font-body-md">لا توجد نتائج مطابقة لبحثك أو التصنيف المحدد.</span>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = displayedSuppliers.map(s => {
            const hasDebt = s.current_debt > 0;
            const debtBadgeClass = hasDebt ? 'bg-error-container/20 text-error' : 'bg-primary-container/20 text-primary';
            const debtText = hasDebt ? `- ${Number(s.current_debt).toLocaleString('fr-DZ')} د.ج` : '0.00 د.ج (خالص)';
            const isSelected = selectedSupplier && selectedSupplier.id === s.id;

            return `
                <tr class="hover:bg-surface-container-high/60 transition-colors group cursor-pointer ${isSelected ? 'bg-surface-container-high/90 ring-1 ring-primary/40' : ''}" onclick="window.selectSupplier(${s.id})">
                    <td class="py-3 px-space-md">
                        <div class="flex items-center gap-space-sm">
                            <div class="w-10 h-10 rounded-lg ${isSelected ? 'bg-primary text-on-primary' : 'bg-secondary-container/20 text-secondary'} flex items-center justify-center font-bold text-[14px] shrink-0 transition-colors">
                                ${s.code || 'SUP'}
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="text-on-surface font-semibold truncate group-hover:text-primary transition-colors">${s.company_name}</span>
                                <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[13px]">location_on</span> ${s.address || 'الجزائر'}
                                </span>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-space-sm">
                        <div class="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface">
                            <span class="dir-ltr text-on-surface font-mono">${s.phone}</span>
                            ${s.whatsapp ? `
                                <a href="https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" onclick="event.stopPropagation()" class="w-6 h-6 rounded-full bg-primary-container/20 text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors" title="محادثة واتساب">
                                    <span class="material-symbols-outlined text-[14px]">chat</span>
                                </a>
                            ` : ''}
                        </div>
                    </td>
                    <td class="py-3 px-space-sm">
                        <span class="px-space-xs py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm">${s.supply_type || 'توريد عام'}</span>
                    </td>
                    <td class="py-3 px-space-sm text-left font-label-md text-label-md text-on-surface">
                        ${Number(s.total_purchases || 0).toLocaleString('fr-DZ')} <span class="text-on-surface-variant font-label-sm">د.ج</span>
                    </td>
                    <td class="py-3 px-space-md text-left">
                        <span class="px-2 py-1 rounded ${debtBadgeClass} font-label-md text-label-md font-bold tracking-tight inline-block">
                            ${debtText}
                        </span>
                    </td>
                    <td class="py-3 px-space-sm font-label-sm text-label-sm text-on-surface-variant">
                        ${s.purchases_count || 0} فاتورة
                    </td>
                    <td class="py-3 px-space-md text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="event.stopPropagation(); window.openPayModal(${s.id})" class="p-1.5 rounded-lg hover:bg-primary-container/30 hover:text-primary text-on-surface-variant transition-colors" title="تسجيل دفعة سداد">
                                <span class="material-symbols-outlined text-[18px]">payments</span>
                            </button>
                            <button onclick="event.stopPropagation(); window.openPurchaseModal(${s.id})" class="p-1.5 rounded-lg hover:bg-secondary-container/30 hover:text-secondary text-on-surface-variant transition-colors" title="إصدار فاتورة شراء">
                                <span class="material-symbols-outlined text-[18px]">post_add</span>
                            </button>
                            <button onclick="event.stopPropagation(); window.selectSupplier(${s.id})" class="p-1.5 rounded-lg ${isSelected ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-highest text-on-surface-variant'} transition-colors" title="عرض السجل المحدد">
                                <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Select Supplier Dossier
    window.selectSupplier = async function (id) {
        try {
            const supplierData = await window.moboraAPI.suppliers.getById(id);
            if (!supplierData) return;
            selectedSupplier = supplierData;
            renderDossier(supplierData);
            renderSuppliersTable();
        } catch (e) {
            console.error('[Get Supplier Dossier Error]', e);
        }
    };

    function renderEmptyDossier() {
        const container = document.querySelector('.2xl\\:col-span-4');
        if (!container) return;
        container.innerHTML = `
            <div class="bg-surface-container rounded-xl p-8 text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[48px] text-outline mb-2">person_off</span>
                <p class="font-body-md">يرجى إضافة أو تحديد مورد لعرض ملف حسابه والجدول الزمني.</p>
            </div>
        `;
    }

    function renderDossier(sup) {
        // Company Name
        const nameEl = document.querySelector('.2xl\\:col-span-4 h3');
        if (nameEl) nameEl.innerText = sup.company_name;

        // Contact Person
        const contactEl = document.querySelector('.2xl\\:col-span-4 .font-body-sm.text-on-surface-variant');
        if (contactEl) contactEl.innerText = `المدير التجاري: ${sup.contact_person || 'غير محدد'}`;

        // Code
        const codeEl = document.querySelector('.2xl\\:col-span-4 .font-label-sm.bg-surface-container-highest');
        if (codeEl) codeEl.innerText = `كود: ${sup.code || 'SUP'}`;

        // Debt Box
        const debtEl = document.querySelector('.2xl\\:col-span-4 .font-headline-lg');
        if (debtEl) {
            const hasDebt = sup.current_debt > 0;
            debtEl.className = `font-headline-lg text-headline-lg ${hasDebt ? 'text-error' : 'text-primary'} font-bold tracking-tight`;
            debtEl.innerHTML = `${Number(sup.current_debt).toLocaleString('fr-DZ')} <span class="font-label-md text-label-md text-on-surface-variant">د.ج</span>`;
        }

        // Quick contacts
        const contactPills = document.querySelectorAll('.2xl\\:col-span-4 .grid-cols-2 > div');
        if (contactPills && contactPills.length >= 2) {
            contactPills[0].innerHTML = `
                <span class="material-symbols-outlined text-[15px] text-secondary">phone_iphone</span>
                <span class="dir-ltr text-on-surface font-mono">${sup.phone || '-'}</span>
            `;
            contactPills[1].innerHTML = sup.whatsapp ? `
                <a href="https://wa.me/${sup.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="flex items-center gap-1 text-primary hover:underline">
                    <span class="material-symbols-outlined text-[15px]">chat</span>
                    <span>واتساب: ${sup.whatsapp}</span>
                </a>
            ` : `
                <span class="material-symbols-outlined text-[15px] text-on-surface-variant">chat_bubble_outline</span>
                <span>لا يوجد واتساب</span>
            `;
        }

        // Action Pay Button
        const payBtn = document.querySelector('.2xl\\:col-span-4 button:has(.material-symbols-outlined)');
        if (payBtn) {
            payBtn.onclick = () => window.openPayModal(sup.id);
        }

        // Render Vertical Ledger Timeline (Purchases + Payments)
        renderLedgerTimeline(sup);
    }

    function renderLedgerTimeline(sup) {
        const timelineContainer = document.querySelector('.2xl\\:col-span-4 .relative.flex.flex-col.gap-space-md');
        if (!timelineContainer) return;

        const purchases = (sup.purchases || []).map(p => ({
            type: 'purchase',
            date: p.invoice_date || p.created_at,
            timestamp: new Date(p.invoice_date || p.created_at).getTime(),
            data: p
        }));

        const payments = (sup.payments || []).map(pm => ({
            type: 'payment',
            date: pm.payment_date || pm.created_at,
            timestamp: new Date(pm.payment_date || pm.created_at).getTime(),
            data: pm
        }));

        const timelineEvents = [...purchases, ...payments].sort((a, b) => b.timestamp - a.timestamp);

        if (timelineEvents.length === 0) {
            timelineContainer.innerHTML = `
                <div class="p-6 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl">
                    <span class="material-symbols-outlined text-[28px] text-outline mb-1">history_toggle_off</span>
                    <p class="font-body-sm">لا توجد عمليات شراء أو دفعات مسجلة لهذا المورد بعد.</p>
                </div>
            `;
            return;
        }

        timelineContainer.innerHTML = timelineEvents.slice(0, 10).map(ev => {
            if (ev.type === 'purchase') {
                const p = ev.data;
                const formattedDate = new Date(p.invoice_date || p.created_at).toLocaleDateString('ar-DZ', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                return `
                    <div class="relative flex items-start gap-space-sm">
                        <div class="w-8 h-8 rounded-full bg-error-container/30 text-error flex items-center justify-center shrink-0 z-10 shadow-sm">
                            <span class="material-symbols-outlined text-[16px]">receipt</span>
                        </div>
                        <div class="flex-1 bg-surface-container-lowest p-space-sm rounded-lg flex flex-col gap-1 border border-outline-variant/30 hover:border-outline-variant transition-colors">
                            <div class="flex items-center justify-between">
                                <span class="font-body-md text-body-md font-semibold text-on-surface">فاتورة شراء: #${p.invoice_number}</span>
                                <span class="font-label-sm text-label-sm text-error font-bold">+ ${Number(p.total_amount).toLocaleString('fr-DZ')} د.ج</span>
                            </div>
                            <div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                                <span>المدفوع نقداً: <span class="text-primary font-mono">${Number(p.paid_amount || 0).toLocaleString('fr-DZ')} د.ج</span></span>
                                <span class="font-mono">${formattedDate}</span>
                            </div>
                            <div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm pt-1 border-t border-outline-variant/20 mt-1">
                                <span class="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[12px]">inventory_2</span>
                                    ${p.items_count || 0} بنود مشتراة
                                </span>
                                ${p.remaining_debt > 0 ? `<span class="text-error font-semibold">باقي دين: ${Number(p.remaining_debt).toLocaleString('fr-DZ')} د.ج</span>` : '<span class="text-primary font-semibold">مسددة بالكامل</span>'}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const pm = ev.data;
                const formattedDate = new Date(pm.payment_date || pm.created_at).toLocaleDateString('ar-DZ', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                const methodLabel = pm.payment_method === 'cash' ? 'نقداً (صندوق المتجر)' : (pm.payment_method === 'baridimob' ? 'بريدي موب BaridiMob' : 'تحويل بنكي / صك');
                return `
                    <div class="relative flex items-start gap-space-sm">
                        <div class="w-8 h-8 rounded-full bg-primary-container/30 text-primary flex items-center justify-center shrink-0 z-10 shadow-sm">
                            <span class="material-symbols-outlined text-[16px]">payments</span>
                        </div>
                        <div class="flex-1 bg-surface-container-lowest p-space-sm rounded-lg flex flex-col gap-1 border border-outline-variant/30 hover:border-outline-variant transition-colors">
                            <div class="flex items-center justify-between">
                                <span class="font-body-md text-body-md font-semibold text-on-surface">سداد دفعة حساب</span>
                                <span class="font-label-sm text-label-sm text-primary font-bold">- ${Number(pm.amount).toLocaleString('fr-DZ')} د.ج</span>
                            </div>
                            <div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                                <span>طريقة الدفع: <span class="text-on-surface font-medium">${methodLabel}</span></span>
                                <span class="font-mono">${formattedDate}</span>
                            </div>
                            ${pm.notes ? `
                                <div class="text-on-surface-variant font-label-sm text-label-sm italic pt-1 border-t border-outline-variant/20 mt-1">
                                    "${pm.notes}"
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    // Modal Injection (Add Supplier, Record Payment, Record Purchase)
    function injectModals() {
        if (document.getElementById('modal-add-supplier')) return;

        const modalsHtml = `
        <!-- Modal: Add New Supplier -->
        <div id="modal-add-supplier" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[24px]">person_add</span>
                        <h3 class="font-headline-md text-on-surface">تسجيل مورد جديد</h3>
                    </div>
                    <button onclick="document.getElementById('modal-add-supplier').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div class="p-space-md flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">اسم المورد أو الشركة *</label>
                            <input id="new-sup-name" type="text" placeholder="مثال: العالمية لقطع الغيار" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">اسم المسؤول / جهة الاتصال</label>
                            <input id="new-sup-contact" type="text" placeholder="مثال: سفيان رحماني" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">رقم الهاتف *</label>
                            <input id="new-sup-phone" type="tel" dir="ltr" placeholder="0550123456" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">رقم الواتساب</label>
                            <input id="new-sup-whatsapp" type="tel" dir="ltr" placeholder="213550123456" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">نوع التوريد</label>
                            <select id="new-sup-type" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary">
                                <option value="شاشات وبطاريات فك">شاشات وبطاريات فك</option>
                                <option value="هواتف رسمية (علب جديدة)">هواتف رسمية (علب جديدة)</option>
                                <option value="شواحن وكوابل وإكسسوارات">شواحن وكوابل وإكسسوارات</option>
                                <option value="آيفون مجدد CPO">آيفون مجدد CPO</option>
                                <option value="معدات وأدوات صيانة">معدات وأدوات صيانة</option>
                                <option value="قطع غيار عامة">قطع غيار عامة</option>
                            </select>
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">الرصيد المبدئي / الدين السابق (د.ج)</label>
                            <input id="new-sup-debt" type="number" placeholder="0" value="0" class="w-full bg-surface-container-lowest text-error font-mono font-bold p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">العنوان والولاية</label>
                        <input id="new-sup-address" type="text" placeholder="مثال: بلفور - الحراش (الجزائر)" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">ملاحظات إضافية</label>
                        <textarea id="new-sup-notes" rows="2" placeholder="ملاحظات حول طريقة التسليم، فترات التوريد، إلخ..." class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
                    </div>
                </div>
                <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                    <button onclick="document.getElementById('modal-add-supplier').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                    <button onclick="window.saveNewSupplier()" class="px-6 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold font-label-md shadow-md flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[18px]">check</span>
                        <span>حفظ المورد</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal: Record Payment -->
        <div id="modal-pay-supplier" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[24px]">payments</span>
                        <h3 class="font-headline-md text-on-surface">تسجيل دفعة سداد للمورد</h3>
                    </div>
                    <button onclick="document.getElementById('modal-pay-supplier').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div class="p-space-md flex flex-col gap-3">
                    <div class="p-3 bg-surface-container-lowest rounded-xl flex items-center justify-between">
                        <div>
                            <span class="font-label-sm text-on-surface-variant block">المورد:</span>
                            <span id="pay-sup-name" class="font-headline-sm text-on-surface font-bold">-</span>
                        </div>
                        <div class="text-left">
                            <span class="font-label-sm text-on-surface-variant block">الدين الحالي:</span>
                            <span id="pay-sup-debt" class="font-headline-sm text-error font-mono font-bold">0 د.ج</span>
                        </div>
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">مبلغ الدفعة بالدينار (DZD) *</label>
                        <input id="pay-amount" type="number" placeholder="50000" class="w-full bg-surface-container-lowest text-primary font-mono font-bold text-xl p-3 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">طريقة السداد</label>
                        <select id="pay-method" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="cash">نقداً (من صندوق المتجر)</option>
                            <option value="baridimob">بريدي موب BaridiMob</option>
                            <option value="bank">تحويل بنكي رسمي (BNA / CPA)</option>
                            <option value="cheque">صك بنكي / بريدي</option>
                        </select>
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">ملاحظات / رقم وصل التحويل</label>
                        <input id="pay-notes" type="text" placeholder="مثال: سند صرف #5510 أو إشعار بنكي" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                </div>
                <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                    <button onclick="document.getElementById('modal-pay-supplier').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                    <button onclick="window.saveSupplierPayment()" class="px-6 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold font-label-md shadow-md flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>تأكيد تسجيل الدفعة</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal: Record Purchase Invoice with Stock Items -->
        <div id="modal-purchase-invoice" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary text-[24px]">post_add</span>
                        <h3 class="font-headline-md text-on-surface">إصدار وتوثيق فاتورة شراء وإدخال للمخزن</h3>
                    </div>
                    <button onclick="document.getElementById('modal-purchase-invoice').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div class="p-space-md flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">المورد *</label>
                            <select id="pinv-supplier-id" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary"></select>
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">رقم الفاتورة</label>
                            <input id="pinv-number" type="text" placeholder="تلقائي (PINV-XXXX)" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">تاريخ الفاتورة</label>
                            <input id="pinv-date" type="date" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>

                    <!-- Items Table -->
                    <div class="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/40 flex flex-col gap-2">
                        <div class="flex items-center justify-between">
                            <span class="font-label-md text-on-surface font-semibold flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px] text-primary">inventory_2</span>
                                بنود الفاتورة وإضافة الكميات للمخزن
                            </span>
                            <button onclick="window.addPurchaseItemRow()" class="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary font-label-sm transition-all flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">add</span> إضافة بند
                            </button>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-right border-collapse text-label-sm" id="pinv-items-table">
                                <thead>
                                    <tr class="text-on-surface-variant border-b border-outline-variant/30">
                                        <th class="py-1 px-2">المنتج في المخزن</th>
                                        <th class="py-1 px-2 w-24">الكمية</th>
                                        <th class="py-1 px-2 w-32">سعر الشراء (د.ج)</th>
                                        <th class="py-1 px-2 w-28 text-left">المجموع</th>
                                        <th class="py-1 px-1 w-10 text-center">إلغاء</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-outline-variant/20">
                                    <!-- Dynamic rows inserted here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">إجمالي الفاتورة (د.ج) *</label>
                            <input id="pinv-total" type="number" placeholder="0" class="w-full bg-surface-container-lowest text-on-surface font-mono font-bold text-lg p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">المبلغ المسدد فوراً نقداً (د.ج)</label>
                            <input id="pinv-paid" type="number" placeholder="0" value="0" class="w-full bg-surface-container-lowest text-primary font-mono font-bold text-lg p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>

                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">ملاحظات حول الشحنة أو الاستلام</label>
                        <input id="pinv-notes" type="text" placeholder="مثال: تم فحص البضاعة واستلامها كاملة" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                </div>
                <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-between">
                    <div class="text-on-surface-variant font-label-sm">
                        <span>الدين المتبقي من الفاتورة: </span>
                        <span id="pinv-remaining-badge" class="font-bold text-error font-mono">0 د.ج</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="document.getElementById('modal-purchase-invoice').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                        <button onclick="window.savePurchaseInvoice()" class="px-6 py-2 rounded-xl bg-secondary hover:bg-secondary-fixed-dim text-on-secondary font-bold font-label-md shadow-md flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px]">save</span>
                            <span>توثيق الفاتورة وتحديث المخزون</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalsHtml);

        // Bind auto calculations on purchase invoice
        const totalInput = document.getElementById('pinv-total');
        const paidInput = document.getElementById('pinv-paid');
        const remBadge = document.getElementById('pinv-remaining-badge');

        function updateRem() {
            const tot = Number(totalInput?.value) || 0;
            const pd = Number(paidInput?.value) || 0;
            const rem = Math.max(0, tot - pd);
            if (remBadge) {
                remBadge.innerText = `${rem.toLocaleString('fr-DZ')} د.ج`;
                remBadge.className = rem > 0 ? 'font-bold text-error font-mono' : 'font-bold text-primary font-mono';
            }
        }

        if (totalInput) totalInput.addEventListener('input', updateRem);
        if (paidInput) paidInput.addEventListener('input', updateRem);
    }

    // Modal Trigger: Open Add Supplier
    window.openAddSupplierModal = function () {
        const modal = document.getElementById('modal-add-supplier');
        if (!modal) return;
        document.getElementById('new-sup-name').value = '';
        document.getElementById('new-sup-contact').value = '';
        document.getElementById('new-sup-phone').value = '';
        document.getElementById('new-sup-whatsapp').value = '';
        document.getElementById('new-sup-debt').value = '0';
        document.getElementById('new-sup-address').value = '';
        document.getElementById('new-sup-notes').value = '';
        modal.classList.remove('hidden');
        document.getElementById('new-sup-name').focus();
    };

    // Save New Supplier
    window.saveNewSupplier = async function () {
        const company = document.getElementById('new-sup-name')?.value.trim();
        const contact = document.getElementById('new-sup-contact')?.value.trim();
        const phone = document.getElementById('new-sup-phone')?.value.trim();
        const whatsapp = document.getElementById('new-sup-whatsapp')?.value.trim();
        const supplyType = document.getElementById('new-sup-type')?.value;
        const debt = Number(document.getElementById('new-sup-debt')?.value) || 0;
        const address = document.getElementById('new-sup-address')?.value.trim();
        const notes = document.getElementById('new-sup-notes')?.value.trim();

        if (!company || !phone) {
            alert('يرجى كتابة اسم المورد ورقم الهاتف على الأقل.');
            return;
        }

        try {
            const res = await window.moboraAPI.suppliers.create({
                company_name: company,
                contact_person: contact || null,
                phone: phone,
                whatsapp: whatsapp || null,
                supply_type: supplyType,
                current_debt: debt,
                address: address || null,
                notes: notes || null
            });

            document.getElementById('modal-add-supplier').classList.add('hidden');
            await loadSuppliers();
            if (res && res.supplier) {
                window.selectSupplier(res.supplier.id);
            }
        } catch (e) {
            alert('خطأ أثناء حفظ المورد: ' + e.message);
        }
    };

    // Modal Trigger: Open Pay Modal
    window.openPayModal = function (supplierId) {
        const sup = allSuppliers.find(s => s.id === supplierId) || selectedSupplier;
        if (!sup) {
            alert('يرجى تحديد مورد أولاً.');
            return;
        }

        const modal = document.getElementById('modal-pay-supplier');
        if (!modal) return;

        window._activePayingSupplierId = sup.id;
        document.getElementById('pay-sup-name').innerText = sup.company_name;
        document.getElementById('pay-sup-debt').innerText = `${Number(sup.current_debt || 0).toLocaleString('fr-DZ')} د.ج`;
        document.getElementById('pay-amount').value = sup.current_debt > 0 ? sup.current_debt : '';
        document.getElementById('pay-notes').value = '';
        modal.classList.remove('hidden');
        document.getElementById('pay-amount').focus();
    };

    // Save Payment
    window.saveSupplierPayment = async function () {
        const supId = window._activePayingSupplierId;
        const amount = Number(document.getElementById('pay-amount')?.value);
        const method = document.getElementById('pay-method')?.value || 'cash';
        const notes = document.getElementById('pay-notes')?.value.trim();

        if (!amount || amount <= 0) {
            alert('يرجى إدخال مبلغ دفع صالح أكبر من الصفر.');
            return;
        }

        try {
            await window.moboraAPI.suppliers.recordPayment({
                supplierId: supId,
                amount: amount,
                paymentMethod: method,
                notes: notes || 'دفعة سداد حساب'
            });

            document.getElementById('modal-pay-supplier').classList.add('hidden');
            await loadSuppliers();
            window.selectSupplier(supId);
        } catch (e) {
            alert('خطأ أثناء تسجيل الدفعة: ' + e.message);
        }
    };

    // Modal Trigger: Open Purchase Modal
    window.openPurchaseModal = function (supplierId) {
        const sup = allSuppliers.find(s => s.id === supplierId) || selectedSupplier;
        const modal = document.getElementById('modal-purchase-invoice');
        if (!modal) return;

        // Populate suppliers dropdown
        const supSelect = document.getElementById('pinv-supplier-id');
        if (supSelect) {
            supSelect.innerHTML = allSuppliers.map(s => `
                <option value="${s.id}" ${sup && sup.id === s.id ? 'selected' : ''}>${s.company_name} (${s.code || 'SUP'})</option>
            `).join('');
        }

        document.getElementById('pinv-number').value = '';
        document.getElementById('pinv-date').value = new Date().toISOString().slice(0, 10);
        document.getElementById('pinv-total').value = '';
        document.getElementById('pinv-paid').value = '0';
        document.getElementById('pinv-notes').value = '';
        document.getElementById('pinv-remaining-badge').innerText = '0 د.ج';

        // Clear items table & add first row
        const tbody = document.querySelector('#pinv-items-table tbody');
        if (tbody) tbody.innerHTML = '';
        window.addPurchaseItemRow();

        modal.classList.remove('hidden');
    };

    // Add row to purchase invoice items table
    window.addPurchaseItemRow = function () {
        const tbody = document.querySelector('#pinv-items-table tbody');
        if (!tbody) return;

        const rowId = 'prow_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const optionsHtml = inventoryProducts.map(p => `
            <option value="${p.id}" data-cost="${p.cost_price || 0}">${p.name} (المخزون الحالي: ${p.current_stock})</option>
        `).join('');

        const tr = document.createElement('tr');
        tr.id = rowId;
        tr.className = 'hover:bg-surface-container-high/40';
        tr.innerHTML = `
            <td class="py-1 px-2">
                <select class="pitem-select w-full bg-surface-container-high text-on-surface p-1.5 rounded-lg border border-outline-variant/40 font-body-sm" onchange="window.onPurchaseProductSelected('${rowId}')">
                    <option value="">-- اختر منتجاً من المخزن --</option>
                    ${optionsHtml}
                </select>
            </td>
            <td class="py-1 px-2">
                <input type="number" min="1" value="1" class="pitem-qty w-full bg-surface-container-high text-on-surface p-1.5 rounded-lg border border-outline-variant/40 font-mono text-center" oninput="window.calcPurchaseRowTotal('${rowId}')" />
            </td>
            <td class="py-1 px-2">
                <input type="number" min="0" placeholder="0" class="pitem-cost w-full bg-surface-container-high text-on-surface p-1.5 rounded-lg border border-outline-variant/40 font-mono text-left" oninput="window.calcPurchaseRowTotal('${rowId}')" />
            </td>
            <td class="py-1 px-2 font-mono text-left font-bold text-on-surface pitem-subtotal">
                0 د.ج
            </td>
            <td class="py-1 px-1 text-center">
                <button onclick="document.getElementById('${rowId}').remove(); window.recalcPurchaseGrandTotal();" class="p-1 rounded hover:bg-error-container/40 text-error">
                    <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    };

    window.onPurchaseProductSelected = function (rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const select = row.querySelector('.pitem-select');
        const selectedOption = select.options[select.selectedIndex];
        const cost = selectedOption.getAttribute('data-cost');
        const costInput = row.querySelector('.pitem-cost');
        if (costInput && cost) {
            costInput.value = cost;
        }
        window.calcPurchaseRowTotal(rowId);
    };

    window.calcPurchaseRowTotal = function (rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const qty = Number(row.querySelector('.pitem-qty')?.value) || 0;
        const cost = Number(row.querySelector('.pitem-cost')?.value) || 0;
        const subtotal = qty * cost;
        const subEl = row.querySelector('.pitem-subtotal');
        if (subEl) subEl.innerText = `${subtotal.toLocaleString('fr-DZ')} د.ج`;
        window.recalcPurchaseGrandTotal();
    };

    window.recalcPurchaseGrandTotal = function () {
        const rows = document.querySelectorAll('#pinv-items-table tbody tr');
        let total = 0;
        rows.forEach(r => {
            const qty = Number(r.querySelector('.pitem-qty')?.value) || 0;
            const cost = Number(r.querySelector('.pitem-cost')?.value) || 0;
            total += (qty * cost);
        });

        if (total > 0) {
            const totalInput = document.getElementById('pinv-total');
            if (totalInput) {
                totalInput.value = total;
                totalInput.dispatchEvent(new Event('input'));
            }
        }
    };

    // Save Purchase Invoice
    window.savePurchaseInvoice = async function () {
        const supId = Number(document.getElementById('pinv-supplier-id')?.value);
        const invNum = document.getElementById('pinv-number')?.value.trim();
        const invDate = document.getElementById('pinv-date')?.value;
        const total = Number(document.getElementById('pinv-total')?.value);
        const paid = Number(document.getElementById('pinv-paid')?.value) || 0;
        const notes = document.getElementById('pinv-notes')?.value.trim();

        if (!supId) {
            alert('يرجى اختيار مورد.');
            return;
        }
        if (!total || total <= 0) {
            alert('يرجى إدخال إجمالي مبلغ الفاتورة.');
            return;
        }

        // Collect items
        const items = [];
        const rows = document.querySelectorAll('#pinv-items-table tbody tr');
        rows.forEach(r => {
            const prodId = Number(r.querySelector('.pitem-select')?.value);
            const qty = Number(r.querySelector('.pitem-qty')?.value) || 0;
            const cost = Number(r.querySelector('.pitem-cost')?.value) || 0;
            if (prodId && qty > 0) {
                items.push({ product_id: prodId, quantity: qty, unit_cost: cost });
            }
        });

        try {
            const res = await window.moboraAPI.suppliers.recordPurchase({
                supplierId: supId,
                invoiceNumber: invNum || null,
                invoiceDate: invDate || null,
                totalAmount: total,
                paidAmount: paid,
                items: items,
                notes: notes
            });

            document.getElementById('modal-purchase-invoice').classList.add('hidden');
            await loadSuppliers();
            loadInventoryProducts(); // refresh cache
            window.selectSupplier(supId);
        } catch (e) {
            alert('خطأ أثناء حفظ فاتورة الشراء: ' + e.message);
        }
    };

    // Export Suppliers CSV
    window.exportSuppliersCSV = function () {
        if (!allSuppliers || allSuppliers.length === 0) {
            alert('لا توجد بيانات موردين لتصديرها.');
            return;
        }

        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'كود المورد,اسم الشركة,المسؤول,رقم الهاتف,نوع التوريد,إجمالي المشتريات (د.ج),الدين المتبقي (د.ج),العنوان\n';

        allSuppliers.forEach(s => {
            const cleanCompany = (s.company_name || '').replace(/,/g, ' ');
            const cleanContact = (s.contact_person || '').replace(/,/g, ' ');
            const cleanType = (s.supply_type || '').replace(/,/g, ' ');
            const cleanAddr = (s.address || '').replace(/,/g, ' ');
            csvContent += `"${s.code || ''}","${cleanCompany}","${cleanContact}","${s.phone || ''}","${cleanType}",${s.total_purchases || 0},${s.current_debt || 0},"${cleanAddr}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `mobora_suppliers_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print Suppliers Ledger / Statement
    window.printSuppliersStatement = function () {
        window.print();
    };

    function bindHeaderActions() {
        // Quick Action Triggers
        const actionButtons = document.querySelectorAll('.flex.items-center.gap-space-sm button');
        actionButtons.forEach(btn => {
            if (btn.innerText.includes('دفعة سريعة')) {
                btn.onclick = () => {
                    if (selectedSupplier) window.openPayModal(selectedSupplier.id);
                    else if (allSuppliers.length > 0) window.openPayModal(allSuppliers[0].id);
                    else alert('لا يوجد موردون مسجلون حالياً.');
                };
            } else if (btn.innerText.includes('مورد جديد')) {
                btn.onclick = window.openAddSupplierModal;
            }
        });

        // Search Input
        const searchInput = document.querySelector('input[placeholder*="البحث"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                applyFilterAndSearch();
            });
        }

        // Filter Tabs
        const filterTabs = document.querySelectorAll('.flex.items-center.bg-surface-container-low button');
        if (filterTabs && filterTabs.length >= 3) {
            const setTabActive = (activeIdx) => {
                filterTabs.forEach((tab, i) => {
                    if (i === activeIdx) {
                        tab.className = 'px-space-sm py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold shadow-sm';
                    } else {
                        tab.className = 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors';
                    }
                });
            };

            filterTabs[0].onclick = () => { currentFilter = 'all'; setTabActive(0); applyFilterAndSearch(); };
            filterTabs[1].onclick = () => { currentFilter = 'debt'; setTabActive(1); applyFilterAndSearch(); };
            filterTabs[2].onclick = () => { currentFilter = 'cleared'; setTabActive(2); applyFilterAndSearch(); };
        }

        // Table Meta Bar Actions (Download Excel/CSV, Print, Refresh)
        const metaButtons = document.querySelectorAll('.bg-surface-container-high\\/40 .flex.items-center.gap-space-xs button');
        if (metaButtons && metaButtons.length >= 3) {
            metaButtons[0].onclick = window.exportSuppliersCSV;
            metaButtons[1].onclick = window.printSuppliersStatement;
            metaButtons[2].onclick = loadSuppliers;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
