// Staff & Audit Log Renderer
document.addEventListener('DOMContentLoaded', () => {
    initStaffAndAudit();
});

let allStaff = [];
let allAuditLogs = [];
let currentRoleFilter = 'all';
let currentAuditFilter = 'all';

async function initStaffAndAudit() {
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
                b.className = 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm';
            });
            btn.className = 'px-space-sm py-1 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm font-semibold';

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

        // Update KPI Card 1: Total Staff
        const totalStaffEl = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > div:first-child .font-headline-xl');
        if (totalStaffEl) {
            totalStaffEl.textContent = allStaff.length.toString();
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
                        <div class="relative w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">
                            <span>${emp.name.slice(0, 2)}</span>
                            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 ${isActive ? 'bg-primary' : 'bg-outline'} rounded-full ring-2 ring-surface-container-lowest"></span>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-headline-md text-body-lg font-bold text-on-surface">${emp.name}</span>
                            <span class="font-label-sm text-label-sm text-outline tracking-tight">${emp.email || 'بدون بريد'} | ${emp.phone || '-'}</span>
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
                        <span class="font-label-sm text-label-sm text-primary flex items-center gap-1 font-semibold">
                            <span class="material-symbols-outlined text-[13px]">desktop_windows</span>
                            ${isActive ? 'متصل الآن' : 'غير متصل'}
                        </span>
                        <span class="font-label-sm text-label-sm text-outline">منضم منذ: ${createdDate}</span>
                    </div>
                </td>
                <td class="py-space-sm px-space-md text-center">
                    <span class="px-space-sm py-0.5 rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'bg-outline/20 text-outline'} font-label-sm text-label-sm font-semibold">
                        ${isActive ? 'نشط' : 'معطل'}
                    </span>
                </td>
                <td class="py-space-sm px-space-md text-left">
                    <div class="flex items-center justify-end gap-1">
                        <button class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary" onclick="resetEmployeePin(${emp.id}, '${emp.name}')" title="إعادة تعيين PIN">
                            <span class="material-symbols-outlined text-[18px]">pin</span>
                        </button>
                        <button class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface" onclick="toggleEmployeeActive(${emp.id}, ${emp.is_active ? 0 : 1})" title="${isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}">
                            <span class="material-symbols-outlined text-[18px]">${isActive ? 'block' : 'check_circle'}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.resetEmployeePin = async (id, name) => {
    const supervisorPin = prompt('أدخل رمز PIN المشرف العام للتأكيد:');
    if (!supervisorPin) return;

    if (!window.moboraAPI || !window.moboraAPI.employees) return;
    const verifyRes = await window.moboraAPI.employees.verifyPin({ pin: supervisorPin, requiredRole: 'owner' });
    if (!verifyRes.success) {
        alert('رمز المشرف غير صحيح أو ليست لديك صلاحية كافية');
        return;
    }

    const newPin = prompt(`أدخل رمز PIN الجديد المكون من 4 أرقام للموظف (${name}):`);
    if (!newPin || newPin.length < 4) {
        alert('يجب أن يتكون رمز PIN من 4 أرقام على الأقل');
        return;
    }

    await window.moboraAPI.employees.update(id, { pin_code: newPin });
    alert(`تم تحديث رمز PIN للموظف ${name} بنجاح!`);
};

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
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
        const name = prompt('اسم الموظف الكامل:');
        if (!name) return;

        const role = prompt('الدور الوظيفي (owner, seller, technician, stock_keeper):', 'seller');
        const phone = prompt('رقم الهاتف:', '+213 ');
        const pin = prompt('رمز PIN الخاص بالموظف (4 أرقام):', '1234');

        try {
            if (window.moboraAPI && window.moboraAPI.employees) {
                await window.moboraAPI.employees.create({
                    name,
                    role: role || 'seller',
                    phone: phone || null,
                    pin_code: pin || '1234'
                });
                alert(`تم تسجيل الموظف "${name}" بنجاح في النظام!`);
                await loadStaff();
                await loadAuditLogs();
            }
        } catch (err) {
            alert(`خطأ: ${err.message}`);
        }
    });
}

function setupAuditFilters() {
    const filterButtons = document.querySelectorAll('.flex.items-center.gap-1.bg-surface-container-lowest button');
    filterButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            filterButtons.forEach(b => {
                b.className = 'px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm';
            });
            btn.className = 'px-space-sm py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold';

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
        renderAuditList(allAuditLogs);
    } catch (err) {
        console.error('Failed to load audit logs:', err);
    }
}

function renderAuditList(logs) {
    const listContainer = document.querySelector('.flex.flex-col.gap-space-xs:has(.shadow-sm)');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (!logs || logs.length === 0) {
        listContainer.innerHTML = `
            <div class="p-space-md text-center text-on-surface-variant font-body-sm bg-surface-container-lowest rounded-lg">
                لا توجد سجلات رقابة مسجلة لهذا التصنيف.
            </div>
        `;
        return;
    }

    const actionMeta = {
        sale_created: { title: 'عملية بيع مسجلة', icon: 'point_of_sale', color: 'primary' },
        sale_voided: { title: 'إلغاء سند بيع', icon: 'warning', color: 'error' },
        inventory_updated: { title: 'تعديل المخزون / الأسعار', icon: 'price_change', color: 'secondary' },
        warranty_check: { title: 'فحص الضمان والـ IMEI', icon: 'verified', color: 'primary' },
        warranty_voided: { title: 'إلغاء ضمان معتمد', icon: 'block', color: 'error' },
        pin_verified: { title: 'تحقق من رمز PIN أو عملية موظف', icon: 'lock_open', color: 'tertiary' }
    };

    logs.forEach(log => {
        const meta = actionMeta[log.action_type] || { title: log.action_type || 'نشاط في النظام', icon: 'info', color: 'primary' };
        const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString('ar-DZ') : 'مؤخراً';
        const dateStr = log.created_at ? new Date(log.created_at).toLocaleDateString('ar-DZ') : 'اليوم';
        const actor = log.employee_name ? `${log.employee_name} (${log.employee_role || 'طاقم العمل'})` : 'النظام الآلي / المشرف';
        const notes = log.notes || `تعديل على السجل #${log.target_id || ''}`;

        const itemHtml = `
            <div class="flex flex-col xl:flex-row xl:items-center justify-between p-space-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors gap-space-sm shadow-sm">
                <div class="flex items-start gap-space-sm">
                    <span class="w-9 h-9 rounded-lg bg-${meta.color}/10 text-${meta.color} flex items-center justify-center shrink-0 mt-0.5">
                        <span class="material-symbols-outlined text-[20px]">${meta.icon}</span>
                    </span>
                    <div class="flex flex-col">
                        <div class="flex items-center gap-space-xs flex-wrap">
                            <span class="px-1.5 py-0.5 rounded bg-${meta.color}/20 text-${meta.color} font-label-sm text-label-sm font-bold">${meta.title}</span>
                            ${log.target_id ? `<span class="font-label-sm text-label-sm text-outline font-mono">#${log.target_id}</span>` : ''}
                        </div>
                        <p class="font-body-md text-body-md text-on-surface mt-0.5">
                            ${notes}
                        </p>
                        <div class="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm mt-1">
                            <span class="text-on-surface font-semibold">الفاعل: ${actor}</span>
                            <span>•</span>
                            <span class="text-outline">${dateStr}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center justify-between xl:flex-col xl:items-end gap-1 shrink-0 pt-space-xs xl:pt-0">
                    <span class="font-label-sm text-label-sm text-primary font-bold">${timeStr}</span>
                    <span class="font-label-sm text-label-sm text-outline font-mono">${log.ip_or_device || 'Local POS'}</span>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

function setupExportAuditButton() {
    const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تصدير سجل الرقابة'));
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
        if (!allAuditLogs || allAuditLogs.length === 0) {
            alert('لا توجد سجلات رقابة لتصديرها');
            return;
        }
        let csv = '\uFEFFالتاريخ,الوقت,نوع العملية,الموظف,الهدف,التفاصيل\n';
        allAuditLogs.forEach(l => {
            csv += `"${l.created_at || ''}","${l.action_type || ''}","${l.employee_name || 'عام'}","${l.target_entity || ''}","${l.target_id || ''}","${(l.notes || '').replace(/"/g, '""')}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `سجل_الرقابة_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    });
}
