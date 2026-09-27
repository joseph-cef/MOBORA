-- Mobora SQLite Database Schema
PRAGMA foreign_keys = ON;

-- ==========================================================
-- 1. الموظفون وسجل التدقيق الأمني (Employees & Audit Log)
-- ==========================================================

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    role TEXT NOT NULL CHECK(role IN ('owner', 'seller', 'technician', 'stock_keeper')),
    pin_code TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    action_type TEXT NOT NULL CHECK(action_type IN (
        'sale_created', 'sale_voided', 'price_changed', 'product_deleted',
        'stock_adjusted', 'expense_added', 'expense_deleted', 'pin_verified', 'backup_restored'
    )),
    target_entity TEXT NOT NULL,
    target_id TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    notes TEXT,
    ip_or_device TEXT DEFAULT 'Local POS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action_type);

-- ==========================================================
-- 2. الفئات والمخزون والمنتجات (Inventory & Products)
-- ==========================================================

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    icon TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    barcode TEXT UNIQUE,
    
    -- حقول الهواتف
    storage_rom TEXT,
    ram TEXT,
    color TEXT,
    device_condition TEXT CHECK(device_condition IN (
        'new_sealed', 'like_new_99', 'good_used', 'refurbished', NULL
    )),
    battery_health_percent INTEGER DEFAULT 100,
    warranty_months INTEGER DEFAULT 0,
    
    -- الأسعار والمخزون
    cost_price REAL NOT NULL DEFAULT 0.0,
    sell_price REAL NOT NULL DEFAULT 0.0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 2,
    
    -- خدمات وورشة
    is_workshop_only INTEGER NOT NULL DEFAULT 0,
    
    -- صور المنتج
    images TEXT, -- JSON Array
    
    -- تيليجرام
    is_telegram_synced INTEGER NOT NULL DEFAULT 0,
    telegram_description TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_slug) REFERENCES categories(slug)
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock);

CREATE TABLE IF NOT EXISTS product_imeis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    imei1 TEXT NOT NULL UNIQUE,
    imei2 TEXT,
    serial_number TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'sold', 'in_repair', 'returned')),
    sold_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_imeis_imei1 ON product_imeis(imei1);
CREATE INDEX IF NOT EXISTS idx_imeis_status ON product_imeis(status);

-- ==========================================================
-- 3. نقطة البيع والفواتير (POS & Sales)
-- ==========================================================

CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    cashier_id INTEGER,
    
    customer_name TEXT DEFAULT 'عميل عام / زبون المتجر',
    customer_phone TEXT,
    
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    cost_total REAL NOT NULL DEFAULT 0.0,
    profit REAL NOT NULL DEFAULT 0.0,
    
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'baridimob', 'bank', 'split')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('paid', 'partial', 'voided')),
    
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cashier_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);

CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    imei_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    unit_price REAL NOT NULL DEFAULT 0.0,
    subtotal REAL NOT NULL DEFAULT 0.0,
    warranty_months INTEGER DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (imei_id) REFERENCES product_imeis(id)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- ==========================================================
-- 4. ورشة الصيانة والإصلاحات (Repairs Workshop)
-- ==========================================================

CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT NOT NULL UNIQUE,
    
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    device_model TEXT NOT NULL,
    device_color TEXT,
    lock_code TEXT,
    imei TEXT,
    
    issue_category TEXT CHECK(issue_category IN ('screen', 'battery', 'motherboard', 'software', 'other')),
    issue_description TEXT NOT NULL,
    inspection_photos TEXT,
    
    status TEXT NOT NULL DEFAULT 'received' CHECK(status IN (
        'received', 'diagnosing', 'in_progress', 'ready', 'delivered'
    )),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal', 'urgent')),
    storage_slot TEXT,
    
    technician_id INTEGER,
    
    spare_parts_cost REAL NOT NULL DEFAULT 0.0,
    spare_parts_price REAL NOT NULL DEFAULT 0.0,
    labor_cost REAL NOT NULL DEFAULT 0.0,
    total_price REAL NOT NULL DEFAULT 0.0,
    profit REAL NOT NULL DEFAULT 0.0,
    
    warranty_days INTEGER DEFAULT 30,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid')),
    payment_method TEXT CHECK(payment_method IN ('cash', 'baridimob', 'bank')),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ready_at DATETIME,
    delivered_at DATETIME,
    FOREIGN KEY (technician_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_repairs_ticket ON repairs(ticket_number);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_phone ON repairs(customer_phone);

CREATE TABLE IF NOT EXISTS repair_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    unit_price REAL NOT NULL DEFAULT 0.0,
    is_deducted INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_repair_parts_repair ON repair_parts(repair_id);

-- ==========================================================
-- 5. الموردون وفواتير الشراء والديون (Suppliers & Purchases)
-- ==========================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    address TEXT,
    supply_type TEXT,
    total_purchases REAL NOT NULL DEFAULT 0.0,
    current_debt REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0.0,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    remaining_debt REAL NOT NULL DEFAULT 0.0,
    invoice_date DATE NOT NULL,
    invoice_image TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES supplier_purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    purchase_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'baridimob', 'bank')),
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (purchase_id) REFERENCES supplier_purchases(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_debt ON suppliers(current_debt);

-- ==========================================================
-- 6. سجل الضمان والـ IMEI (Warranties & IMEI Checker)
-- ==========================================================

CREATE TABLE IF NOT EXISTS warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imei TEXT NOT NULL UNIQUE,
    serial_number TEXT,
    product_name TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    sale_id INTEGER,
    repair_id INTEGER,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'voided')),
    coverage_details TEXT,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_warranties_imei ON warranties(imei);
CREATE INDEX IF NOT EXISTS idx_warranties_phone ON warranties(customer_phone);

-- ==========================================================
-- 7. تكامل Telegram Bot (Bot Config, Channels & Post Log)
-- ==========================================================

CREATE TABLE IF NOT EXISTS telegram_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_title TEXT NOT NULL,
    channel_username TEXT,
    chat_id TEXT NOT NULL UNIQUE,
    channel_type TEXT NOT NULL DEFAULT 'channel' CHECK(channel_type IN ('channel', 'group', 'private')),
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_post_new INTEGER NOT NULL DEFAULT 1,
    auto_update_price INTEGER NOT NULL DEFAULT 1,
    auto_sold_out INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS telegram_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    telegram_message_id INTEGER,
    posted_caption TEXT,
    status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted', 'sold_out', 'failed', 'pending_retry')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sold_out_at DATETIME,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES telegram_channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tg_product ON telegram_posts(product_id);
CREATE INDEX IF NOT EXISTS idx_tg_status ON telegram_posts(status);

-- ==========================================================
-- 8. المالية والمصاريف وحسابات السيولة (Finance & Expenses)
-- ==========================================================

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN (
        'workshop_supplies', 'bills_utilities', 'rent', 'salaries', 'other'
    )),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'baridimob', 'bank')),
    amount REAL NOT NULL,
    employee_id INTEGER,
    receipt_attachment TEXT,
    notes TEXT,
    expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ==========================================================
-- 9. إعدادات النظام والنسخ الاحتياطي (Settings & Backup)
-- ==========================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    backup_type TEXT NOT NULL CHECK(backup_type IN ('manual', 'scheduled')),
    sha256_checksum TEXT,
    status TEXT NOT NULL DEFAULT 'verified' CHECK(status IN ('verified', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
