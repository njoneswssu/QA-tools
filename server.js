const express = require('express');
const path = require('path');
const cors = require('cors');
const { db, createTestSession, updateTestSession, saveMerchantTestResult } = require('./database/init_db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Serve the merchant tester UI
app.get('/tester', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'merchant-tester.html'));
});

// API Routes

// Get all merchant test results
app.get('/api/merchant-results', (req, res) => {
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

    let query = `
        SELECT mtr.*, mmd.primary_category, mmd.parent_category, mmd.max_rate, mmd.max_rate_kind
        FROM merchant_test_results mtr
        LEFT JOIN merchant_master_data mmd ON mtr.merchant_id = mmd.merchant_id
        WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (session_id) {
        query += ' AND mtr.session_id = ?';
        params.push(session_id);
    }

    if (status) {
        if (status === 'user_passed') {
            query += ' AND mtr.is_user_passed = 1';
        } else {
            query += ' AND mtr.test_status = ?';
            params.push(status);
        }
    }

    if (category) {
        query += ' AND (mtr.primary_category = ? OR mmd.primary_category = ?)';
        params.push(category, category);
    }

    if (search) {
        query += ' AND (mtr.merchant_name LIKE ? OR mtr.merchant_url LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    if (date_from) {
        query += ' AND mtr.tested_at >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND mtr.tested_at <= ?';
        params.push(date_to + ' 23:59:59');
    }

    // Add ordering
    query += ' ORDER BY mtr.tested_at DESC';

    // Add pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM merchant_test_results mtr
            LEFT JOIN merchant_master_data mmd ON mtr.merchant_id = mmd.merchant_id
            WHERE 1=1
        `;
        const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params

        // Re-apply the same filters for count
        let paramIndex = 0;
        if (session_id) {
            countQuery += ' AND mtr.session_id = ?';
            paramIndex++;
        }
        if (status) {
            if (status === 'user_passed') {
                countQuery += ' AND mtr.is_user_passed = 1';
            } else {
                countQuery += ' AND mtr.test_status = ?';
                paramIndex++;
            }
        }
        if (category) {
            countQuery += ' AND (mtr.primary_category = ? OR mmd.primary_category = ?)';
            paramIndex += 2;
        }
        if (search) {
            countQuery += ' AND (mtr.merchant_name LIKE ? OR mtr.merchant_url LIKE ?)';
            paramIndex += 2;
        }
        if (date_from) {
            countQuery += ' AND mtr.tested_at >= ?';
            paramIndex++;
        }
        if (date_to) {
            countQuery += ' AND mtr.tested_at <= ?';
            paramIndex++;
        }

        db.get(countQuery, countParams, (countErr, countResult) => {
            if (countErr) {
                console.error('Count query error:', countErr);
                res.status(500).json({ error: 'Database error' });
                return;
            }

            res.json({
                data: rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult.total,
                    pages: Math.ceil(countResult.total / limit)
                }
            });
        });
    });
});

// Get test sessions
app.get('/api/sessions', (req, res) => {
    const query = `
        SELECT session_id, started_at, completed_at, status, 
               total_merchants, successful_merchants, flagged_merchants, user_passed_merchants
        FROM test_sessions 
        ORDER BY started_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(rows);
    });
});

// Get categories
app.get('/api/categories', (req, res) => {
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

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(rows.map(row => row.primary_category));
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    const { session_id } = req.query;
    
    let query = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN test_status = 'success' THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN test_status = 'flagged' THEN 1 ELSE 0 END) as flagged,
            SUM(CASE WHEN is_user_passed = 1 THEN 1 ELSE 0 END) as user_passed
        FROM merchant_test_results
    `;
    const params = [];

    if (session_id) {
        query += ' WHERE session_id = ?';
        params.push(session_id);
    }

    db.get(query, params, (err, row) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(row);
    });
});

// Create a new test session
app.post('/api/sessions', async (req, res) => {
    const { session_id, notes } = req.body;
    
    try {
        const sessionDbId = await createTestSession(session_id, notes);
        res.json({ id: sessionDbId, session_id });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update a test session
app.put('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const updateData = req.body;
    
    try {
        await updateTestSession(sessionId, updateData);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
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

// Start API-driven merchant test
app.post('/api/start-test', async (req, res) => {
    const { merchants, sessionId, testName } = req.body;
    
    try {
        console.log(`Starting test for ${merchants.length} merchants`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`Test Name: ${testName}`);
        
        // Import and use the API test runner
        const APITestRunner = require('./api-test-runner');
        const testRunner = new APITestRunner();
        
        // Start the test asynchronously (don't wait for completion)
        testRunner.runTest(merchants, sessionId, testName)
            .then(result => {
                console.log('Test completed:', result);
            })
            .catch(error => {
                console.error('Test failed:', error);
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

// Get merchant master data
app.get('/api/merchants', (req, res) => {
    const { search, category, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM merchant_master_data WHERE 1=1';
    const params = [];

    if (search) {
        query += ' AND merchant_name LIKE ?';
        params.push(`%${search}%`);
    }

    if (category) {
        query += ' AND primary_category = ?';
        params.push(category);
    }

    query += ' ORDER BY merchant_name LIMIT ?';
    params.push(parseInt(limit));

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(rows);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Dashboard available at: http://localhost:3000');
});

module.exports = app;
