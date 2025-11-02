// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Database selection based on environment variable
// Set USE_POSTGRES=true to use PostgreSQL, otherwise falls back to SQLite
const USE_POSTGRES = process.env.USE_POSTGRES === 'true' || process.env.PGDATABASE;

let dbModule;
if (USE_POSTGRES) {
    console.log('🐘 Using PostgreSQL database');
    dbModule = require('./database/pg_init_db');
} else {
    console.log('📦 Using SQLite database (set USE_POSTGRES=true or configure PGDATABASE to use PostgreSQL)');
    dbModule = require('./database/init_db');
}

const { createTestSession, updateTestSession, saveMerchantTestResult } = dbModule;
const db = dbModule.pool || dbModule.db; // pool for PostgreSQL, db for SQLite
const APITestRunner = require('./api-test-runner');

const app = express();
const PORT = process.env.PORT || 3000;

// Track running test instances by session ID
const runningTests = new Map(); // sessionId -> { runner: APITestRunner, cancel: Function }

// Merchant cache system for instant loading
let merchantCache = {
    data: null,
    lastUpdated: null,
    isLoading: false
};

// Cache refresh interval (5 minutes)
const CACHE_REFRESH_INTERVAL = 5 * 60 * 1000;

// Load merchants into cache
async function loadMerchantsIntoCache() {
    if (merchantCache.isLoading) {
        console.log('🔄 Merchant cache is already loading, skipping...');
        return;
    }
    
    merchantCache.isLoading = true;
    console.log('📦 Loading merchants into cache...');
    
    try {
        const query = 'SELECT * FROM merchant_master_data ORDER BY merchant_name LIMIT 50000';
        const merchants = await queryAll(query, []);
        
        // Convert to API format
        const apiFormat = merchants.map(merchant => {
            const safeJsonParse = (jsonString, fallback = []) => {
                try {
                    return JSON.parse(jsonString || JSON.stringify(fallback));
                } catch (error) {
                    return fallback;
                }
            };
            
            return {
                AppID: merchant.app_id,
                MerchantID: merchant.merchant_id,
                MerchantName: merchant.merchant_name,
                MerchantDomains: safeJsonParse(merchant.merchant_domains, []),
                MerchantScore: merchant.merchant_score,
                IsFeaturedMerchant: merchant.is_featured_merchant === 1 || merchant.is_featured_merchant === true,
                PrimaryCategory: merchant.primary_category,
                PrimaryCategoryID: merchant.primary_category_id,
                ParentCategory: merchant.parent_category,
                ParentCategoryID: merchant.parent_category_id,
                MaxRate: merchant.max_rate,
                MaxRateKind: merchant.max_rate_kind,
                MaxRateCurrency: merchant.max_rate_currency,
                MaxRateLedgerID: merchant.max_rate_ledger_id,
                Boosted: merchant.boosted === 1 || merchant.boosted === true,
                MaxOfferScore: merchant.max_offer_score,
                DetailedRates: safeJsonParse(merchant.detailed_rates, []),
                Coupons: safeJsonParse(merchant.coupons, []),
                BrandColor: merchant.brand_color,
                TextColor: merchant.text_color,
                FeaturedImageURL: merchant.featured_image_url,
                LogoImageExists: merchant.logo_image_exists === 1 || merchant.logo_image_exists === true,
                Images: safeJsonParse(merchant.images, []),
                CreatedDate: merchant.created_date,
                ModifiedDate: merchant.modified_date
            };
        });
        
        merchantCache.data = apiFormat;
        merchantCache.lastUpdated = new Date();
        merchantCache.isLoading = false;
        
        console.log(`✅ Loaded ${apiFormat.length} merchants into cache`);
    } catch (error) {
        console.error('❌ Error loading merchants into cache:', error);
        merchantCache.isLoading = false;
    }
}

// Database query helpers that work with both PostgreSQL and SQLite
async function queryAll(query, params = []) {
    if (USE_POSTGRES) {
        const result = await db.query(query, params);
        return result.rows;
    } else {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

async function queryOne(query, params = []) {
    if (USE_POSTGRES) {
        const result = await db.query(query, params);
        return result.rows[0];
    } else {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function queryRun(query, params = []) {
    if (USE_POSTGRES) {
        const result = await db.query(query, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.run(query, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes, lastID: this.lastID });
            });
        });
    }
}

// Middleware
// Global request logger to debug missing PUT requests
app.use((req, res, next) => {
    if (req.method === 'PUT' && req.url.includes('/api/sessions')) {
        console.error(`🚨🚨🚨 GLOBAL MIDDLEWARE - ${req.method} ${req.url} 🚨🚨🚨`);
        console.error('🚨 Body:', JSON.stringify(req.body));
    }
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large merchant datasets
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/tester', express.static(__dirname));
// Serve media files (screenshots and videos)
app.use('/media', express.static(path.join(__dirname, 'media')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Serve the merchant tester UI
app.get('/tester', (req, res) => {
    res.sendFile(path.join(__dirname, 'merchant-tester.html'));
});

// API Routes

// Get all merchant test results
app.get('/api/merchant-results', async (req, res) => {
    try {
        const {
            session_id,
            status,
            category,
            search,
            date_from,
            date_to,
            page = 1,
            limit = 50
        } = req.query;

        let params = [];
        let paramIndex = 1;
        
        // Build a simple, guaranteed-deduplication query
        let query;
        
        if (USE_POSTGRES) {
            // PostgreSQL: Simple DISTINCT ON approach
            query = `
                SELECT DISTINCT ON (mtr.merchant_id)
                    mtr.id,
                    mtr.session_id,
                    mtr.merchant_id,
                    mtr.merchant_name,
                    mtr.merchant_url,
                    mtr.app_id,
                    mtr.test_status,
                    mtr.test_result,
                    mtr.test_duration_ms,
                    mtr.is_user_passed,
                    mtr.screenshot_path,
                    mtr.video_path,
                    mtr.tested_at,
                    mmd.primary_category,
                    mmd.parent_category,
                    mmd.max_rate,
                    mmd.max_rate_kind
                FROM merchant_test_results mtr
                LEFT JOIN merchant_master_data mmd ON mtr.merchant_id = mmd.merchant_id
                WHERE 1=1
            `;
            
            // Apply all filters
            if (session_id) {
                query += ` AND mtr.session_id = $${paramIndex++}`;
                params.push(session_id);
            }
            if (status) {
                if (status === 'user_passed') {
                    query += ` AND mtr.is_user_passed = TRUE`;
                } else {
                    query += ` AND mtr.test_status = $${paramIndex++}`;
                    params.push(status);
                }
            }
            if (category) {
                query += ` AND (mtr.primary_category = $${paramIndex++} OR mmd.primary_category = $${paramIndex++})`;
                params.push(category, category);
            }
            if (search) {
                query += ` AND (mtr.merchant_name ILIKE $${paramIndex++} OR mtr.merchant_url ILIKE $${paramIndex++})`;
                params.push(`%${search}%`, `%${search}%`);
            }
            if (date_from) {
                query += ` AND mtr.tested_at >= $${paramIndex++}`;
                params.push(date_from);
            }
            if (date_to) {
                query += ` AND mtr.tested_at <= $${paramIndex++}`;
                params.push(date_to + ' 23:59:59');
            }
            
            // Order by merchant_id first (required for DISTINCT ON), then by tested_at DESC
            query += ` ORDER BY mtr.merchant_id, mtr.tested_at DESC`;
            
        } else {
            // SQLite: Use a CTE to get the most recent test per merchant
            query = `
                WITH latest_tests AS (
                    SELECT merchant_id, MAX(tested_at) as latest_date
                    FROM merchant_test_results
                    WHERE 1=1
            `;
            
            if (session_id) {
                query += ` AND session_id = ?`;
                params.push(session_id);
            }
            if (status) {
                if (status === 'user_passed') {
                    query += ` AND is_user_passed = 1`;
                } else {
                    query += ` AND test_status = ?`;
                    params.push(status);
                }
            }
            
            query += `
                    GROUP BY merchant_id
                )
                SELECT 
                    mtr.id,
                    mtr.session_id,
                    mtr.merchant_id,
                    mtr.merchant_name,
                    mtr.merchant_url,
                    mtr.app_id,
                    mtr.test_status,
                    mtr.test_result,
                    mtr.test_duration_ms,
                    mtr.is_user_passed,
                    mtr.screenshot_path,
                    mtr.video_path,
                    mtr.tested_at,
                    mmd.primary_category,
                    mmd.parent_category,
                    mmd.max_rate,
                    mmd.max_rate_kind
                FROM merchant_test_results mtr
                INNER JOIN latest_tests lt ON mtr.merchant_id = lt.merchant_id AND mtr.tested_at = lt.latest_date
                LEFT JOIN merchant_master_data mmd ON mtr.merchant_id = mmd.merchant_id
                WHERE 1=1
            `;
            
            if (category) {
                query += ` AND (mtr.primary_category = ? OR mmd.primary_category = ?)`;
                params.push(category, category);
            }
            if (search) {
                query += ` AND (mtr.merchant_name LIKE ? OR mtr.merchant_url LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }
            if (date_from) {
                query += ` AND mtr.tested_at >= ?`;
                params.push(date_from);
            }
            if (date_to) {
                query += ` AND mtr.tested_at <= ?`;
                params.push(date_to + ' 23:59:59');
            }
            
            query += ` ORDER BY mtr.tested_at DESC`;
        }

        // Add pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT ${USE_POSTGRES ? `$${paramIndex++}` : '?'} OFFSET ${USE_POSTGRES ? `$${paramIndex++}` : '?'}`;
        params.push(parseInt(limit), offset);

        console.log('🔍 Query:', query);
        console.log('🔍 Params:', params);
        console.log(`🔍 Session filter: ${session_id ? `'${session_id}'` : 'NONE - loading all results!'}`);

        const rows = await queryAll(query, params);
        
        console.log(`✅ [Server] Returned ${rows.length} unique merchants for session: ${session_id || 'ALL'}`);
        
        // Log first few results for debugging
        if (rows.length > 0 && rows.length <= 5) {
            rows.forEach(row => {
                console.log(`   - ${row.merchant_name} (ID: ${row.merchant_id}, Session: ${row.session_id})`);
            });
        }

        // Simple count of unique merchants
        let countQuery;
        let countParams = [];
        
        if (USE_POSTGRES) {
            countQuery = `SELECT COUNT(DISTINCT merchant_id) as total FROM merchant_test_results WHERE 1=1`;
            let countIndex = 1;
            if (session_id) {
                countQuery += ` AND session_id = $${countIndex++}`;
                countParams.push(session_id);
            }
            if (status) {
                if (status === 'user_passed') {
                    countQuery += ` AND is_user_passed = TRUE`;
                } else {
                    countQuery += ` AND test_status = $${countIndex++}`;
                    countParams.push(status);
                }
            }
        } else {
            countQuery = `SELECT COUNT(DISTINCT merchant_id) as total FROM merchant_test_results WHERE 1=1`;
            if (session_id) {
                countQuery += ` AND session_id = ?`;
                countParams.push(session_id);
            }
            if (status) {
                if (status === 'user_passed') {
                    countQuery += ` AND is_user_passed = 1`;
                } else {
                    countQuery += ` AND test_status = ?`;
                    countParams.push(status);
                }
            }
        }

        const countResult = await queryOne(countQuery, countParams);
        const total = countResult ? countResult.total : 0;

        res.json({
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get test sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const query = `
            SELECT session_id, session_name, started_at, completed_at, status, created_at,
                   total_merchants, successful_merchants, flagged_merchants, user_passed_merchants,
                   current_merchant, current_url, notes
            FROM test_sessions 
            ORDER BY started_at DESC
        `;

        const rows = await queryAll(query, []);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get test sessions (for compatibility)
app.get('/api/test-sessions', async (req, res) => {
    try {
        const query = `
            SELECT session_id, session_name, started_at, completed_at, status, created_at,
                   total_merchants, successful_merchants, flagged_merchants, user_passed_merchants,
                   current_merchant, current_url, notes
            FROM test_sessions 
            ORDER BY created_at DESC
        `;

        const rows = await queryAll(query, []);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get specific test session with real-time status
app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const query = `
            SELECT session_id, started_at, completed_at, status, 
                   total_merchants, successful_merchants, flagged_merchants, user_passed_merchants,
                   current_merchant, current_url, notes
            FROM test_sessions 
            WHERE session_id = ${USE_POSTGRES ? '$1' : '?'}
        `;

        const row = await queryOne(query, [sessionId]);
        
        if (!row) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        res.json(row);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get recent test results for a session (for real-time updates)
app.get('/api/sessions/:sessionId/recent-results', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { since } = req.query; // timestamp
        
        let query = `
            SELECT mtr.*, mmd.primary_category, mmd.parent_category, mmd.max_rate, mmd.max_rate_kind
            FROM merchant_test_results mtr
            LEFT JOIN merchant_master_data mmd ON mtr.merchant_id = mmd.merchant_id
            WHERE mtr.session_id = ${USE_POSTGRES ? '$1' : '?'}
        `;
        const params = [sessionId];
        let paramIndex = 2;
        
        if (since) {
            query += ` AND mtr.tested_at > ${USE_POSTGRES ? `$${paramIndex++}` : '?'}`;
            params.push(since);
        }
        
        query += ' ORDER BY mtr.tested_at DESC LIMIT 100';
        
        const rows = await queryAll(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get categories
app.get('/api/categories', async (req, res) => {
    const query = `
        SELECT DISTINCT primary_category 
        FROM merchant_test_results 
        WHERE primary_category IS NOT NULL 
        UNION 
        SELECT DISTINCT primary_category 
        FROM merchant_master_data 
        WHERE primary_category IS NOT NULL 
        ORDER BY primary_category
    `;

    try {
        const rows = await queryAll(query, []);
        res.json(rows.map(row => row.primary_category));
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    const { session_id } = req.query;
    
    let query = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN test_status = 'success' THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN test_status = 'flagged' THEN 1 ELSE 0 END) as flagged,
            SUM(CASE WHEN is_user_passed = ${USE_POSTGRES ? 'TRUE' : '1'} THEN 1 ELSE 0 END) as user_passed
        FROM merchant_test_results
    `;
    const params = [];

    if (session_id) {
        query += ` WHERE session_id = ${USE_POSTGRES ? '$1' : '?'}`;
        params.push(session_id);
    }

    try {
        const row = await queryOne(query, params);
        res.json(row);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create a new test session
app.post('/api/sessions', async (req, res) => {
    const { session_id, session_name, notes } = req.body;
    
    try {
        const sessionDbId = await createTestSession(session_id, session_name, notes);
        res.json({ id: sessionDbId, session_id });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Get session status
app.get('/api/sessions/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = await queryOne(
            USE_POSTGRES 
                ? 'SELECT status FROM test_sessions WHERE session_id = $1'
                : 'SELECT status FROM test_sessions WHERE session_id = ?',
            [sessionId]
        );
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json({ status: session.status });
    } catch (error) {
        console.error('Error fetching session status:', error);
        res.status(500).json({ error: 'Failed to fetch session status' });
    }
});

// Update a test session
app.put('/api/sessions/:sessionId', async (req, res) => {
    console.error('🔥🔥🔥 [DEBUG] PUT /api/sessions endpoint HIT - ERROR STREAM! 🔥🔥🔥');
    console.log('🔥 [DEBUG] PUT /api/sessions endpoint HIT!');
    const { sessionId } = req.params;
    const updateData = req.body;
    
    console.error(`📝 [Server ERROR] PUT /api/sessions/${sessionId} - Update data:`, JSON.stringify(updateData));
    console.log(`📝 [Server] PUT /api/sessions/${sessionId} - Update data:`, updateData);
    
    try {
        await updateTestSession(sessionId, updateData);
        console.log(`✅ [Server] Session ${sessionId} updated successfully`);
        res.json({ success: true });
    } catch (error) {
        console.error(`❌ [Server] Error updating session ${sessionId}:`, error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// Delete a test session and all its results
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    console.log(`🗑️ [Server] DELETE request for session: ${sessionId}`);
    
    try {
        // Delete all merchant results for this session first
        if (USE_POSTGRES) {
            const resultCount = await db.query('SELECT COUNT(*) FROM merchant_test_results WHERE session_id = $1', [sessionId]);
            console.log(`📊 [Server] Found ${resultCount.rows[0].count} results to delete for session ${sessionId}`);
            
            await db.query('DELETE FROM merchant_test_results WHERE session_id = $1', [sessionId]);
            console.log(`✅ [Server] Deleted merchant_test_results for session ${sessionId}`);
            
            await db.query('DELETE FROM test_sessions WHERE session_id = $1', [sessionId]);
            console.log(`✅ [Server] Deleted test_sessions entry for session ${sessionId}`);
        } else {
            // Count first for logging
            const resultCount = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM merchant_test_results WHERE session_id = ?', [sessionId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            console.log(`📊 [Server] Found ${resultCount.count} results to delete for session ${sessionId}`);
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM merchant_test_results WHERE session_id = ?', [sessionId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`✅ [Server] Deleted merchant_test_results for session ${sessionId}`);
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM test_sessions WHERE session_id = ?', [sessionId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`✅ [Server] Deleted test_sessions entry for session ${sessionId}`);
        }
        
        console.log(`✅ [Server] Successfully deleted session and all results: ${sessionId}`);
        res.json({ success: true, message: 'Session and results deleted' });
    } catch (error) {
        console.error('❌ [Server] Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

// Clear all test results and sessions (keeps merchant master data)
app.delete('/api/clear-all-results', async (req, res) => {
    try {
        console.log('🗑️ [Server] Clearing ALL test results and sessions from database');
        
        // Delete all merchant test results and sessions
        if (USE_POSTGRES) {
            const resultCount = await db.query('SELECT COUNT(*) FROM merchant_test_results');
            const sessionCount = await db.query('SELECT COUNT(*) FROM test_sessions');
            
            console.log(`📊 [Server] Found ${resultCount.rows[0].count} results and ${sessionCount.rows[0].count} sessions to delete`);
            
            await db.query('DELETE FROM merchant_test_results');
            console.log(`✅ [Server] Deleted all merchant_test_results`);
            
            await db.query('DELETE FROM test_sessions');
            console.log(`✅ [Server] Deleted all test_sessions`);
        } else {
            // SQLite - count first for logging
            const resultCount = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM merchant_test_results', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            const sessionCount = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM test_sessions', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            console.log(`📊 [Server] Found ${resultCount.count} results and ${sessionCount.count} sessions to delete`);
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM merchant_test_results', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`✅ [Server] Deleted all merchant_test_results`);
            
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM test_sessions', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`✅ [Server] Deleted all test_sessions`);
        }
        
        // Delete all screenshot and video files
        let deletedScreenshots = 0;
        let deletedVideos = 0;
        
        try {
            const screenshotsDir = path.join(__dirname, 'media', 'screenshots');
            const videosDir = path.join(__dirname, 'media', 'videos');
            
            // Delete screenshots
            if (fs.existsSync(screenshotsDir)) {
                const screenshotFiles = fs.readdirSync(screenshotsDir);
                for (const file of screenshotFiles) {
                    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
                        fs.unlinkSync(path.join(screenshotsDir, file));
                        deletedScreenshots++;
                    }
                }
                console.log(`🗑️ [Server] Deleted ${deletedScreenshots} screenshot files`);
            }
            
            // Delete videos
            if (fs.existsSync(videosDir)) {
                const videoFiles = fs.readdirSync(videosDir);
                for (const file of videoFiles) {
                    if (file.endsWith('.webm') || file.endsWith('.mp4')) {
                        fs.unlinkSync(path.join(videosDir, file));
                        deletedVideos++;
                    }
                }
                console.log(`🗑️ [Server] Deleted ${deletedVideos} video files`);
            }
        } catch (fileError) {
            console.error('⚠️ [Server] Error deleting media files:', fileError);
            // Continue even if file deletion fails
        }
        
        console.log(`✅ [Server] Successfully cleared all test results and sessions`);
        res.json({ 
            success: true, 
            message: 'All test results and sessions cleared',
            deletedScreenshots,
            deletedVideos
        });
    } catch (error) {
        console.error('❌ [Server] Error clearing all results:', error);
        res.status(500).json({ error: 'Failed to clear all results' });
    }
});

// Save a merchant test result
app.post('/api/merchant-results', async (req, res) => {
    const testData = req.body;
    
    try {
        const resultId = await saveMerchantTestResult(testData);
        res.json({ id: resultId });
    } catch (error) {
        console.error('Error saving test result:', error);
        res.status(500).json({ error: 'Failed to save test result' });
    }
});

// Update merchant result status
app.put('/api/merchant-results/:merchantId/status', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { status, session_id } = req.body;
        
        console.log(`📝 Status change request: merchant_id=${merchantId}, status=${status}, session_id=${session_id}`);
        
        if (!['success', 'flagged'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        if (!session_id) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        
        // Update the test status in database with manual review note
        const manualReviewNote = 'Status changed by user manual review';
        let result;
        if (USE_POSTGRES) {
            result = await db.query(
                'UPDATE merchant_test_results SET test_status = $1, details = $2 WHERE merchant_id = $3 AND session_id = $4',
                [status, manualReviewNote, parseInt(merchantId), session_id]
            );
            console.log(`✅ Updated ${result.rowCount} row(s) for merchant ${merchantId}`);
            
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'No matching result found for this merchant and session' });
            }
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE merchant_test_results SET test_status = ?, details = ? WHERE merchant_id = ? AND session_id = ?',
                    [status, manualReviewNote, parseInt(merchantId), session_id],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`✅ Updated ${this.changes} row(s) for merchant ${merchantId}`);
                            if (this.changes === 0) {
                                reject(new Error('No matching result found'));
                            } else {
                                resolve();
                            }
                        }
                    }
                );
            });
        }
        
        console.log(`✅ Updated merchant ${merchantId} to status: ${status}`);
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: error.message || 'Failed to update status' });
    }
});

// Store merchants from API data
app.post('/api/store-merchants', async (req, res) => {
    try {
        const { merchants } = req.body;
        
        if (!merchants || !Array.isArray(merchants)) {
            return res.status(400).json({ error: 'Invalid merchants data' });
        }
        
        console.log(`📦 Storing ${merchants.length} merchants in database`);
        
        // Use the correct database module's populate function
        const { populateMerchantMasterData } = dbModule;
        await populateMerchantMasterData(merchants);
        
        console.log(`✅ Successfully stored ${merchants.length} merchants`);
        
        res.json({ 
            success: true, 
            message: `Stored ${merchants.length} merchants`,
            count: merchants.length
        });
    } catch (error) {
        console.error('Error storing merchants:', error);
        res.status(500).json({ error: 'Failed to store merchants', details: error.message });
    }
});

// Get stored merchants (now using cache for instant response)
app.get('/api/stored-merchants', async (req, res) => {
    try {
        const { app_id, limit = 50000 } = req.query;
        
        // If cache is empty or stale, load it
        if (!merchantCache.data || !merchantCache.lastUpdated || 
            (Date.now() - merchantCache.lastUpdated.getTime()) > CACHE_REFRESH_INTERVAL) {
            console.log('🔄 Cache is stale or empty, refreshing...');
            await loadMerchantsIntoCache();
        }
        
        // Serve from cache (instant response)
        let merchants = merchantCache.data || [];
        
        // Apply app_id filter if specified
        if (app_id) {
            merchants = merchants.filter(merchant => merchant.AppID == app_id);
        }
        
        // Apply limit
        const limitNum = parseInt(limit);
        if (limitNum && limitNum < merchants.length) {
            merchants = merchants.slice(0, limitNum);
        }
        
        console.log(`📦 Served ${merchants.length} merchants from cache (filtered by app_id: ${app_id || 'none'})`);
        
        res.json({
            merchants: merchants,
            total: merchants.length,
            cached: true,
            lastUpdated: merchantCache.lastUpdated
        });
        
    } catch (error) {
        console.error('Error serving cached merchants:', error);
        
        // Fallback to direct database query if cache fails
        console.log('⚠️ Cache failed, falling back to database query...');
        
        let query = 'SELECT * FROM merchant_master_data';
        let params = [];
        let paramIndex = 1;
        
        if (req.query.app_id) {
            query += ` WHERE app_id = ${USE_POSTGRES ? '$1' : '?'}`;
            params.push(req.query.app_id);
            paramIndex++;
        }
        
        query += ` ORDER BY merchant_name LIMIT ${USE_POSTGRES ? `$${paramIndex}` : '?'}`;
        params.push(parseInt(req.query.limit || 50000));
        
        const merchants = await queryAll(query, params);
        
        // Convert back to API format with safe JSON parsing
        const apiFormat = merchants.map(merchant => {
            // Safe JSON parsing function
            const safeJsonParse = (jsonString, fallback = []) => {
                try {
                    return JSON.parse(jsonString || JSON.stringify(fallback));
                } catch (error) {
                    console.warn(`JSON parse error for merchant ${merchant.merchant_name}:`, error.message);
                    return fallback;
                }
            };
            
            return {
                AppID: merchant.app_id,
                MerchantID: merchant.merchant_id,
                MerchantName: merchant.merchant_name,
                MerchantDomains: safeJsonParse(merchant.merchant_domains, []),
                MerchantScore: merchant.merchant_score,
                IsFeaturedMerchant: merchant.is_featured_merchant === 1 || merchant.is_featured_merchant === true,
                PrimaryCategory: merchant.primary_category,
                PrimaryCategoryID: merchant.primary_category_id,
                ParentCategory: merchant.parent_category,
                ParentCategoryID: merchant.parent_category_id,
                MaxRate: merchant.max_rate,
                MaxRateKind: merchant.max_rate_kind,
                MaxRateCurrency: merchant.max_rate_currency,
                MaxRateLedgerID: merchant.max_rate_ledger_id,
                Boosted: merchant.boosted === 1 || merchant.boosted === true,
                MaxOfferScore: merchant.max_offer_score,
                DetailedRates: safeJsonParse(merchant.detailed_rates, []),
                Coupons: safeJsonParse(merchant.coupons, []),
                BrandColor: merchant.brand_color,
                TextColor: merchant.text_color,
                FeaturedImageURL: merchant.featured_image_url,
                LogoImageExists: merchant.logo_image_exists === 1 || merchant.logo_image_exists === true,
                Images: safeJsonParse(merchant.images, []),
                CreatedDate: merchant.created_date,
                ModifiedDate: merchant.modified_date
            };
        });
        
        // If limit is 1, get the total count for the response
        let totalCount = apiFormat.length;
        if (parseInt(limit) === 1 && apiFormat.length > 0) {
            const countQuery = app_id ? 
                `SELECT COUNT(*) as total FROM merchant_master_data WHERE app_id = ${USE_POSTGRES ? '$1' : '?'}` :
                'SELECT COUNT(*) as total FROM merchant_master_data';
            const countParams = app_id ? [app_id] : [];
            
            const countResult = await queryOne(countQuery, countParams);
            totalCount = countResult.total;
        }
        
        res.json({
            merchants: apiFormat,
            count: totalCount
        });
    } catch (error) {
        console.error('Error fetching stored merchants:', error);
        res.status(500).json({ error: 'Failed to fetch stored merchants' });
    }
});

// Get available App IDs from database
app.get('/api/app-ids', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT app_id 
            FROM merchant_master_data 
            WHERE app_id IS NOT NULL 
            ORDER BY app_id
        `;
        
        const rows = await queryAll(query, []);
        const appIds = rows.map(row => row.app_id);
        
        res.json(appIds);
    } catch (error) {
        console.error('Error fetching App IDs:', error);
        res.status(500).json({ error: 'Failed to fetch App IDs', details: error.message });
    }
});

// Start API-driven merchant test
app.post('/api/start-test', async (req, res) => {
    const { merchants, sessionId, testName } = req.body;
    
    try {
        console.log(`🚀 Starting API merchant test`);
        console.log(`📊 Merchants: ${merchants.length}`);
        console.log(`🆔 Session: ${sessionId}`);
        console.log(`📝 Test Name: ${testName}`);
        
        // ✨ NEW: Check if a test is already running for this session and stop it
        if (runningTests.has(sessionId)) {
            console.log(`⚠️ Found existing test running for session ${sessionId} - stopping it first`);
            const existingTest = runningTests.get(sessionId);
            
            try {
                // Call the browser close method if available
                if (existingTest.runner && existingTest.runner.browser) {
                    console.log('🔴 Closing existing browser...');
                    await existingTest.runner.browser.close();
                }
                
                // Remove from tracking
                runningTests.delete(sessionId);
                console.log('✅ Existing test stopped successfully');
                
                // Wait a moment for cleanup
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (stopError) {
                console.log(`⚠️ Error stopping existing test: ${stopError.message}`);
                // Continue anyway
            }
        }
        
        // Clear the log file for this session if it exists (for fresh start on restart)
        const logFile = path.join(__dirname, 'logs', `test-${sessionId}.log`);
        if (fs.existsSync(logFile)) {
            console.log(`🧹 Clearing existing log file: ${logFile}`);
            fs.writeFileSync(logFile, ''); // Truncate the log file
        }
        
        // Create or update test session in database
        try {
            // Check if session exists
            const existingSession = await queryOne(
                USE_POSTGRES 
                    ? 'SELECT id, status FROM test_sessions WHERE session_id = $1'
                    : 'SELECT id, status FROM test_sessions WHERE session_id = ?',
                [sessionId]
            );
            
            if (existingSession) {
                // Session exists - update it to running status and clear completion data
                console.log(`📝 Updating existing session ${sessionId} (current status: ${existingSession.status})`);
                
                // ✨ IMPORTANT: Delete old test results for this session before restarting
                console.log(`🗑️ Clearing old test results for session ${sessionId}...`);
                try {
                    if (USE_POSTGRES) {
                        const deleteResult = await db.query('DELETE FROM merchant_test_results WHERE session_id = $1', [sessionId]);
                        console.log(`✅ Deleted ${deleteResult.rowCount} old test results`);
                    } else {
                        await new Promise((resolve, reject) => {
                            db.run('DELETE FROM merchant_test_results WHERE session_id = ?', [sessionId], function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log(`✅ Deleted ${this.changes} old test results`);
                                    resolve();
                                }
                            });
                        });
                    }
                } catch (deleteError) {
                    console.log(`⚠️ Failed to delete old results: ${deleteError.message}`);
                }
                
                await updateTestSession(sessionId, { 
                    status: 'running',
                    completed_at: null
                });
                console.log(`✅ Session updated to running status: ${sessionId}`);
            } else {
                // New session - create it
                console.log(`🆕 Creating new session: ${sessionId}`);
                await createTestSession(sessionId, testName, null);
                console.log(`✅ New session created: ${sessionId}`);
            }
        } catch (dbError) {
            console.log(`⚠️ Database session setup failed: ${dbError.message}`);
        }
        
        // Import and use the API test runner
        const testRunner = new APITestRunner();
        
        // Track this running test
        runningTests.set(sessionId, { runner: testRunner });
        console.log(`📝 Tracking new test instance for session ${sessionId}`);
        
        // Start the test asynchronously (don't wait for completion)
        testRunner.runTest(merchants, sessionId, testName)
            .then(result => {
                console.log('✅ Test completed:', result);
                // Remove from tracking when complete
                runningTests.delete(sessionId);
                console.log(`🗑️ Removed completed test from tracking: ${sessionId}`);
            })
            .catch(error => {
                console.error('❌ Test failed:', error);
                // Remove from tracking on error
                runningTests.delete(sessionId);
                console.log(`🗑️ Removed failed test from tracking: ${sessionId}`);
            });
        
        res.json({ 
            success: true, 
            message: `Test started for ${merchants.length} merchants`,
            sessionId: sessionId
        });
    } catch (error) {
        console.error('Error starting test:', error);
        res.status(500).json({ error: 'Failed to start test' });
    }
});

// Get test logs for streaming
app.get('/api/sessions/:sessionId/logs', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { since } = req.query; // Optional: get logs since this byte offset
        
        const logFile = path.join(__dirname, 'logs', `test-${sessionId}.log`);
        
        if (!fs.existsSync(logFile)) {
            return res.json({ logs: '', hasMore: false });
        }
        
        const stats = fs.statSync(logFile);
        const startPosition = since ? parseInt(since) : 0;
        
        if (startPosition >= stats.size) {
            return res.json({ logs: '', position: stats.size, hasMore: false });
        }
        
        const stream = fs.createReadStream(logFile, {
            start: startPosition,
            encoding: 'utf8'
        });
        
        let logs = '';
        stream.on('data', (chunk) => {
            logs += chunk;
        });
        
        stream.on('end', () => {
            res.json({
                logs: logs,
                position: stats.size,
                hasMore: false
            });
        });
        
        stream.on('error', (error) => {
            console.error('Error reading log file:', error);
            res.status(500).json({ error: 'Failed to read logs' });
        });
    } catch (error) {
        console.error('Error streaming logs:', error);
        res.status(500).json({ error: 'Failed to stream logs' });
    }
});

// Stop API test
app.post('/api/stop-test', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        console.log(`🛑 Stop test requested for session: ${sessionId}`);
        
        // Kill any running Playwright processes
        const { spawn } = require('child_process');
        spawn('pkill', ['-f', 'playwright.*test'], { stdio: 'ignore' });
        
        // Update session status in database
        if (sessionId) {
            try {
                await updateTestSession(sessionId, {
                    status: 'stopped',
                    completed_at: new Date().toISOString()
                });
            } catch (dbError) {
                console.error('Error updating session status:', dbError);
            }
        }
        
        res.json({
            success: true,
            message: 'Test stop request processed'
        });
        
    } catch (error) {
        console.error('Error stopping test:', error);
        res.status(500).json({ error: 'Failed to stop test' });
    }
});

// Reset database (dangerous operation)
app.post('/api/reset-database', async (req, res) => {
    try {
        console.log('🚨 Database reset requested');
        
        // Clear all tables
        if (USE_POSTGRES) {
            // PostgreSQL version
            await db.query('DELETE FROM merchant_test_results');
            await db.query('DELETE FROM test_sessions');
            await db.query('DELETE FROM merchant_master_data');
            console.log('✅ PostgreSQL database reset completed');
        } else {
            // SQLite version
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('DELETE FROM merchant_test_results', (err) => {
                        if (err) {
                            console.error('Error clearing merchant_test_results:', err);
                            reject(err);
                            return;
                        }
                    });
                    
                    db.run('DELETE FROM test_sessions', (err) => {
                        if (err) {
                            console.error('Error clearing test_sessions:', err);
                            reject(err);
                            return;
                        }
                    });
                    
                    db.run('DELETE FROM merchant_master_data', (err) => {
                        if (err) {
                            console.error('Error clearing merchant_master_data:', err);
                            reject(err);
                            return;
                        }
                        
                        console.log('✅ SQLite database reset completed');
                        resolve();
                    });
                });
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Database reset successfully' 
        });
    } catch (error) {
        console.error('❌ Database reset failed:', error);
        res.status(500).json({ 
            error: 'Failed to reset database',
            details: error.message 
        });
    }
});

// Get merchant master data
app.get('/api/merchants', async (req, res) => {
    const { search, category, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM merchant_master_data WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
        query += ` AND merchant_name ${USE_POSTGRES ? 'ILIKE' : 'LIKE'} ${USE_POSTGRES ? `$${paramIndex++}` : '?'}`;
        params.push(`%${search}%`);
    }

    if (category) {
        query += ` AND primary_category = ${USE_POSTGRES ? `$${paramIndex++}` : '?'}`;
        params.push(category);
    }

    query += ` ORDER BY merchant_name LIMIT ${USE_POSTGRES ? `$${paramIndex}` : '?'}`;
    params.push(parseInt(limit));

    try {
        const rows = await queryAll(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Dashboard available at: http://localhost:3000');
    
    // Initialize merchant cache on server startup
    console.log('🚀 Initializing merchant cache...');
    await loadMerchantsIntoCache();
    
    // Set up periodic cache refresh
    setInterval(async () => {
        console.log('🔄 Refreshing merchant cache...');
        await loadMerchantsIntoCache();
    }, CACHE_REFRESH_INTERVAL);
    
    console.log(`✅ Server ready with merchant cache (refreshes every ${CACHE_REFRESH_INTERVAL / 1000 / 60} minutes)`);
});

module.exports = app;
