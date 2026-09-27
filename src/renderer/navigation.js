// Mobora Shared Navigation, Global Header, Session & Quick Search Handler
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

    // User Session
    function getCurrentUser() {
        try {
            const saved = localStorage.getItem('mobora_active_user');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { id: 1, name: 'أحمد بن علي', role: 'owner', role_title: 'المشرف العام (Admin)' };
    }

    function setCurrentUser(user) {
        localStorage.setItem('mobora_active_user', JSON.stringify(user));
        updateUserUI();
    }

    window.moboraSession = {
        getUser: getCurrentUser,
        setUser: setCurrentUser
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

        // 3. Update store name & date in header
        updateHeaderInfo();

        // 4. Setup User Session UI & Lock / PIN Switch Modal
        setupUserSessionAndPinModal();

        // 5. Setup Global Ctrl+K / Search Bar
        setupGlobalSearch();

        // 6. Setup Notification Bell with Real Dynamic Alerts
        setupNotificationCenter();
    }

    function updateHeaderInfo() {
        // Dynamic Date in Arabic
        const dateEl = document.querySelector('header .hidden.xl\\:flex span.font-label-sm');
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.innerText = now.toLocaleDateString('ar-DZ', options);
        }

        // Store name from DB
        if (window.moboraAPI && window.moboraAPI.settings) {
            window.moboraAPI.settings.getAll().then(settings => {
                const headerTitle = document.querySelector('header span.whitespace-nowrap');
                if (headerTitle && settings.store_name_ar) {
                    headerTitle.innerText = settings.store_name_ar;
                }
            }).catch(() => {});
        }
    }

    function updateUserUI() {
        const user = getCurrentUser();
        // Sidebar user name
        const userNameEl = document.querySelector('aside .font-label-md.text-on-surface.font-semibold');
        if (userNameEl) userNameEl.innerText = user.name;

        const userRoleEl = document.querySelector('aside .font-label-sm.text-on-surface-variant.truncate');
        if (userRoleEl) userRoleEl.innerText = user.role_title || user.role;
    }

    function setupUserSessionAndPinModal() {
        updateUserUI();

        // Inject PIN Modal if not present
        if (!document.getElementById('mobora-pin-modal')) {
            const modalHtml = `
            <div id="mobora-pin-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-surface-container-lowest/85 backdrop-blur-md p-4">
                <div class="bg-surface-container max-w-sm w-full rounded-2xl shadow-2xl p-6 flex flex-col items-center border border-surface-container-high animate-in fade-in">
                    <div class="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-3">
                        <span class="material-symbols-outlined text-[32px]">lock</span>
                    </div>
                    <h3 class="font-headline-md text-headline-md text-on-surface font-bold text-center">تبديل المستخدم / قفل الشاشة</h3>
                    <p class="font-body-sm text-body-sm text-on-surface-variant text-center mt-1 mb-4">أدخل رمز PIN السريع (4 أرقام) للتبديل</p>
                    
                    <input id="quick-pin-input" type="password" maxlength="6" class="w-48 text-center text-3xl font-mono tracking-widest bg-surface-container-lowest text-primary py-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary mb-4" placeholder="••••" />
                    
                    <div class="grid grid-cols-3 gap-2 w-48 mb-4">
                        ${[1,2,3,4,5,6,7,8,9, 'C', 0, 'OK'].map(key => `
                            <button onclick="window.handlePinKey('${key}')" class="h-11 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline-md font-bold transition-all flex items-center justify-center shadow-sm">
                                ${key}
                            </button>
                        `).join('')}
                    </div>

                    <div class="flex items-center gap-2 w-full mt-2">
                        <button onclick="document.getElementById('mobora-pin-modal').classList.add('hidden')" class="flex-1 py-2 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md transition-colors">إلغاء</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        window.handlePinKey = async function (key) {
            const input = document.getElementById('quick-pin-input');
            if (!input) return;

            if (key === 'C') {
                input.value = '';
            } else if (key === 'OK') {
                verifyPinSwitch(input.value);
            } else {
                if (input.value.length < 6) input.value += key;
                if (input.value.length === 4) {
                    verifyPinSwitch(input.value);
                }
            }
        };

        async function verifyPinSwitch(pin) {
            if (!pin || pin.length < 4) return;
            try {
                if (window.moboraAPI && window.moboraAPI.employees) {
                    const res = await window.moboraAPI.employees.verifyPin({ pin });
                    if (res.success && res.employee) {
                        const rolesMap = {
                            owner: 'المشرف العام (Owner)',
                            seller: 'مسؤول المبيعات (Cashier)',
                            technician: 'فني الصيانة (Technician)',
                            stock_keeper: 'مسؤول المخزون'
                        };
                        const emp = res.employee;
                        setCurrentUser({
                            id: emp.id,
                            name: emp.name,
                            role: emp.role,
                            role_title: rolesMap[emp.role] || emp.role
                        });
                        alert(`✅ مرحباً بك يا ${emp.name}! (${rolesMap[emp.role] || emp.role})`);
                        document.getElementById('mobora-pin-modal').classList.add('hidden');
                        document.getElementById('quick-pin-input').value = '';
                    } else {
                        alert('❌ رمز PIN غير صحيح');
                        document.getElementById('quick-pin-input').value = '';
                    }
                }
            } catch (err) {
                alert('خطأ أثناء التحقق: ' + err.message);
            }
        }

        // Hook up logout and profile buttons to open PIN Switch Modal
        document.querySelectorAll('a[data-path="login-portal"], header div:has(> .material-symbols-outlined:contains("person"))').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const modal = document.getElementById('mobora-pin-modal');
                if (modal) {
                    modal.classList.remove('hidden');
                    const input = document.getElementById('quick-pin-input');
                    if (input) { input.value = ''; input.focus(); }
                }
            };
        });
    }

    function setupGlobalSearch() {
        const searchInput = document.querySelector('header input[placeholder*="البحث عن هاتف"]');
        if (!searchInput) return;

        // Shortcut: Ctrl+K or Cmd+K
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });

        // Inject dropdown container right below search input
        const parent = searchInput.closest('.max-w-lg') || searchInput.parentElement;
        if (parent) {
            parent.style.position = 'relative';
            const dropdown = document.createElement('div');
            dropdown.id = 'header-search-results';
            dropdown.className = 'hidden absolute top-full left-0 right-0 mt-2 bg-surface-container rounded-2xl shadow-2xl border border-surface-container-high max-h-96 overflow-y-auto z-50 p-2 flex flex-col gap-1';
            parent.appendChild(dropdown);

            let searchTimeout = null;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                const query = searchInput.value.trim();
                if (query.length < 2) {
                    dropdown.classList.add('hidden');
                    return;
                }

                searchTimeout = setTimeout(async () => {
                    if (!window.moboraAPI) return;
                    try {
                        const [prodRes, repRes] = await Promise.all([
                            window.moboraAPI.products.list({ search: query, limit: 5 }),
                            window.moboraAPI.repairs.listKanban({ search: query })
                        ]);

                        const products = prodRes.items || [];
                        const allRepairs = repRes ? Object.values(repRes.columns).flat() : [];
                        const matchingRepairs = allRepairs.slice(0, 4);

                        if (products.length === 0 && matchingRepairs.length === 0) {
                            dropdown.innerHTML = '<div class="p-3 text-center text-on-surface-variant font-body-sm">لا توجد نتائج مطابقة</div>';
                            dropdown.classList.remove('hidden');
                            return;
                        }

                        dropdown.innerHTML = `
                            ${products.map(p => `
                                <div onclick="window.location.href='../pos_terminal/code.html'" class="p-2 rounded-xl hover:bg-surface-container-high flex items-center justify-between cursor-pointer transition-colors">
                                    <div class="flex items-center gap-2">
                                        <span class="material-symbols-outlined text-primary text-[20px]">phone_iphone</span>
                                        <div class="flex flex-col">
                                            <span class="font-label-md text-on-surface font-semibold">${p.name}</span>
                                            <span class="font-label-sm text-outline font-mono">سعر: ${Number(p.sell_price).toLocaleString()} دج • المتوفر: ${p.current_stock}</span>
                                        </div>
                                    </div>
                                    <span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm">البيع POS</span>
                                </div>
                            `).join('')}
                            ${matchingRepairs.map(r => `
                                <div onclick="window.location.href='../repairs_kanban/code.html'" class="p-2 rounded-xl hover:bg-surface-container-high flex items-center justify-between cursor-pointer transition-colors">
                                    <div class="flex items-center gap-2">
                                        <span class="material-symbols-outlined text-secondary text-[20px]">handyman</span>
                                        <div class="flex flex-col">
                                            <span class="font-label-md text-on-surface font-semibold">تذكرة #${r.ticket_number} - ${r.device_model}</span>
                                            <span class="font-body-sm text-on-surface-variant">${r.customer_name} • ${r.issue_description}</span>
                                        </div>
                                    </div>
                                    <span class="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-label-sm">الصيانة</span>
                                </div>
                            `).join('')}
                        `;
                        dropdown.classList.remove('hidden');
                    } catch (e) {
                        console.error('Search error:', e);
                    }
                }, 250);
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!parent.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }
    }

    function setupNotificationCenter() {
        const notifBtn = document.querySelector('header button:has(.material-symbols-outlined:contains("notifications"))');
        if (!notifBtn) return;

        // Container dropdown
        const dropdown = document.createElement('div');
        dropdown.id = 'notif-dropdown';
        dropdown.className = 'hidden absolute top-16 left-8 w-80 bg-surface-container rounded-2xl shadow-2xl border border-surface-container-high z-50 p-3 flex flex-col gap-2 animate-in fade-in';
        document.body.appendChild(dropdown);

        // Fetch live alerts count and update badge
        async function updateAlerts() {
            if (!window.moboraAPI) return;
            try {
                const [lowStock, readyRepairs] = await Promise.all([
                    window.moboraAPI.products.list({ stockStatus: 'low', limit: 10 }),
                    window.moboraAPI.repairs.listKanban()
                ]);

                const lowCount = lowStock.total || 0;
                const readyList = readyRepairs.columns.ready || [];
                const readyCount = readyList.length;
                const totalAlerts = lowCount + readyCount;

                const badge = notifBtn.querySelector('.bg-error');
                if (badge) {
                    badge.innerText = totalAlerts > 9 ? '9+' : totalAlerts;
                    badge.style.display = totalAlerts > 0 ? 'flex' : 'none';
                }

                dropdown.innerHTML = `
                    <div class="flex items-center justify-between pb-2 border-b border-surface-container-high">
                        <span class="font-headline-md text-on-surface font-bold">مركز التنبيهات الحية</span>
                        <span class="font-label-sm text-outline">${totalAlerts} تنبيه</span>
                    </div>
                    <div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
                        ${lowCount > 0 ? `
                            <div onclick="window.location.href='../inventory/code.html'" class="p-2 rounded-xl bg-error/10 text-error flex items-start gap-2 cursor-pointer hover:bg-error/20 transition-colors">
                                <span class="material-symbols-outlined text-[20px] mt-0.5">warning</span>
                                <div>
                                    <div class="font-label-md font-bold">أصناف قاربت على النفاد</div>
                                    <div class="font-body-sm text-on-surface-variant text-[11px]">${lowCount} أصناف في المخزن وصلت للحد الأدنى</div>
                                </div>
                            </div>
                        ` : ''}
                        ${readyCount > 0 ? `
                            <div onclick="window.location.href='../repairs_kanban/code.html'" class="p-2 rounded-xl bg-primary/10 text-primary flex items-start gap-2 cursor-pointer hover:bg-primary/20 transition-colors">
                                <span class="material-symbols-outlined text-[20px] mt-0.5">check_circle</span>
                                <div>
                                    <div class="font-label-md font-bold">أجهزة صيانة جاهزة للتسليم</div>
                                    <div class="font-body-sm text-on-surface-variant text-[11px]">${readyCount} أجهزة بالورشة جاهزة لقبض المبلغ وتسليمها للزبون</div>
                                </div>
                            </div>
                        ` : ''}
                        ${totalAlerts === 0 ? `
                            <div class="p-4 text-center text-on-surface-variant font-body-sm">
                                <span class="material-symbols-outlined text-[28px] text-primary mb-1">done_all</span>
                                <div>لا توجد تنبيهات عاجلة، كل شيء سليم!</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (e) {}
        }

        notifBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        updateAlerts();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigation);
    } else {
        initNavigation();
    }
})();
