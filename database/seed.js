const fs = require('fs');
const path = require('path');
const db = require('./db');

const DB_FILE_PATH = path.join(__dirname, '..', 'data', 'coptic_lms.db');

async function resetDatabaseIfNeeded() {
  if (!fs.existsSync(DB_FILE_PATH)) {
    return;
  }

  try {
    const tableRows = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const userCountRow = await db.get('SELECT COUNT(*) as count FROM users').catch(() => ({ count: 0 }));
    const mediosCountRow = await db.get('SELECT COUNT(*) as count FROM medios').catch(() => ({ count: 0 }));
    const hasData = userCountRow.count > 0 || mediosCountRow.count > 0 || tableRows.length > 0;

    if (!hasData) {
      return;
    }

    await new Promise((resolve, reject) => {
      db.rawDb.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    for (const extraFile of ['coptic_lms.db-wal', 'coptic_lms.db-shm']) {
      const extraPath = path.join(__dirname, '..', 'data', extraFile);
      if (fs.existsSync(extraPath)) {
        fs.unlinkSync(extraPath);
      }
    }

    if (fs.existsSync(DB_FILE_PATH)) {
      fs.unlinkSync(DB_FILE_PATH);
    }

    console.log('Clean database reset: previous platform data removed to enforce an empty startup state.');
  } catch (error) {
    console.warn('Database reset check failed:', error.message);
  }
}

// The 13 Medios — educational classification system for access codes
const MEDIOS_LIST = [
  { name: 'Medios 1',  name_ar: 'ميديوس 1',  order_index: 1 },
  { name: 'Medios 2',  name_ar: 'ميديوس 2',  order_index: 2 },
  { name: 'Medios 3',  name_ar: 'ميديوس 3',  order_index: 3 },
  { name: 'Medios 4',  name_ar: 'ميديوس 4',  order_index: 4 },
  { name: 'Medios 5',  name_ar: 'ميديوس 5',  order_index: 5 },
  { name: 'Medios 6',  name_ar: 'ميديوس 6',  order_index: 6 },
  { name: 'Medios 7',  name_ar: 'ميديوس 7',  order_index: 7 },
  { name: 'Medios 8',  name_ar: 'ميديوس 8',  order_index: 8 },
  { name: 'Medios 9',  name_ar: 'ميديوس 9',  order_index: 9 },
  { name: 'Medios 10', name_ar: 'ميديوس 10', order_index: 10 },
  { name: 'Medios 11', name_ar: 'ميديوس 11', order_index: 11 },
  { name: 'Medios 12', name_ar: 'ميديوس 12', order_index: 12 },
  { name: 'Medios 13', name_ar: 'ميديوس 13', order_index: 13 },
];

async function seedDatabase() {
  try {
    // Apply schema (CREATE IF NOT EXISTS — safe to run multiple times)
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.exec(schemaSql);

    // Seed the 13 Medios (only if not already present)
    const mediosCount = await db.get('SELECT COUNT(*) as count FROM medios');
    if (mediosCount.count === 0) {
      console.log('Seeding 13 Medios...');
      for (const m of MEDIOS_LIST) {
        await db.run(
          'INSERT INTO medios (name, name_ar, order_index) VALUES (?, ?, ?)',
          [m.name, m.name_ar, m.order_index]
        );
      }
      console.log('13 Medios seeded successfully.');
    }

    // Seed minimal platform settings (only if not already present)
    const settingsCount = await db.get('SELECT COUNT(*) as count FROM platform_settings');
    if (settingsCount.count === 0) {
      console.log('Seeding platform settings...');
      const defaultSettings = [
        ['platform_name', 'Doros Coptic'],
        ['platform_name_ar', 'دروس قبطي'],
        ['platform_tagline', 'Learn the Coptic Language with Modern Interactive Lessons'],
        ['platform_tagline_ar', 'منصة متكاملة لتعليم اللغة القبطية بأحدث الأساليب التفاعلية'],
        ['primary_color', '#1d4ed8'],
        ['secondary_color', '#6d28d9'],
        ['accent_gold', '#f59e0b'],
        ['default_language', 'ar'],
        ['contact_phone', ''],
        ['contact_email', ''],
        ['min_password_length', '6']
      ];

      for (const [key, value] of defaultSettings) {
        await db.run(
          'INSERT OR REPLACE INTO platform_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [key, value]
        );
      }
      console.log('Platform settings seeded.');
    }

    console.log('Database initialization complete. Platform is ready for first administrator setup.');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = { seedDatabase };
