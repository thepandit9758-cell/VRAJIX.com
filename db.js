const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'vrajix_enquiries.sqlite');
let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      db.run(`
        CREATE TABLE IF NOT EXISTS enquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ref_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          service TEXT NOT NULL,
          budget TEXT,
          timeline TEXT,
          details TEXT NOT NULL,
          status TEXT DEFAULT 'NEW',
          timestamp TEXT NOT NULL
        )
      `, (createErr) => {
        if (createErr) return reject(createErr);
        resolve(db);
      });
    });
  });
}

function saveEnquiry(record) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO enquiries (ref_id, name, email, phone, service, budget, timeline, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [record.refId, record.name, record.email, record.phone, record.service, record.budget, record.timeline, record.details, record.timestamp];
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, ...record });
    });
  });
}

function getAllEnquiries() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM enquiries ORDER BY id DESC', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = { initDatabase, saveEnquiry, getAllEnquiries };
