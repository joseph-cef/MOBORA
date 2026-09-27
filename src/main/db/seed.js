// Mobora Default Data Seeder
const fs = require('fs');
const path = require('path');

function seedDatabase(db) {
    const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (existingCategories && existingCategories.count > 0) {
        return; // Already seeded
    }

    const runSeed = db.transaction(() => {
        // 1. Categories
        const insertCategory = db.prepare(`
            INSERT INTO categories (slug, name_ar, name_en, icon)
            VALUES (@slug, @name_ar, @name_en, @icon)
        `);
        const categories = [
            { slug: 'phone', name_ar: 'هواتف ذكية', name_en: 'Smartphones', icon: 'smartphone' },
            { slug: 'accessory', name_ar: 'إكسسوارات وكوابل', name_en: 'Accessories', icon: 'cable' },
            { slug: 'spare', name_ar: 'قطع غيار وشاشات', name_en: 'Spare Parts', icon: 'display_settings' },
            { slug: 'tools', name_ar: 'أدوات صيانة', name_en: 'Workshop Tools', icon: 'build' }
        ];
        for (const cat of categories) {
            insertCategory.run(cat);
        }

        // 2. Employees
        const insertEmployee = db.prepare(`
            INSERT INTO employees (name, email, phone, role, pin_code, is_active)
            VALUES (@name, @email, @phone, @role, @pin_code, @is_active)
        `);
        const employees = [
            { name: 'أحمد بن علي', email: 'ahmed.benali@phonehub.dz', phone: '+213 550 12 34 56', role: 'owner', pin_code: '1234', is_active: 1 },
            { name: 'مراد بلقاسم', email: 'mourad.tech@phonehub.dz', phone: '+213 661 88 90 12', role: 'technician', pin_code: '2222', is_active: 1 },
            { name: 'فاطمة الزهراء', email: 'fatima.stock@phonehub.dz', phone: '+213 555 77 11 99', role: 'stock_keeper', pin_code: '3333', is_active: 1 },
            { name: 'ياسين شاشات', email: 'yacine.repairs@phonehub.dz', phone: '+213 770 44 55 66', role: 'technician', pin_code: '4444', is_active: 1 }
        ];
        for (const emp of employees) {
            insertEmployee.run(emp);
        }

        // 3. System Settings
        const insertSetting = db.prepare(`
            INSERT OR REPLACE INTO system_settings (key, value)
            VALUES (@key, @value)
        `);
        const settings = [
            { key: 'store_name_ar', value: 'محل فون إكسبريس للاتصالات' },
            { key: 'store_name_fr', value: 'PhoneHub Express Store DZ' },
            { key: 'store_address', value: 'الجزائر العاصمة - باب الزوار، حي 8 ماي 1945' },
            { key: 'store_phone', value: '+213 550 12 34 56' },
            { key: 'commercial_rc', value: '16/00-0984521 B 21' },
            { key: 'nif_nis', value: '002116098452189 / 0920162548' },
            { key: 'currency', value: 'DZD' },
            { key: 'receipt_footer', value: 'شكرًا لثقتكم بمحل PhoneHub Pro! الضمان يشمل عيوب الشاشات والقطع الأصلية لمدة 30 يومًا، ولا يشمل الصدمات أو تسرب السوائل. الاسترجاع خلال 48 ساعة بالفاتورة.' },
            { key: 'printer_type', value: '80mm' },
            { key: 'cashier_supervisor_pin', value: '8492' },
            { key: 'auto_lock_minutes', value: '15' },
            { key: 'telegram_bot_token', value: '' },
            { key: 'telegram_admin_chat_id', value: '' }
        ];
        for (const s of settings) {
            insertSetting.run(s);
        }

        // 4. Products & Stock
        const insertProduct = db.prepare(`
            INSERT INTO products (
                category_slug, name, brand, model, barcode, storage_rom, ram, color,
                device_condition, battery_health_percent, warranty_months, cost_price,
                sell_price, current_stock, min_stock_alert, is_workshop_only, is_telegram_synced
            ) VALUES (
                @category_slug, @name, @brand, @model, @barcode, @storage_rom, @ram, @color,
                @device_condition, @battery_health_percent, @warranty_months, @cost_price,
                @sell_price, @current_stock, @min_stock_alert, @is_workshop_only, @is_telegram_synced
            )
        `);

        const p1 = insertProduct.run({
            category_slug: 'phone',
            name: 'iPhone 15 Pro Max',
            brand: 'Apple',
            model: 'A3106',
            barcode: 'APL-IP15PM-256NT',
            storage_rom: '256GB',
            ram: '8GB',
            color: 'Natural Titanium',
            device_condition: 'new_sealed',
            battery_health_percent: 100,
            warranty_months: 12,
            cost_price: 198000,
            sell_price: 224000,
            current_stock: 4,
            min_stock_alert: 2,
            is_workshop_only: 0,
            is_telegram_synced: 1
        });

        const insertImei = db.prepare(`
            INSERT INTO product_imeis (product_id, imei1, imei2, serial_number, status)
            VALUES (@product_id, @imei1, @imei2, @serial_number, @status)
        `);
        insertImei.run({
            product_id: p1.lastInsertRowid,
            imei1: '354891102938471',
            imei2: '354891102938489',
            serial_number: 'FD9X192KLM8',
            status: 'available'
        });
        insertImei.run({
            product_id: p1.lastInsertRowid,
            imei1: '359128091823901',
            imei2: '359128091823902',
            serial_number: 'FD9X192KLM9',
            status: 'available'
        });

        const p2 = insertProduct.run({
            category_slug: 'phone',
            name: 'Samsung Galaxy S24 Ultra',
            brand: 'Samsung',
            model: 'SM-S928B',
            barcode: 'SAM-S24U-512GR',
            storage_rom: '512GB',
            ram: '12GB',
            color: 'Titanium Gray',
            device_condition: 'new_sealed',
            battery_health_percent: 100,
            warranty_months: 12,
            cost_price: 185000,
            sell_price: 215000,
            current_stock: 2,
            min_stock_alert: 1,
            is_workshop_only: 0,
            is_telegram_synced: 1
        });
        insertImei.run({
            product_id: p2.lastInsertRowid,
            imei1: '358920192837190',
            imei2: '358920192837191',
            serial_number: 'R58N102948F',
            status: 'available'
        });

        const p3 = insertProduct.run({
            category_slug: 'spare',
            name: 'شاشة Samsung A54 Super AMOLED Original Service Pack',
            brand: 'Samsung',
            model: 'Galaxy A54 5G',
            barcode: 'SCR-SAM-A54-ORG',
            storage_rom: null,
            ram: null,
            color: 'Black',
            device_condition: null,
            battery_health_percent: 100,
            warranty_months: 1,
            cost_price: 11500,
            sell_price: 16500,
            current_stock: 2,
            min_stock_alert: 3,
            is_workshop_only: 1,
            is_telegram_synced: 0
        });

        const p4 = insertProduct.run({
            category_slug: 'spare',
            name: 'بطارية iPhone 11 أصلية (TI Board 3110mAh)',
            brand: 'Apple',
            model: 'iPhone 11',
            barcode: 'BAT-APL-IP11-OEM',
            storage_rom: null,
            ram: null,
            color: null,
            device_condition: null,
            battery_health_percent: 100,
            warranty_months: 6,
            cost_price: 2800,
            sell_price: 5200,
            current_stock: 12,
            min_stock_alert: 5,
            is_workshop_only: 0,
            is_telegram_synced: 1
        });

        const p5 = insertProduct.run({
            category_slug: 'spare',
            name: 'Charging IC Hydra (1610A3 Original OEM)',
            brand: 'Apple',
            model: 'iPhone 13 / 13 Pro',
            barcode: 'PRT-HYD-13',
            storage_rom: null,
            ram: null,
            color: null,
            device_condition: null,
            battery_health_percent: 100,
            warranty_months: 3,
            cost_price: 3000,
            sell_price: 4500,
            current_stock: 8,
            min_stock_alert: 2,
            is_workshop_only: 1,
            is_telegram_synced: 0
        });

        const p6 = insertProduct.run({
            category_slug: 'spare',
            name: 'شريط لاصق عازل للمياه أصلي (Waterproof Adhesive Seal)',
            brand: 'Apple',
            model: 'iPhone 13 Pro',
            barcode: 'ADH-WTR-13P',
            storage_rom: null,
            ram: null,
            color: null,
            device_condition: null,
            battery_health_percent: 100,
            warranty_months: 0,
            cost_price: 400,
            sell_price: 1000,
            current_stock: 24,
            min_stock_alert: 5,
            is_workshop_only: 1,
            is_telegram_synced: 0
        });

        const p7 = insertProduct.run({
            category_slug: 'accessory',
            name: 'شاحن سريع Anker 312 Nano (20W PD Type-C)',
            brand: 'Anker',
            model: 'A2633',
            barcode: '0194644086603',
            storage_rom: null,
            ram: null,
            color: 'White',
            device_condition: 'new_sealed',
            battery_health_percent: 100,
            warranty_months: 18,
            cost_price: 2100,
            sell_price: 3200,
            current_stock: 18,
            min_stock_alert: 5,
            is_workshop_only: 0,
            is_telegram_synced: 1
        });

        const p8 = insertProduct.run({
            category_slug: 'accessory',
            name: 'سماعات AirPods Pro 2 MagSafe',
            brand: 'Apple',
            model: 'MQD83ZM/A',
            barcode: 'APL-APP2-MAG',
            storage_rom: null,
            ram: null,
            color: 'White',
            device_condition: 'new_sealed',
            battery_health_percent: 100,
            warranty_months: 12,
            cost_price: 28000,
            sell_price: 36000,
            current_stock: 7,
            min_stock_alert: 2,
            is_workshop_only: 0,
            is_telegram_synced: 1
        });

        const p9 = insertProduct.run({
            category_slug: 'accessory',
            name: 'كابل Baseus 100W Braided Type-C (2m)',
            brand: 'Baseus',
            model: 'CATJK-D01',
            barcode: 'BAS-100W-2M',
            storage_rom: null,
            ram: null,
            color: 'Black',
            device_condition: 'new_sealed',
            battery_health_percent: 100,
            warranty_months: 6,
            cost_price: 700,
            sell_price: 1200,
            current_stock: 32,
            min_stock_alert: 10,
            is_workshop_only: 0,
            is_telegram_synced: 0
        });

        const p10 = insertProduct.run({
            category_slug: 'accessory',
            name: 'حماية شاشة 9D زجاجية لجميع الموديلات',
            brand: 'Universal',
            model: 'Tempered Glass 9D',
            barcode: 'GLS-9D-UNIV',
            storage_rom: null,
            ram: null,
            color: 'Clear',
            device_condition: null,
            battery_health_percent: 100,
            warranty_months: 0,
            cost_price: 150,
            sell_price: 500,
            current_stock: 140,
            min_stock_alert: 20,
            is_workshop_only: 0,
            is_telegram_synced: 0
        });

        // 5. Suppliers
        const insertSupplier = db.prepare(`
            INSERT INTO suppliers (code, company_name, contact_person, phone, whatsapp, address, supply_type, total_purchases, current_debt, notes)
            VALUES (@code, @company_name, @contact_person, @phone, @whatsapp, @address, @supply_type, @total_purchases, @current_debt, @notes)
        `);
        insertSupplier.run({
            code: 'SUP-014',
            company_name: 'العالمية لقطع الغيار الأصلية',
            contact_person: 'سفيان رحماني',
            phone: '0550 12 34 89',
            whatsapp: '0550123489',
            address: 'العلمة - سطيف',
            supply_type: 'شاشات وبطاريات فك',
            total_purchases: 1980000,
            current_debt: 470000,
            notes: 'مورد موثوق لقطع الغيار الأصلية والشاشات'
        });
        insertSupplier.run({
            code: 'SUP-002',
            company_name: 'مؤسسة الشروق لتوزيع الهواتف',
            contact_person: 'طارق بوخميس',
            phone: '0661 88 92 10',
            whatsapp: '0661889210',
            address: 'بلفور - الحراش (الجزائر)',
            supply_type: 'هواتف رسمية (علب جديدة)',
            total_purchases: 12450000,
            current_debt: 620000,
            notes: 'وكيل معتمد وموزع جملة'
        });
        insertSupplier.run({
            code: 'SUP-005',
            company_name: 'كينغ فون للاستيراد وتوريد الآيفون',
            contact_person: 'حميد كينغ',
            phone: '+971 50 234 991',
            whatsapp: '+97150234991',
            address: 'دبي (سوق ديرة) / بلفور',
            supply_type: 'آيفون مجدد كأنه جديد CPO',
            total_purchases: 6120000,
            current_debt: 150000,
            notes: 'أجهزة مستوردة كابة ممتازة'
        });
        insertSupplier.run({
            code: 'SUP-008',
            company_name: 'الأندلس للبطاريات ومعدات الصيانة',
            contact_person: 'عادل الأندلسي',
            phone: '0560 77 12 04',
            whatsapp: '0560771204',
            address: 'بئر خادم - الجزائر',
            supply_type: 'أجهزة فحص، كوايات، بطاريات',
            total_purchases: 520000,
            current_debt: 0,
            notes: 'مسدد بالكامل'
        });

        // 6. Repairs Initial Tickets
        const insertRepair = db.prepare(`
            INSERT INTO repairs (
                ticket_number, customer_name, customer_phone, device_model, device_color,
                lock_code, imei, issue_category, issue_description, status, priority,
                storage_slot, technician_id, spare_parts_cost, spare_parts_price,
                labor_cost, total_price, profit, warranty_days, payment_status, payment_method
            ) VALUES (
                @ticket_number, @customer_name, @customer_phone, @device_model, @device_color,
                @lock_code, @imei, @issue_category, @issue_description, @status, @priority,
                @storage_slot, @technician_id, @spare_parts_cost, @spare_parts_price,
                @labor_cost, @total_price, @profit, @warranty_days, @payment_status, @payment_method
            )
        `);

        // REP-2049 (Received)
        insertRepair.run({
            ticket_number: 'REP-2049',
            customer_name: 'سمير دحمان',
            customer_phone: '0552489130',
            device_model: 'iPhone 14 Pro Max',
            device_color: 'Deep Purple',
            lock_code: '1472',
            imei: '359128091823901',
            issue_category: 'screen',
            issue_description: 'شاشة مطفأة تماماً بعد السقوط، الاهتزاز يعمل',
            status: 'received',
            priority: 'urgent',
            storage_slot: 'صندوق الاستلام 1',
            technician_id: 2,
            spare_parts_cost: 26000,
            spare_parts_price: 30000,
            labor_cost: 4000,
            total_price: 34000,
            profit: 8000,
            warranty_days: 30,
            payment_status: 'unpaid',
            payment_method: null
        });

        // REP-2048 (Diagnosing)
        insertRepair.run({
            ticket_number: 'REP-2048',
            customer_name: 'صارة مهدي',
            customer_phone: '0770987654',
            device_model: 'iPad Air 5 (M1)',
            device_color: 'Space Gray',
            lock_code: '0000',
            imei: '354891102938499',
            issue_category: 'motherboard',
            issue_description: 'تعرض للسوائل + توقف الإضاءة وتفريغ شحن سريع',
            status: 'diagnosing',
            priority: 'normal',
            storage_slot: 'طاولة التشخيص 2',
            technician_id: 2,
            spare_parts_cost: 11000,
            spare_parts_price: 13500,
            labor_cost: 5000,
            total_price: 18500,
            profit: 7500,
            warranty_days: 30,
            payment_status: 'unpaid',
            payment_method: null
        });

        // REP-2041 (In Progress)
        const rep2041 = insertRepair.run({
            ticket_number: 'REP-2041',
            customer_name: 'وليد سيدي عيسى',
            customer_phone: '0552 48 91 30',
            device_model: 'Apple iPhone 13 Pro',
            device_color: 'Sierra Blue / 256GB',
            lock_code: '2580',
            imei: '356789114258901',
            issue_category: 'motherboard',
            issue_description: 'حرارة مرتفعة وعدم الاستجابة للشحن السريع',
            status: 'in_progress',
            priority: 'urgent',
            storage_slot: 'ورشة مجهر 1',
            technician_id: 2,
            spare_parts_cost: 3400,
            spare_parts_price: 5500,
            labor_cost: 4500,
            total_price: 10000,
            profit: 6600,
            warranty_days: 30,
            payment_status: 'unpaid',
            payment_method: null
        });

        // Add repair parts for REP-2041
        const insertRepairPart = db.prepare(`
            INSERT INTO repair_parts (repair_id, product_id, quantity, unit_cost, unit_price, is_deducted)
            VALUES (@repair_id, @product_id, @quantity, @unit_cost, @unit_price, @is_deducted)
        `);
        insertRepairPart.run({
            repair_id: rep2041.lastInsertRowid,
            product_id: p5.lastInsertRowid,
            quantity: 1,
            unit_cost: 3000,
            unit_price: 4500,
            is_deducted: 1
        });
        insertRepairPart.run({
            repair_id: rep2041.lastInsertRowid,
            product_id: p6.lastInsertRowid,
            quantity: 1,
            unit_cost: 400,
            unit_price: 1000,
            is_deducted: 1
        });

        // REP-2032 (Ready)
        insertRepair.run({
            ticket_number: 'REP-2032',
            customer_name: 'حنان دراجي',
            customer_phone: '0661223344',
            device_model: 'Honor X9a 5G',
            device_color: 'Emerald Green',
            lock_code: '3366',
            imei: '864501062991024',
            issue_category: 'battery',
            issue_description: 'إصلاح مسار الشحن السريع 40W وتغيير منفذ Type-C',
            status: 'ready',
            priority: 'normal',
            storage_slot: 'خزانة A-12',
            technician_id: 4,
            spare_parts_cost: 1500,
            spare_parts_price: 2500,
            labor_cost: 2000,
            total_price: 4500,
            profit: 3000,
            warranty_days: 30,
            payment_status: 'unpaid',
            payment_method: null
        });

        // REP-2028 (Delivered)
        insertRepair.run({
            ticket_number: 'REP-2028',
            customer_name: 'سفيان بوجلال',
            customer_phone: '0550112233',
            device_model: 'iPhone 13',
            device_color: 'Midnight',
            lock_code: '1212',
            imei: '354891102999999',
            issue_category: 'screen',
            issue_description: 'استبدال كاميرا خلفية أصلية',
            status: 'delivered',
            priority: 'normal',
            storage_slot: 'مكتمل ومسلم',
            technician_id: 2,
            spare_parts_cost: 10000,
            spare_parts_price: 13000,
            labor_cost: 3000,
            total_price: 16000,
            profit: 6000,
            warranty_days: 30,
            payment_status: 'paid',
            payment_method: 'cash'
        });

        // 7. Initial Telegram Channels
        const insertChannel = db.prepare(`
            INSERT INTO telegram_channels (channel_title, channel_username, chat_id, channel_type, is_active, auto_post_new, auto_update_price, auto_sold_out)
            VALUES (@channel_title, @channel_username, @chat_id, @channel_type, @is_active, @auto_post_new, @auto_update_price, @auto_sold_out)
        `);
        insertChannel.run({
            channel_title: 'عروض PhoneHub الجزائر الرسمية (باب الزوار)',
            channel_username: '@PhoneHub_DZ',
            chat_id: '-1001928374921',
            channel_type: 'channel',
            is_active: 1,
            auto_post_new: 1,
            auto_update_price: 1,
            auto_sold_out: 1
        });
        insertChannel.run({
            channel_title: 'عروض هواتف كابة ومستعملة VIP (ضمان 3 أشهر)',
            channel_username: '@PhoneHub_Kaba_VIP',
            chat_id: '-1002019485721',
            channel_type: 'channel',
            is_active: 1,
            auto_post_new: 1,
            auto_update_price: 1,
            auto_sold_out: 1
        });

        // 8. Initial Expenses
        const insertExpense = db.prepare(`
            INSERT INTO expenses (expense_code, title, category, payment_method, amount, employee_id, notes)
            VALUES (@expense_code, @title, @category, @payment_method, @amount, @employee_id, @notes)
        `);
        insertExpense.run({
            expense_code: 'EXP-2024-089',
            title: 'شراء مفكات احترافية + قصدير لحام + مادة تنظيف الفلكس (Flux)',
            category: 'workshop_supplies',
            payment_method: 'cash',
            amount: 14500,
            employee_id: 2,
            notes: 'تجديد مستلزمات طاولة الصيانة'
        });
        insertExpense.run({
            expense_code: 'EXP-2024-088',
            title: 'فاتورة اشتراك الإنترنت فايبر (اتصالات الجزائر 500Mbps)',
            category: 'bills_utilities',
            payment_method: 'baridimob',
            amount: 12000,
            employee_id: 1,
            notes: 'اشتراك شهري للمحل'
        });

        // 9. Initial Audit Log Entry
        const insertAudit = db.prepare(`
            INSERT INTO audit_logs (employee_id, action_type, target_entity, target_id, old_values, new_values, notes)
            VALUES (@employee_id, @action_type, @target_entity, @target_id, @old_values, @new_values, @notes)
        `);
        insertAudit.run({
            employee_id: 1,
            action_type: 'pin_verified',
            target_entity: 'system',
            target_id: 'SYSTEM_INIT',
            old_values: null,
            new_values: JSON.stringify({ status: 'initialized' }),
            notes: 'تهيئة أولية لقاعدة بيانات نظام Mobora OS'
        });
    });

    runSeed();
}

module.exports = { seedDatabase };
