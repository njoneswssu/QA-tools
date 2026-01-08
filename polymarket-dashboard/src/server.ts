import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import RSSParser from 'rss-parser';
import cron from 'node-cron';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from './database/init';
import { EdgeDetector } from './utils/edge-detector';
import { TradeExecutor } from './utils/trade-executor';
import { RealtimeMonitor } from './utils/realtime-monitor';
import { Market, NewsItem, EdgeOpportunity, PnLSummary } from './types';

dotenv.config({ path: './poly.env' });

const app = express();
const PORT = parseInt(process.env.PORT || '3005');
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize
initDatabase();
const rssParser = new RSSParser();
const edgeDetector = new EdgeDetector();
const tradeExecutor = new TradeExecutor();
const realtimeMonitor = new RealtimeMonitor(server);

// Polymarket API endpoints
const POLYMARKET_API = 'https://clob.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

// Cache for market data
let marketsCache: Market[] = [];
let newsCache: NewsItem[] = [];
let edgeOpportunities: EdgeOpportunity[] = [];

// ============= POLYMARKET API ROUTES =============

app.get('/api/balance', async (_req: Request, res: Response) => {
    try {
        const balance = await tradeExecutor.getBalance();
        res.json(balance);
    } catch (error: any) {
        console.error('Error fetching balance:', error.message);
        res.status(500).json({ error: 'Failed to fetch balance', usdc: 0, matic: 0 });
    }
});

app.get('/api/markets', async (_req: Request, res: Response) => {
    try {
        // Fetch more markets - increase limit to get all active markets
        const response = await axios.get(`${GAMMA_API}/markets`, {
            params: {
                active: true,
                closed: false,
                limit: 500  // Increased from 100 to 500
            }
        });
        
        const markets: Market[] = response.data;
        
        console.log(`✅ Fetched ${markets.length} active markets`);
        
        // Update database
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO markets (id, name, description, end_date, volume, liquidity, yes_price, no_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        markets.forEach(market => {
            stmt.run(
                market.id,
                market.question || market.name,
                market.description,
                new Date(market.endDate).getTime(),
                market.volume || 0,
                market.liquidity || 0,
                market.outcomePrices?.[0] || 0.5,
                market.outcomePrices?.[1] || 0.5
            );
        });
        
        db.close();
        marketsCache = markets;
        
        // Broadcast update to connected clients
        realtimeMonitor.broadcastMarketUpdate(markets);
        
        res.json(markets);
    } catch (error: any) {
        console.error('Error fetching markets:', error.message);
        res.status(500).json({ error: 'Failed to fetch markets' });
    }
});

app.get('/api/markets/:id', async (req: Request, res: Response) => {
    try {
        const response = await axios.get(`${GAMMA_API}/markets/${req.params.id}`);
        res.json(response.data);
    } catch (error: any) {
        console.error('Error fetching market:', error.message);
        res.status(500).json({ error: 'Failed to fetch market' });
    }
});

app.get('/api/markets/:id/orderbook', async (req: Request, res: Response) => {
    try {
        const response = await axios.get(`${POLYMARKET_API}/book`, {
            params: {
                token_id: req.params.id
            }
        });
        res.json(response.data);
    } catch (error: any) {
        console.error('Error fetching orderbook:', error.message);
        res.status(500).json({ error: 'Failed to fetch orderbook' });
    }
});

// ============= RSS FEED ROUTES =============

app.get('/api/news', async (_req: Request, res: Response) => {
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
                item.contentSnippet || item.content,
                item.pubDate,
                item.content || ''
            );
        });
        
        db.close();
        newsCache = feed.items as NewsItem[];
        
        // Broadcast news update
        realtimeMonitor.broadcastNewsUpdate(feed.items.slice(0, 50));
        
        res.json(feed.items.slice(0, 50));
    } catch (error: any) {
        console.error('Error fetching RSS feed:', error.message);
        res.status(500).json({ error: 'Failed to fetch news feed' });
    }
});

// ============= EDGE DETECTION ROUTES =============

app.get('/api/edge-opportunities', async (_req: Request, res: Response) => {
    try {
        // Always fetch fresh markets data
        if (marketsCache.length === 0) {
            const response = await axios.get(`${GAMMA_API}/markets`, {
                params: { active: true, closed: false, limit: 500 }
            });
            marketsCache = response.data;
            console.log(`✅ Loaded ${marketsCache.length} markets for edge detection`);
        }
        
        // Fetch news if needed
        if (newsCache.length === 0) {
            const feed = await rssParser.parseURL(process.env.RSS_FEED_URL || 'https://mashable.com/feeds/rss/all');
            newsCache = feed.items as NewsItem[];
            console.log(`✅ Loaded ${newsCache.length} news items for edge detection`);
        }
        
        // Run edge detection
        console.log(`🔍 Running edge detection on ${marketsCache.length} markets...`);
        edgeOpportunities = await edgeDetector.findEdges(marketsCache, newsCache);
        console.log(`✅ Found ${edgeOpportunities.length} edge opportunities`);
        
        // Save to database
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO edge_opportunities (market_id, market_name, edge_score, reason, yes_price, no_price)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        edgeOpportunities.forEach((opp: EdgeOpportunity) => {
            try {
                stmt.run(
                    opp.marketId,
                    opp.marketName,
                    opp.edgeScore,
                    opp.reason,
                    opp.yesPrice,
                    opp.noPrice
                );
            } catch (e) {
                // Ignore duplicate key errors
            }
        });
        
        db.close();
        
        // Broadcast to connected clients
        realtimeMonitor.broadcastEdgeUpdate(edgeOpportunities);
        
        res.json(edgeOpportunities);
    } catch (error: any) {
        console.error('Error detecting edges:', error.message);
        res.status(500).json({ error: 'Failed to detect edge opportunities' });
    }
});

// ============= TRADING ROUTES =============

app.post('/api/trades', async (req: Request, res: Response): Promise<void> => {
    try {
        const { marketId, side, size, price, marketName, edge } = req.body as {
            marketId: string;
            side: 'YES' | 'NO';
            size: number;
            price: number;
            marketName?: string;
            edge?: number;
        };
        
        if (!marketId || !side || !size || !price) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        
        if (size > parseFloat(process.env.MAX_TRADE_SIZE || '100')) {
            res.status(400).json({ error: 'Trade size exceeds maximum' });
            return;
        }
        
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
                    market_id: marketId,
                    market_name: marketName || '',
                    side,
                    size,
                    price
                });
                
                db.prepare(`
                    UPDATE trades SET status = ?, executed_at = ? WHERE id = ?
                `).run('executed', Math.floor(Date.now() / 1000), tradeId);
                
                db.close();
                
                // Broadcast trade update
                realtimeMonitor.broadcastTradeUpdate({ id: tradeId, status: 'executed', ...executionResult });
                
                res.json({
                    success: true,
                    tradeId,
                    executed: true,
                    executionResult
                });
            } catch (execError: any) {
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
            
            // Broadcast trade update
            realtimeMonitor.broadcastTradeUpdate({ id: tradeId, status: 'pending' });
            
            res.json({
                success: true,
                tradeId,
                executed: false,
                message: 'Trade saved but not executed (auto-trade disabled)'
            });
        }
    } catch (error: any) {
        console.error('Error creating trade:', error.message);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

app.get('/api/trades', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        const trades = db.prepare(`
            SELECT * FROM trades ORDER BY created_at DESC LIMIT 100
        `).all();
        db.close();
        
        res.json(trades);
    } catch (error: any) {
        console.error('Error fetching trades:', error.message);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

app.patch('/api/trades/:id', async (req: Request, res: Response) => {
    try {
        const { pnl, status } = req.body;
        const db = getDatabase();
        
        db.prepare(`
            UPDATE trades SET pnl = ?, status = ?, closed_at = ? WHERE id = ?
        `).run(pnl, status, Math.floor(Date.now() / 1000), req.params.id);
        
        db.close();
        
        // Broadcast trade update
        realtimeMonitor.broadcastTradeUpdate({ id: req.params.id, pnl, status });
        
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error updating trade:', error.message);
        res.status(500).json({ error: 'Failed to update trade' });
    }
});

app.delete('/api/trades', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        db.prepare('DELETE FROM trades').run();
        db.close();
        
        console.log('✅ All trades cleared');
        
        // Broadcast update to all clients
        realtimeMonitor.broadcastTradeUpdate({ cleared: true });
        
        res.json({ success: true, message: 'All trades cleared' });
    } catch (error: any) {
        console.error('Error clearing trades:', error.message);
        res.status(500).json({ error: 'Failed to clear trades' });
    }
});

app.get('/api/pnl', async (_req: Request, res: Response) => {
    try {
        const db = getDatabase();
        
        const summary: PnLSummary = db.prepare(`
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
        `).get() as PnLSummary;
        
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
    } catch (error: any) {
        console.error('Error fetching P&L:', error.message);
        res.status(500).json({ error: 'Failed to fetch P&L data' });
    }
});

// ============= REALTIME MONITORING STATUS =============

app.get('/api/status', (_req: Request, res: Response) => {
    res.json({
        connected_clients: realtimeMonitor.getClientCount(),
        markets_cached: marketsCache.length,
        edge_opportunities: edgeOpportunities.length,
        news_cached: newsCache.length,
        auto_trading: process.env.AUTO_TRADE_ENABLED === 'true',
        uptime: process.uptime()
    });
});

// ============= SCHEDULED TASKS (AUTO-REFRESH) =============

// Refresh markets every 2 minutes (more frequent than before)
cron.schedule('*/2 * * * *', async () => {
    console.log('🔄 Auto-refreshing market data...');
    try {
        const response = await axios.get(`${GAMMA_API}/markets`, {
            params: { active: true, closed: false, limit: 100 }
        });
        marketsCache = response.data;
        
        // Broadcast to all connected clients
        realtimeMonitor.broadcastMarketUpdate(marketsCache);
        console.log(`✅ Broadcasted ${marketsCache.length} markets to ${realtimeMonitor.getClientCount()} clients`);
    } catch (error: any) {
        console.error('Error auto-refreshing markets:', error.message);
    }
});

// Refresh news every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Auto-refreshing news feed...');
    try {
        const feed = await rssParser.parseURL(process.env.RSS_FEED_URL || 'https://mashable.com/feeds/rss/all');
        newsCache = feed.items as NewsItem[];
        
        // Broadcast to all connected clients
        realtimeMonitor.broadcastNewsUpdate(newsCache.slice(0, 50));
        console.log(`✅ Broadcasted ${newsCache.length} news items`);
    } catch (error: any) {
        console.error('Error auto-refreshing news:', error.message);
    }
});

// Run edge detection every 3 minutes (more frequent)
cron.schedule('*/3 * * * *', async () => {
    console.log('🔄 Auto-running edge detection...');
    try {
        if (marketsCache.length > 0 && newsCache.length > 0) {
            edgeOpportunities = await edgeDetector.findEdges(marketsCache, newsCache);
            
            // Broadcast to all connected clients
            realtimeMonitor.broadcastEdgeUpdate(edgeOpportunities);
            console.log(`✅ Found ${edgeOpportunities.length} edge opportunities`);
        }
    } catch (error: any) {
        console.error('Error in auto edge detection:', error.message);
    }
});

// ============= START SERVER =============

server.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('  📊 POLYMARKET EDGE DETECTION DASHBOARD (TypeScript)');
    console.log('='.repeat(60));
    console.log(`\n  🚀 Server running: http://localhost:${PORT}`);
    console.log(`  🔌 WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`  📊 Auto-trading: ${process.env.AUTO_TRADE_ENABLED === 'true' ? '✅ ENABLED' : '⚠️  DISABLED'}`);
    console.log(`  💰 Max trade size: $${process.env.MAX_TRADE_SIZE || 100}`);
    console.log(`  📈 Min edge threshold: ${(parseFloat(process.env.MIN_EDGE_THRESHOLD || '0.05') * 100).toFixed(1)}%`);
    console.log(`  🔄 Auto-refresh: ✅ ENABLED`);
    console.log(`     • Markets: Every 2 minutes`);
    console.log(`     • News: Every 5 minutes`);
    console.log(`     • Edge Detection: Every 3 minutes`);
    console.log(`\n  📚 Documentation: See README.md`);
    console.log(`  🎯 Quick Start: Open browser to http://localhost:${PORT}`);
    console.log('\n' + '='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        realtimeMonitor.close();
        process.exit(0);
    });
});

