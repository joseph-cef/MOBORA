// Mobora Secure ContextBridge Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moboraAPI', {
    // 1. Dashboard
    dashboard: {
        getMetrics: () => ipcRenderer.invoke('dashboard:get-metrics')
    },

    // 2. Products / Inventory
    products: {
        getCategories: () => ipcRenderer.invoke('products:get-categories'),
        list: (params) => ipcRenderer.invoke('products:list', params),
        getById: (id) => ipcRenderer.invoke('products:get-by-id', id),
        lookupCode: (code) => ipcRenderer.invoke('products:lookup-code', code),
        create: (data, employeeId) => ipcRenderer.invoke('products:create', { data, employeeId }),
        update: (id, data, employeeId) => ipcRenderer.invoke('products:update', { id, data, employeeId }),
        delete: (id, employeeId) => ipcRenderer.invoke('products:delete', { id, employeeId })
    },

    // 3. POS & Sales
    sales: {
        create: (payload) => ipcRenderer.invoke('sales:create', payload),
        list: (params) => ipcRenderer.invoke('sales:list', params),
        getByInvoice: (invoiceNumber) => ipcRenderer.invoke('sales:get-by-invoice', invoiceNumber),
        voidSale: (payload) => ipcRenderer.invoke('sales:void', payload)
    },

    // 4. Repairs Workshop
    repairs: {
        listKanban: (params) => ipcRenderer.invoke('repairs:list-kanban', params),
        getById: (id) => ipcRenderer.invoke('repairs:get-by-id', id),
        create: (data) => ipcRenderer.invoke('repairs:create', data),
        updateStatus: (payload) => ipcRenderer.invoke('repairs:update-status', payload),
        addPart: (payload) => ipcRenderer.invoke('repairs:add-part', payload),
        removePart: (partRecordId) => ipcRenderer.invoke('repairs:remove-part', partRecordId),
        completeAndPay: (payload) => ipcRenderer.invoke('repairs:complete-and-pay', payload)
    },

    // 5. Suppliers & Invoices
    suppliers: {
        list: (params) => ipcRenderer.invoke('suppliers:list', params),
        getById: (id) => ipcRenderer.invoke('suppliers:get-by-id', id),
        create: (data) => ipcRenderer.invoke('suppliers:create', data),
        update: (id, data) => ipcRenderer.invoke('suppliers:update', { id, data }),
        recordPurchase: (payload) => ipcRenderer.invoke('suppliers:record-purchase', payload),
        recordPayment: (payload) => ipcRenderer.invoke('suppliers:record-payment', payload)
    },

    // 6. Warranty & IMEI Checker
    warranty: {
        checkImei: (query) => ipcRenderer.invoke('warranty:check-imei', query),
        getStats: () => ipcRenderer.invoke('warranty:get-stats'),
        void: (payload) => ipcRenderer.invoke('warranty:void', payload),
        list: (params) => ipcRenderer.invoke('warranty:list', params)
    },

    // 7. Finance & Reports
    finance: {
        getSummary: (params) => ipcRenderer.invoke('finance:get-summary', params),
        listExpenses: (params) => ipcRenderer.invoke('expenses:list', params),
        createExpense: (data) => ipcRenderer.invoke('expenses:create', data),
        deleteExpense: (id) => ipcRenderer.invoke('expenses:delete', { id })
    },

    // 8. Employees & Audit Log
    employees: {
        list: (params) => ipcRenderer.invoke('employees:list', params),
        verifyPin: (payload) => ipcRenderer.invoke('employees:verify-pin', payload),
        create: (data) => ipcRenderer.invoke('employees:create', data),
        update: (id, data) => ipcRenderer.invoke('employees:update', { id, data }),
        listAudit: (params) => ipcRenderer.invoke('audit:list', params)
    },

    // 9. System Settings & Backup
    settings: {
        getAll: () => ipcRenderer.invoke('settings:get-all'),
        update: (settingsMap) => ipcRenderer.invoke('settings:update', settingsMap),
        createBackup: (payload) => ipcRenderer.invoke('backup:create-now', payload),
        listBackups: () => ipcRenderer.invoke('backup:list')
    },

    // 10. Telegram Bot
    telegram: {
        testToken: (token) => ipcRenderer.invoke('telegram:test-token', token),
        getChannels: () => ipcRenderer.invoke('telegram:get-channels'),
        addChannel: (data) => ipcRenderer.invoke('telegram:add-channel', data),
        deleteChannel: (id) => ipcRenderer.invoke('telegram:delete-channel', id),
        sendTestMessage: (chatId) => ipcRenderer.invoke('telegram:send-test-message', chatId),
        listPosts: (params) => ipcRenderer.invoke('telegram:list-posts', params),
        publishProduct: (payload) => ipcRenderer.invoke('telegram:publish-product', payload)
    }
});
