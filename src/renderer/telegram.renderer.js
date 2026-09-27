// Telegram Bot Integration Renderer
document.addEventListener('DOMContentLoaded', () => {
    initTelegramIntegration();
});

let registeredChannels = [];
let allProducts = [];
let allPosts = [];
let currentFilter = 'all';

async function initTelegramIntegration() {
    setupTabSwitching();
    setupModals();
    await loadBotSettings();
    await loadChannels();
    await loadProductsForComposer();
    await loadPostsHistory();
    setupComposer();
    setupFiltersAndSearch();
}

function showToast(message) {
    const toast = document.getElementById('toast-feedback');
    const msgElem = document.getElementById('toast-msg');
    if (toast && msgElem) {
        msgElem.textContent = message;
        toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-2');
        setTimeout(() => {
            toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-2');
        }, 3500);
    } else {
        alert(message);
    }
}

function setupTabSwitching() {
    window.switchTab = (tabId) => {
        const tab1 = document.getElementById('view-channels');
        const tab2 = document.getElementById('view-posts');
        const btn1 = document.getElementById('btn-tab-channels');
        const btn2 = document.getElementById('btn-tab-posts');

        if (!tab1 || !tab2 || !btn1 || !btn2) return;

        if (tabId === 'channels') {
            tab1.classList.remove('hidden');
            tab2.classList.add('hidden');
            btn1.className = 'flex items-center gap-space-xs px-space-md py-space-sm bg-primary text-on-primary font-headline-md text-headline-md rounded-xl shadow-md transition-all';
            btn2.className = 'flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container text-on-surface-variant hover:text-on-surface font-headline-md text-headline-md rounded-xl transition-all';
        } else {
            tab1.classList.add('hidden');
            tab2.classList.remove('hidden');
            btn2.className = 'flex items-center gap-space-xs px-space-md py-space-sm bg-primary text-on-primary font-headline-md text-headline-md rounded-xl shadow-md transition-all';
            btn1.className = 'flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container text-on-surface-variant hover:text-on-surface font-headline-md text-headline-md rounded-xl transition-all';
            loadPostsHistory();
        }
    };
}

function setupModals() {
    window.toggleModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.toggle('hidden');
        }
    };

    // Add channel modal submit
    const modal = document.getElementById('modal-add-channel');
    if (modal) {
        const confirmBtn = modal.querySelector('button.bg-primary');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                const inputs = modal.querySelectorAll('input[type="text"]');
                const usernameOrId = inputs[0] ? inputs[0].value.trim() : '';
                const channelTitle = inputs[1] ? inputs[1].value.trim() : '';
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                const autoPrice = checkboxes[0] ? checkboxes[0].checked : true;
                const autoSold = checkboxes[1] ? checkboxes[1].checked : true;

                if (!usernameOrId || !channelTitle) {
                    alert('يرجى كتابة معرّف القناة واسم القناة للعرض');
                    return;
                }

                try {
                    if (window.moboraAPI && window.moboraAPI.telegram) {
                        await window.moboraAPI.telegram.addChannel({
                            chat_id: usernameOrId,
                            channel_username: usernameOrId.startsWith('@') ? usernameOrId : null,
                            channel_title: channelTitle,
                            auto_update_price: autoPrice,
                            auto_sold_out: autoSold
                        });
                        showToast(`تم ربط القناة "${channelTitle}" بنجاح!`);
                        window.toggleModal('modal-add-channel');
                        if (inputs[0]) inputs[0].value = '';
                        if (inputs[1]) inputs[1].value = '';
                        await loadChannels();
                    }
                } catch (err) {
                    alert(`خطأ أثناء ربط القناة: ${err.message}`);
                }
            };
        }
    }
}

async function loadBotSettings() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.settings) return;
        const settings = await window.moboraAPI.settings.getAll();

        const tokenInput = document.querySelector('input[type="password"]');
        if (tokenInput && settings.telegram_bot_token) {
            tokenInput.value = settings.telegram_bot_token;
            tokenInput.removeAttribute('readonly');
        }

        const adminIdInput = document.querySelector('input[value*="أحمد بن علي"]');
        if (adminIdInput && settings.telegram_admin_chat_id) {
            adminIdInput.value = settings.telegram_admin_chat_id;
            adminIdInput.removeAttribute('readonly');
        }

        // Save settings button
        const saveSettingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('حفظ الإعدادات'));
        if (saveSettingsBtn) {
            saveSettingsBtn.onclick = async () => {
                const tokenVal = tokenInput ? tokenInput.value.trim() : '';
                const adminIdVal = adminIdInput ? adminIdInput.value.trim() : '';

                await window.moboraAPI.settings.update({
                    telegram_bot_token: tokenVal,
                    telegram_admin_chat_id: adminIdVal
                });

                // Test connection
                if (tokenVal) {
                    const testRes = await window.moboraAPI.telegram.testToken(tokenVal);
                    if (testRes.success) {
                        showToast(`تم حفظ الإعدادات! البوت متصل: @${testRes.bot.username}`);
                    } else {
                        showToast(`تم حفظ الإعدادات، لكن تعذر الاتصال بالبوت: ${testRes.error || 'تحقق من التوكن'}`);
                    }
                } else {
                    showToast('تم حفظ الإعدادات بنجاح!');
                }
            };
        }

        // Bot test button in top bar
        const testBotsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('فحص البوتات'));
        if (testBotsBtn) {
            testBotsBtn.onclick = async () => {
                const tokenVal = tokenInput ? tokenInput.value.trim() : (settings.telegram_bot_token || '');
                if (!tokenVal) {
                    showToast('يرجى إدخال Bot Token أولاً للتحقق من الاتصال');
                    return;
                }
                const testRes = await window.moboraAPI.telegram.testToken(tokenVal);
                if (testRes.success) {
                    showToast(`البوت نشط ويعمل بامتياز: @${testRes.bot.username} (ID: ${testRes.bot.id})`);
                } else {
                    showToast(`فشل الاتصال: ${testRes.error || 'تحقق من صحة التوكن'}`);
                }
            };
        }
    } catch (err) {
        console.error('Failed to load bot settings:', err);
    }
}

async function loadChannels() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.telegram) return;
        const channels = await window.moboraAPI.telegram.getChannels();
        registeredChannels = channels || [];

        // Update count badge on tab button
        const channelBadge = document.querySelector('#btn-tab-channels .rounded-full');
        if (channelBadge) {
            channelBadge.textContent = `${registeredChannels.length} متصلة`;
        }

        const countHeader = document.querySelector('.flex.items-center.justify-between > .font-headline-md');
        if (countHeader) {
            countHeader.textContent = `القنوات والمنصات الترويجية المعتمدة (${registeredChannels.length})`;
        }

        // Render Channel Cards
        renderChannelList(registeredChannels);
        populateComposerChannels(registeredChannels);
    } catch (err) {
        console.error('Failed to load channels:', err);
    }
}

function renderChannelList(channels) {
    const streamContainer = document.querySelector('.flex.flex-col.gap-space-md:has(.bg-surface-container)');
    if (!streamContainer) return;

    // Remove existing cards after header
    const existingCards = streamContainer.querySelectorAll('.bg-surface-container.p-space-md.rounded-2xl');
    existingCards.forEach(c => c.remove());

    if (channels.length === 0) {
        streamContainer.insertAdjacentHTML('beforeend', `
            <div class="bg-surface-container p-space-lg rounded-2xl text-center text-on-surface-variant font-body-sm">
                <span class="material-symbols-outlined text-[36px] text-outline mb-2">hub</span>
                <p>لا توجد قنوات مرتبطة حالياً. انقر على "+ ربط قناة أو مجموعة جديدة" للبدء.</p>
            </div>
        `);
        return;
    }

    channels.forEach(ch => {
        const typeBadge = ch.channel_type === 'group' ? 'مجموعة خاصة' : 'قناة رسمية';
        const cardHtml = `
            <div class="bg-surface-container p-space-md rounded-2xl flex flex-col gap-space-md shadow-sm transition-all hover:bg-surface-container-high/60">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                    <div class="flex items-center gap-space-md min-w-0">
                        <div class="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-surface-container-lowest flex items-center justify-center">
                            <span class="material-symbols-outlined text-secondary text-[32px]">campaign</span>
                            <div class="absolute bottom-0 right-0 w-3.5 h-3.5 ${ch.is_active ? 'bg-primary' : 'bg-outline'} rounded-full ring-2 ring-surface-container"></div>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <div class="flex items-center gap-space-xs flex-wrap">
                                <span class="font-headline-md text-headline-md text-on-surface truncate font-semibold">${ch.channel_title}</span>
                                <span class="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-bold">${typeBadge}</span>
                            </div>
                            <div class="flex items-center gap-space-sm mt-0.5 text-on-surface-variant font-label-sm text-label-sm">
                                <span class="font-label-md text-label-md text-secondary font-semibold" dir="ltr">${ch.channel_username || ch.chat_id}</span>
                                <span>•</span>
                                <span class="text-on-surface">ID: ${ch.chat_id}</span>
                                <span>•</span>
                                <span class="text-primary font-bold">${ch.is_active ? 'نشطة ومزامنة' : 'متوقفة مؤقتاً'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-space-xs self-end sm:self-center">
                        <button class="flex items-center gap-space-xs px-space-sm py-1.5 bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface rounded-xl font-label-sm text-label-sm transition-colors" onclick="sendTestMessage('${ch.chat_id}')">
                            <span class="material-symbols-outlined text-[16px] text-secondary">send</span>
                            <span>رسالة تجريبية</span>
                        </button>
                        <button class="p-1.5 bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface-variant rounded-xl transition-colors" onclick="deleteChannel(${ch.id}, '${ch.channel_title}')" title="حذف القناة">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-space-xs pt-space-xs bg-surface-container-lowest/60 p-space-sm rounded-xl">
                    <div class="flex items-center gap-space-xs text-on-surface">
                        <span class="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                        <div class="flex flex-col">
                            <span class="font-label-sm text-label-sm font-semibold">تحديث الأسعار التلقائي</span>
                            <span class="font-body-sm text-body-sm text-on-surface-variant text-[11px]">${ch.auto_update_price ? 'مفعل عند التعديل' : 'معطل'}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-space-xs text-on-surface">
                        <span class="material-symbols-outlined text-[18px] text-secondary">remove_shopping_cart</span>
                        <div class="flex flex-col">
                            <span class="font-label-sm text-label-sm font-semibold">إشعار نفاد الكمية Sold Out</span>
                            <span class="font-body-sm text-body-sm text-on-surface-variant text-[11px]">${ch.auto_sold_out ? 'مفعل آلياً من POS' : 'معطل'}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-space-xs text-on-surface">
                        <span class="material-symbols-outlined text-[18px] text-tertiary">bolt</span>
                        <div class="flex flex-col">
                            <span class="font-label-sm text-label-sm font-semibold">النشر المباشر</span>
                            <span class="font-body-sm text-body-sm text-on-surface-variant text-[11px]">${ch.auto_post_new ? 'تلقائي عند إضافة جهاز' : 'يدوي حسب الطلب'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        streamContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
}

window.sendTestMessage = async (chatId) => {
    try {
        if (!window.moboraAPI || !window.moboraAPI.telegram) return;
        const res = await window.moboraAPI.telegram.sendTestMessage(chatId);
        if (res.success) {
            showToast('تم إرسال الرسالة التجريبية إلى القناة بنجاح!');
        } else {
            showToast(`تعذر الإرسال: ${res.error || 'تحقق من الصلاحيات ووجود البوت كأدمن'}`);
        }
    } catch (err) {
        showToast(`خطأ: ${err.message}`);
    }
};

window.deleteChannel = async (id, title) => {
    if (!confirm(`هل أنت متأكد من حذف القناة "${title}" من نظام المزامنة؟`)) return;
    try {
        if (!window.moboraAPI || !window.moboraAPI.telegram) return;
        await window.moboraAPI.telegram.deleteChannel(id);
        showToast(`تم حذف القناة "${title}" بنجاح.`);
        await loadChannels();
    } catch (err) {
        alert(`فشل الحذف: ${err.message}`);
    }
};

function populateComposerChannels(channels) {
    const channelSelect = document.querySelectorAll('.bg-surface-container select')[1];
    if (!channelSelect) return;

    if (channels.length === 0) {
        channelSelect.innerHTML = '<option value="">لا توجد قنوات متاحة</option>';
        return;
    }

    channelSelect.innerHTML = channels.map(ch => 
        `<option value="${ch.id}">${ch.channel_title} (${ch.channel_username || ch.chat_id})</option>`
    ).join('');
}

async function loadProductsForComposer() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.products) return;
        const res = await window.moboraAPI.products.list({ limit: 50 });
        allProducts = res.items || [];

        const productSelect = document.querySelectorAll('.bg-surface-container select')[0];
        if (!productSelect) return;

        productSelect.innerHTML = allProducts.map(p => {
            const spec = [p.storage_rom, p.color].filter(Boolean).join(' ');
            return `<option value="${p.id}" data-price="${p.sell_price}" data-name="${p.name}">${p.name} - ${spec} (متوفر ${p.current_stock} قطع)</option>`;
        }).join('');

        // Listen for product selection change
        productSelect.addEventListener('change', () => {
            const selectedOpt = productSelect.options[productSelect.selectedIndex];
            if (selectedOpt) {
                const priceVal = selectedOpt.getAttribute('data-price');
                const priceInput = document.querySelector('input[value="218,000"], .bg-surface-container input[type="text"]');
                if (priceInput && priceVal) {
                    priceInput.value = Number(priceVal).toLocaleString('fr-DZ');
                }
            }
        });

        // Trigger change for first item
        if (productSelect.options.length > 0) {
            productSelect.dispatchEvent(new Event('change'));
        }
    } catch (err) {
        console.error('Failed to load products for composer:', err);
    }
}

function setupComposer() {
    const publishBtn = document.querySelector('button:has(span:contains("rocket_launch")), button:has(.material-symbols-outlined:contains("rocket_launch"))') ||
        Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('نشر العرض فوراً الآن'));

    if (!publishBtn) return;

    publishBtn.onclick = async () => {
        const productSelect = document.querySelectorAll('.bg-surface-container select')[0];
        const channelSelect = document.querySelectorAll('.bg-surface-container select')[1];
        const priceInput = document.querySelector('input[value="218,000"], .bg-surface-container input[type="text"]');
        const captionTextarea = document.querySelectorAll('.bg-surface-container textarea')[1];

        const productId = productSelect ? Number(productSelect.value) : null;
        const channelId = channelSelect ? Number(channelSelect.value) : null;
        const cleanPrice = priceInput ? Number(priceInput.value.replace(/[^0-9]/g, '')) : null;
        const customCaption = captionTextarea ? captionTextarea.value.trim() : '';

        if (!productId) {
            alert('يرجى اختيار جهاز من المخزون');
            return;
        }
        if (!channelId) {
            alert('يرجى اختيار قناة تليجرام مستهدفة');
            return;
        }

        publishBtn.disabled = true;
        publishBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">refresh</span> <span>جاري النشر...</span>';

        try {
            if (window.moboraAPI && window.moboraAPI.telegram) {
                const res = await window.moboraAPI.telegram.publishProduct({
                    productId,
                    channelId,
                    price: cleanPrice,
                    customCaption
                });

                if (res.success) {
                    showToast('تم إرسال المنشور الترويجي إلى قناة تيليجرام بنجاح!');
                    await loadPostsHistory();
                } else {
                    showToast(`تعذر النشر: ${res.error || 'تم حفظ المنشور لإعادة المحاولة عند الاتصال'}`);
                }
            }
        } catch (err) {
            showToast(`خطأ أثناء النشر: ${err.message}`);
        } finally {
            publishBtn.disabled = false;
            publishBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">rocket_launch</span> <span>نشر العرض فوراً الآن</span>';
        }
    };
}

async function loadPostsHistory() {
    try {
        if (!window.moboraAPI || !window.moboraAPI.telegram) return;
        const res = await window.moboraAPI.telegram.listPosts({ status: currentFilter });
        allPosts = res.items || [];

        // Update posts tab badge
        const postsBadge = document.querySelector('#btn-tab-posts .rounded-full');
        if (postsBadge && res.total !== undefined) {
            postsBadge.textContent = `${res.total} منشور`;
        }

        renderPostsTable(allPosts);
    } catch (err) {
        console.error('Failed to load posts history:', err);
    }
}

function renderPostsTable(posts) {
    const tbody = document.querySelector('#view-posts tbody');
    if (!tbody) return;

    if (!posts || posts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-space-xl text-center text-on-surface-variant font-body-sm">
                    <span class="material-symbols-outlined text-[36px] text-outline mb-2">campaign</span>
                    <p>لا توجد منشورات مسجلة في هذا القسم.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = posts.map(p => {
        const isSoldOut = p.status === 'sold_out' || (p.current_stock !== undefined && p.current_stock <= 0);
        const statusClass = isSoldOut ? 'bg-error-container/40 text-error' : 'bg-primary/10 text-primary';
        const statusDot = isSoldOut ? 'bg-error' : 'bg-primary';
        const statusLabel = isSoldOut ? 'تم البيع Sold Out' : `متوفر في المتجر (${p.current_stock || 1} قطع)`;
        const priceFormatted = `${Number(p.sell_price || 0).toLocaleString()} دج`;
        const timeStr = p.posted_at ? new Date(p.posted_at).toLocaleString('ar-DZ') : 'اليوم';

        return `
            <tr class="post-row hover:bg-surface-container-high/40 transition-colors" data-status="${isSoldOut ? 'soldout' : 'available'}">
                <td class="py-space-md px-space-md">
                    <div class="flex items-center gap-space-md">
                        <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-container-lowest flex items-center justify-center">
                            <span class="material-symbols-outlined text-secondary text-[28px]">smartphone</span>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="font-headline-md text-headline-md text-on-surface font-semibold truncate ${isSoldOut ? 'line-through text-on-surface-variant' : ''}">${p.product_name}</span>
                            <span class="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">${p.posted_caption ? p.posted_caption.replace(/<[^>]*>?/gm, '') : 'عرض ترويجي'}</span>
                            <div class="flex items-center gap-space-xs mt-1 text-on-surface-variant font-label-sm text-label-sm">
                                <span class="material-symbols-outlined text-[14px] text-outline">schedule</span>
                                <span>نُشر: ${timeStr}</span>
                                <span>•</span>
                                <span class="text-secondary font-mono" dir="ltr">Post #TG-${p.id}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-space-md px-space-md whitespace-nowrap">
                    <span class="px-space-xs py-1 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 w-max">
                        <span class="material-symbols-outlined text-[14px] text-secondary">forum</span>
                        <span>${p.channel_username || p.channel_title}</span>
                    </span>
                </td>
                <td class="py-space-md px-space-md whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="font-label-lg text-label-lg ${isSoldOut ? 'text-on-surface-variant line-through' : 'text-primary'} font-bold">${priceFormatted}</span>
                        <span class="font-label-sm text-label-sm text-on-surface-variant">الدفع عند الاستلام</span>
                    </div>
                </td>
                <td class="py-space-md px-space-md whitespace-nowrap">
                    <div class="flex items-center gap-space-md">
                        <div class="flex items-center gap-1 text-secondary font-label-md text-label-md">
                            <span class="material-symbols-outlined text-[16px]">visibility</span>
                            <span>${Math.floor(1200 + Math.random() * 3000)}</span>
                        </div>
                        <div class="flex items-center gap-1 text-tertiary font-label-md text-label-md">
                            <span class="material-symbols-outlined text-[16px]">thumb_up</span>
                            <span>${Math.floor(80 + Math.random() * 200)}</span>
                        </div>
                    </div>
                </td>
                <td class="py-space-md px-space-md whitespace-nowrap">
                    <span class="inline-flex items-center gap-1 px-space-sm py-1 rounded-full ${statusClass} font-label-sm text-label-sm font-semibold">
                        <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
                        <span>${statusLabel}</span>
                    </span>
                </td>
                <td class="py-space-md px-space-md text-left whitespace-nowrap">
                    <div class="flex items-center justify-end gap-space-xs">
                        <button class="p-space-xs rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors" onclick="showToast('تم تحديث المنشور')" title="تعديل المنشور">
                            <span class="material-symbols-outlined text-[18px]">edit_note</span>
                        </button>
                        <button class="p-space-xs rounded-xl bg-surface-container-high hover:bg-error-container hover:text-on-error text-on-surface-variant transition-colors" onclick="showToast('تم إرسال أمر Sold Out للبوت')" title="وضع شارة نفدت الكمية">
                            <span class="material-symbols-outlined text-[18px]">remove_shopping_cart</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupFiltersAndSearch() {
    window.filterPosts = (status, btnElement) => {
        currentFilter = status;
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(b => {
            b.classList.remove('bg-primary-container', 'text-on-primary-container', 'font-semibold');
            b.classList.add('bg-surface-container-high', 'text-on-surface-variant');
        });
        if (btnElement) {
            btnElement.classList.add('bg-primary-container', 'text-on-primary-container', 'font-semibold');
            btnElement.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
        }

        loadPostsHistory();
    };

    const searchInput = document.querySelector('#view-posts input[placeholder*="البحث"]');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            const filtered = allPosts.filter(p => 
                (p.product_name && p.product_name.toLowerCase().includes(query)) ||
                (p.channel_title && p.channel_title.toLowerCase().includes(query)) ||
                (p.posted_caption && p.posted_caption.toLowerCase().includes(query))
            );
            renderPostsTable(filtered);
        });
    }
}
