const fs = require('fs');
const path = require('path');

let result = 'START';
try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    const row = db.prepare('SELECT 99 as val').get();
    result = 'SUCCESS: ' + JSON.stringify(row);
} catch (err) {
    result = 'ERROR: ' + err.message + '\n' + err.stack;
}

fs.writeFileSync(path.join(__dirname, 'electron_test_result.txt'), result, 'utf8');
console.log(result);

if (process.versions.electron) {
    const { app } = require('electron');
    if (app) app.quit();
}
