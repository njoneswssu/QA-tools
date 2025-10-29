const express = require('express');
const cors = require('cors');
const path = require('path');
const APITestRunner = require('./api-test-runner');

// Import database functions from local database
const dbPath = path.join(__dirname, 'database', 'init_db.js');
let dbModule;
try {
    dbModule = require(dbPath);
} catch (error) {
    console.log('Warning: Database module not found. Some features may not work.');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Serve the main tester page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'merchant-tester.html'));
});

// Get available App IDs from database
app.get('/api/app-ids', async (req, res) => {
    if (!dbModule) {
        return res.json([]);
    }
    
    try {
        const db = dbModule.getDatabase();
        const appIds = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT app_id 
                FROM merchant_master_data 
                WHERE app_id IS NOT NULL 
                ORDER BY app_id
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.app_id));
            });
        });
        
        res.json(appIds);
    } catch (error) {
        console.error('Error fetching App IDs:', error);
        res.status(500).json({ error: 'Failed to fetch App IDs' });
    }
});

// Get merchant test results
app.get('/api/merchant-results', async (req, res) => {
    if (!dbModule) {
        return res.json([]);
    }
    
    try {
        const { session_id, limit = 1000 } = req.query;
        const results = await dbModule.getMerchantTestResults(session_id, parseInt(limit));
        res.json(results);
    } catch (error) {
        console.error('Error fetching merchant results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// Create test session
app.post('/api/sessions', async (req, res) => {
    if (!dbModule) {
        return res.status(500).json({ error: 'Database not available' });
    }
    
    try {
        const { session_id, session_name } = req.body;
        await dbModule.createTestSession(session_id, session_name);
        res.json({ session_id, session_name });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
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
        
        // Create test session in database
        if (dbModule) {
            try {
                await dbModule.createTestSession(sessionId, testName);
                console.log(`✅ Database session created: ${sessionId}`);
            } catch (dbError) {
                console.log(`⚠️ Database session creation failed: ${dbError.message}`);
            }
        }
        
        // Import and use the API test runner
        const testRunner = new APITestRunner();
        
        // Start the test asynchronously (don't wait for completion)
        testRunner.runTest(merchants, sessionId, testName)
            .then(result => {
                console.log('✅ Test completed:', result);
            })
            .catch(error => {
                console.error('❌ Test failed:', error);
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

// Save merchant test result
app.post('/api/merchant-results', async (req, res) => {
    if (!dbModule) {
        return res.status(500).json({ error: 'Database not available' });
    }
    
    const testData = req.body;
    
    try {
        const resultId = await dbModule.saveMerchantTestResult(testData);
        res.json({ id: resultId });
    } catch (error) {
        console.error('Error saving test result:', error);
        res.status(500).json({ error: 'Failed to save test result' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: dbModule ? 'connected' : 'not available'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 API Merchant Tester Server Started');
    console.log('='.repeat(50));
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`🧪 Tester UI: http://localhost:${PORT}`);
    console.log(`💾 Database: ${dbModule ? 'Connected' : 'Not Available'}`);
    console.log('='.repeat(50));
});

module.exports = app;
