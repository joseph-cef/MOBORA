// Dashboard Renderer Logic (Connects UI with window.moboraAPI)
(function () {
    async function loadDashboard() {
        if (!window.moboraAPI || !window.moboraAPI.dashboard) {
            console.warn('[Dashboard] moboraAPI not found. Running in standalone browser preview.');
            return;
        }

        try {
            const res = await window.moboraAPI.dashboard.getMetrics();
            if (!res || !res.success) return;
            const data = res.data;

            // 1. Metric 1: Today's Revenue
            const revenueEl = document.querySelector('h1 + span + span, .grid > div:nth-child(1) .font-headline-xl');
            if (revenueEl) {
                revenueEl.innerText = Number(data.today.revenue).toLocaleString('fr-DZ');
            }

            // 2. Metric 2: Stock Units & Valuation
            const stockValuationEl = document.querySelector('.grid > div:nth-child(2) .font-headline-xl');
            if (stockValuationEl) {
                stockValuationEl.innerText = Number(data.stock.valuation).toLocaleString('fr-DZ');
            }
            const stockBadgeEl = document.querySelector('.grid > div:nth-child(2) .font-headline-xl + span');
            if (stockBadgeEl) {
                stockBadgeEl.innerText = `${data.stock.total_items} صنف`;
            }

            // 3. Metric 3: Active Repairs
            const repairsEl = document.querySelector('.grid > div:nth-child(3) .font-headline-xl');
            if (repairsEl) {
                repairsEl.innerText = data.repairs.active;
            }
            const repairBreakdown = document.querySelector('.grid > div:nth-child(3) .mt-space-md');
            if (repairBreakdown) {
                repairBreakdown.innerHTML = `
                    <span class="text-secondary-fixed"><strong class="font-bold">${data.repairs.diagnosing}</strong> قيد الفحص</span>
                    <span class="w-1 h-1 rounded-full bg-outline-variant"></span>
                    <span class="text-tertiary"><strong class="font-bold">${data.repairs.in_progress}</strong> صيانة نشطة</span>
                    <span class="w-1 h-1 rounded-full bg-outline-variant"></span>
                    <span class="text-primary font-bold">${data.repairs.ready} جاهزة</span>
                `;
            }

            // 4. Metric 4: Daily Profit Estimation
            const profitEl = document.querySelector('.grid > div:nth-child(4) .font-headline-xl');
            if (profitEl) {
                profitEl.innerText = Number(data.today.profit).toLocaleString('fr-DZ');
            }
            const marginEl = document.querySelector('.grid > div:nth-child(4) .mt-space-md span:nth-child(2)');
            if (marginEl) {
                marginEl.innerText = `هامش ربح تقديري: ${data.today.margin_percent}%`;
            }

            // 5. Cash Drawer in Sidebar & Widget
            const cashDrawerSidebar = document.querySelector('aside .font-label-md.text-tertiary-fixed');
            if (cashDrawerSidebar) {
                cashDrawerSidebar.innerText = `${Number(data.liquidity.cash_drawer).toLocaleString('fr-DZ')} دج`;
            }
            const cashWidget = document.querySelector('.bg-surface-container-low .text-tertiary-fixed');
            if (cashWidget) {
                cashWidget.innerText = `${Number(data.liquidity.cash_drawer).toLocaleString('fr-DZ')} د.ج`;
            }

            // 6. Low Stock Alert Table
            const lowStockProductsRes = await window.moboraAPI.products.list({ stockStatus: 'low', limit: 4 });
            const lowStockContainer = document.querySelector('.grid-cols-1.lg\\:grid-cols-2 > div:nth-child(1) .flex-col.gap-space-xs');
            const lowStockBadge = document.querySelector('.grid-cols-1.lg\\:grid-cols-2 > div:nth-child(1) .bg-error-container');
            
            if (lowStockBadge) {
                lowStockBadge.innerText = `${lowStockProductsRes.total} أصناف حرجة`;
            }

            if (lowStockContainer && lowStockProductsRes.items.length > 0) {
                lowStockContainer.innerHTML = lowStockProductsRes.items.map(p => `
                    <div class="flex items-center justify-between p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors gap-space-sm">
                        <div class="flex items-center gap-space-sm min-w-0">
                            <div class="w-11 h-11 rounded-lg bg-surface-container-highest overflow-hidden shrink-0 flex items-center justify-center text-primary">
                                <span class="material-symbols-outlined text-[24px]">inventory_2</span>
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="font-label-lg text-label-lg text-on-surface font-semibold truncate">${p.name}</span>
                                <span class="font-body-sm text-body-sm text-on-surface-variant font-mono text-[11px] truncate">SKU: ${p.barcode || 'N/A'} • سعر البيع: ${Number(p.sell_price).toLocaleString('fr-DZ')} د.ج</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-space-sm shrink-0">
                            <span class="px-space-xs py-0.5 rounded bg-error-container text-on-error font-label-sm text-label-sm font-bold flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">error</span>
                                باقي ${p.current_stock} فقط
                            </span>
                            <button onclick="window.location.href='../suppliers_purchases/code.html'" class="px-space-sm py-1 rounded bg-secondary-container text-on-secondary-container hover:bg-secondary font-label-sm text-label-sm transition-colors whitespace-nowrap">
                                طلب توريد
                            </button>
                        </div>
                    </div>
                `).join('');
            }

            // 7. Repairs Ready for Handover List
            const readyRepairsRes = await window.moboraAPI.repairs.listKanban();
            const readyRepairs = readyRepairsRes.columns.ready || [];
            const readyContainer = document.querySelector('.grid-cols-1.lg\\:grid-cols-2 > div:nth-child(2) .flex-col.gap-space-xs');
            const readyBadge = document.querySelector('.grid-cols-1.lg\\:grid-cols-2 > div:nth-child(2) .bg-primary-container');

            if (readyBadge) {
                readyBadge.innerText = `${readyRepairs.length} أجهزة جاهزة`;
            }

            if (readyContainer) {
                if (readyRepairs.length === 0) {
                    readyContainer.innerHTML = '<div class="p-space-md text-center text-on-surface-variant font-body-sm">لا توجد أجهزة جاهزة بانتظار التسليم حالياً.</div>';
                } else {
                    readyContainer.innerHTML = readyRepairs.slice(0, 4).map(r => `
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors gap-space-sm">
                            <div class="flex items-start gap-space-sm min-w-0">
                                <div class="p-space-xs rounded bg-surface-container-highest text-primary shrink-0 mt-0.5">
                                    <span class="material-symbols-outlined text-[20px]">phone_android</span>
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-space-xs">
                                        <span class="font-label-md text-label-md text-primary font-bold">#${r.ticket_number}</span>
                                        <span class="font-label-sm text-label-sm text-on-surface font-semibold truncate">${r.customer_name} (${r.customer_phone})</span>
                                    </div>
                                    <span class="font-body-sm text-body-sm text-on-surface truncate">${r.device_model} • ${r.issue_description}</span>
                                    <span class="font-label-sm text-label-sm text-outline">المكان: ${r.storage_slot || 'جاهز بالورشة'}</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between sm:justify-end gap-space-md shrink-0 pt-space-xs sm:pt-0">
                                <div class="text-right">
                                    <span class="font-label-sm text-label-sm text-on-surface-variant block">المطلوب دفعه</span>
                                    <span class="font-headline-md text-headline-md text-primary font-bold">${Number(r.total_price).toLocaleString('fr-DZ')} د.ج</span>
                                </div>
                                <button onclick="deliverAndPayRepair(${r.id})" class="px-space-md py-space-xs rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim font-label-md text-label-md font-bold transition-all shadow-sm flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[18px]">receipt_long</span>
                                    <span>تسليم وقبض</span>
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // 8. Bind Shortcut Buttons (F1 to F4)
            const quickButtons = document.querySelectorAll('.lg\\:col-span-4 button');
            if (quickButtons.length >= 4) {
                quickButtons[0].onclick = () => window.location.href = '../pos_terminal/code.html';
                quickButtons[1].onclick = () => window.location.href = '../repairs_kanban/code.html';
                quickButtons[2].onclick = () => window.location.href = '../imei_warranty_checker/code.html';
                quickButtons[3].onclick = () => window.location.href = '../inventory/code.html';
            }

            // Keyboard listeners: F1, F2, F3, F4
            window.addEventListener('keydown', (e) => {
                if (e.key === 'F1') { e.preventDefault(); window.location.href = '../pos_terminal/code.html'; }
                if (e.key === 'F2') { e.preventDefault(); window.location.href = '../repairs_kanban/code.html'; }
                if (e.key === 'F3') { e.preventDefault(); window.location.href = '../imei_warranty_checker/code.html'; }
                if (e.key === 'F4') { e.preventDefault(); window.location.href = '../inventory/code.html'; }
            });

        } catch (err) {
            console.error('[Dashboard Renderer Error]', err);
        }
    }

    // Global action: Handover repair from dashboard
    window.deliverAndPayRepair = async function (id) {
        if (!confirm('تأكيد تسليم الجهاز للزبون واستلام المبلغ نقداً؟')) return;
        try {
            await window.moboraAPI.repairs.completeAndPay({ id, paymentMethod: 'cash' });
            alert('تم تسجيل تسليم الجهاز وإصدار الضمان وقبض المبلغ بنجاح!');
            loadDashboard();
        } catch (e) {
            alert('حدث خطأ: ' + e.message);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDashboard);
    } else {
        loadDashboard();
    }
})();
