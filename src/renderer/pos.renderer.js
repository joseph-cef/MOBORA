// POS Terminal Renderer Logic
(function () {
    let catalog = [];
    let cart = [];
    let currentCategory = 'all';
    let currentSearch = '';
    let currentCustomer = { name: 'عميل عام / زبون المتجر', phone: '' };

    async function loadCatalog() {
        if (!window.moboraAPI || !window.moboraAPI.products) return;

        try {
            const res = await window.moboraAPI.products.list({
                category: currentCategory,
                search: currentSearch,
                limit: 100
            });
            catalog = res.items || [];
            renderCatalog();
        } catch (e) {
            console.error('[POS Catalog Error]', e);
        }
    }

    function renderCatalog() {
        const grid = document.querySelector('.grid.grid-cols-2.sm\\:grid-cols-2.md\\:grid-cols-3');
        if (!grid) return;

        if (catalog.length === 0) {
            grid.innerHTML = '<div class="col-span-full p-8 text-center text-on-surface-variant font-body-sm">لا توجد منتجات مطابقة في المخزون.</div>';
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
                        <span class="absolute top-2 right-2 bg-surface-container-lowest/80 backdrop-blur-md text-${isOut ? 'error' : 'primary'} font-label-sm text-label-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                            ${isOut ? 'نفد كلياً' : `متوفر: ${p.current_stock}`}
                        </span>
                        ${p.category_slug === 'phone' ? '<span class="absolute bottom-2 left-2 bg-surface-container-high/90 text-secondary font-label-sm text-label-sm px-1.5 py-0.5 rounded">IMEI</span>' : ''}
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                        <span class="font-label-sm text-label-sm text-secondary">${p.brand || 'عام'} • ${p.category_name_ar || p.category_slug}</span>
                        <h3 class="font-body-md text-body-md text-on-surface font-semibold line-clamp-2">${p.name}</h3>
                    </div>
                    <div class="mt-space-sm pt-space-xs flex items-center justify-between">
                        <div class="flex flex-col">
                            <span class="font-headline-md text-headline-md text-primary font-bold">${Number(p.sell_price).toLocaleString('fr-DZ')}</span>
                            <span class="font-label-sm text-label-sm text-outline">د.ج الجزائري</span>
                        </div>
                        <button class="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow hover:bg-primary-fixed-dim transition-transform active:scale-90" title="إضافة للسلة">
                            <span class="material-symbols-outlined text-[20px]">add</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Add to Cart
    window.handleProductClick = async function (productId) {
        const product = catalog.find(p => p.id === productId);
        if (!product || product.current_stock <= 0) return;

        // If phone with IMEI, fetch available IMEI
        let imeiId = null;
        let imeiCode = null;

        if (product.category_slug === 'phone') {
            const fullProd = await window.moboraAPI.products.getById(productId);
            const availableImeis = (fullProd && fullProd.imeis) ? fullProd.imeis.filter(i => i.status === 'available') : [];
            
            // Check which IMEIs are already in cart
            const usedImeiIds = cart.filter(c => c.product_id === productId && c.imei_id).map(c => c.imei_id);
            const remainingImei = availableImeis.find(i => !usedImeiIds.includes(i.id));

            if (!remainingImei) {
                alert(`جميع أجهزة [${product.name}] المسجلة بالـ IMEI أُضيفت إلى السلة أو نفدت.`);
                return;
            }
            imeiId = remainingImei.id;
            imeiCode = remainingImei.imei1;
        }

        // Check if existing item in cart (without IMEI)
        if (!imeiId) {
            const existing = cart.find(c => c.product_id === productId && !c.imei_id);
            if (existing) {
                if (existing.quantity >= product.current_stock) {
                    alert(`لا يمكن إضافة المزيد. المخزون المتوفر: ${product.current_stock}`);
                    return;
                }
                existing.quantity += 1;
                renderCart();
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
    };

    function renderCart() {
        const container = document.getElementById('cart-container');
        if (!container) return;

        if (cart.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-space-lg text-center text-on-surface-variant h-48">
                    <span class="material-symbols-outlined text-[36px] text-outline mb-1">shopping_cart</span>
                    <span class="font-body-md text-body-md">السلة فارغة</span>
                    <span class="font-label-sm text-label-sm text-outline">اختر منتجاً أو امسح الباركود لإضافته</span>
                </div>
            `;
            updateTotals();
            return;
        }

        container.innerHTML = cart.map((item, idx) => `
            <div class="cart-item bg-surface-container-lowest p-space-sm rounded-xl flex items-center justify-between gap-space-sm shadow-sm">
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="font-body-md text-body-md text-on-surface font-semibold truncate">${item.name}</span>
                    ${item.imei_code ? `<span class="font-label-sm text-label-sm text-secondary truncate">IMEI: ${item.imei_code}</span>` : ''}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="font-label-md text-label-md text-outline">${Number(item.unit_price).toLocaleString('fr-DZ')} د.ج</span>
                    </div>
                </div>
                <div class="flex items-center gap-space-xs shrink-0">
                    <div class="flex items-center bg-surface-container rounded-lg p-0.5">
                        <button onclick="window.changeCartQty(${idx}, -1)" class="w-6 h-6 rounded bg-surface-container-high hover:bg-surface-bright flex items-center justify-center text-on-surface transition-colors">
                            <span class="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <span class="item-qty font-label-md text-label-md px-space-xs font-bold text-on-surface min-w-[24px] text-center">${item.quantity}</span>
                        <button onclick="window.changeCartQty(${idx}, 1)" class="w-6 h-6 rounded bg-surface-container-high hover:bg-surface-bright flex items-center justify-center text-on-surface transition-colors" ${item.imei_id ? 'disabled opacity-30' : ''}>
                            <span class="material-symbols-outlined text-[14px]">add</span>
                        </button>
                    </div>
                    <div class="text-left min-w-[75px]">
                        <span class="font-label-md text-label-md text-primary font-bold">${Number(item.unit_price * item.quantity).toLocaleString('fr-DZ')}</span>
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
        if (item.imei_id && delta > 0) return; // Devices with IMEI are sold individual

        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            cart.splice(idx, 1);
        } else if (newQty > item.current_stock) {
            alert(`لا يمكن تجاوز المخزون المتوفر (${item.current_stock})`);
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
        if (cart.length > 0 && !confirm('هل أنت متأكد من إفراغ السلة بالكامل؟')) return;
        cart = [];
        renderCart();
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
                changeEl.className = 'text-tertiary-fixed font-bold font-label-lg text-label-lg';
            } else {
                changeEl.innerText = `- ${Math.abs(change).toLocaleString('fr-DZ')} د.ج (غير كافٍ)`;
                changeEl.className = 'text-error font-bold font-label-lg text-label-lg';
            }
        }
    }

    window.recalcTotals = updateTotals;
    window.calcChange = updateTotals;

    // Checkout: Complete Sale
    window.completeSale = async function () {
        if (cart.length === 0) {
            alert('السلة فارغة. يرجى إضافة منتجات أولاً.');
            return;
        }

        const discountInput = document.getElementById('discount-input');
        const discount = discountInput ? Number(discountInput.value) || 0 : 0;
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
                alert(`✅ تم إتمام عملية البيع بنجاح!\n\nرقم الفاتورة: ${inv.invoice_number}\nالإجمالي: ${Number(inv.total_amount).toLocaleString('fr-DZ')} د.ج\nطريقة الدفع: ${payMethod}\nتم خصم المخزون وتوليد بطاقة الضمان بنجاح.`);
                
                // Reset cart & reload catalog
                cart = [];
                renderCart();
                loadCatalog();
            }
        } catch (e) {
            alert('فشل إتمام البيع: ' + e.message);
        }
    };

    // Barcode scanner input handling
    function initScanner() {
        const scanInput = document.querySelector('input[placeholder*="امسح الباركود"]');
        if (!scanInput) return;

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
                    alert(`لم يتم العثور على أي منتج يطابق الباركود أو الـ IMEI: ${code}`);
                }
            }
        });

        // F2 focus scanner
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                scanInput.focus();
            } else if (e.key === 'F12') {
                e.preventDefault();
                window.completeSale();
            }
        });
    }

    // Category pills filter
    function initCategoryTabs() {
        document.querySelectorAll('.brand-pill').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.brand-pill').forEach(b => {
                    b.className = 'brand-pill bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full whitespace-nowrap transition-colors';
                });
                btn.className = 'brand-pill bg-surface-container-highest text-primary font-bold px-3 py-1 rounded-full whitespace-nowrap';

                const text = btn.innerText.trim();
                if (text === 'الجميع') currentSearch = '';
                else currentSearch = text;
                loadCatalog();
            };
        });
    }

    // Change customer name/phone
    window.changeCustomer = function () {
        const name = prompt('اسم الزبون:', currentCustomer.name);
        if (name !== null) {
            const phone = prompt('رقم هاتف الزبون (لإصدار الضمان):', currentCustomer.phone || '05');
            currentCustomer.name = name.trim() || 'عميل عام / زبون المتجر';
            currentCustomer.phone = phone ? phone.trim() : '';

            const nameEl = document.getElementById('selected-customer-name');
            if (nameEl) nameEl.innerText = currentCustomer.name;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initScanner();
            initCategoryTabs();
            loadCatalog();
            renderCart();

            const changeCustBtn = document.querySelector('button:has(.material-symbols-outlined:contains("person_add")), .p-space-xs.px-space-sm button');
            if (changeCustBtn) {
                changeCustBtn.onclick = window.changeCustomer;
            }
        });
    } else {
        initScanner();
        initCategoryTabs();
        loadCatalog();
        renderCart();
    }
})();
