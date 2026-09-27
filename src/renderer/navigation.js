// Mobora Shared Navigation & Global Header Handler
(function () {
    const routeMap = {
        'dashboard': '../dashboard/code.html',
        'pos-terminal': '../pos_terminal/code.html',
        'inventory-management': '../inventory/code.html',
        'repairs-workshop': '../repairs_kanban/code.html',
        'suppliers-and-invoices': '../suppliers_purchases/code.html',
        'warranty-imei-checker': '../imei_warranty_checker/code.html',
        'telegram-bot-integration': '../telegram_bot/code.html',
        'finance-and-reports': '../finance_reports/code.html',
        'staff-and-audit-logs': '../employees_audit_log/code.html',
        'system-backup': '../settings_backup/code.html',
        'system-settings': '../settings_backup/code.html'
    };

    function initNavigation() {
        // 1. Sidebar Links
        document.querySelectorAll('aside nav a[data-path]').forEach(link => {
            const pathKey = link.getAttribute('data-path');
            if (routeMap[pathKey]) {
                link.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = routeMap[pathKey];
                };
            }
        });

        // 2. Header Quick Actions
        const quickSaleBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('بيع سريع'));
        if (quickSaleBtn) {
            quickSaleBtn.onclick = () => { window.location.href = routeMap['pos-terminal']; };
        }

        const quickRepairBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('استلام صيانة'));
        if (quickRepairBtn) {
            quickRepairBtn.onclick = () => { window.location.href = routeMap['repairs-workshop']; };
        }

        // 3. Update store name & date in header from DB if available
        if (window.moboraAPI && window.moboraAPI.settings) {
            window.moboraAPI.settings.getAll().then(settings => {
                const headerTitle = document.querySelector('header span.whitespace-nowrap');
                if (headerTitle && settings.store_name_ar) {
                    headerTitle.innerText = settings.store_name_ar;
                }
            }).catch(() => {});
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigation);
    } else {
        initNavigation();
    }
})();
