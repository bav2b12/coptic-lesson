const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

function ensureUploadDirectories() {
  const dataDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  ['covers', 'materials', 'assignments', 'avatars', 'exam-images'].forEach(subDir => {
    const fullPath = path.join(config.UPLOAD_DIR, subDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
}

function createConnection() {
  const newDb = new sqlite3.Database(config.DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      newDb.run('PRAGMA foreign_keys = ON');
      newDb.run('PRAGMA journal_mode = WAL');
    }
  });

  return newDb;
}

ensureUploadDirectories();

let db = createConnection();

const dbAsync = {
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  rawDb: db,

  reopen: () => {
    return new Promise((resolve, reject) => {
      if (db) {
        db.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          db = createConnection();
          dbAsync.rawDb = db;
          resolve();
        });
      } else {
        db = createConnection();
        dbAsync.rawDb = db;
        resolve();
      }
    });
  }
};

module.exports = dbAsync;
