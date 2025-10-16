const sqlite3 = require('better-sqlite3');
const db = new sqlite3('./data/ca_office.db');

try {
  db.exec('ALTER TABLE staff ADD COLUMN primary_firm_id INTEGER DEFAULT NULL');
  console.log('✅ Column added successfully');
} catch (error) {
  if (error.message.includes('duplicate')) {
    console.log('✅ Column already exists');
  } else {
    console.error('❌ Error:', error.message);
  }
}

db.close();