// Mobora Database Manager (better-sqlite3)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { seedDatabase } = require('./seed');

let dbInstance = null;

function getDbPath() {
    // In production Electron app, use userData directory.
    // In dev / test, use local ./data/mobora.db
    let baseDir = path.resolve(__dirname, '../../../data');
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    return path.join(baseDir, 'mobora.db');
}

function initDatabase(customPath = null) {
    if (dbInstance) {
        return dbInstance;
    }

    const dbPath = customPath || getDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    console.log(`[DB] Initializing SQLite database at: ${dbPath}`);

    dbInstance = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    // 1. Enable WAL mode for high concurrency
    dbInstance.pragma('journal_mode = WAL');
    // 2. Enforce foreign key constraints
    dbInstance.pragma('foreign_keys = ON');
    // 3. Set synchronous mode to NORMAL for WAL performance
    dbInstance.pragma('synchronous = NORMAL');

    // 4. Execute Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        dbInstance.exec(schemaSql);
        console.log('[DB] Schema executed successfully.');
    } else {
        throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    // 5. Seed initial data if empty
    seedDatabase(dbInstance);
    console.log('[DB] Database seeded and ready.');

    return dbInstance;
}

function getDb() {
    if (!dbInstance) {
        return initDatabase();
    }
    return dbInstance;
}

function closeDb() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        console.log('[DB] Database connection closed.');
    }
}

module.exports = {
    initDatabase,
    getDb,
    closeDb,
    getDbPath
};
