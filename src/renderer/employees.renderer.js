// Staff & Audit Log Renderer - Interactive Modals, Live KPIs & Role Management
document.addEventListener('DOMContentLoaded', () => {
    initStaffAndAudit();
});

let allStaff = [];
let allAuditLogs = [];
let currentRoleFilter = 'all';
let currentAuditFilter = 'all';

async function initStaffAndAudit() {
    injectStaffModals();
    setupRoleFilters();
    setupAuditFilters();
    setupStaffSearch();
    setupAddStaffButton();
    setupExportAuditButton();

    await loadStaff();
    await loadAuditLogs();
}

function setupRoleFilters() {
    const roleButtons = document.querySelectorAll('.flex.items-center.bg-surface-container.rounded-lg.p-1 button');
    roleButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            roleButtons.forEach(b => {
                b.className = 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors';
            });
            btn.className = 'px-space-sm py-1 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm font-semibold shadow-sm';

            const roles = ['all', 'owner', 'seller', 'technician', 'stock_keeper'];
            currentRoleFilter = roles[index] || 'all';
            await loadStaff();
        });
    });
}

function setupStaffSearch() {
    const searchInput = document.querySelector('.bg-surface-container-low input[placeholder*="البحث بالاسم"]');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            const filtered = allStaff.filter(s =>
                (s.name && s.name.toLowerCase().includes(query)) ||
                (s.email && s.email.toLowerCase().includes(query)) ||
                (s.phone && s.phone.toLowerCase().includes(query)) ||
                (s.role && s.role.toLowerCase().includes(query))
            );
            renderStaffTable(filtered);
        });
    }
}

async function loadStaff() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.employees) return;
        const staff = await window.moboraAPI.employees.list({ role: currentRoleFilter });
        allStaff = staff || [];

        // Update KPI Card 1: Total Staff & Active Staff
        const statCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > div');
        if (statCards.length >= 1) {
            const totalEl = statCards[0].querySelector('.font-headline-xl');
            if (totalEl) totalEl.textContent = allStaff.length.toString();

            const activeCount = allStaff.filter(s => s.is_active === 1).length;
            const inactiveCount = allStaff.length - activeCount;
            const activeSub = statCards[0].querySelector('.bg-surface-container-lowest\\/50 span:nth-child(2)');
            if (activeSub) activeSub.textContent = `${activeCount} متواجدون الآن`;
            const inactSub = statCards[0].querySelector('.bg-surface-container-lowest\\/50 > span:last-child');
            if (inactSub) inactSub.textContent = `${inactiveCount} في عطلة / معطل`;
        }

        renderStaffTable(allStaff);
    } catch (err) {
        console.error('Failed to load staff:', err);
    }
}

function renderStaffTable(staffList) {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    if (!staffList || staffList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-space-md text-center text-on-surface-variant font-body-sm">
                    لا يوجد موظفون مسجلون بهذه الفئة.
                </td>
            </tr>
        `;
        return;
    }

    const roleInfo = {
        owner: { title: 'مشرف عام (Admin / Owner)', icon: 'shield_person', color: 'tertiary' },
        technician: { title: 'كبير فنيي الصيانة (Hardware Tech)', icon: 'home_repair_service', color: 'secondary' },
        seller: { title: 'مسؤول مبيعات ونقطة بيع (Cashier)', icon: 'point_of_sale', color: 'primary' },
        stock_keeper: { title: 'إدارة المخزون والمشتريات (Inventory)', icon: 'inventory_2', color: 'tertiary-fixed' }
    };

    const permissionsMap = {
        owner: ['التحكم الكلي', 'فتح الصندوق', 'التقارير المالية', 'تعديل الأسعار'],
        technician: ['استلام وتفكيك', 'طلب قطع الغيار', 'اختبار الضمان'],
        seller: ['نقطة البيع (POS)', 'إصدار وصولات', 'البيع بالتقسيط'],
        stock_keeper: ['جرد القطع والهواتف', 'سندات التوريد', 'تعديل أسعار الشراء']
    };

    tbody.innerHTML = staffList.map((emp, index) => {
        const info = roleInfo[emp.role] || { title: emp.role, icon: 'badge', color: 'primary' };
        const perms = permissionsMap[emp.role] || ['صلاحيات عامة'];
        const isActive = emp.is_active === 1;
        const bgRow = index % 2 === 1 ? 'bg-surface-container/20' : '';
        const createdDate = emp.created_at ? new Date(emp.created_at).toLocaleDateString('ar-DZ') : '15 جانفي 2024';

        return `
            <tr class="hover:bg-surface-container transition-colors ${bgRow}">
                <td class="py-space-sm px-space-md">
                    <div class="flex items-center gap-space-sm">
                        <div class="relative w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary shrink-0">
                            <span>${(emp.name || 'م').slice(0, 2)}</span>
                            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 ${isActive ? 'bg-primary' : 'bg-outline'} rounded-full ring-2 ring-surface-container-lowest"></span>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-headline-md text-body-lg font-bold text-on-surface">${emp.name}</span>
                            <span class="font-label-sm text-label-sm text-outline tracking-tight font-mono">${emp.email || 'بدون بريد'} | ${emp.phone || '-'}</span>
                        </div>
                    </div>
                </td>
                <td class="py-space-sm px-space-md">
                    <div class="flex flex-col gap-0.5">
                        <div class="inline-flex items-center gap-1 self-start px-space-xs py-0.5 rounded bg-${info.color}/10 text-${info.color} font-label-sm text-label-sm font-semibold">
                            <span class="material-symbols-outlined text-[14px]">${info.icon}</span>
                            <span>${info.title}</span>
                        </div>
                        <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                            <span class="material-symbols-outlined text-[13px] text-outline">location_on</span>
                            الفرع الرئيسي - المحل
                        </span>
                    </div>
                </td>
                <td class="py-space-sm px-space-md">
                    <div class="flex flex-wrap gap-1 max-w-xs">
                        ${perms.map(p => `<span class="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm">${p}</span>`).join('')}
                    </div>
                </td>
                <td class="py-space-sm px-space-md">
                    <div class="flex flex-col">
                        <span class="font-label-sm text-label-sm ${isActive ? 'text-primary' : 'text-on-surface-variant'} flex items-center gap-1 font-semibold">
                            <span class="material-symbols-outlined text-[13px]">${isActive ? 'desktop_windows' : 'power_settings_new'}</span>
                            ${isActive ? 'متصل الآن' : 'غير متصل'}
                        </span>
                        <span class="font-label-sm text-label-sm text-outline font-mono">منضم منذ: ${createdDate}</span>
                    </div>
                </td>
                <td class="py-space-sm px-space-md text-center">
                    <span class="px-space-sm py-0.5 rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'bg-outline/20 text-outline'} font-label-sm text-label-sm font-semibold">
                        ${isActive ? 'نشط' : 'معطل'}
                    </span>
                </td>
                <td class="py-space-sm px-space-md text-left">
                    <div class="flex items-center justify-end gap-1">
                        <button class="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" onclick="window.openResetPinModal(${emp.id}, '${emp.name}')" title="إعادة تعيين رمز PIN">
                            <span class="material-symbols-outlined text-[18px]">pin</span>
                        </button>
                        <button class="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors" onclick="window.toggleEmployeeActive(${emp.id}, ${emp.is_active ? 0 : 1})" title="${isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}">
                            <span class="material-symbols-outlined text-[18px]">${isActive ? 'block' : 'check_circle'}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.toggleEmployeeActive = async (id, newStatus) => {
    if (!confirm('هل أنت متأكد من تغيير حالة نشاط هذا الموظف؟')) return;
    try {
        if (!window.moboraAPI || !window.moboraAPI.employees) return;
        await window.moboraAPI.employees.update(id, { is_active: newStatus });
        await loadStaff();
    } catch (err) {
        alert(`فشل التحديث: ${err.message}`);
    }
};

function setupAddStaffButton() {
    const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إضافة موظف جديد'));
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const modal = document.getElementById('modal-add-staff');
            if (modal) {
                document.getElementById('staff-name').value = '';
                document.getElementById('staff-phone').value = '';
                document.getElementById('staff-email').value = '';
                document.getElementById('staff-pin').value = '';
                modal.classList.remove('hidden');
                document.getElementById('staff-name').focus();
            }
        });
    }
}

function setupAuditFilters() {
    const filterButtons = document.querySelectorAll('.flex.items-center.gap-1.bg-surface-container-lowest button');
    filterButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => {
                b.className = 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors';
            });
            btn.className = 'px-space-sm py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold shadow-sm';

            const actions = ['all', 'sale_created', 'inventory_updated', 'sale_voided', 'pin_verified'];
            currentAuditFilter = actions[index] || 'all';
            await loadAuditLogs();
        });
    });
}

async function loadAuditLogs() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.employees) return;
        const res = await window.moboraAPI.employees.listAudit({ actionType: currentAuditFilter, limit: 30 });
        allAuditLogs = res.items || [];

        // Update KPI Card 4: Security Alerts Count
        const statCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > div');
        if (statCards.length >= 4) {
            const alertsEl = statCards[3].querySelector('.font-headline-lg');
            if (alertsEl) {
                const securityEvents = allAuditLogs.filter(a => a.action_type === 'sale_voided' || a.action_type === 'pin_verified').length;
                alertsEl.textContent = securityEvents.toString();
            }
        }

        renderAuditTimeline(allAuditLogs);
    } catch (err) {
        console.error('Failed to load audit logs:', err);
    }
}

function renderAuditTimeline(logs) {
    const listContainer = document.querySelector('.flex.flex-col.gap-space-sm.relative');
    if (!listContainer) return;

    if (!logs || logs.length === 0) {
        listContainer.innerHTML = `
            <div class="p-space-md text-center text-on-surface-variant font-body-sm">
                لا توجد سجلات رقابة مسجلة حالياً بهذه المعايير.
            </div>
        `;
        return;
    }

    const actionColors = {
        sale_created: { color: 'primary', icon: 'point_of_sale', label: 'عملية بيع جديدة' },
        sale_voided: { color: 'error', icon: 'cancel', label: 'إلغاء فاتورة بيع' },
        inventory_updated: { color: 'tertiary', icon: 'inventory_2', label: 'تعديل مخزون' },
        stock_adjusted: { color: 'tertiary', icon: 'warehouse', label: 'توريد قطع ومشتريات' },
        pin_verified: { color: 'secondary', icon: 'lock_open', label: 'تحقق من رمز PIN' },
        login: { color: 'primary', icon: 'login', label: 'تسجيل دخول' }
    };

    listContainer.innerHTML = logs.map(l => {
        const info = actionColors[l.action_type] || { color: 'on-surface-variant', icon: 'history', label: l.action_type };
        const timeStr = l.created_at ? new Date(l.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : 'الآن';
        const dateStr = l.created_at ? new Date(l.created_at).toLocaleDateString('ar-DZ') : 'اليوم';
        const empName = l.employee_name || 'مشرف النظام';

        return `
            <div class="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high/60 hover:bg-surface-container-high transition-colors">
                <div class="w-8 h-8 rounded-full bg-${info.color}/20 text-${info.color} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[16px]">${info.icon}</span>
                </div>
                <div class="flex flex-col flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <span class="font-label-md text-label-md font-semibold text-on-surface">${info.label}</span>
                        <span class="font-label-sm text-label-sm text-outline font-mono">${timeStr}</span>
                    </div>
                    <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${l.notes || l.target_entity || 'إجراء أمني'}</span>
                    <span class="font-label-sm text-label-sm text-primary mt-0.5">الموظف: ${empName} • ${dateStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

function setupExportAuditButton() {
    const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تصدير السجل (CSV)'));
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!allAuditLogs || allAuditLogs.length === 0) {
                alert('لا توجد سجلات رقابة لتصديرها');
                return;
            }

            let csv = '\uFEFF';
            csv += 'التاريخ,الوقت,نوع الإجراء,الموظف,الكيان,التفاصيل والملاحظات\n';
            allAuditLogs.forEach(l => {
                const date = l.created_at ? new Date(l.created_at).toLocaleDateString('ar-DZ') : '';
                const time = l.created_at ? new Date(l.created_at).toLocaleTimeString('ar-DZ') : '';
                const notes = (l.notes || '').replace(/,/g, ' ');
                csv += `"${date}","${time}","${l.action_type}","${l.employee_name || ''}","${l.target_entity || ''}","${notes}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `سجل_الرقابة_MOBORA_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        });
    }
}

// Injected Staff Modals (Add Staff & Reset PIN)
function injectStaffModals() {
    if (document.getElementById('modal-add-staff')) return;

    const modalHtml = `
    <!-- Modal: Add New Staff Member -->
    <div id="modal-add-staff" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
        <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-[24px]">person_add</span>
                    <h3 class="font-headline-md text-on-surface">إضافة موظف جديد وتعيين الصلاحيات</h3>
                </div>
                <button onclick="document.getElementById('modal-add-staff').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>
            <div class="p-space-md flex flex-col gap-3">
                <div>
                    <label class="font-label-sm text-on-surface-variant block mb-1">اسم الموظف الكامل *</label>
                    <input id="staff-name" type="text" placeholder="مثال: يوسف معمري" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">الدور والصلاحية *</label>
                        <select id="staff-role" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="seller">مسؤول مبيعات (Cashier)</option>
                            <option value="technician">فني صيانة (Hardware Tech)</option>
                            <option value="stock_keeper">مسؤول مخزون (Inventory)</option>
                            <option value="owner">مشرف عام (Admin / Owner)</option>
                        </select>
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">رمز PIN للدخول (4 أرقام) *</label>
                        <input id="staff-pin" type="password" maxlength="6" placeholder="1234" class="w-full bg-surface-container-lowest text-on-surface font-mono p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">رقم الهاتف</label>
                        <input id="staff-phone" type="tel" dir="ltr" placeholder="0550123456" class="w-full bg-surface-container-lowest text-on-surface font-mono p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">البريد الإلكتروني (اختياري)</label>
                        <input id="staff-email" type="email" dir="ltr" placeholder="staff@store.dz" class="w-full bg-surface-container-lowest text-on-surface font-mono p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                </div>
            </div>
            <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                <button onclick="document.getElementById('modal-add-staff').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                <button onclick="window.saveNewStaff()" class="px-6 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold font-label-md shadow-md flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px]">check</span>
                    <span>حفظ الموظف وتفعيل الحساب</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Modal: Reset Employee PIN -->
    <div id="modal-reset-pin" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
        <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-secondary text-[24px]">pin</span>
                    <h3 class="font-headline-md text-on-surface">إعادة تعيين رمز PIN</h3>
                </div>
                <button onclick="document.getElementById('modal-reset-pin').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>
            <div class="p-space-md flex flex-col gap-3">
                <div class="p-2.5 bg-surface-container-lowest rounded-xl flex items-center justify-between">
                    <span class="font-label-sm text-on-surface-variant">الموظف:</span>
                    <span id="reset-pin-emp-name" class="font-headline-sm text-on-surface font-bold">-</span>
                </div>
                <div>
                    <label class="font-label-sm text-on-surface-variant block mb-1">رمز PIN المشرف العام للتأكيد *</label>
                    <input id="reset-sup-pin" type="password" placeholder="أدخل PIN المشرف" class="w-full bg-surface-container-lowest text-on-surface font-mono p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                    <label class="font-label-sm text-on-surface-variant block mb-1">رمز PIN الجديد للموظف (4 أرقام) *</label>
                    <input id="reset-new-pin" type="password" maxlength="6" placeholder="مثال: 5544" class="w-full bg-surface-container-lowest text-on-surface font-mono p-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
            </div>
            <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                <button onclick="document.getElementById('modal-reset-pin').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                <button onclick="window.confirmResetPin()" class="px-6 py-2 rounded-xl bg-secondary hover:bg-secondary-fixed-dim text-on-secondary font-bold font-label-md shadow-md flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px]">lock_reset</span>
                    <span>تحديث الرمز</span>
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.openResetPinModal = function (empId, empName) {
    window._activeResetEmpId = empId;
    const modal = document.getElementById('modal-reset-pin');
    if (!modal) return;
    document.getElementById('reset-pin-emp-name').innerText = empName;
    document.getElementById('reset-sup-pin').value = '';
    document.getElementById('reset-new-pin').value = '';
    modal.classList.remove('hidden');
    document.getElementById('reset-sup-pin').focus();
};

window.confirmResetPin = async function () {
    const empId = window._activeResetEmpId;
    const supPin = document.getElementById('reset-sup-pin')?.value.trim();
    const newPin = document.getElementById('reset-new-pin')?.value.trim();

    if (!supPin) {
        alert('يرجى إدخال رمز PIN المشرف للتأكيد.');
        return;
    }
    if (!newPin || newPin.length < 4) {
        alert('يجب أن يتكون رمز PIN الجديد من 4 أرقام على الأقل.');
        return;
    }

    try {
        if (!window.moboraAPI || !window.moboraAPI.employees) return;
        const verifyRes = await window.moboraAPI.employees.verifyPin({ pin: supPin, requiredRole: 'owner' });
        if (!verifyRes.success) {
            alert('رمز المشرف غير صحيح أو ليست لديك صلاحية كافية.');
            return;
        }

        await window.moboraAPI.employees.update(empId, { pin_code: newPin });
        alert('✅ تم تحديث رمز PIN للموظف بنجاح!');
        document.getElementById('modal-reset-pin').classList.add('hidden');
    } catch (e) {
        alert('خطأ: ' + e.message);
    }
};

window.saveNewStaff = async function () {
    const name = document.getElementById('staff-name')?.value.trim();
    const role = document.getElementById('staff-role')?.value;
    const pin = document.getElementById('staff-pin')?.value.trim();
    const phone = document.getElementById('staff-phone')?.value.trim();
    const email = document.getElementById('staff-email')?.value.trim();

    if (!name || !pin) {
        alert('يرجى إدخال اسم الموظف ورمز PIN للدخول.');
        return;
    }
    if (pin.length < 4) {
        alert('يجب أن يتكون رمز PIN من 4 أرقام على الأقل.');
        return;
    }

    try {
        if (window.moboraAPI && window.moboraAPI.employees) {
            await window.moboraAPI.employees.create({
                name,
                role: role || 'seller',
                phone: phone || null,
                email: email || null,
                pin_code: pin
            });

            alert(`✅ تم تسجيل الموظف "${name}" بنجاح في النظام!`);
            document.getElementById('modal-add-staff').classList.add('hidden');
            await loadStaff();
            await loadAuditLogs();
        }
    } catch (err) {
        alert(`خطأ: ${err.message}`);
    }
};
