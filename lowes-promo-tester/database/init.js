const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function initDatabase() {
  const dbPath = path.join(__dirname, 'lowes_promo_tests.db');
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err);
      throw err;
    }
    console.log('✅ Connected to SQLite database');
  });

  // Create products table
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating products table:', err);
    } else {
      console.log('✅ Products table ready');
    }
  });

  // Create test_results table
  db.run(`
    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      product_name TEXT,
      product_url TEXT,
      model TEXT,
      test_date DATE NOT NULL,
      width INTEGER,
      height INTEGER,
      color TEXT,
      original_price REAL,
      promotional_price REAL,
      promo_percentage REAL,
      screenshot_path TEXT,
      screenshot_data BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating test_results table:', err);
    } else {
      console.log('✅ Test results table ready');
    }
  });

  // Add screenshot_data column if it doesn't exist (for existing databases)
  db.run(`
    ALTER TABLE test_results ADD COLUMN screenshot_data BLOB
  `, (err) => {
    // Ignore error if column already exists
  });

  return db;
}

module.exports = { initDatabase };
