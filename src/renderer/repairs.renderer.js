// Repairs Kanban Workshop Renderer Logic
(function () {
    let currentTechnician = 'all';
    let currentIssue = 'all';
    let isUrgentOnly = false;
    let searchQuery = '';
    let activeTicketId = null;

    async function loadKanban() {
        if (!window.moboraAPI || !window.moboraAPI.repairs) return;

        try {
            const res = await window.moboraAPI.repairs.listKanban({
                technicianId: currentTechnician,
                issueCategory: currentIssue,
                urgentOnly: isUrgentOnly,
                search: searchQuery
            });

            if (!res || !res.columns) return;

            const cols = ['received', 'diagnosing', 'in_progress', 'ready', 'delivered'];
            cols.forEach((colKey, index) => {
                const colEl = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.xl\\:grid-cols-5 > div')[index];
                if (!colEl) return;

                // Update count badge
                const countBadge = colEl.querySelector('.font-label-sm.rounded-full');
                const items = res.columns[colKey] || [];
                if (countBadge) countBadge.innerText = items.length;

                // Remove existing cards
                const existingCards = colEl.querySelectorAll('.bg-surface-container, .bg-surface-container\\/60');
                existingCards.forEach(c => c.remove());

                // Append real cards
                items.forEach(item => {
                    const card = document.createElement('div');
                    const isUrgent = item.priority === 'urgent';
                    card.className = 'bg-surface-container rounded-lg p-space-sm flex flex-col gap-space-xs shadow-md hover:bg-surface-container-high transition-all cursor-pointer group mt-2';
                    card.onclick = () => window.openDetailModal(item.ticket_number);

                    let statusAction = '';
                    if (colKey === 'ready') {
                        statusAction = `
                            <button onclick="event.stopPropagation(); window.quickDeliverRepair(${item.id})" class="w-full bg-primary text-on-primary font-label-sm text-label-sm py-1 rounded flex items-center justify-center gap-1 hover:bg-primary-fixed-dim mt-1">
                                <span class="material-symbols-outlined text-[14px]">point_of_sale</span>
                                تسليم وقبض
                            </button>
                        `;
                    }

                    card.innerHTML = `
                        <div class="flex items-center justify-between">
                            <span class="font-label-sm text-label-sm text-secondary bg-surface-container-highest px-space-xs py-0.5 rounded font-bold">${item.ticket_number}</span>
                            ${isUrgent ? `
                                <span class="flex items-center gap-1 font-label-sm text-label-sm text-error bg-error-container/40 text-on-error-container px-space-xs py-0.5 rounded">
                                    <span class="material-symbols-outlined text-[14px]">bolt</span>
                                    مستعجل
                                </span>
                            ` : '<span class="font-label-sm text-label-sm text-outline">عادي</span>'}
                        </div>
                        <div class="flex items-center gap-space-xs">
                            <div class="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 text-primary">
                                <span class="material-symbols-outlined text-[20px]">phone_iphone</span>
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="font-headline-md text-headline-md text-on-surface truncate">${item.device_model}</span>
                                <span class="font-label-sm text-label-sm text-on-surface-variant truncate">الزبون: ${item.customer_name}</span>
                            </div>
                        </div>
                        <div class="bg-surface-container-lowest/60 p-space-xs rounded font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px] text-tertiary">build</span>
                            <span class="truncate">${item.issue_description}</span>
                        </div>
                        <div class="flex items-center justify-between pt-space-xs">
                            <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                                <span class="material-symbols-outlined text-[16px]">schedule</span>
                                <span>${item.storage_slot || 'الورشة'}</span>
                            </div>
                            <span class="font-label-md text-label-md text-primary font-bold">${Number(item.total_price).toLocaleString('fr-DZ')} د.ج</span>
                        </div>
                        ${statusAction}
                    `;

                    colEl.appendChild(card);
                });
            });

        } catch (e) {
            console.error('[Repairs Kanban Error]', e);
        }
    }

    // Open Detail Modal
    window.openDetailModal = async function (ticketNumber) {
        if (!ticketNumber) return;
        const modal = document.getElementById('repairDetailModal');
        if (!modal) return;

        try {
            const ticket = await window.moboraAPI.repairs.getById(ticketNumber);
            if (!ticket) return;

            activeTicketId = ticket.id;
            modal.classList.remove('hidden');

            // Populate header
            modal.querySelector('h2, .font-headline-lg').innerText = `بطاقة أمر الإصلاح: ${ticket.ticket_number}`;
            const statusBadge = modal.querySelector('.font-headline-lg + span');
            if (statusBadge) {
                const statusNames = { received: '1. مستلم', diagnosing: '2. قيد الفحص', in_progress: '3. قيد الإصلاح', ready: '4. جاهز للتسليم', delivered: '5. تم التسليم' };
                statusBadge.innerText = statusNames[ticket.status] || ticket.status;
            }

            // Populate Device Card
            const devCards = modal.querySelectorAll('.bg-surface-container-lowest');
            if (devCards.length >= 2) {
                // Device info
                devCards[0].innerHTML = `
                    <span class="font-label-md text-label-md text-secondary font-bold flex items-center gap-1">
                        <span class="material-symbols-outlined text-[18px]">smartphone</span> بيانات الجهاز
                    </span>
                    <div class="flex flex-col gap-1 mt-1 text-body-md">
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">الموديل:</span><span class="text-on-surface font-bold">${ticket.device_model}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">اللون:</span><span class="text-on-surface">${ticket.device_color || 'غير محدد'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">رمز القفل:</span><span class="text-primary font-label-md font-bold tracking-widest bg-surface-container px-2 py-0.5 rounded">${ticket.lock_code || 'بدون رمز'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">IMEI:</span><span class="text-secondary font-label-sm font-mono">${ticket.imei || 'غير مسجل'}</span></div>
                    </div>
                `;

                // Customer info
                devCards[1].innerHTML = `
                    <span class="font-label-md text-label-md text-primary font-bold flex items-center gap-1">
                        <span class="material-symbols-outlined text-[18px]">person</span> بيانات الزبون
                    </span>
                    <div class="flex flex-col gap-1 mt-1 text-body-md">
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">الاسم الكامل:</span><span class="text-on-surface font-bold">${ticket.customer_name}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">الهاتف:</span><span class="text-on-surface font-label-md font-mono">${ticket.customer_phone}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">المكان:</span><span class="text-primary font-bold">${ticket.storage_slot || 'الورشة'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">العطل:</span><span class="text-on-surface-variant text-body-sm truncate">${ticket.issue_description}</span></div>
                    </div>
                `;
            }

            // Populate Parts Table
            renderPartsTable(ticket.parts || [], ticket);

            // Bind Stage Transition Controls
            bindStageControls(ticket);

        } catch (e) {
            console.error('[Open Detail Error]', e);
        }
    };

    function renderPartsTable(parts, ticket) {
        const tbody = document.querySelector('#repairDetailModal table tbody');
        if (!tbody) return;

        if (parts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-space-md text-center text-on-surface-variant">لم يتم استخدام قطع غيار من المخزون بعد. اضغط على "+ إضافة قطعة من المخزن" لإرفاق قطعة.</td></tr>';
        } else {
            tbody.innerHTML = parts.map(p => `
                <tr class="hover:bg-surface-container-high/40 transition-colors">
                    <td class="p-space-xs font-label-sm text-secondary font-mono">${p.part_code || 'PRT'}</td>
                    <td class="p-space-xs font-semibold">${p.part_name}</td>
                    <td class="p-space-xs text-center font-label-md">${p.quantity}</td>
                    <td class="p-space-xs font-label-md text-primary">${Number(p.unit_price).toLocaleString('fr-DZ')} د.ج</td>
                    <td class="p-space-xs">
                        <span class="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-primary-container/20 px-2 py-0.5 rounded">
                            <span class="material-symbols-outlined text-[14px]">done</span> تم الخصم
                        </span>
                    </td>
                    <td class="p-space-xs text-center">
                        <button onclick="window.removeRepairPart(${p.id})" class="text-error hover:text-on-error p-1 rounded hover:bg-error-container" title="حذف واسترجاع للمخزن">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Totals summary
        const sparePartsTotalEl = document.querySelector('#repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(1) .font-headline-md');
        if (sparePartsTotalEl) sparePartsTotalEl.innerText = `${Number(ticket.spare_parts_price).toLocaleString('fr-DZ')} د.ج`;

        const laborEl = document.querySelector('#repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(2) input, #repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(2) .font-headline-md');
        if (laborEl) {
            if (laborEl.tagName === 'INPUT') laborEl.value = ticket.labor_cost;
            else laborEl.innerText = `${Number(ticket.labor_cost).toLocaleString('fr-DZ')} د.ج`;
        }

        const totalPayableEl = document.querySelector('#repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(3) .font-headline-xl, #repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(3) .font-headline-md');
        if (totalPayableEl) totalPayableEl.innerText = `${Number(ticket.total_price).toLocaleString('fr-DZ')} د.ج`;
    }

    function bindStageControls(ticket) {
        // Handover & Pay button in footer
        const payBtn = document.querySelector('#repairDetailModal .bg-primary.hover\\:bg-primary-fixed-dim');
        if (payBtn) {
            payBtn.onclick = async () => {
                if (confirm(`تسليم الجهاز للزبون [${ticket.customer_name}] وقبض مبلغ ${Number(ticket.total_price).toLocaleString('fr-DZ')} د.ج نقداً؟`)) {
                    await window.moboraAPI.repairs.completeAndPay({ id: ticket.id, paymentMethod: 'cash' });
                    alert('تم تسليم الجهاز وإصدار بطاقة الضمان وقبض المبلغ بنجاح!');
                    window.closeDetailModal();
                    loadKanban();
                }
            };
        }

        // Add part button
        const addPartBtn = document.getElementById('addPartBtn');
        if (addPartBtn) {
            addPartBtn.onclick = async () => {
                // Fetch workshop parts
                const spareList = await window.moboraAPI.products.list({ category: 'spare', limit: 50 });
                if (!spareList.items || spareList.items.length === 0) {
                    alert('لا توجد قطع غيار مسجلة في المخزن.');
                    return;
                }

                const optionsStr = spareList.items.map((p, idx) => `${idx + 1}. ${p.name} (متوفر: ${p.current_stock} | السعر: ${p.sell_price} د.ج)`).join('\n');
                const choice = prompt(`اختر رقم القطعة المراد استخدامها من المخزن:\n\n${optionsStr}`);
                const num = parseInt(choice, 10);
                if (num >= 1 && num <= spareList.items.length) {
                    const selected = spareList.items[num - 1];
                    try {
                        await window.moboraAPI.repairs.addPart({
                            repairId: ticket.id,
                            productId: selected.id,
                            quantity: 1
                        });
                        alert(`تم خصم [${selected.name}] من المخزن وإضافتها لأمر الصيانة بنجاح!`);
                        window.openDetailModal(ticket.id);
                        loadKanban();
                    } catch (e) {
                        alert(e.message);
                    }
                }
            };
        }
    }

    window.removeRepairPart = async function (partId) {
        if (!confirm('حذف هذه القطعة من أمر الصيانة واسترجاع كميتها للمخزن؟')) return;
        try {
            await window.moboraAPI.repairs.removePart(partId);
            alert('تم استرجاع القطعة إلى المخزون بنجاح!');
            if (activeTicketId) window.openDetailModal(activeTicketId);
            loadKanban();
        } catch (e) {
            alert(e.message);
        }
    };

    window.quickDeliverRepair = async function (id) {
        if (!confirm('تسليم الجهاز وقبض المبلغ نقداً؟')) return;
        try {
            await window.moboraAPI.repairs.completeAndPay({ id, paymentMethod: 'cash' });
            alert('تم تسليم الجهاز وإصدار الضمان وقبض المبلغ!');
            loadKanban();
        } catch (e) {
            alert(e.message);
        }
    };

    // Intake New Repair
    window.intakeNewRepair = async function () {
        const custName = prompt('اسم الزبون:');
        if (!custName || !custName.trim()) return;

        const custPhone = prompt('رقم الهاتف:');
        if (!custPhone || !custPhone.trim()) return;

        const devModel = prompt('موديل الجهاز (مثال: iPhone 13 Pro Max):');
        if (!devModel || !devModel.trim()) return;

        const lockCode = prompt('رمز القفل أو النمط (اختياري):', '');
        const issue = prompt('وصف العطل بدقة:', 'شاشة مكسورة');
        const labor = prompt('أجر اليد المقدر (د.ج):', '3000');
        const isUrgent = confirm('هل الطلب مستعجل؟');

        try {
            const res = await window.moboraAPI.repairs.create({
                customer_name: custName.trim(),
                customer_phone: custPhone.trim(),
                device_model: devModel.trim(),
                lock_code: lockCode ? lockCode.trim() : null,
                issue_description: issue ? issue.trim() : 'فحص وصيانة',
                labor_cost: Number(labor) || 0,
                priority: isUrgent ? 'urgent' : 'normal'
            });

            alert(`✅ تم فتح تذكرة صيانة جديدة بنجاح!\nرقم التذكرة: ${res.ticket.ticket_number}`);
            loadKanban();
        } catch (e) {
            alert('خطأ: ' + e.message);
        }
    };

    function initFilters() {
        const intakeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('استلام جهاز جديد'));
        if (intakeBtn) {
            intakeBtn.onclick = window.intakeNewRepair;
        }

        const urgentBtn = document.querySelector('button:has(.material-symbols-outlined:contains("priority_high"))');
        if (urgentBtn) {
            urgentBtn.onclick = () => {
                isUrgentOnly = !isUrgentOnly;
                urgentBtn.className = isUrgentOnly 
                    ? 'bg-error text-on-error px-space-sm py-2 rounded-lg font-label-md text-label-md flex items-center gap-1 shadow-md'
                    : 'bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface px-space-sm py-2 rounded-lg font-label-md text-label-md flex items-center gap-1 transition-colors';
                loadKanban();
            };
        }

        const searchInput = document.querySelector('input[placeholder*="البحث عن تذكرة"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                loadKanban();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initFilters();
            loadKanban();
        });
    } else {
        initFilters();
        loadKanban();
    }
})();
