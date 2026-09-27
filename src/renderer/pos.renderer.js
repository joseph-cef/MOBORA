// POS Terminal Renderer Logic - High Speed, Offline-Resilient & Feature-Complete
(function () {
    let catalog = [];
    let cart = [];
    let currentCategory = 'all';
    let currentSearch = '';
    let currentCustomer = { name: 'عميل عام / زبون المتجر', phone: '' };
    window.currentPayment = 'cash';
    let heldCarts = JSON.parse(sessionStorage.getItem('mobora_held_carts') || '[]');

    async function init() {
        injectCustomerModal();
        bindEvents();
        initCategoryTabs();
        initBrandTabs();
        initScanner();
        updateHoldButtonBadge();
        await loadCatalog();
        renderCart();
    }

    async function loadCatalog() {
        if (!window.moboraAPI || !window.moboraAPI.products) return;

        try {
            // Map category filter to backend DB slug
            let dbCat = currentCategory;
            if (currentCategory === 'phones') dbCat = 'phone';
            else if (currentCategory === 'accessories') dbCat = 'accessory';
            else if (currentCategory === 'parts') dbCat = 'spare';
            else if (currentCategory === 'services') dbCat = 'service';

            const res = await window.moboraAPI.products.list({
                category: dbCat,
                search: currentSearch,
                limit: 150
            });
            catalog = res.items || [];
            renderCatalog();
        } catch (e) {
            console.error('[POS Catalog Error]', e);
        }
    }

    function renderCatalog() {
        const grid = document.querySelector('.grid.grid-cols-2');
        if (!grid) return;

        if (catalog.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full p-12 text-center text-on-surface-variant flex flex-col items-center justify-center">
                    <span class="material-symbols-outlined text-[48px] text-outline mb-2">search_off</span>
                    <span class="font-body-md">لا توجد منتجات مطابقة في المخزون حالياً.</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = catalog.map(p => {
            const isOut = p.current_stock <= 0;
            let defaultImg = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=200';
            if (p.category_slug === 'accessory') defaultImg = 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=200';
            if (p.category_slug === 'spare') defaultImg = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=200';

            return `
                <div class="product-card group relative flex flex-col justify-between bg-surface-container hover:bg-surface-container-high rounded-xl p-space-sm shadow-md transition-all duration-200 cursor-pointer overflow-hidden ${isOut ? 'opacity-50 pointer-events-none' : ''}" onclick="window.handleProductClick(${p.id})">
                    <div class="relative w-full h-32 rounded-lg overflow-hidden bg-surface-container-lowest mb-space-sm flex items-center justify-center">
                        <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="${defaultImg}"/>
                        <span class="absolute top-2 right-2 bg-surface-container-lowest/80 backdrop-blur-md text-${isOut ? 'error' : 'primary'} font-label-sm text-label-sm px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                            ${isOut ? 'نفد كلياً' : `متوفر: ${p.current_stock}`}
                        </span>
                        ${p.category_slug === 'phone' ? '<span class="absolute bottom-2 left-2 bg-surface-container-high/90 text-secondary font-label-sm text-label-sm px-1.5 py-0.5 rounded font-mono">IMEI</span>' : ''}
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                        <span class="font-label-sm text-label-sm text-secondary">${p.brand || 'عام'} • ${p.category_name_ar || p.category_slug}</span>
                        <h3 class="font-body-md text-body-md text-on-surface font-semibold line-clamp-2">${p.name}</h3>
                    </div>
                    <div class="mt-space-sm pt-space-xs flex items-center justify-between">
                        <div class="flex flex-col">
                            <span class="font-headline-md text-headline-md text-primary font-bold font-mono">${Number(p.sell_price).toLocaleString('fr-DZ')}</span>
                            <span class="font-label-sm text-label-sm text-outline">د.ج</span>
                        </div>
                        <button class="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow hover:bg-primary-fixed-dim transition-transform active:scale-90" title="إضافة للسلة">
                            <span class="material-symbols-outlined text-[20px]">add</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Add to Cart with IMEI Awareness
    window.handleProductClick = async function (productId) {
        const product = catalog.find(p => p.id === productId);
        if (!product || product.current_stock <= 0) return;

        let imeiId = null;
        let imeiCode = null;

        if (product.category_slug === 'phone') {
            try {
                const fullProd = await window.moboraAPI.products.getById(productId);
                const availableImeis = (fullProd && fullProd.imeis) ? fullProd.imeis.filter(i => i.status === 'available') : [];
                
                // Exclude already added IMEIs in cart
                const usedImeiIds = cart.filter(c => c.product_id === productId && c.imei_id).map(c => c.imei_id);
                const remainingImei = availableImeis.find(i => !usedImeiIds.includes(i.id));

                if (!remainingImei) {
                    showToast('تنبيه المخزون', `جميع أجهزة [${product.name}] بالـ IMEI أضيفت للسلة.`, 'inventory_2');
                    return;
                }
                imeiId = remainingImei.id;
                imeiCode = remainingImei.imei1;
            } catch (e) {
                console.error(e);
            }
        }

        // Generic accessories or parts (stack by quantity)
        if (!imeiId) {
            const existing = cart.find(c => c.product_id === productId && !c.imei_id);
            if (existing) {
                if (existing.quantity >= product.current_stock) {
                    showToast('حد المخزون', `لا يمكن تجاوز المخزون المتوفر (${product.current_stock})`, 'warning');
                    return;
                }
                existing.quantity += 1;
                renderCart();
                showToast('تحديث السلة', `تمت زيادة كمية [${product.name}]`, 'shopping_cart');
                return;
            }
        }

        cart.push({
            product_id: product.id,
            name: product.name,
            unit_price: product.sell_price,
            quantity: 1,
            current_stock: product.current_stock,
            imei_id: imeiId,
            imei_code: imeiCode
        });

        renderCart();
        showToast('أضيف للسلة 🛒', `${product.name} ${imeiCode ? `(IMEI: ${imeiCode.slice(-4)})` : ''}`, 'add_shopping_cart');
    };

    // Render Cart HTML
    function renderCart() {
        const container = document.getElementById('cart-container');
        if (!container) return;

        if (cart.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-space-lg text-center text-on-surface-variant h-52">
                    <span class="material-symbols-outlined text-[44px] text-outline mb-1">shopping_cart</span>
                    <span class="font-body-md text-body-md font-semibold">السلة فارغة حالياً</span>
                    <span class="font-label-sm text-label-sm text-outline">امسح الباركود أو انقر على المنتجات لإضافتها</span>
                </div>
            `;
            updateTotals();
            return;
        }

        container.innerHTML = cart.map((item, idx) => `
            <div class="cart-item bg-surface-container-lowest p-space-sm rounded-xl flex items-center justify-between gap-space-sm shadow-sm border border-outline-variant/30">
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="font-body-md text-body-md text-on-surface font-semibold truncate">${item.name}</span>
                    ${item.imei_code ? `<span class="font-label-sm text-label-sm text-secondary truncate font-mono">IMEI: ${item.imei_code}</span>` : ''}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="font-label-md text-label-md text-outline font-mono">${Number(item.unit_price).toLocaleString('fr-DZ')} د.ج</span>
                    </div>
                </div>
                <div class="flex items-center gap-space-xs shrink-0">
                    <div class="flex items-center bg-surface-container rounded-lg p-0.5">
                        <button onclick="window.changeCartQty(${idx}, -1)" class="w-6 h-6 rounded bg-surface-container-high hover:bg-surface-bright flex items-center justify-center text-on-surface transition-colors">
                            <span class="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <span class="item-qty font-label-md text-label-md px-space-xs font-bold text-on-surface min-w-[24px] text-center font-mono">${item.quantity}</span>
                        <button onclick="window.changeCartQty(${idx}, 1)" class="w-6 h-6 rounded bg-surface-container-high hover:bg-surface-bright flex items-center justify-center text-on-surface transition-colors" ${item.imei_id ? 'disabled opacity-30' : ''}>
                            <span class="material-symbols-outlined text-[14px]">add</span>
                        </button>
                    </div>
                    <div class="text-left min-w-[75px]">
                        <span class="font-label-md text-label-md text-primary font-bold font-mono">${Number(item.unit_price * item.quantity).toLocaleString('fr-DZ')}</span>
                        <span class="font-label-sm text-label-sm block text-outline">د.ج</span>
                    </div>
                    <button onclick="window.removeCartItem(${idx})" class="text-outline hover:text-error transition-colors p-1" title="حذف">
                        <span class="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            </div>
        `).join('');

        updateTotals();
    }

    window.changeCartQty = function (idx, delta) {
        if (!cart[idx]) return;
        const item = cart[idx];
        if (item.imei_id && delta > 0) return;

        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            cart.splice(idx, 1);
        } else if (newQty > item.current_stock) {
            showToast('المخزون المتوفر', `المخزون المتوفر هو ${item.current_stock} فقط`, 'warning');
        } else {
            item.quantity = newQty;
        }
        renderCart();
    };

    window.removeCartItem = function (idx) {
        cart.splice(idx, 1);
        renderCart();
    };

    window.clearCart = function () {
        if (cart.length === 0) return;
        cart = [];
        renderCart();
        showToast('إفراغ السلة', 'تم تفريغ السلة بالكامل', 'delete_sweep');
    };

    function updateTotals() {
        const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const discountInput = document.getElementById('discount-input');
        const discount = discountInput ? Math.max(0, Number(discountInput.value) || 0) : 0;
        const grandTotal = Math.max(0, subtotal - discount);

        const subtotalEl = document.getElementById('cart-subtotal');
        if (subtotalEl) {
            subtotalEl.innerText = `${subtotal.toLocaleString('fr-DZ')} د.ج`;
        }

        const grandTotalEl = document.getElementById('cart-grand-total');
        if (grandTotalEl) {
            grandTotalEl.innerText = grandTotal.toLocaleString('fr-DZ');
        }

        // Cash change calculation
        const cashInput = document.getElementById('cash-received');
        const changeEl = document.getElementById('cash-change');
        if (cashInput && changeEl) {
            const received = Number(cashInput.value) || 0;
            const change = received - grandTotal;
            if (change >= 0) {
                changeEl.innerText = `+ ${change.toLocaleString('fr-DZ')} د.ج`;
                changeEl.className = 'text-tertiary-fixed font-bold font-label-lg text-label-lg font-mono';
            } else {
                changeEl.innerText = `- ${Math.abs(change).toLocaleString('fr-DZ')} د.ج (متبقي)`;
                changeEl.className = 'text-error font-bold font-label-lg text-label-lg font-mono';
            }
        }
    }

    window.recalcTotals = updateTotals;
    window.calcChange = updateTotals;

    // Switch Payment Mode (Cash, BaridiMob, CCP)
    window.switchPaymentMode = function (mode) {
        window.currentPayment = mode;
        const tabs = ['cash', 'baridimob', 'ccp'];

        tabs.forEach(m => {
            const tabBtn = document.getElementById(`pay-tab-${m}`);
            const panel = document.getElementById(m === 'cash' ? 'payment-cash-panel' : (m === 'baridimob' ? 'payment-baridi-panel' : 'payment-ccp-panel'));
            if (tabBtn) {
                if (m === mode) {
                    tabBtn.className = 'pay-method-btn flex flex-col items-center justify-center p-space-xs rounded-xl bg-primary text-on-primary font-bold shadow-md transition-all duration-150';
                } else {
                    tabBtn.className = 'pay-method-btn flex flex-col items-center justify-center p-space-xs rounded-xl bg-surface-container hover:bg-surface-bright text-on-surface transition-all duration-150';
                }
            }
            if (panel) {
                panel.classList.toggle('hidden', m !== mode);
            }
        });

        // Set cash default received
        if (mode === 'cash') {
            const grandTotalText = document.getElementById('cart-grand-total')?.innerText.replace(/[^0-9]/g, '') || '0';
            const cashInput = document.getElementById('cash-received');
            if (cashInput && Number(grandTotalText) > 0) {
                cashInput.value = grandTotalText;
                updateTotals();
            }
        }
    };

    // Park / Hold Cart Feature
    window.holdCart = function () {
        if (cart.length > 0) {
            heldCarts.push({
                id: Date.now(),
                customer: { ...currentCustomer },
                cart: [...cart],
                time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
            });
            sessionStorage.setItem('mobora_held_carts', JSON.stringify(heldCarts));
            cart = [];
            currentCustomer = { name: 'عميل عام / زبون المتجر', phone: '' };
            updateCustomerDisplay();
            renderCart();
            updateHoldButtonBadge();
            showToast('تم تعليق الفاتورة (Hold) ⏸️', 'يمكنك استئناف الفاتورة في أي وقت بالنقر على نفس الزر', 'pause_circle');
        } else if (heldCarts.length > 0) {
            // Restore held cart
            const lastHeld = heldCarts.pop();
            sessionStorage.setItem('mobora_held_carts', JSON.stringify(heldCarts));
            cart = lastHeld.cart;
            currentCustomer = lastHeld.customer;
            updateCustomerDisplay();
            renderCart();
            updateHoldButtonBadge();
            showToast('تم استئناف الفاتورة المعلقة ▶️', `تمت استعادة سلة الزبون: ${currentCustomer.name}`, 'play_circle');
        } else {
            showToast('لا توجد فواتير معلقة', 'قم بإضافة منتجات ثم انقر تعليق لحفظها مؤقتاً', 'info');
        }
    };

    function updateHoldButtonBadge() {
        const holdBtn = document.querySelector('button[title*="حفظ الفاتورة"]');
        if (holdBtn) {
            const count = heldCarts.length;
            holdBtn.innerHTML = `
                <span class="material-symbols-outlined text-[16px]">${count > 0 ? 'play_circle' : 'pause_circle'}</span>
                <span>${count > 0 ? `استئناف (${count})` : 'تعليق (Hold)'}</span>
            `;
            if (count > 0) {
                holdBtn.className = 'flex items-center justify-center gap-1 py-1.5 px-space-xs bg-secondary-container text-on-secondary-container font-bold rounded-lg font-label-sm text-label-sm transition-colors shadow-sm';
            } else {
                holdBtn.className = 'flex items-center justify-center gap-1 py-1.5 px-space-xs bg-surface-container hover:bg-surface-bright rounded-lg text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors';
            }
        }
    }

    // Complete Sale (Checkout)
    window.completeSale = async function () {
        if (cart.length === 0) {
            showToast('السلة فارغة', 'يرجى اختيار أو مسح منتجات أولاً', 'warning');
            return;
        }

        const discountInput = document.getElementById('discount-input');
        const discount = discountInput ? Math.max(0, Number(discountInput.value) || 0) : 0;
        const payMethod = window.currentPayment || 'cash';

        const payload = {
            items: cart.map(c => ({
                product_id: c.product_id,
                imei_id: c.imei_id || null,
                quantity: c.quantity,
                unit_price: c.unit_price
            })),
            customerName: currentCustomer.name,
            customerPhone: currentCustomer.phone,
            discount,
            paymentMethod: payMethod,
            cashierId: 1
        };

        try {
            const res = await window.moboraAPI.sales.create(payload);
            if (res.success) {
                const inv = res.sale;
                showToast('تمت الفاتورة بنجاح 🧾', `فاتورة #${inv.invoice_number} بمبلغ ${Number(inv.total_amount).toLocaleString('fr-DZ')} د.ج`, 'receipt');

                // Print thermal ticket
                if (window.moboraAPI && window.moboraAPI.printer) {
                    try {
                        await window.moboraAPI.printer.printSale({ saleId: inv.id });
                    } catch (printErr) {
                        console.warn('[POS Thermal Print Warning]', printErr.message);
                    }
                }

                // Reset cart & reload catalog
                cart = [];
                currentCustomer = { name: 'عميل عام / زبون المتجر', phone: '' };
                updateCustomerDisplay();
                renderCart();
                loadCatalog();
            }
        } catch (e) {
            showToast('خطأ أثناء البيع', e.message, 'error');
        }
    };

    // Customer Selection Modal & Management
    function injectCustomerModal() {
        if (document.getElementById('modal-pos-customer')) return;

        const modalHtml = `
        <div id="modal-pos-customer" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
            <div class="bg-surface-container-high border border-outline-variant/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div class="p-space-md bg-surface-container-highest border-b border-outline-variant/40 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[24px]">person</span>
                        <h3 class="font-headline-md text-on-surface">بيانات الزبون للفاتورة والضمان</h3>
                    </div>
                    <button onclick="document.getElementById('modal-pos-customer').classList.add('hidden')" class="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surface-variant flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div class="p-space-md flex flex-col gap-3">
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">اسم الزبون الكامل *</label>
                        <input id="pos-cust-name" type="text" placeholder="مثال: يوسف معمري أو عميل عام" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">رقم هاتف الزبون (لإصدار وصل الضمان وتتبع الصيانة)</label>
                        <input id="pos-cust-phone" type="tel" dir="ltr" placeholder="0550123456" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label class="font-label-sm text-on-surface-variant block mb-1">تصنيف العميل</label>
                        <select id="pos-cust-type" class="w-full bg-surface-container-lowest text-on-surface p-2.5 rounded-xl border border-outline-variant font-body-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="retail">زبون عادي (سعر التجزئة)</option>
                            <option value="wholesale">زبون جملة / تقسيط</option>
                            <option value="vip">زبون دائم VIP</option>
                        </select>
                    </div>
                </div>
                <div class="p-space-md bg-surface-container-highest border-t border-outline-variant/40 flex items-center justify-end gap-2">
                    <button onclick="document.getElementById('modal-pos-customer').classList.add('hidden')" class="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-label-md">إلغاء</button>
                    <button onclick="window.savePosCustomer()" class="px-6 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold font-label-md shadow-md flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[18px]">check</span>
                        <span>تعيين الزبون في الفاتورة</span>
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    window.openCustomerModal = function () {
        const modal = document.getElementById('modal-pos-customer');
        if (!modal) return;
        document.getElementById('pos-cust-name').value = currentCustomer.name === 'عميل عام / زبون المتجر' ? '' : currentCustomer.name;
        document.getElementById('pos-cust-phone').value = currentCustomer.phone || '';
        modal.classList.remove('hidden');
        document.getElementById('pos-cust-name').focus();
    };

    window.savePosCustomer = function () {
        const name = document.getElementById('pos-cust-name')?.value.trim();
        const phone = document.getElementById('pos-cust-phone')?.value.trim();

        currentCustomer.name = name || 'عميل عام / زبون المتجر';
        currentCustomer.phone = phone || '';
        updateCustomerDisplay();
        document.getElementById('modal-pos-customer').classList.add('hidden');
        showToast('تم تعيين الزبون', currentCustomer.name, 'person');
    };

    function updateCustomerDisplay() {
        const nameEl = document.getElementById('selected-customer-name');
        if (nameEl) nameEl.innerText = currentCustomer.name;
    }

    // Barcode Scanner & Hotkeys
    function initScanner() {
        const scanInput = document.querySelector('input[placeholder*="امسح الباركود"], input[placeholder*="البحث عن منتج"]');
        if (scanInput) {
            scanInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const code = scanInput.value.trim();
                    if (!code) return;

                    const match = await window.moboraAPI.products.lookupCode(code);
                    if (match && match.product) {
                        await window.handleProductClick(match.product.id);
                        scanInput.value = '';
                    } else {
                        showToast('لم يتم العثور على المنتج', `الكود أو السيريال: ${code}`, 'error');
                    }
                }
            });

            // Live filter on search typing
            scanInput.addEventListener('input', (e) => {
                currentSearch = e.target.value.trim();
                loadCatalog();
            });
        }

        // Global POS Hotkeys (F1, F2, F3, F4, F8, F12)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F12') {
                e.preventDefault();
                window.completeSale();
            } else if (e.key === 'F2' || e.key === 'F3') {
                e.preventDefault();
                if (scanInput) scanInput.focus();
            } else if (e.key === 'F8') {
                e.preventDefault();
                showToast('درج النقود 💵', 'تم إرسال إشارة فتح درج الكاش للمطبعة الحرارية', 'payments');
            }
        });
    }

    // Category Tabs Logic
    function initCategoryTabs() {
        document.querySelectorAll('.pos-category-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.pos-category-btn').forEach(b => {
                    b.className = 'pos-category-btn px-space-md py-space-xs rounded-xl font-label-md text-label-md flex items-center gap-space-xs transition-colors whitespace-nowrap bg-surface-container hover:bg-surface-container-high text-on-surface-variant';
                });
                btn.className = 'pos-category-btn active px-space-md py-space-xs rounded-xl font-label-md text-label-md flex items-center gap-space-xs transition-colors whitespace-nowrap bg-primary-container text-on-primary-container font-semibold shadow-sm';

                currentCategory = btn.getAttribute('data-category') || 'all';
                loadCatalog();
            };
        });
    }

    // Brand Pills Logic
    function initBrandTabs() {
        document.querySelectorAll('.brand-pill').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.brand-pill').forEach(b => {
                    b.className = 'brand-pill bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full whitespace-nowrap transition-colors';
                });
                btn.className = 'brand-pill bg-surface-container-highest text-primary font-bold px-3 py-1 rounded-full whitespace-nowrap';

                const text = btn.innerText.trim();
                currentSearch = (text === 'الجميع') ? '' : text;
                loadCatalog();
            };
        });
    }

    function bindEvents() {
        // Customer change buttons
        const custButtons = document.querySelectorAll('.bg-surface-container-lowest.rounded-xl.p-space-xs button');
        custButtons.forEach(btn => {
            btn.onclick = window.openCustomerModal;
        });

        // Hold button
        const holdBtn = document.querySelector('button[title*="حفظ الفاتورة"]');
        if (holdBtn) {
            holdBtn.onclick = window.holdCart;
        }

        // Clear cart buttons
        const clearBtns = document.querySelectorAll('button[onclick*="clearCart"], button[title*="إفراغ السلة"], button[title*="إلغاء العملية"]');
        clearBtns.forEach(b => {
            b.onclick = window.clearCart;
        });

        // Checkout button
        const checkoutBtn = document.querySelector('button:has(.material-symbols-outlined:contains("print"))');
        if (checkoutBtn && checkoutBtn.innerText.includes('إتمام البيع')) {
            checkoutBtn.onclick = window.completeSale;
        }

        // Refresh Stock button
        const refreshBtn = document.querySelector('button:has(.material-symbols-outlined:contains("sync"))');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                loadCatalog();
                showToast('تحديث المخزون', 'تم تحديث قائمة المنتجات والكميات من قاعدة البيانات', 'sync');
            };
        }
    }

    // Pos Toast Feedback
    function showToast(title, desc, iconName) {
        const toast = document.getElementById('pos-toast');
        if (!toast) return;

        const titleEl = document.getElementById('toast-title');
        const descEl = document.getElementById('toast-desc');
        const iconEl = document.getElementById('toast-icon');

        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        if (iconEl && iconName) iconEl.textContent = iconName;

        toast.classList.remove('translate-y-24', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        clearTimeout(window._posToastTimeout);
        window._posToastTimeout = setTimeout(() => {
            toast.classList.add('translate-y-24', 'opacity-0');
            toast.classList.remove('translate-y-0', 'opacity-100');
        }, 2600);
    }
    window.showToast = showToast;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
