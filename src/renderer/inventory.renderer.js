// Inventory & Products Renderer Logic
(function () {
    let currentCategory = 'all';
    let currentStockStatus = 'all';
    let currentTelegramStatus = 'all';
    let searchQuery = '';
    let currentPage = 1;
    let selectedCategoryId = 'phone';
    let editingProductId = null;

    async function loadMetrics() {
        if (!window.moboraAPI || !window.moboraAPI.dashboard) return;
        try {
            const res = await window.moboraAPI.dashboard.getMetrics();
            if (!res || !res.success) return;
            const data = res.data;

            // 1. Valuation
            const valEl = document.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div:nth-child(1) .font-headline-xl');
            if (valEl) {
                valEl.innerHTML = `${Number(data.stock.valuation).toLocaleString('fr-DZ')} <span class="font-label-sm text-label-sm text-primary font-normal">د.ج</span>`;
            }

            // 2. Total active items
            const activeEl = document.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div:nth-child(2) .font-headline-xl');
            if (activeEl) {
                activeEl.innerHTML = `${data.stock.total_items} <span class="font-label-sm text-label-sm text-secondary font-normal">صنف مسجل</span>`;
            }
            const phoneBadge = document.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div:nth-child(2) .text-on-surface-variant');
            if (phoneBadge) {
                phoneBadge.innerText = `منها ${data.stock.active_phones} هاتف مسجل بالـ IMEI`;
            }

            // 3. Low stock alerts
            const lowEl = document.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div:nth-child(3) .font-headline-xl');
            if (lowEl) {
                lowEl.innerHTML = `${data.stock.low_stock_count} <span class="font-label-sm text-label-sm text-on-surface-variant font-normal">قطع قاربت النفاد</span>`;
            }

            // 4. Telegram Live
            const tgEl = document.querySelector('.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div:nth-child(4) .font-headline-xl');
            if (tgEl) {
                tgEl.innerHTML = `${data.telegram.live_posts} <span class="font-label-sm text-label-sm text-on-surface-variant font-normal">عرض مباشر</span>`;
            }

            // Top header badge
            const headerBadge = document.querySelector('h1 + span');
            if (headerBadge) {
                headerBadge.innerText = `${data.stock.total_units} وحدة حية`;
            }
        } catch (e) {
            console.error('[Inventory Metrics Error]', e);
        }
    }

    async function loadProducts() {
        if (!window.moboraAPI || !window.moboraAPI.products) return;

        try {
            const res = await window.moboraAPI.products.list({
                category: currentCategory,
                stockStatus: currentStockStatus,
                telegramStatus: currentTelegramStatus,
                search: searchQuery,
                page: currentPage,
                limit: 50
            });

            const tbody = document.querySelector('table tbody');
            const footerText = document.querySelector('.p-space-md.bg-surface-container .font-body-sm');
            if (footerText) {
                footerText.innerHTML = `<span>عرض ${res.items.length} من أصل ${res.total} صنفاً</span>`;
            }

            if (!tbody) return;

            if (res.items.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="p-space-xl text-center text-on-surface-variant">
                            <span class="material-symbols-outlined text-[36px] text-outline mb-2">search_off</span>
                            <div>لم يتم العثور على أي منتج يطابق خيارات البحث الحالية.</div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = res.items.map(p => {
                const marginVal = p.sell_price - p.cost_price;
                const marginPct = p.cost_price > 0 ? ((marginVal / p.cost_price) * 100).toFixed(1) : 0;
                const isLow = p.current_stock <= p.min_stock_alert && p.current_stock > 0;
                const isOut = p.current_stock === 0;

                let stockBadgeClass = 'bg-primary/15 text-primary';
                let stockText = `${p.current_stock} قطع متوفرة`;
                if (isOut) {
                    stockBadgeClass = 'bg-error-container text-on-error-container';
                    stockText = 'نفد من المخزن (0)';
                } else if (isLow) {
                    stockBadgeClass = 'bg-tertiary/15 text-tertiary';
                    stockText = `${p.current_stock} قطع فقط (منخفض)`;
                }

                let defaultImg = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=200';
                if (p.category_slug === 'accessory') defaultImg = 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=200';
                if (p.category_slug === 'spare') defaultImg = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=200';

                return `
                    <tr class="hover:bg-surface-container transition-colors group">
                        <td class="p-space-md text-center">
                            <input class="rounded bg-surface-container-lowest text-primary focus:ring-0 cursor-pointer" type="checkbox"/>
                        </td>
                        <td class="p-space-md">
                            <div class="flex items-center gap-space-md">
                                <div class="w-12 h-12 rounded-lg bg-surface-container-lowest shrink-0 overflow-hidden p-1 flex items-center justify-center">
                                    <img class="object-cover w-full h-full rounded" src="${defaultImg}"/>
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-space-xs">
                                        <span class="font-headline-md text-headline-md text-on-surface font-semibold group-hover:text-primary transition-colors truncate">${p.name}</span>
                                        ${p.storage_rom ? `<span class="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-bold">${p.storage_rom}</span>` : ''}
                                        ${p.color ? `<span class="px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">${p.color}</span>` : ''}
                                    </div>
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-on-surface-variant font-label-sm text-label-sm">
                                        <span class="text-secondary font-mono">${p.barcode || 'بدون باركود'}</span>
                                        ${p.model ? `<span class="text-outline">•</span><span>موديل: ${p.model}</span>` : ''}
                                        ${p.available_imeis_count > 0 ? `<span class="text-outline">•</span><span class="text-primary font-mono font-bold">${p.available_imeis_count} IMEI متوفر</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="p-space-md">
                            <div class="flex flex-col">
                                <span class="text-on-surface font-medium">${p.category_name_ar || p.category_slug}</span>
                                <span class="text-on-surface-variant font-label-sm text-label-sm">${p.brand || 'عام'}</span>
                            </div>
                        </td>
                        <td class="p-space-md text-center">
                            <div class="inline-flex flex-col items-center">
                                <span class="px-2.5 py-1 rounded-full font-label-md text-label-md font-bold ${stockBadgeClass}">
                                    ${stockText}
                                </span>
                                <span class="text-on-surface-variant font-label-sm text-label-sm mt-0.5">حد الطلب: ${p.min_stock_alert}</span>
                            </div>
                        </td>
                        <td class="p-space-md text-left font-label-md text-label-md text-on-surface font-mono">
                            ${Number(p.cost_price).toLocaleString('fr-DZ')} <span class="text-outline text-[11px]">د.ج</span>
                        </td>
                        <td class="p-space-md text-left font-label-md text-label-md text-primary font-bold font-mono">
                            ${Number(p.sell_price).toLocaleString('fr-DZ')} <span class="text-primary/70 text-[11px]">د.ج</span>
                        </td>
                        <td class="p-space-md text-center">
                            <div class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-sm text-label-sm font-bold">
                                <span>+${marginPct}%</span>
                                <span class="text-[10px] text-on-surface-variant">(+${Number(marginVal).toLocaleString('fr-DZ')})</span>
                            </div>
                        </td>
                        <td class="p-space-md text-center">
                            ${p.is_telegram_synced ? `
                                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/15 text-secondary font-label-sm text-label-sm font-medium">
                                    <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                                    <span>منشور بالقناة</span>
                                </div>
                            ` : `
                                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-medium">
                                    <span class="material-symbols-outlined text-[14px]">visibility_off</span>
                                    <span>داخلي فقط</span>
                                </div>
                            `}
                        </td>
                        <td class="p-space-md text-center">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="editProduct(${p.id})" class="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors" title="تعديل">
                                    <span class="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button onclick="publishToTelegram(${p.id})" class="p-1.5 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors" title="نشر على Telegram">
                                    <span class="material-symbols-outlined text-[18px]">send</span>
                                </button>
                                <button onclick="deleteProduct(${p.id}, '${p.name}')" class="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container hover:text-on-error-container transition-colors" title="حذف">
                                    <span class="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error('[Load Products Error]', e);
        }
    }

    // Modal Category Switcher
    window.switchCategory = function (cat) {
        selectedCategoryId = cat;
        const phoneGroup = document.getElementById('phoneFieldsGroup');
        const accGroup = document.getElementById('accessoryFieldsGroup');

        ['tabPhone', 'tabAccessory', 'tabSpare', 'tabTools'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.className = 'flex items-center justify-center gap-space-xs py-2.5 px-space-sm rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all';
            }
        });

        const activeBtn = document.getElementById(`tab${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
        if (activeBtn) {
            activeBtn.className = 'flex items-center justify-center gap-space-xs py-2.5 px-space-sm rounded-lg font-label-md text-label-md font-bold transition-all bg-primary text-on-primary shadow-sm';
        }

        if (cat === 'phone') {
            if (phoneGroup) phoneGroup.classList.remove('hidden');
            if (accGroup) accGroup.classList.add('hidden');
        } else {
            if (phoneGroup) phoneGroup.classList.add('hidden');
            if (accGroup) accGroup.classList.remove('hidden');
        }
    };

    // Modal Open / Close
    window.openProductModal = function (isEdit = false) {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
        if (!isEdit) {
            editingProductId = null;
            document.querySelector('#productModal h2').innerText = 'إضافة بطاقة منتج جديدة';
        }
    };

    window.closeProductModal = function () {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        editingProductId = null;
    };

    // Save Product Form Action
    window.saveProductForm = async function () {
        const modal = document.getElementById('productModal');
        if (!modal) return;

        const isPhone = selectedCategoryId === 'phone';
        const brand = isPhone ? modal.querySelector('#phoneFieldsGroup select')?.value || 'Apple' : 'General';
        const model = isPhone ? modal.querySelector('#phoneFieldsGroup input[placeholder*="Modèle"]')?.value || '' : '';
        const name = isPhone 
            ? `${brand} ${model}`.trim() || 'هاتف ذكي جديد'
            : modal.querySelector('#accessoryFieldsGroup input')?.value || 'إكسسوار جديد';

        const storage = isPhone ? modal.querySelector('#phoneFieldsGroup select:nth-of-type(2)')?.value : null;
        const ram = isPhone ? modal.querySelector('#phoneFieldsGroup select:nth-of-type(3)')?.value : null;
        const color = isPhone ? modal.querySelector('#phoneFieldsGroup input[type="text"]:nth-of-type(2)')?.value : null;
        const imei1 = isPhone ? modal.querySelector('input[maxlength="15"]')?.value : null;
        const imei2 = isPhone ? modal.querySelectorAll('input[maxlength="15"]')[1]?.value : null;

        const costPrice = Number(document.getElementById('costPrice')?.value) || 0;
        const sellPrice = Number(document.getElementById('sellPrice')?.value) || 0;
        const stock = Number(modal.querySelector('input[type="number"][min="1"]')?.value) || 1;
        const minStock = Number(modal.querySelectorAll('input[type="number"][min="1"]')[1]?.value) || 2;
        const isTgSync = modal.querySelector('input[type="checkbox"].sr-only')?.checked ? 1 : 0;

        const payload = {
            category_slug: selectedCategoryId,
            name,
            brand,
            model,
            storage_rom: storage,
            ram,
            color,
            imei1,
            imei2,
            cost_price: costPrice,
            sell_price: sellPrice,
            current_stock: stock,
            min_stock_alert: minStock,
            is_telegram_synced: isTgSync,
            is_workshop_only: selectedCategoryId === 'spare' ? 1 : 0
        };

        try {
            if (editingProductId) {
                await window.moboraAPI.products.update(editingProductId, payload, 1);
                alert('تم تحديث بيانات المنتج بنجاح!');
            } else {
                await window.moboraAPI.products.create(payload, 1);
                alert('تمت إضافة المنتج بنجاح إلى المخزون!');
            }
            closeProductModal();
            loadMetrics();
            loadProducts();
        } catch (e) {
            alert('حدث خطأ أثناء الحفظ: ' + e.message);
        }
    };

    // Delete Product
    window.deleteProduct = async function (id, name) {
        if (!confirm(`هل أنت متأكد من حذف الصنف "${name}" نهائياً من قاعدة البيانات؟`)) return;
        try {
            await window.moboraAPI.products.delete(id, 1);
            alert('تم حذف الصنف بنجاح وتم تسجيل العملية في سجل الرقابة.');
            loadMetrics();
            loadProducts();
        } catch (e) {
            alert('فشل الحذف: ' + e.message);
        }
    };

    // Edit Product
    window.editProduct = async function (id) {
        try {
            const product = await window.moboraAPI.products.getById(id);
            if (!product) return;
            editingProductId = id;
            openProductModal(true);
            document.querySelector('#productModal h2').innerText = `تعديل الصنف: ${product.name}`;
            document.getElementById('costPrice').value = product.cost_price;
            document.getElementById('sellPrice').value = product.sell_price;
            window.calculateMargin();
        } catch (e) {
            console.error(e);
        }
    };

    // Publish to Telegram
    window.publishToTelegram = async function (id) {
        try {
            const channels = await window.moboraAPI.telegram.getChannels();
            if (!channels || channels.length === 0) {
                alert('يرجى أولاً ربط قناة تيليجرام واحدة على الأقل من صفحة تيليجرام بوت.');
                return;
            }
            const channel = channels[0];
            const res = await window.moboraAPI.telegram.publishProduct({
                productId: id,
                channelId: channel.id
            });
            if (res.success) {
                alert('تم نشر العرض بنجاح على قناة Telegram!');
                loadProducts();
            } else if (res.queued) {
                alert('تم وضع المنشور في قائمة الانتظار للمحاولة الآلية فور توفر الاتصال بالإنترنت.');
            }
        } catch (e) {
            alert('خطأ أثناء النشر: ' + e.message);
        }
    };

    // Search and filter listeners
    function initFilters() {
        const searchInput = document.querySelector('input[placeholder*="امسح الباركود"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                loadProducts();
            });
        }

        const stockFilterSelect = document.querySelector('select:has(option[value="in_stock"])');
        if (stockFilterSelect) {
            stockFilterSelect.addEventListener('change', (e) => {
                currentStockStatus = e.target.value;
                loadProducts();
            });
        }

        const tgFilterSelect = document.querySelector('select:has(option[value="published"])');
        if (tgFilterSelect) {
            tgFilterSelect.addEventListener('change', (e) => {
                currentTelegramStatus = e.target.value;
                loadProducts();
            });
        }

        // Category filter chips
        document.querySelectorAll('.flex.items-center.gap-space-xs.overflow-x-auto button').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.flex.items-center.gap-space-xs.overflow-x-auto button').forEach(b => {
                    b.className = 'flex items-center gap-space-xs px-space-md py-2 rounded-lg font-label-md text-label-md bg-surface-container text-on-surface-variant hover:text-on-surface transition-all whitespace-nowrap shadow-sm';
                });
                btn.className = 'flex items-center gap-space-xs px-space-md py-2 rounded-lg font-label-md text-label-md bg-primary-container text-on-primary-container font-bold transition-all whitespace-nowrap shadow-md';

                const text = btn.innerText;
                if (text.includes('الكل')) currentCategory = 'all';
                else if (text.includes('هواتف')) currentCategory = 'phone';
                else if (text.includes('إكسسوارات')) currentCategory = 'accessory';
                else if (text.includes('قطع غيار')) currentCategory = 'spare';
                else if (text.includes('أدوات')) currentCategory = 'tools';

                loadProducts();
            };
        });

        // Open modal button
        const openModalBtn = document.getElementById('openModalBtn');
        if (openModalBtn) {
            openModalBtn.onclick = () => openProductModal(false);
        }

        const closeModalBtn = document.getElementById('closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.onclick = closeProductModal;
        }

        const cancelModalBtn = document.getElementById('cancelModalBtn');
        if (cancelModalBtn) {
            cancelModalBtn.onclick = closeProductModal;
        }

        const saveBtn = document.querySelector('#productModal button:has(.material-symbols-outlined:contains("save")), #productModal .bg-primary');
        const footerSaveBtn = Array.from(document.querySelectorAll('#productModal button')).find(b => b.innerText.includes('حفظ المنتج'));
        if (footerSaveBtn) {
            footerSaveBtn.onclick = window.saveProductForm;
        }

        // Hide modal initially
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initFilters();
            loadMetrics();
            loadProducts();
        });
    } else {
        initFilters();
        loadMetrics();
        loadProducts();
    }
})();
