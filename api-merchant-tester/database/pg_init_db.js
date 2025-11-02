const { Pool } = require('pg');
const path = require('path');

// Database configuration
// You can override these with environment variables
const dbConfig = {
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'merchant_tester',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if no connection is available
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection error:', err.message);
    console.log('💡 Make sure PostgreSQL is running and configured correctly');
    console.log('💡 Connection details:', {
      host: dbConfig.host,
      database: dbConfig.database,
      user: dbConfig.user,
      port: dbConfig.port
    });
  } else {
    console.log('✅ Connected to PostgreSQL database');
    console.log(`📊 Database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
  }
});

// Create tables
async function initializeTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Test sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        total_merchants INTEGER DEFAULT 0,
        successful_merchants INTEGER DEFAULT 0,
        flagged_merchants INTEGER DEFAULT 0,
        user_passed_merchants INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'running',
        current_merchant TEXT,
        current_url TEXT,
        notes TEXT
      )
    `);

    // Merchant test results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS merchant_test_results (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        merchant_name TEXT NOT NULL,
        merchant_url TEXT NOT NULL,
        merchant_id INTEGER,
        app_id INTEGER,
        primary_category VARCHAR(255),
        parent_category VARCHAR(255),
        max_rate VARCHAR(50),
        max_rate_kind VARCHAR(50),
        test_status VARCHAR(50) NOT NULL,
        test_result TEXT NOT NULL,
        error_pattern TEXT,
        tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        test_duration_ms INTEGER,
        is_user_passed BOOLEAN DEFAULT FALSE,
        detailed_analysis TEXT,
        screenshot_path TEXT,
        video_path TEXT,
        FOREIGN KEY (session_id) REFERENCES test_sessions (session_id) ON DELETE CASCADE
      )
    `);

    // Merchant master data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS merchant_master_data (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL,
        merchant_id INTEGER NOT NULL,
        merchant_name TEXT NOT NULL,
        merchant_domains TEXT,
        merchant_score INTEGER DEFAULT 0,
        is_featured_merchant BOOLEAN DEFAULT FALSE,
        primary_category VARCHAR(255),
        primary_category_id INTEGER,
        parent_category VARCHAR(255),
        parent_category_id INTEGER,
        max_rate VARCHAR(50),
        max_rate_kind VARCHAR(50),
        max_rate_currency VARCHAR(10),
        max_rate_ledger_id INTEGER,
        boosted BOOLEAN DEFAULT FALSE,
        max_offer_score INTEGER DEFAULT 0,
        detailed_rates TEXT,
        coupons TEXT,
        brand_color VARCHAR(50),
        text_color VARCHAR(50),
        featured_image_url TEXT,
        logo_image_exists BOOLEAN DEFAULT FALSE,
        images TEXT,
        created_date TIMESTAMP,
        modified_date TIMESTAMP,
        UNIQUE(app_id, merchant_id)
      )
    `);

    // Create indexes for better performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_merchant_test_results_session_id ON merchant_test_results (session_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_merchant_test_results_status ON merchant_test_results (test_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_merchant_test_results_tested_at ON merchant_test_results (tested_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_merchant_master_data_name ON merchant_master_data (merchant_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_merchant_master_data_category ON merchant_master_data (primary_category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_test_sessions_status ON test_sessions (status)`);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Initialize tables on startup
initializeTables().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Function to populate merchant master data
async function populateMerchantMasterData(merchantsData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO merchant_master_data (
        app_id, merchant_id, merchant_name, merchant_domains, merchant_score,
        is_featured_merchant, primary_category, primary_category_id, parent_category,
        parent_category_id, max_rate, max_rate_kind, max_rate_currency,
        max_rate_ledger_id, boosted, max_offer_score, detailed_rates, coupons,
        brand_color, text_color, featured_image_url, logo_image_exists, images,
        created_date, modified_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (app_id, merchant_id) DO UPDATE SET
        merchant_name = EXCLUDED.merchant_name,
        merchant_domains = EXCLUDED.merchant_domains,
        merchant_score = EXCLUDED.merchant_score,
        is_featured_merchant = EXCLUDED.is_featured_merchant,
        primary_category = EXCLUDED.primary_category,
        primary_category_id = EXCLUDED.primary_category_id,
        parent_category = EXCLUDED.parent_category,
        parent_category_id = EXCLUDED.parent_category_id,
        max_rate = EXCLUDED.max_rate,
        max_rate_kind = EXCLUDED.max_rate_kind,
        max_rate_currency = EXCLUDED.max_rate_currency,
        max_rate_ledger_id = EXCLUDED.max_rate_ledger_id,
        boosted = EXCLUDED.boosted,
        max_offer_score = EXCLUDED.max_offer_score,
        detailed_rates = EXCLUDED.detailed_rates,
        coupons = EXCLUDED.coupons,
        brand_color = EXCLUDED.brand_color,
        text_color = EXCLUDED.text_color,
        featured_image_url = EXCLUDED.featured_image_url,
        logo_image_exists = EXCLUDED.logo_image_exists,
        images = EXCLUDED.images,
        modified_date = EXCLUDED.modified_date
    `;

    for (const merchant of merchantsData) {
      await client.query(insertQuery, [
        parseInt(merchant.AppID) || 0,
        parseInt(merchant.MerchantID) || 0,
        merchant.MerchantName,
        JSON.stringify(merchant.MerchantDomains),
        parseInt(merchant.MerchantScore) || 0,
        merchant.IsFeaturedMerchant === true || merchant.IsFeaturedMerchant === 'true',
        merchant.PrimaryCategory,
        parseInt(merchant.PrimaryCategoryID) || null,
        merchant.ParentCategory,
        parseInt(merchant.ParentCategoryID) || null,
        merchant.MaxRate,
        merchant.MaxRateKind,
        merchant.MaxRateCurrency,
        parseInt(merchant.MaxRateLedgerID) || null,
        merchant.Boosted === true || merchant.Boosted === 'true',
        parseInt(merchant.MaxOfferScore) || 0,
        JSON.stringify(merchant.DetailedRates),
        JSON.stringify(merchant.Coupons),
        merchant.BrandColor,
        merchant.TextColor,
        merchant.FeaturedImageURL,
        merchant.LogoImageExists === true || merchant.LogoImageExists === 'true',
        JSON.stringify(merchant.Images),
        merchant.CreatedDate,
        merchant.ModifiedDate
      ]);
    }

    await client.query('COMMIT');
    console.log(`✅ Populated ${merchantsData.length} merchants in master data`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting merchant data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to create a new test session
async function createTestSession(sessionId, notes = null) {
  const result = await pool.query(
    `INSERT INTO test_sessions (session_id, notes) VALUES ($1, $2) RETURNING id`,
    [sessionId, notes]
  );
  return result.rows[0].id;
}

// Function to update test session
async function updateTestSession(sessionId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (data.completed_at !== undefined) {
    fields.push(`completed_at = $${paramIndex++}`);
    values.push(data.completed_at);
  }
  if (data.total_merchants !== undefined) {
    fields.push(`total_merchants = $${paramIndex++}`);
    values.push(data.total_merchants);
  }
  if (data.successful_merchants !== undefined) {
    fields.push(`successful_merchants = $${paramIndex++}`);
    values.push(data.successful_merchants);
  }
  if (data.flagged_merchants !== undefined) {
    fields.push(`flagged_merchants = $${paramIndex++}`);
    values.push(data.flagged_merchants);
  }
  if (data.user_passed_merchants !== undefined) {
    fields.push(`user_passed_merchants = $${paramIndex++}`);
    values.push(data.user_passed_merchants);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
    console.log(`🔄 [DB] Updating session ${sessionId} status to: ${data.status}`);
  }

  values.push(sessionId);

  const query = `UPDATE test_sessions SET ${fields.join(', ')} WHERE session_id = $${paramIndex}`;
  console.log(`📝 [DB] Executing query: ${query} with values:`, values);
  const result = await pool.query(query, values);
  console.log(`✅ [DB] Updated ${result.rowCount} row(s) for session ${sessionId}`);
  return result.rowCount;
}

// Function to save merchant test result
async function saveMerchantTestResult(data) {
  const result = await pool.query(
    `INSERT INTO merchant_test_results (
      session_id, merchant_name, merchant_url, merchant_id, app_id,
      primary_category, parent_category, max_rate, max_rate_kind,
      test_status, test_result, error_pattern, test_duration_ms,
      is_user_passed, detailed_analysis, screenshot_path, video_path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id`,
    [
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
      data.is_user_passed || false,
      data.detailed_analysis || null,
      data.screenshot_path || null,
      data.video_path || null
    ]
  );
  return result.rows[0].id;
}

// Function to get test sessions
async function getTestSessions(limit = 50) {
  const result = await pool.query(
    `SELECT * FROM test_sessions ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// Function to get merchant test results
async function getMerchantTestResults(sessionId = null, limit = 1000) {
  let query = `SELECT * FROM merchant_test_results`;
  const params = [];

  if (sessionId) {
    query += ` WHERE session_id = $1`;
    params.push(sessionId);
    query += ` ORDER BY tested_at DESC LIMIT $2`;
    params.push(limit);
  } else {
    query += ` ORDER BY tested_at DESC LIMIT $1`;
    params.push(limit);
  }

  const result = await pool.query(query, params);
  return result.rows;
}

// Function to get stats
async function getStats() {
  const sessionStats = await pool.query(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(total_merchants) as total_merchants_tested,
      SUM(successful_merchants) as total_successful,
      SUM(flagged_merchants) as total_flagged
    FROM test_sessions
  `);

  const recentActivity = await pool.query(`
    SELECT 
      session_id, 
      COUNT(*) as merchant_count,
      MAX(tested_at) as last_tested
    FROM merchant_test_results 
    GROUP BY session_id 
    ORDER BY last_tested DESC 
    LIMIT 10
  `);

  return {
    sessions: sessionStats.rows[0],
    recentActivity: recentActivity.rows
  };
}

// Function to get categories
async function getCategories() {
  const result = await pool.query(`
    SELECT DISTINCT primary_category 
    FROM merchant_master_data 
    WHERE primary_category IS NOT NULL 
    ORDER BY primary_category
  `);
  return result.rows.map(row => row.primary_category);
}

// Function to get merchant master data
async function getMerchantMasterData(filters = {}) {
  let query = `SELECT * FROM merchant_master_data WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (filters.search) {
    query += ` AND merchant_name ILIKE $${paramIndex++}`;
    params.push(`%${filters.search}%`);
  }

  if (filters.category) {
    query += ` AND primary_category = $${paramIndex++}`;
    params.push(filters.category);
  }

  if (filters.app_id) {
    query += ` AND app_id = $${paramIndex++}`;
    params.push(filters.app_id);
  }

  query += ` ORDER BY merchant_name LIMIT $${paramIndex}`;
  params.push(filters.limit || 100);

  const result = await pool.query(query, params);
  return result.rows;
}

// Function to update current merchant being tested
async function updateCurrentMerchant(sessionId, merchantName, merchantUrl) {
  await pool.query(
    `UPDATE test_sessions 
     SET current_merchant = $1, current_url = $2 
     WHERE session_id = $3`,
    [merchantName, merchantUrl, sessionId]
  );
}

// Export pool and functions
module.exports = {
  pool,
  getDatabase: () => pool,
  populateMerchantMasterData,
  createTestSession,
  updateTestSession,
  saveMerchantTestResult,
  getTestSessions,
  getMerchantTestResults,
  getStats,
  getCategories,
  getMerchantMasterData,
  updateCurrentMerchant
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('Database connection closed.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('Database connection closed.');
  process.exit(0);
});

