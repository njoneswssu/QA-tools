const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database directory if it doesn't exist
const fs = require('fs');
const dbDir = path.dirname(__filename);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(__dirname, 'merchant_tests.db');

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tables
db.serialize(() => {
  // Test sessions table
  db.run(`CREATE TABLE IF NOT EXISTS test_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_merchants INTEGER DEFAULT 0,
    successful_merchants INTEGER DEFAULT 0,
    flagged_merchants INTEGER DEFAULT 0,
    user_passed_merchants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running', -- running, completed, interrupted
    current_merchant TEXT, -- currently testing merchant name
    current_url TEXT, -- currently testing merchant URL
    notes TEXT
  )`);

  // Merchant test results table
  db.run(`CREATE TABLE IF NOT EXISTS merchant_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    merchant_url TEXT NOT NULL,
    merchant_id INTEGER, -- from the provided JSON data
    app_id INTEGER, -- from the provided JSON data
    primary_category TEXT,
    parent_category TEXT,
    max_rate TEXT,
    max_rate_kind TEXT,
    test_status TEXT NOT NULL, -- success, flagged, user_passed
    test_result TEXT NOT NULL, -- detailed reason/analysis
    error_pattern TEXT, -- for flagged merchants
    tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    test_duration_ms INTEGER,
    is_user_passed BOOLEAN DEFAULT 0,
    detailed_analysis TEXT, -- enhanced description
    screenshot_path TEXT, -- path to screenshot file
    video_path TEXT, -- path to video file
    FOREIGN KEY (session_id) REFERENCES test_sessions (session_id)
  )`);

  // Merchant master data table (from the provided JSON)
  db.run(`CREATE TABLE IF NOT EXISTS merchant_master_data (
    id INTEGER PRIMARY KEY,
    app_id INTEGER NOT NULL,
    merchant_id INTEGER NOT NULL,
    merchant_name TEXT NOT NULL,
    merchant_domains TEXT, -- JSON array as string
    merchant_score INTEGER DEFAULT 0,
    is_featured_merchant BOOLEAN DEFAULT 0,
    primary_category TEXT,
    primary_category_id INTEGER,
    parent_category TEXT,
    parent_category_id INTEGER,
    max_rate TEXT,
    max_rate_kind TEXT,
    max_rate_currency TEXT,
    max_rate_ledger_id INTEGER,
    boosted BOOLEAN DEFAULT 0,
    max_offer_score INTEGER DEFAULT 0,
    detailed_rates TEXT, -- JSON as string
    coupons TEXT, -- JSON as string
    brand_color TEXT,
    text_color TEXT,
    featured_image_url TEXT,
    logo_image_exists BOOLEAN DEFAULT 0,
    images TEXT, -- JSON as string
    created_date DATETIME,
    modified_date DATETIME,
    UNIQUE(app_id, merchant_id)
  )`);

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchant_test_results_session_id ON merchant_test_results (session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchant_test_results_status ON merchant_test_results (test_status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchant_test_results_tested_at ON merchant_test_results (tested_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchant_master_data_name ON merchant_master_data (merchant_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchant_master_data_category ON merchant_master_data (primary_category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_merchant_master_data_domains ON merchant_master_data (merchant_domains)`);

  // Add new columns to existing test_sessions table (for backwards compatibility)
  db.run(`ALTER TABLE test_sessions ADD COLUMN current_merchant TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding current_merchant column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE test_sessions ADD COLUMN current_url TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding current_url column:', err.message);
    }
  });

  // Add media file columns to existing merchant_test_results table
  db.run(`ALTER TABLE merchant_test_results ADD COLUMN screenshot_path TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding screenshot_path column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE merchant_test_results ADD COLUMN video_path TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding video_path column:', err.message);
    }
  });

  console.log('Database tables created successfully');
});

// Function to populate merchant master data
function populateMerchantMasterData(merchantsData) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT OR REPLACE INTO merchant_master_data (
      app_id, merchant_id, merchant_name, merchant_domains, merchant_score,
      is_featured_merchant, primary_category, primary_category_id, parent_category,
      parent_category_id, max_rate, max_rate_kind, max_rate_currency,
      max_rate_ledger_id, boosted, max_offer_score, detailed_rates, coupons,
      brand_color, text_color, featured_image_url, logo_image_exists, images,
      created_date, modified_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let processed = 0;
    const total = merchantsData.length;

    merchantsData.forEach((merchant) => {
      stmt.run([
        merchant.AppID,
        merchant.MerchantID,
        merchant.MerchantName,
        JSON.stringify(merchant.MerchantDomains),
        merchant.MerchantScore,
        merchant.IsFeaturedMerchant ? 1 : 0,
        merchant.PrimaryCategory,
        merchant.PrimaryCategoryID,
        merchant.ParentCategory,
        merchant.ParentCategoryID,
        merchant.MaxRate,
        merchant.MaxRateKind,
        merchant.MaxRateCurrency,
        merchant.MaxRateLedgerID,
        merchant.Boosted ? 1 : 0,
        merchant.MaxOfferScore,
        JSON.stringify(merchant.DetailedRates),
        JSON.stringify(merchant.Coupons),
        merchant.BrandColor,
        merchant.TextColor,
        merchant.FeaturedImageURL,
        merchant.LogoImageExists ? 1 : 0,
        JSON.stringify(merchant.Images),
        merchant.CreatedDate,
        merchant.ModifiedDate
      ], (err) => {
        if (err) {
          console.error('Error inserting merchant data:', err);
        }
        processed++;
        if (processed === total) {
          stmt.finalize();
          console.log(`Populated ${total} merchants in master data`);
          resolve();
        }
      });
    });
  });
}

// Function to create a new test session
function createTestSession(sessionId, notes = null) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO test_sessions (session_id, notes) VALUES (?, ?)`, 
      [sessionId, notes], 
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// Function to update test session
function updateTestSession(sessionId, data) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    
    if (data.completed_at !== undefined) {
      fields.push('completed_at = ?');
      values.push(data.completed_at);
    }
    if (data.total_merchants !== undefined) {
      fields.push('total_merchants = ?');
      values.push(data.total_merchants);
    }
    if (data.successful_merchants !== undefined) {
      fields.push('successful_merchants = ?');
      values.push(data.successful_merchants);
    }
    if (data.flagged_merchants !== undefined) {
      fields.push('flagged_merchants = ?');
      values.push(data.flagged_merchants);
    }
    if (data.user_passed_merchants !== undefined) {
      fields.push('user_passed_merchants = ?');
      values.push(data.user_passed_merchants);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    values.push(sessionId);

    db.run(`UPDATE test_sessions SET ${fields.join(', ')} WHERE session_id = ?`, 
      values, 
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

// Function to save merchant test result
function saveMerchantTestResult(data) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO merchant_test_results (
      session_id, merchant_name, merchant_url, merchant_id, app_id,
      primary_category, parent_category, max_rate, max_rate_kind,
      test_status, test_result, error_pattern, test_duration_ms,
      is_user_passed, detailed_analysis, screenshot_path, video_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      data.session_id,
      data.merchant_name,
      data.merchant_url,
      data.merchant_id || null,
      data.app_id || null,
      data.primary_category || null,
      data.parent_category || null,
      data.max_rate || null,
      data.max_rate_kind || null,
      data.test_status,
      data.test_result,
      data.error_pattern || null,
      data.test_duration_ms || null,
      data.is_user_passed ? 1 : 0,
      data.detailed_analysis || null,
      data.screenshot_path || null,
      data.video_path || null
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Function to get test sessions
function getTestSessions(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT ?`, 
      [limit], 
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Function to get merchant test results
function getMerchantTestResults(sessionId = null, limit = 1000) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM merchant_test_results`;
    let params = [];
    
    if (sessionId) {
      query += ` WHERE session_id = ?`;
      params.push(sessionId);
    }
    
    query += ` ORDER BY tested_at DESC LIMIT ?`;
    params.push(limit);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Function to get stats
function getStats() {
  return new Promise((resolve, reject) => {
    const stats = {};
    
    // Get session stats
    db.get(`SELECT 
      COUNT(*) as total_sessions,
      SUM(total_merchants) as total_merchants_tested,
      SUM(successful_merchants) as total_successful,
      SUM(flagged_merchants) as total_flagged
    FROM test_sessions`, (err, sessionStats) => {
      if (err) {
        reject(err);
        return;
      }
      
      stats.sessions = sessionStats;
      
      // Get recent activity
      db.all(`SELECT 
        session_id, 
        COUNT(*) as merchant_count,
        MAX(tested_at) as last_tested
      FROM merchant_test_results 
      GROUP BY session_id 
      ORDER BY last_tested DESC 
      LIMIT 10`, (err, recentActivity) => {
        if (err) {
          reject(err);
          return;
        }
        
        stats.recentActivity = recentActivity;
        resolve(stats);
      });
    });
  });
}

// Function to get categories
function getCategories() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT DISTINCT primary_category 
            FROM merchant_master_data 
            WHERE primary_category IS NOT NULL 
            ORDER BY primary_category`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(row => row.primary_category));
      }
    });
  });
}

// Function to get merchant master data
function getMerchantMasterData(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM merchant_master_data WHERE 1=1`;
    let params = [];
    
    if (filters.search) {
      query += ` AND merchant_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }
    
    if (filters.category) {
      query += ` AND primary_category = ?`;
      params.push(filters.category);
    }
    
    if (filters.app_id) {
      query += ` AND app_id = ?`;
      params.push(filters.app_id);
    }
    
    query += ` ORDER BY merchant_name LIMIT ?`;
    params.push(filters.limit || 100);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Function to get database instance
function getDatabase() {
  return db;
}

// Function to update current merchant being tested
function updateCurrentMerchant(sessionId, merchantName, merchantUrl) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE test_sessions 
       SET current_merchant = ?, current_url = ? 
       WHERE session_id = ?`,
      [merchantName, merchantUrl, sessionId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Export database and functions
module.exports = {
  db,
  getDatabase,
  populateMerchantMasterData,
  createTestSession,
  updateTestSession,
  saveMerchantTestResult,
  getTestSessions,
  getMerchantTestResults,
  getStats,
  getCategories,
  getMerchantMasterData,
  updateCurrentMerchant,
  dbPath
};

// Close database connection on process exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});
