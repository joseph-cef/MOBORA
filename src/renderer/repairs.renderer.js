// Repairs Kanban Workshop Renderer Logic
(function () {
    let currentTechnician = 'all';
    let currentIssue = 'all';
    let isUrgentOnly = false;
    let searchQuery = '';
    let activeTicketId = null;
    let activeTicketData = null;

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
                const existingCards = colEl.querySelectorAll('.kanban-card, .bg-surface-container, .bg-surface-container\\/60');
                existingCards.forEach(c => c.remove());

                // Append real cards
                items.forEach(item => {
                    const card = document.createElement('div');
                    const isUrgent = item.priority === 'urgent';
                    card.className = 'kanban-card bg-surface-container rounded-lg p-space-sm flex flex-col gap-space-xs shadow-md hover:bg-surface-container-high transition-all cursor-pointer group mt-2';
                    card.onclick = () => window.openDetailModal(item.ticket_number);

                    let statusAction = '';
                    if (colKey === 'ready') {
                        statusAction = `
                            <button onclick="event.stopPropagation(); window.quickDeliverRepair(${item.id})" class="w-full bg-primary text-on-primary font-label-sm text-label-sm py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-primary-fixed-dim mt-1 font-bold shadow-sm">
                                <span class="material-symbols-outlined text-[16px]">point_of_sale</span>
                                تسليم وقبض
                            </button>
                        `;
                    }

                    card.innerHTML = `
                        <div class="flex items-center justify-between">
                            <span class="font-label-sm text-label-sm text-secondary bg-surface-container-highest px-space-xs py-0.5 rounded font-bold">${item.ticket_number}</span>
                            ${isUrgent ? `
                                <span class="flex items-center gap-1 font-label-sm text-label-sm text-error bg-error-container/40 text-on-error-container px-space-xs py-0.5 rounded font-bold">
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
                            <span class="font-label-md text-label-md text-primary font-bold font-mono">${Number(item.total_price).toLocaleString('fr-DZ')} د.ج</span>
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
    window.openDetailModal = async function (ticketIdentifier) {
        if (!ticketIdentifier) return;
        const modal = document.getElementById('repairDetailModal');
        if (!modal) return;

        try {
            const ticket = await window.moboraAPI.repairs.getById(ticketIdentifier);
            if (!ticket) return;

            activeTicketId = ticket.id;
            activeTicketData = ticket;
            modal.classList.remove('hidden');

            // Populate header
            const titleEl = modal.querySelector('h2, .font-headline-lg');
            if (titleEl) titleEl.innerText = `بطاقة أمر الإصلاح: ${ticket.ticket_number}`;

            const statusBadge = modal.querySelector('.font-headline-lg + span');
            if (statusBadge) {
                const statusNames = { 
                    received: '1. مستلم في الانتظار', 
                    diagnosing: '2. قيد الفحص والتشخيص', 
                    in_progress: '3. قيد الإصلاح الفعلي', 
                    ready: '4. تم الإصلاح (جاهز للتسليم)', 
                    delivered: '5. تم التسليم والأرشفة' 
                };
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
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">رمز القفل:</span><span class="text-primary font-label-md font-bold tracking-widest bg-surface-container px-2 py-0.5 rounded font-mono">${ticket.lock_code || 'بدون رمز'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">IMEI:</span><span class="text-secondary font-label-sm font-mono">${ticket.imei || 'غير مسجل'}</span></div>
                    </div>
                `;

                // Customer info
                devCards[1].innerHTML = `
                    <span class="font-label-md text-label-md text-primary font-bold flex items-center gap-1">
                        <span class="material-symbols-outlined text-[18px]">person</span> بيانات الزبون
                    </span>
                    <div class="flex flex-col gap-1 mt-1 text-body-md">
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">الاسم:</span><span class="text-on-surface font-bold">${ticket.customer_name}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">الهاتف:</span><span class="text-on-surface font-label-md font-mono" dir="ltr">${ticket.customer_phone}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">المكان:</span><span class="text-primary font-bold">${ticket.storage_slot || 'صندوق الورشة'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-on-surface-variant">العطل:</span><span class="text-on-surface-variant text-body-sm truncate">${ticket.issue_description}</span></div>
                    </div>
                `;
            }

            // Populate Parts Table
            renderPartsTable(ticket.parts || [], ticket);

            // Bind Stage Transition Controls
            bindStageControls(ticket);

            // Bind Action Footer Buttons (Thermal Print, SMS/WhatsApp, Handover)
            bindFooterActions(ticket);

        } catch (e) {
            console.error('[Open Detail Error]', e);
        }
    };

    window.closeDetailModal = function () {
        const modal = document.getElementById('repairDetailModal');
        if (modal) modal.classList.add('hidden');
        activeTicketId = null;
        activeTicketData = null;
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
                    <td class="p-space-xs font-label-md text-primary font-mono">${Number(p.unit_price).toLocaleString('fr-DZ')} د.ج</td>
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
        if (sparePartsTotalEl) sparePartsTotalEl.innerText = `${Number(ticket.spare_parts_price || 0).toLocaleString('fr-DZ')} د.ج`;

        const laborEl = document.querySelector('#repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(2) input');
        if (laborEl) {
            laborEl.value = ticket.labor_cost;
        }

        const totalPayableEl = document.querySelector('#repairDetailModal .grid-cols-1.md\\:grid-cols-3 > div:nth-child(3) .font-headline-xl');
        if (totalPayableEl) totalPayableEl.innerText = Number(ticket.total_price).toLocaleString('fr-DZ');
    }

    function bindStageControls(ticket) {
        // Wire the 5 Stage Transition Buttons in the Modal Bar
        const stageBar = document.querySelector('#repairDetailModal .flex-wrap.items-center.gap-space-xs');
        if (stageBar) {
            const stages = [
                { key: 'received', label: '1. مستلم' },
                { key: 'diagnosing', label: '2. قيد الفحص' },
                { key: 'in_progress', label: '3. قيد الإصلاح' },
                { key: 'ready', label: '4. تم الإصلاح (جاهز)' },
                { key: 'delivered', label: '5. تسليم وأرشفة' }
            ];

            stageBar.innerHTML = stages.map(s => {
                const isCurrent = ticket.status === s.key;
                const activeClass = isCurrent 
                    ? 'bg-primary text-on-primary font-bold shadow-md' 
                    : 'bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface';
                return `<button onclick="window.transitionRepairStage('${s.key}')" class="px-space-sm py-1.5 rounded-lg font-label-sm text-label-sm transition-all ${activeClass}">${s.label}</button>`;
            }).join('');
        }
    }

    window.transitionRepairStage = async function (newStatus) {
        if (!activeTicketId) return;
        try {
            await window.moboraAPI.repairs.updateStatus({ id: activeTicketId, status: newStatus });
            // Reload modal & board
            window.openDetailModal(activeTicketId);
            loadKanban();
        } catch (e) {
            alert('خطأ أثناء تحديث الحالة: ' + e.message);
        }
    };

    function bindFooterActions(ticket) {
        // 1. Thermal print voucher button
        const printBtn = Array.from(document.querySelectorAll('#repairDetailModal button')).find(b => b.innerText.includes('طباعة وصل الاستلام'));
        if (printBtn) {
            printBtn.onclick = async () => {
                if (window.moboraAPI && window.moboraAPI.printer) {
                    try {
                        await window.moboraAPI.printer.printRepair({ repairId: ticket.id });
                        alert('✅ تم إرسال أمر طباعة وصل الاستلام إلى الطابعة الحرارية.');
                    } catch (pe) {
                        alert('تعذر الطباعة الحرارية: ' + pe.message);
                    }
                }
            };
        }

        // 2. WhatsApp message button (replaces fake SMS)
        const smsBtn = Array.from(document.querySelectorAll('#repairDetailModal button')).find(b => b.innerText.includes('إرسال SMS') || b.innerText.includes('واتساب'));
        if (smsBtn) {
            smsBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">chat</span><span>مراسلة عبر WhatsApp</span>';
            smsBtn.onclick = () => {
                const phone = (ticket.customer_phone || '').replace(/[^0-9]/g, '');
                const cleanPhone = phone.startsWith('0') ? '213' + phone.slice(1) : phone;
                const msg = encodeURIComponent(`مرحباً ${ticket.customer_name}، بخصوص جهازك (${ticket.device_model}) رقم التذكرة #${ticket.ticket_number} في محلنا. حالة الجهاز: ${ticket.status}.`);
                window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
            };
        }

        // 3. Handover & Pay Button
        const payBtn = Array.from(document.querySelectorAll('#repairDetailModal button')).find(b => b.innerText.includes('تسليم الجهاز وقبض المبلغ'));
        if (payBtn) {
            payBtn.onclick = async () => {
                if (confirm(`تسليم الجهاز للزبون [${ticket.customer_name}] وقبض مبلغ ${Number(ticket.total_price).toLocaleString('fr-DZ')} د.ج نقداً؟`)) {
                    try {
                        await window.moboraAPI.repairs.completeAndPay({ id: ticket.id, paymentMethod: 'cash' });
                        alert('✅ تم تسليم الجهاز للزبون وإصدار بطاقة الضمان وقبض المبلغ بنجاح!');
                        window.closeDetailModal();
                        loadKanban();
                    } catch (e) {
                        alert('خطأ: ' + e.message);
                    }
                }
            };
        }

        // 4. Add part button: Dedicated Modal / Picker
        const addPartBtn = document.getElementById('addPartBtn') || Array.from(document.querySelectorAll('#repairDetailModal button')).find(b => b.innerText.includes('إضافة قطعة من المخزن'));
        if (addPartBtn) {
            addPartBtn.onclick = () => window.openAddPartModal(ticket);
        }
    }

    // Dedicated Add Part Picker Modal
    window.openAddPartModal = async function (ticket) {
        try {
            const spareList = await window.moboraAPI.products.list({ category: 'spare', limit: 100 });
            const items = spareList.items || [];
            if (items.length === 0) {
                alert('لا توجد قطع غيار مسجلة في المخزن حالياً.');
                return;
            }

            let pickerModal = document.getElementById('spare-part-picker-modal');
            if (!pickerModal) {
                const modalHtml = `
                <div id="spare-part-picker-modal" class="fixed inset-0 z-[110] flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-4">
                    <div class="bg-surface-container max-w-lg w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-4 border border-surface-container-high">
                        <div class="flex items-center justify-between pb-2 border-b border-surface-container-high">
                            <h3 class="font-headline-md text-on-surface font-bold">اختيار قطعة غيار من المخزن</h3>
                            <button onclick="document.getElementById('spare-part-picker-modal').classList.add('hidden')" class="text-on-surface-variant hover:text-on-surface">
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <input id="spare-search-input" type="text" placeholder="ابحث بالاسم أو الباركود..." class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary font-body-sm" />
                        <div id="spare-parts-list" class="flex flex-col gap-1.5 max-h-64 overflow-y-auto"></div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                pickerModal = document.getElementById('spare-part-picker-modal');
            }

            const listContainer = document.getElementById('spare-parts-list');
            const searchInput = document.getElementById('spare-search-input');

            function renderSpares(filtered) {
                listContainer.innerHTML = filtered.map(p => `
                    <div onclick="window.confirmAttachPart(${ticket.id}, ${p.id}, '${p.name.replace(/'/g, "\\'")}')" class="p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high flex items-center justify-between cursor-pointer transition-colors">
                        <div class="flex flex-col min-w-0">
                            <span class="font-label-md text-on-surface font-semibold truncate">${p.name}</span>
                            <span class="font-label-sm text-outline font-mono">متوفر: ${p.current_stock} قطع</span>
                        </div>
                        <span class="font-label-md text-primary font-bold font-mono">${Number(p.sell_price).toLocaleString()} د.ج</span>
                    </div>
                `).join('');
            }

            renderSpares(items);
            if (searchInput) {
                searchInput.value = '';
                searchInput.oninput = () => {
                    const q = searchInput.value.toLowerCase().trim();
                    const filtered = items.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)));
                    renderSpares(filtered);
                };
            }

            pickerModal.classList.remove('hidden');

        } catch (e) {
            alert(e.message);
        }
    };

    window.confirmAttachPart = async function (repairId, productId, partName) {
        if (!confirm(`تأكيد خصم [${partName}] من المخزن وإضافتها لأمر الصيانة؟`)) return;
        try {
            await window.moboraAPI.repairs.addPart({ repairId, productId, quantity: 1 });
            const modal = document.getElementById('spare-part-picker-modal');
            if (modal) modal.classList.add('hidden');
            window.openDetailModal(repairId);
            loadKanban();
        } catch (e) {
            alert('فشل إضافة القطعة: ' + e.message);
        }
    };

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
        if (!confirm('تسليم الجهاز للزبون وقبض المبلغ نقداً؟')) return;
        try {
            await window.moboraAPI.repairs.completeAndPay({ id, paymentMethod: 'cash' });
            alert('✅ تم تسليم الجهاز وإصدار الضمان وقبض المبلغ بنجاح!');
            loadKanban();
        } catch (e) {
            alert('خطأ: ' + e.message);
        }
    };

    // Intake New Repair: Real Modal Dialog
    function setupIntakeModal() {
        if (document.getElementById('modal-repair-intake')) return;

        const modalHtml = `
        <div id="modal-repair-intake" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-4">
            <div class="bg-surface-container max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-surface-container-high animate-in fade-in">
                <div class="p-space-md bg-surface-container-high flex items-center justify-between">
                    <div class="flex items-center gap-space-xs text-primary font-bold">
                        <span class="material-symbols-outlined text-[24px]">add_task</span>
                        <span class="font-headline-md text-on-surface">استلام جهاز صيانة جديد (Intake Ticket)</span>
                    </div>
                    <button onclick="document.getElementById('modal-repair-intake').classList.add('hidden')" class="text-on-surface-variant hover:text-on-surface">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-space-lg flex flex-col gap-3 overflow-y-auto max-h-[80vh]">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">اسم الزبون *</label>
                            <input id="intake-cust-name" type="text" placeholder="الاسم الكامل للزبون" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">رقم هاتف الزبون *</label>
                            <input id="intake-cust-phone" type="text" placeholder="0550 12 34 56" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono" dir="ltr" />
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">موديل الجهاز *</label>
                            <input id="intake-dev-model" type="text" placeholder="مثال: iPhone 13 Pro Max" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">رمز القفل أو النمط</label>
                            <input id="intake-lock-code" type="text" placeholder="مثال: 1234 أو L" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
                        </div>
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">رقم IMEI أو السيريال (اختياري)</label>
                        <input id="intake-imei" type="text" maxlength="15" placeholder="15 رقماً" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">وصف العطل والفحص المبدئي *</label>
                        <textarea id="intake-issue" rows="2" placeholder="مثال: الشاشة مكسورة، لا يشحن، سقط في الماء..." class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">أجر يد العمل التقديري (د.ج)</label>
                            <input id="intake-labor" type="number" placeholder="2000" value="2000" class="w-full bg-surface-container-lowest text-primary font-bold p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <label class="font-label-sm text-on-surface-variant block mb-1">مكان تخزين الجهاز</label>
                            <input id="intake-slot" type="text" placeholder="مثال: درج A-04" value="صندوق الاستلام" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>
                    <label class="flex items-center gap-2 p-2 bg-surface-container-lowest rounded-xl cursor-pointer">
                        <input id="intake-urgent" type="checkbox" class="text-error focus:ring-0 rounded" />
                        <span class="font-label-md text-error font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">bolt</span>
                            طلب صيانة مستعجل (Urgent Priority)
                        </span>
                    </label>
                </div>
                <div class="p-space-md bg-surface-container-high flex items-center justify-end gap-2">
                    <button onclick="document.getElementById('modal-repair-intake').classList.add('hidden')" class="px-space-md py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                    <button onclick="window.saveRepairIntake()" class="px-space-lg py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold font-label-md shadow-md flex items-center gap-1">
                        <span class="material-symbols-outlined text-[18px]">print</span>
                        <span>فتح التذكرة وطباعة الوصل</span>
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    window.intakeNewRepair = function () {
        const modal = document.getElementById('modal-repair-intake');
        if (modal) {
            // Check if arriving with prefilled IMEI from Warranty Checker
            const prefillImei = sessionStorage.getItem('mobora_new_repair_imei');
            const prefillModel = sessionStorage.getItem('mobora_new_repair_model');
            if (prefillImei) {
                const imeiInput = document.getElementById('intake-imei');
                if (imeiInput) imeiInput.value = prefillImei;
                sessionStorage.removeItem('mobora_new_repair_imei');
            }
            if (prefillModel) {
                const modelInput = document.getElementById('intake-dev-model');
                if (modelInput) modelInput.value = prefillModel;
                sessionStorage.removeItem('mobora_new_repair_model');
            }

            modal.classList.remove('hidden');
            const nameInput = document.getElementById('intake-cust-name');
            if (nameInput) nameInput.focus();
        }
    };

    window.saveRepairIntake = async function () {
        const name = document.getElementById('intake-cust-name')?.value.trim();
        const phone = document.getElementById('intake-cust-phone')?.value.trim();
        const model = document.getElementById('intake-dev-model')?.value.trim();
        const lock = document.getElementById('intake-lock-code')?.value.trim();
        const imei = document.getElementById('intake-imei')?.value.trim();
        const issue = document.getElementById('intake-issue')?.value.trim();
        const labor = Number(document.getElementById('intake-labor')?.value) || 0;
        const slot = document.getElementById('intake-slot')?.value.trim() || 'صندوق الاستلام';
        const urgent = document.getElementById('intake-urgent')?.checked;

        if (!name || !phone || !model || !issue) {
            alert('يرجى ملء جميع الحقول المطلوبة (اسم الزبون، الهاتف، الموديل، ووصف العطل).');
            return;
        }

        try {
            const res = await window.moboraAPI.repairs.create({
                customer_name: name,
                customer_phone: phone,
                device_model: model,
                lock_code: lock || null,
                imei: imei || null,
                issue_description: issue,
                labor_cost: labor,
                storage_slot: slot,
                priority: urgent ? 'urgent' : 'normal'
            });

            document.getElementById('modal-repair-intake').classList.add('hidden');

            // Print thermal voucher
            if (window.moboraAPI && window.moboraAPI.printer) {
                try {
                    await window.moboraAPI.printer.printRepair({ repairId: res.ticket.id });
                } catch (pe) {
                    console.warn('[Print Voucher Warning]', pe.message);
                }
            }

            alert(`✅ تم فتح تذكرة الصيانة بنجاح برقم [#${res.ticket.ticket_number}]!`);
            loadKanban();
        } catch (e) {
            alert('حدث خطأ أثناء حفظ التذكرة: ' + e.message);
        }
    };

    function initFilters() {
        setupIntakeModal();

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
