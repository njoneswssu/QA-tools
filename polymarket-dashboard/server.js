const express = require('express');
const cors = require('cors');
const axios = require('axios');
const RSSParser = require('rss-parser');
const cron = require('node-cron');
const path = require('path');
const { initDatabase, getDatabase } = require('./database/init');
const { EdgeDetector } = require('./utils/edge-detector');
const { TradeExecutor } = require('./utils/trade-executor');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;
const rssParser = new RSSParser();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initDatabase();

// Polymarket API endpoints
const POLYMARKET_API = 'https://clob.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

// Edge detector and trade executor
const edgeDetector = new EdgeDetector();
const tradeExecutor = new TradeExecutor();

// Cache for market data
let marketsCache = [];
let newsCache = [];
let edgeOpportunities = [];

// ============= POLYMARKET API ROUTES =============

// Get all active markets
app.get('/api/markets', async (req, res) => {
    try {
        const response = await axios.get(`${GAMMA_API}/markets`, {
            params: {
                active: true,
                closed: false,
                limit: 100
            }
        });
        
        const markets = response.data;
        
        // Update database
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO markets (id, name, description, end_date, volume, liquidity, yes_price, no_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        markets.forEach(market => {
            stmt.run(
                market.id,
                market.question,
                market.description,
                market.endDate,
                market.volume || 0,
                market.liquidity || 0,
                market.outcomePrices?.[0] || 0.5,
                market.outcomePrices?.[1] || 0.5
            );
        });
        
        db.close();
        marketsCache = markets;
        
        res.json(markets);
    } catch (error) {
        console.error('Error fetching markets:', error.message);
        res.status(500).json({ error: 'Failed to fetch markets' });
    }
});

// Get specific market details
app.get('/api/markets/:id', async (req, res) => {
    try {
        const response = await axios.get(`${GAMMA_API}/markets/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching market:', error.message);
        res.status(500).json({ error: 'Failed to fetch market' });
    }
});

// Get market orderbook
app.get('/api/markets/:id/orderbook', async (req, res) => {
    try {
        const response = await axios.get(`${POLYMARKET_API}/book`, {
            params: {
                token_id: req.params.id
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching orderbook:', error.message);
        res.status(500).json({ error: 'Failed to fetch orderbook' });
    }
});

// ============= RSS FEED ROUTES =============

app.get('/api/news', async (req, res) => {
    try {
        const feed = await rssParser.parseURL(process.env.RSS_FEED_URL || 'https://mashable.com/feeds/rss/all');
        
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO news_items (title, link, description, pub_date, content)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        feed.items.forEach(item => {
            stmt.run(
                item.title,
                item.link,
                item.contentSnippet || item.description,
                item.pubDate,
                item.content || ''
            );
        });
        
        db.close();
        newsCache = feed.items;
        
        res.json(feed.items.slice(0, 50));
    } catch (error) {
        console.error('Error fetching RSS feed:', error.message);
        res.status(500).json({ error: 'Failed to fetch news feed' });
    }
});

// ============= EDGE DETECTION ROUTES =============

app.get('/api/edge-opportunities', async (req, res) => {
    try {
        if (marketsCache.length === 0) {
            const response = await axios.get(`${GAMMA_API}/markets`, {
                params: { active: true, closed: false, limit: 100 }
            });
            marketsCache = response.data;
        }
        
        if (newsCache.length === 0) {
            const feed = await rssParser.parseURL(process.env.RSS_FEED_URL || 'https://mashable.com/feeds/rss/all');
            newsCache = feed.items;
        }
        
        // Run edge detection
        edgeOpportunities = await edgeDetector.findEdges(marketsCache, newsCache);
        
        // Save to database
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO edge_opportunities (market_id, market_name, edge_score, reason, yes_price, no_price)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        edgeOpportunities.forEach(opp => {
            stmt.run(
                opp.marketId,
                opp.marketName,
                opp.edgeScore,
                opp.reason,
                opp.yesPrice,
                opp.noPrice
            );
        });
        
        db.close();
        
        res.json(edgeOpportunities);
    } catch (error) {
        console.error('Error detecting edge:', error.message);
        res.status(500).json({ error: 'Failed to detect edge opportunities' });
    }
});

// ============= TRADING ROUTES =============

app.post('/api/trades', async (req, res) => {
    try {
        const { marketId, side, size, price, marketName, edge } = req.body;
        
        // Validate trade
        if (!marketId || !side || !size || !price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (size > parseFloat(process.env.MAX_TRADE_SIZE || 100)) {
            return res.status(400).json({ error: 'Trade size exceeds maximum' });
        }
        
        // Save trade to database
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO trades (market_id, market_name, side, size, price, edge, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(marketId, marketName, side, size, price, edge, 'pending');
        
        const tradeId = result.lastInsertRowid;
        
        // Execute trade if auto-trading is enabled
        if (process.env.AUTO_TRADE_ENABLED === 'true') {
            try {
                const executionResult = await tradeExecutor.executeTrade({
                    marketId,
                    side,
                    size,
                    price
                });
                
                db.prepare(`
                    UPDATE trades SET status = ?, executed_at = ? WHERE id = ?
                `).run('executed', Math.floor(Date.now() / 1000), tradeId);
                
                db.close();
                
                res.json({
                    success: true,
                    tradeId,
                    executed: true,
                    executionResult
                });
            } catch (execError) {
                db.prepare(`
                    UPDATE trades SET status = ?, notes = ? WHERE id = ?
                `).run('failed', execError.message, tradeId);
                
                db.close();
                
                res.status(500).json({
                    success: false,
                    tradeId,
                    error: execError.message
                });
            }
        } else {
            db.close();
            res.json({
                success: true,
                tradeId,
                executed: false,
                message: 'Trade saved but not executed (auto-trade disabled)'
            });
        }
    } catch (error) {
        console.error('Error creating trade:', error.message);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

// Get trade history
app.get('/api/trades', async (req, res) => {
    try {
        const db = getDatabase();
        const trades = db.prepare(`
            SELECT * FROM trades ORDER BY created_at DESC LIMIT 100
        `).all();
        db.close();
        
        res.json(trades);
    } catch (error) {
        console.error('Error fetching trades:', error.message);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// Update trade (close position)
app.patch('/api/trades/:id', async (req, res) => {
    try {
        const { pnl, status } = req.body;
        const db = getDatabase();
        
        db.prepare(`
            UPDATE trades SET pnl = ?, status = ?, closed_at = ? WHERE id = ?
        `).run(pnl, status, Math.floor(Date.now() / 1000), req.params.id);
        
        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating trade:', error.message);
        res.status(500).json({ error: 'Failed to update trade' });
    }
});

// Get P&L summary
app.get('/api/pnl', async (req, res) => {
    try {
        const db = getDatabase();
        
        const summary = db.prepare(`
            SELECT 
                COUNT(*) as total_trades,
                SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed_trades,
                SUM(pnl) as total_pnl,
                AVG(pnl) as avg_pnl,
                MAX(pnl) as max_pnl,
                MIN(pnl) as min_pnl,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
                SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades
            FROM trades
            WHERE status IN ('executed', 'closed')
        `).get();
        
        const dailyPnl = db.prepare(`
            SELECT 
                DATE(created_at, 'unixepoch') as date,
                SUM(pnl) as pnl,
                COUNT(*) as trades
            FROM trades
            WHERE status IN ('executed', 'closed')
            GROUP BY DATE(created_at, 'unixepoch')
            ORDER BY date DESC
            LIMIT 30
        `).all();
        
        db.close();
        
        res.json({
            summary,
            dailyPnl: dailyPnl.reverse()
        });
    } catch (error) {
        console.error('Error fetching P&L:', error.message);
        res.status(500).json({ error: 'Failed to fetch P&L data' });
    }
});

// ============= SCHEDULED TASKS =============

// Refresh markets every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('Refreshing market data...');
    try {
        const response = await axios.get(`${GAMMA_API}/markets`, {
            params: { active: true, closed: false, limit: 100 }
        });
        marketsCache = response.data;
    } catch (error) {
        console.error('Error refreshing markets:', error.message);
    }
});

// Refresh news every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('Refreshing news feed...');
    try {
        const feed = await rssParser.parseURL(process.env.RSS_FEED_URL || 'https://mashable.com/feeds/rss/all');
        newsCache = feed.items;
    } catch (error) {
        console.error('Error refreshing news:', error.message);
    }
});

// Run edge detection every 10 minutes
cron.schedule('*/10 * * * *', async () => {
    console.log('Running edge detection...');
    try {
        if (marketsCache.length > 0 && newsCache.length > 0) {
            edgeOpportunities = await edgeDetector.findEdges(marketsCache, newsCache);
            console.log(`Found ${edgeOpportunities.length} edge opportunities`);
        }
    } catch (error) {
        console.error('Error in edge detection:', error.message);
    }
});

// ============= START SERVER =============

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('  📊 POLYMARKET EDGE DETECTION DASHBOARD');
    console.log('='.repeat(60));
    console.log(`\n  🚀 Server running: http://localhost:${PORT}`);
    console.log(`  📊 Auto-trading: ${process.env.AUTO_TRADE_ENABLED === 'true' ? '✅ ENABLED' : '⚠️  DISABLED'}`);
    console.log(`  💰 Max trade size: $${process.env.MAX_TRADE_SIZE || 100}`);
    console.log(`  📈 Min edge threshold: ${(parseFloat(process.env.MIN_EDGE_THRESHOLD || 0.05) * 100).toFixed(1)}%`);
    console.log(`\n  📚 Documentation: See README.md`);
    console.log(`  🎯 Quick Start: Open browser to http://localhost:${PORT}`);
    console.log('\n' + '='.repeat(60) + '\n');
});

module.exports = app;

