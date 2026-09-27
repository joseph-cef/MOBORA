// Suppliers & Purchases Renderer Logic
(function () {
    let suppliersList = [];
    let selectedSupplier = null;

    async function loadSuppliers() {
        if (!window.moboraAPI || !window.moboraAPI.suppliers) return;

        try {
            suppliersList = await window.moboraAPI.suppliers.list();
            renderSuppliersTable();
            if (suppliersList.length > 0 && !selectedSupplier) {
                window.selectSupplier(suppliersList[0].id);
            }
        } catch (e) {
            console.error('[Suppliers Load Error]', e);
        }
    }

    function renderSuppliersTable() {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        if (suppliersList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-on-surface-variant">لا يوجد موردون مسجلون حالياً.</td></tr>';
            return;
        }

        tbody.innerHTML = suppliersList.map(s => {
            const hasDebt = s.current_debt > 0;
            const debtBadgeClass = hasDebt ? 'bg-error-container/20 text-error' : 'bg-primary-container/20 text-primary';
            const debtText = hasDebt ? `- ${Number(s.current_debt).toLocaleString('fr-DZ')} د.ج` : '0.00 د.ج (مسدد بالكامل)';

            return `
                <tr class="hover:bg-surface-container-high/60 transition-colors group cursor-pointer ${selectedSupplier && selectedSupplier.id === s.id ? 'bg-surface-container-high/80' : ''}" onclick="window.selectSupplier(${s.id})">
                    <td class="py-3 px-space-md">
                        <div class="flex items-center gap-space-sm">
                            <div class="w-10 h-10 rounded-lg bg-secondary-container/20 text-secondary flex items-center justify-center font-bold text-[14px] shrink-0">
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
                            <span class="dir-ltr text-on-surface">${s.phone}</span>
                            ${s.whatsapp ? `
                                <a href="https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="w-6 h-6 rounded-full bg-primary-container/20 text-primary flex items-center justify-center hover:bg-primary-container hover:text-on-primary transition-colors" title="محادثة واتساب">
                                    <span class="material-symbols-outlined text-[14px]">chat</span>
                                </a>
                            ` : ''}
                        </div>
                    </td>
                    <td class="py-3 px-space-sm">
                        <span class="px-space-xs py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm">${s.supply_type}</span>
                    </td>
                    <td class="py-3 px-space-sm text-left font-label-md text-label-md text-on-surface">
                        ${Number(s.total_purchases).toLocaleString('fr-DZ')} <span class="text-on-surface-variant font-label-sm">د.ج</span>
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
                            <button onclick="event.stopPropagation(); window.openPayModal(${s.id})" class="p-1 rounded hover:bg-primary/20 hover:text-primary text-on-surface-variant transition-colors" title="تسجيل دفعة">
                                <span class="material-symbols-outlined text-[18px]">payments</span>
                            </button>
                            <button onclick="event.stopPropagation(); window.openPurchaseModal(${s.id})" class="p-1 rounded hover:bg-secondary/20 hover:text-secondary text-on-surface-variant transition-colors" title="إصدار فاتورة شراء">
                                <span class="material-symbols-outlined text-[18px]">post_add</span>
                            </button>
                            <button class="p-1 rounded bg-primary text-on-primary transition-colors" title="عرض السجل المحدد">
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
            console.error(e);
        }
    };

    function renderDossier(sup) {
        // Company Name
        const nameEl = document.querySelector('.2xl\\:col-span-4 h3');
        if (nameEl) nameEl.innerText = sup.company_name;

        // Contact Person
        const contactEl = document.querySelector('.2xl\\:col-span-4 .font-body-sm.text-on-surface-variant');
        if (contactEl) contactEl.innerText = `المسؤول: ${sup.contact_person || 'غير محدد'}`;

        // Code
        const codeEl = document.querySelector('.2xl\\:col-span-4 .font-label-sm.bg-surface-container-highest');
        if (codeEl) codeEl.innerText = `كود: ${sup.code}`;

        // Debt Box
        const debtEl = document.querySelector('.2xl\\:col-span-4 .font-headline-lg.text-error');
        if (debtEl) {
            debtEl.innerHTML = `${Number(sup.current_debt).toLocaleString('fr-DZ')} <span class="font-label-md text-label-md text-on-surface-variant">د.ج</span>`;
        }

        // Action Pay Button
        const payBtn = document.querySelector('.2xl\\:col-span-4 button:has(.material-symbols-outlined:contains("price_check"))');
        if (payBtn) {
            payBtn.onclick = () => window.openPayModal(sup.id);
        }
    }

    // Open Payment Modal
    window.openPayModal = function (supplierId) {
        const sup = suppliersList.find(s => s.id === supplierId) || selectedSupplier;
        if (!sup) return;

        const amount = prompt(`تسجيل دفعة حساب للمورد [${sup.company_name}]\nالدين الحالي: ${Number(sup.current_debt).toLocaleString('fr-DZ')} د.ج\n\nأدخل مبلغ الدفعة بالدينار (DZD):`);
        const cleanAmount = Number(amount);
        if (!cleanAmount || cleanAmount <= 0) return;

        window.moboraAPI.suppliers.recordPayment({
            supplierId: sup.id,
            amount: cleanAmount,
            paymentMethod: 'cash',
            notes: 'دفعة سداد حساب'
        }).then(() => {
            alert(`✅ تم تسجيل دفعة بمبلغ ${cleanAmount.toLocaleString('fr-DZ')} د.ج للمورد [${sup.company_name}] بنجاح!`);
            loadSuppliers();
        }).catch(err => alert('خطأ: ' + err.message));
    };

    // Open Purchase Invoice Modal
    window.openPurchaseModal = async function (supplierId) {
        const sup = suppliersList.find(s => s.id === supplierId) || selectedSupplier;
        if (!sup) return;

        const invNum = prompt(`إصدار فاتورة شراء من [${sup.company_name}]\nأدخل رقم الفاتورة (اتركه فارغاً للتوليد التلقائي):`);
        const total = prompt('إجمالي مبلغ الفاتورة (د.ج):');
        const cleanTotal = Number(total);
        if (!cleanTotal || cleanTotal <= 0) return;

        const paid = prompt('المبلغ المسدد فوراً من الفاتورة نقداً (د.ج):', '0');
        const cleanPaid = Number(paid) || 0;

        try {
            const res = await window.moboraAPI.suppliers.recordPurchase({
                supplierId: sup.id,
                invoiceNumber: invNum ? invNum.trim() : null,
                totalAmount: cleanTotal,
                paidAmount: cleanPaid,
                items: []
            });
            alert(`✅ تم تسجيل فاتورة الشراء برقم [${res.invoiceNumber}] بنجاح!`);
            loadSuppliers();
        } catch (e) {
            alert('خطأ: ' + e.message);
        }
    };

    // Add New Supplier
    window.addNewSupplier = async function () {
        const company = prompt('اسم المورد أو الشركة:');
        if (!company || !company.trim()) return;

        const contact = prompt('اسم المسؤول التجاري:');
        const phone = prompt('رقم الهاتف:');
        if (!phone || !phone.trim()) return;

        const address = prompt('العنوان والولاية (مثال: العلمة - سطيف):');
        const supplyType = prompt('نوع التوريد (مثال: قطع غيار أصلية):', 'شاشات وبطاريات');

        try {
            await window.moboraAPI.suppliers.create({
                company_name: company.trim(),
                contact_person: contact ? contact.trim() : null,
                phone: phone.trim(),
                address: address ? address.trim() : null,
                supply_type: supplyType
            });
            alert(`✅ تمت إضافة المورد [${company}] بنجاح!`);
            loadSuppliers();
        } catch (e) {
            alert('خطأ: ' + e.message);
        }
    };

    function initHeaderActions() {
        const addSupBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('مورد جديد'));
        if (addSupBtn) {
            addSupBtn.onclick = window.addNewSupplier;
        }

        const searchInput = document.querySelector('input[placeholder*="البحث"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                suppliersList = suppliersList.filter(s => 
                    s.company_name.toLowerCase().includes(q) || 
                    s.phone.includes(q) || 
                    s.code.toLowerCase().includes(q)
                );
                renderSuppliersTable();
                if (q === '') loadSuppliers();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initHeaderActions();
            loadSuppliers();
        });
    } else {
        initHeaderActions();
        loadSuppliers();
    }
})();
