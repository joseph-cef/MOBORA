// Finance & Reports Renderer - Complete Ledger, Live KPIs, Custom Date Picker & Full Financial Statements
(function () {
    let currentPeriod = 'month';
    let allExpenses = [];
    let currentSummaryData = null;

    async function initFinanceReports() {
        injectCustomDateModal();
        setupPeriodFilter();
        setupAddExpenseModal();
        setupExpenseFilters();
        setupExportButtons();
        await loadFinancialSummary();
        await loadExpenses();
    }

    function setupPeriodFilter() {
        const periodButtons = document.querySelectorAll('.flex.items-center.gap-space-xs.bg-surface-container-highest button');
        periodButtons.forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                periodButtons.forEach(b => {
                    b.className = 'px-space-md py-1.5 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors';
                });
                btn.className = 'px-space-md py-1.5 rounded font-label-md text-label-md bg-primary-container text-on-primary-container font-semibold shadow-sm';

                if (index === 0) currentPeriod = 'today';
                else if (index === 1) currentPeriod = 'week';
                else if (index === 2) currentPeriod = 'month';
                else if (index === 3) currentPeriod = 'year';
                else if (index === 4) {
                    // Open custom date modal without prompts
                    window.openCustomDateModal();
                    return;
                }

                await loadFinancialSummary({ period: currentPeriod });
            });
        });
    }

    function injectCustomDateModal() {
        if (document.getElementById('modal-custom-period')) return;

        const modalHtml = `
        <div id="modal-custom-period" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[22px]">date_range</span>
                        <h3 class="font-headline-md text-on-surface">تحديد فترة مخصصة للتقرير</h3>
                    </div>
                    <button onclick="document.getElementById('modal-custom-period').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div class="p-space-md flex flex-col gap-3">
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">من تاريخ:</label>
                        <input id="custom-date-from" type="date" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">إلى تاريخ:</label>
                        <input id="custom-date-to" type="date" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                </div>
                <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                    <button onclick="document.getElementById('modal-custom-period').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                    <button onclick="window.applyCustomPeriod()" class="px-6 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold font-label-md shadow-md flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[18px]">check</span>
                        <span>تطبيق الفترة</span>
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    window.openCustomDateModal = function () {
        const modal = document.getElementById('modal-custom-period');
        if (!modal) return;
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const today = now.toISOString().slice(0, 10);

        const fromInput = document.getElementById('custom-date-from');
        const toInput = document.getElementById('custom-date-to');
        if (fromInput && !fromInput.value) fromInput.value = firstDay;
        if (toInput && !toInput.value) toInput.value = today;

        modal.classList.remove('hidden');
    };

    window.applyCustomPeriod = async function () {
        const from = document.getElementById('custom-date-from')?.value;
        const to = document.getElementById('custom-date-to')?.value;

        if (!from || !to) {
            alert('يرجى تحديد تاريخي البداية والنهاية.');
            return;
        }

        document.getElementById('modal-custom-period').classList.add('hidden');
        await loadFinancialSummary({ dateFrom: from, dateTo: to });
    };

    async function loadFinancialSummary(params = { period: currentPeriod }) {
        try {
            if (!window.moboraAPI || !window.moboraAPI.finance) return;
            const data = await window.moboraAPI.finance.getSummary(params);
            if (!data) return;
            currentSummaryData = data;

            const { financials, liquidity } = data;

            // 1. Stat Cards
            const statCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.xl\\:grid-cols-4 > div');
            if (statCards.length >= 4) {
                // Card 1: Revenue
                const revEl = statCards[0].querySelector('.font-headline-xl');
                if (revEl && financials.totalRevenue !== undefined) {
                    revEl.textContent = Number(financials.totalRevenue).toLocaleString('fr-DZ');
                }

                // Card 2: Cost
                const costEl = statCards[1].querySelector('.font-headline-xl');
                if (costEl && financials.totalCostOfGoods !== undefined) {
                    costEl.textContent = Number(financials.totalCostOfGoods).toLocaleString('fr-DZ');
                }

                // Card 3: Expenses
                const expEl = statCards[2].querySelector('.font-headline-xl');
                if (expEl && financials.totalExpenses !== undefined) {
                    expEl.textContent = Number(financials.totalExpenses).toLocaleString('fr-DZ');
                }

                // Card 4: Net Profit
                const profitEl = statCards[3].querySelector('.font-headline-xl');
                if (profitEl && financials.netProfit !== undefined) {
                    profitEl.textContent = Number(financials.netProfit).toLocaleString('fr-DZ');
                    profitEl.className = `font-headline-xl text-headline-xl ${financials.netProfit >= 0 ? 'text-primary' : 'text-error'} font-bold tracking-tight font-mono`;
                }
                const marginEl = statCards[3].querySelector('.font-label-md.text-primary span:last-child, .font-label-md span');
                if (marginEl && financials.profitMargin !== undefined) {
                    marginEl.textContent = `هامش الربح: ${financials.profitMargin}%`;
                }
            }

            // 2. Liquidity Balances
            if (liquidity) {
                const liqCards = document.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-3 > div');
                if (liqCards.length >= 3) {
                    const cashEl = liqCards[0].querySelector('.font-label-md');
                    if (cashEl) cashEl.innerHTML = `${Number(liquidity.cashDrawer).toLocaleString('fr-DZ')} <span class="font-label-sm font-normal text-on-surface-variant font-mono">د.ج</span>`;

                    const bmEl = liqCards[1].querySelector('.font-label-md');
                    if (bmEl) bmEl.innerHTML = `${Number(liquidity.baridimob).toLocaleString('fr-DZ')} <span class="font-label-sm font-normal text-on-surface-variant font-mono">د.ج</span>`;

                    const bnaEl = liqCards[2].querySelector('.font-label-md');
                    if (bnaEl) bnaEl.innerHTML = `${Number(liquidity.bna).toLocaleString('fr-DZ')} <span class="font-label-sm font-normal text-on-surface-variant font-mono">د.ج</span>`;
                }

                // Header Cash box
                const headerCash = document.querySelector('aside .font-label-md.text-tertiary-fixed');
                if (headerCash) {
                    headerCash.textContent = `${Number(liquidity.cashDrawer).toLocaleString('fr-DZ')} دج`;
                }
            }
        } catch (err) {
            console.error('Failed to load financial summary:', err);
        }
    }

    async function loadExpenses() {
        try {
            if (!window.moboraAPI || !window.moboraAPI.finance) return;

            const categorySelect = document.querySelectorAll('.flex.items-center.gap-1.bg-surface-container-high select')[0];
            const paymentSelect = document.querySelectorAll('.flex.items-center.gap-1.bg-surface-container-high select')[1];

            const category = categorySelect ? categorySelect.value : 'all';
            const paymentMethod = paymentSelect ? paymentSelect.value : 'all';

            const categoryMap = {
                'جميع الفئات': 'all',
                'إيجار المحل': 'rent',
                'فواتير ومرافق (كهرباء / إنترنت)': 'bills_utilities',
                'رواتب وسلفيات الموظفين': 'salaries',
                'مستلزمات وأدوات الورشة': 'workshop_supplies',
                'وجبات ونثريات': 'hospitality_misc'
            };

            const paymentMap = {
                'طريقة الدفع: الكل': 'all',
                'صندوق المحل (نقداً)': 'cash',
                'بريدي موب (BaridiMob)': 'baridimob',
                'تحويل بنكي (BNA)': 'bank'
            };

            const res = await window.moboraAPI.finance.listExpenses({
                category: categoryMap[category] || 'all',
                paymentMethod: paymentMap[paymentMethod] || 'all',
                limit: 100
            });

            allExpenses = res.items || [];
            renderExpensesTable(allExpenses);

            // Update total displayed expenses badge
            const totalExpBadge = document.querySelector('.text-error.font-bold.font-label-md');
            if (totalExpBadge) {
                const sum = allExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
                totalExpBadge.textContent = `${Number(sum).toLocaleString('fr-DZ')} د.ج`;
            }
        } catch (err) {
            console.error('Failed to load expenses:', err);
        }
    }

    function renderExpensesTable(expenses) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        if (!expenses || expenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-space-lg text-center text-on-surface-variant font-body-sm">
                        <div class="flex flex-col items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-[32px] text-outline">search_off</span>
                            <span>لا توجد مصاريف مسجلة بهذه المعايير.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const categoryNames = {
            rent: 'إيجار المحل',
            bills_utilities: 'فواتير ومرافق',
            salaries: 'رواتب وسلفيات',
            workshop_supplies: 'مستلزمات ورشة',
            hospitality_misc: 'وجبات ونثريات',
            other: 'أخرى'
        };

        const paymentMethods = {
            cash: 'صندوق المحل (Cash)',
            baridimob: 'بريدي موب (BaridiMob)',
            bank: 'تحويل بنكي (BNA)'
        };

        tbody.innerHTML = expenses.map(e => {
            const catName = categoryNames[e.category] || e.category || 'عام';
            const payName = paymentMethods[e.payment_method] || e.payment_method;
            const dateStr = e.expense_date ? new Date(e.expense_date).toLocaleDateString('ar-DZ') : 'اليوم';
            const empName = e.employee_name || 'أحمد بن علي (المشرف)';

            return `
                <tr class="hover:bg-surface-container/60 transition-colors group">
                    <td class="py-3.5 px-space-md font-label-sm text-label-sm text-secondary font-mono font-semibold">#${e.expense_code}</td>
                    <td class="py-3.5 px-space-md text-on-surface font-label-sm text-label-sm">
                        <div>${dateStr}</div>
                    </td>
                    <td class="py-3.5 px-space-md font-semibold text-on-surface">
                        ${e.title}
                    </td>
                    <td class="py-3.5 px-space-md">
                        <span class="bg-surface-container-high text-on-surface px-2.5 py-1 rounded text-[11px] font-label-sm font-medium">
                            ${catName}
                        </span>
                    </td>
                    <td class="py-3.5 px-space-md">
                        <div class="flex items-center gap-1 text-on-surface font-body-sm text-body-sm">
                            <span class="material-symbols-outlined text-[16px] text-tertiary">payments</span>
                            <span>${payName}</span>
                        </div>
                    </td>
                    <td class="py-3.5 px-space-md">
                        <div class="flex items-center gap-1.5">
                            <div class="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] text-primary font-bold">م.ع</div>
                            <span class="font-body-sm text-body-sm text-on-surface-variant">${empName}</span>
                        </div>
                    </td>
                    <td class="py-3.5 px-space-md text-left font-label-md text-label-md font-bold text-on-surface font-mono">
                        ${Number(e.amount).toLocaleString('fr-DZ')} <span class="font-label-sm text-label-sm font-normal text-on-surface-variant">د.ج</span>
                    </td>
                    <td class="py-3.5 px-space-md text-center">
                        <button class="text-secondary hover:text-secondary-fixed transition-colors" title="سند الصرف">
                            <span class="material-symbols-outlined text-[20px]">receipt</span>
                        </button>
                    </td>
                    <td class="py-3.5 px-space-md text-center">
                        <div class="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                            <button class="p-1 hover:bg-error-container/30 rounded text-error" onclick="window.deleteExpenseRow(${e.id}, '${e.expense_code}')" title="حذف">
                                <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.deleteExpenseRow = async (id, code) => {
        if (!confirm(`هل أنت متأكد من حذف سند المصروف رقم #${code}؟`)) return;
        try {
            if (window.moboraAPI && window.moboraAPI.finance) {
                await window.moboraAPI.finance.deleteExpense(id);
                alert('تم حذف سند المصروف وتعديل قيود الصندوق بنجاح.');
                await loadFinancialSummary();
                await loadExpenses();
            }
        } catch (err) {
            alert(`فشل الحذف: ${err.message}`);
        }
    };

    function setupExpenseFilters() {
        const searchInput = document.querySelector('input[placeholder*="البحث برقم السند"]');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase().trim();
                const filtered = allExpenses.filter(e => 
                    (e.title && e.title.toLowerCase().includes(query)) ||
                    (e.expense_code && e.expense_code.toLowerCase().includes(query)) ||
                    (e.employee_name && e.employee_name.toLowerCase().includes(query))
                );
                renderExpensesTable(filtered);
            });
        }

        const categorySelect = document.querySelectorAll('.flex.items-center.gap-1.bg-surface-container-high select')[0];
        const paymentSelect = document.querySelectorAll('.flex.items-center.gap-1.bg-surface-container-high select')[1];

        if (categorySelect) categorySelect.addEventListener('change', loadExpenses);
        if (paymentSelect) paymentSelect.addEventListener('change', loadExpenses);
    }

    function setupAddExpenseModal() {
        const modal = document.getElementById('add-expense-modal');
        if (!modal) return;

        // Find the save button inside modal and remove inline onclick
        const confirmBtn = modal.querySelector('button.bg-primary');
        if (confirmBtn) {
            confirmBtn.removeAttribute('onclick');
            confirmBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const titleInput = modal.querySelector('input[placeholder*="مثال"]');
                const amountInput = modal.querySelector('input[type="number"]');
                const catSelect = modal.querySelector('select');
                const radioCash = modal.querySelectorAll('input[name="payment_source"]')[0];
                const radioBm = modal.querySelectorAll('input[name="payment_source"]')[1];
                const radioBna = modal.querySelectorAll('input[name="payment_source"]')[2];

                const title = titleInput ? titleInput.value.trim() : '';
                const amount = amountInput ? Number(amountInput.value) : 0;

                if (!title || !amount || amount <= 0) {
                    alert('يرجى إدخال بيان المصروف والمبلغ بشكل صحيح.');
                    return;
                }

                const categoryMapping = {
                    'مستلزمات ورشة': 'workshop_supplies',
                    'إيجار المحل': 'rent',
                    'فواتير ومرافق': 'bills_utilities',
                    'رواتب وسلفيات': 'salaries',
                    'وجبات ونثريات': 'hospitality_misc',
                    'أخرى': 'other'
                };
                const category = categoryMapping[catSelect?.value] || 'other';

                let payment_method = 'cash';
                if (radioBm && radioBm.checked) payment_method = 'baridimob';
                else if (radioBna && radioBna.checked) payment_method = 'bank';

                try {
                    if (window.moboraAPI && window.moboraAPI.finance) {
                        await window.moboraAPI.finance.createExpense({
                            title,
                            amount,
                            category,
                            payment_method,
                            employee_id: 1,
                            notes: 'مسجل من واجهة المالية'
                        });

                        alert('✅ تم اعتماد سند المصروف بنجاح وتحديث الصندوق والأرصدة!');
                        modal.classList.add('hidden');
                        if (titleInput) titleInput.value = '';
                        if (amountInput) amountInput.value = '';

                        await loadFinancialSummary();
                        await loadExpenses();
                    }
                } catch (err) {
                    alert(`خطأ أثناء تسجيل المصروف: ${err.message}`);
                }
            };
        }
    }

    function setupExportButtons() {
        const pdfBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تقرير مالي شامل (PDF)'));
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                window.print();
            });
        }

        const excelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تصدير Excel'));
        if (excelBtn) {
            excelBtn.addEventListener('click', () => {
                let csv = '\uFEFF';
                csv += '=== MOBORA ERP - تقرير الأداء المالي والمصاريف ===\n';
                csv += `تاريخ الاستخراج,${new Date().toLocaleDateString('ar-DZ')}\n`;
                csv += `الفترة المحددة,${currentPeriod}\n\n`;

                if (currentSummaryData && currentSummaryData.financials) {
                    const f = currentSummaryData.financials;
                    const l = currentSummaryData.liquidity;
                    csv += 'المؤشر المالي,القيمة بالدينار الجزائري (د.ج)\n';
                    csv += `إجمالي المبيعات والإيرادات,${f.totalRevenue || 0}\n`;
                    csv += `تكلفة البضاعة والمشتريات (COGS),${f.totalCostOfGoods || 0}\n`;
                    csv += `المصاريف التشغيلية (Opex),${f.totalExpenses || 0}\n`;
                    csv += `صافي الربح الصافي (Net Profit),${f.netProfit || 0}\n`;
                    csv += `هامش الربح الصافي,${f.profitMargin || 0}%\n\n`;

                    if (l) {
                        csv += 'رصيد الخزينة والسيولة,القيمة (د.ج)\n';
                        csv += `صندوق المحل (Cash),${l.cashDrawer || 0}\n`;
                        csv += `بريدي موب (BaridiMob),${l.baridimob || 0}\n`;
                        csv += `حساب البنك (BNA),${l.bna || 0}\n\n`;
                    }
                }

                csv += 'سند الصرف,التاريخ,البيان,الفئة,طريقة الدفع,المسؤول,المبلغ (د.ج)\n';
                allExpenses.forEach(e => {
                    const cleanTitle = (e.title || '').replace(/,/g, ' ');
                    const cleanDate = e.expense_date || '';
                    const cleanEmp = (e.employee_name || 'أحمد بن علي').replace(/,/g, ' ');
                    csv += `"${e.expense_code}","${cleanDate}","${cleanTitle}","${e.category}","${e.payment_method}","${cleanEmp}",${e.amount}\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `تقرير_مالي_MOBORA_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFinanceReports);
    } else {
        initFinanceReports();
    }
})();
