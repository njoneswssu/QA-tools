# 📚 Polymarket Edge Dashboard - Complete Guide

*Last Updated: January 5, 2026*

---

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp poly.env.example poly.env
# Edit poly.env with your settings

# Start dashboard
npm start

# Open browser
http://localhost:3005
```

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Features](#features)
5. [Usage Guide](#usage-guide)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)
8. [Recent Updates](#recent-updates)

---

## Overview

**Polymarket Edge Dashboard** is a comprehensive trading dashboard for Polymarket prediction markets featuring:

- 📊 **Market Analysis** - Real-time data for 500+ active markets
- 🎯 **Edge Detection** - AI-powered opportunity identification
- 💰 **Trade Execution** - Automated and manual trading
- 📈 **P&L Tracking** - Performance monitoring and analytics
- 📰 **News Integration** - Mashable RSS feed for market insights
- 🔍 **Smart Money Tracking** - Whale activity and volume spike detection
- ⚡ **Real-time Updates** - WebSocket-powered live data

---

## Installation

### Prerequisites

- Node.js 18+ and npm
- SQLite3
- Polygon wallet with USDC (for trading)

### Setup Steps

```bash
# 1. Clone/navigate to directory
cd /Users/neil/playwrightautomation/polymarket-dashboard

# 2. Install dependencies
npm install

# 3. Configure environment
cp poly.env.example poly.env

# 4. Edit configuration
nano poly.env

# 5. Build TypeScript
npm run build

# 6. Start server
npm start
```

---

## Configuration

### Environment Variables (`poly.env`)

```bash
# Server
PORT=3005

# Polymarket API
POLYMARKET_API_KEY=optional

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
RPC_URL=https://polygon-rpc.com

# Trading Limits
MAX_TRADE_SIZE=100
MIN_EDGE_THRESHOLD=0.05

# News Feed
RSS_FEED_URL=https://mashable.com/feeds/rss/all

# Smart Money Detection
WHALE_THRESHOLD=50000
VOLUME_SPIKE_MULTIPLIER=3.0
FRESH_WALLET_AGE_DAYS=7
```

### Key Settings

- **MIN_EDGE_THRESHOLD**: Lower = more opportunities detected (0.03-0.10)
- **WHALE_THRESHOLD**: Minimum bet size to trigger whale alert ($)
- **MAX_TRADE_SIZE**: Maximum single trade size ($)

---

## Features

### 1. Market Discovery

- **500+ Active Markets** - Fetches up to 500 live markets
- **Category Filtering** - Filter by crypto, sports, politics, etc.
- **Search Functionality** - Find specific markets quickly
- **Price Display** - Real-time YES/NO prices in cents

### 2. Edge Detection

**Algorithms:**
1. **Volume Analysis** - Identifies volume imbalances
2. **Spread Arbitrage** - Detects pricing inefficiencies
3. **News Correlation** - Matches news with markets
4. **Pure Arbitrage** - Finds cross-market opportunities
5. **Market Inefficiency** - Spots mispriced outcomes
6. **Whale Activity** - Tracks large bets (>$50k)
7. **Fresh Wallet Detection** - Identifies new accounts with history
8. **Volume Spike Detection** - Catches unusual volume increases

### 3. Trade Execution

- **One-Click Trading** - Click price buttons to trade
- **Pre-Selected Sides** - Auto-selects YES/NO from edge opportunities
- **Position Sizing** - Kelly Criterion calculator
- **Order Management** - View and filter all trades
- **Trade History** - Complete P&L tracking

### 4. Real-Time Features

- **WebSocket Updates** - Live market data
- **Auto-Refresh News** - Updates every 10 minutes
- **Balance Updates** - USDC balance every 30 seconds
- **Live P&L** - Real-time profit/loss tracking

### 5. Smart Money Detection

Visual alerts for:
- 🐋 **Whale Bets** - Large positions (>$50k)
- 🆕 **Fresh Wallets** - New accounts with no history
- 📈 **Volume Spikes** - 3x normal volume increases
- 🔥 **High Confidence** - Multiple indicators combined

---

## Usage Guide

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Polymarket Edge     [🔄 Refresh]  Balance: $1,234.56 🟢 │
├──────────────┬────────────────────────────┬─────────────────┤
│  Edge Opps   │        Markets             │      News       │
│  (scroll)    │       (scroll)             │    (scroll)     │
│              │                            │                 │
│  ─────────   │                            │                 │
│    P&L       │                            │                 │
│  (charts)    │                            │                 │
├──────────────┴────────────────────────────┴─────────────────┤
│                    Trades Table                             │
└─────────────────────────────────────────────────────────────┘
```

### Finding Opportunities

1. **Check Edge Opportunities** (left column)
   - Shows detected edges sorted by score
   - Click any opportunity to open trade modal
   - High alerts highlighted with 🔥 badge

2. **Browse Markets** (center)
   - Use search or category filter
   - Click YES/NO prices to trade
   - Shows volume and expiry date

3. **Monitor News** (right column)
   - Auto-refreshes every 10 minutes
   - Look for market-relevant articles
   - Click links to read full stories

### Executing Trades

**Method 1: From Edge Opportunities**
```
1. Click edge opportunity
2. Modal opens with pre-selected side
3. Adjust size/price if needed
4. Click "Execute Trade"
```

**Method 2: From Markets**
```
1. Click YES or NO price button
2. Modal opens with that side selected
3. Enter position size
4. Click "Execute Trade"
```

**Method 3: Manual**
```
1. Click any market card
2. Choose YES or NO
3. Set size and limit price
4. Execute
```

### Category Filtering

Select from dropdown:
- **All Categories** - Show everything
- **Crypto** - Bitcoin, Ethereum, DeFi
- **Sports** - NBA, NFL, Soccer, etc.
- **Politics** - Elections, policy
- **Business** - Markets, companies
- **Entertainment** - Movies, awards

### Managing Trades

- **Filter by Status** - All, Pending, Executed, Closed
- **Clear All Trades** - Delete history (with confirmation)
- **View P&L** - See cumulative profit/loss
- **Track Performance** - Win rate and statistics

---

## Troubleshooting

### No Markets Loading

**Check:**
```bash
# 1. Server logs
tail -f server.log

# 2. Browser console (F12)
# Look for: "❌ Error loading markets"

# 3. Test API directly
curl http://localhost:3005/api/markets
```

**Fix:**
- Ensure server is running (`npm start`)
- Check network tab in DevTools
- Verify Polymarket API is accessible

### No Edge Opportunities

**Causes:**
- Threshold too high
- Not enough markets loaded
- No matching news articles

**Fix:**
```bash
# Lower threshold in poly.env
MIN_EDGE_THRESHOLD=0.03

# Restart
npm start
```

**Check console for:**
```
✅ Loaded 487 markets for edge detection
✅ Loaded 25 news items for edge detection
🔍 Running edge detection on 487 markets...
✅ Found 12 edge opportunities
```

### Category Filter Not Working

**Check console:**
```javascript
// Should see:
Filtering markets: { categoryFilter: 'crypto', totalMarkets: 487 }
Filtered results: 25 markets
Match found: Bitcoin $100k by 2025?
```

**If no matches:**
- Tags might be in different format
- Try typing keyword in search instead
- Check sample market structure in console

### Prices Showing "NaN¢"

**Cause:** Polymarket returns `outcomePrices` as JSON string

**Fix:** Already implemented - prices should show correctly now

**Verify:**
- Prices show as "65.0¢" not "NaN¢"
- Check console for parsing errors
- Clear browser cache if needed

### Balance Shows $0.00

**Causes:**
- No wallet configured
- Invalid private key
- RPC endpoint not working

**Fix:**
```bash
# Check poly.env
PRIVATE_KEY=0xYourPrivateKeyHere
RPC_URL=https://polygon-rpc.com

# Verify wallet has USDC on Polygon
```

---

## API Reference

### REST Endpoints

#### Markets
```
GET /api/markets
Returns: Array of 500 active markets

GET /api/markets/:id
Returns: Specific market details

GET /api/markets/:id/orderbook
Returns: Order book for market
```

#### Edge Detection
```
GET /api/edge-opportunities
Returns: Array of detected opportunities
```

#### Trading
```
POST /api/trades
Body: { marketId, side, size, price, marketName, edge }
Returns: { tradeId, status }

GET /api/trades
Returns: Array of trade history

PATCH /api/trades/:id
Body: { pnl, status }
Returns: { success: true }

DELETE /api/trades
Returns: { success: true, message }
```

#### Analytics
```
GET /api/pnl
Returns: P&L summary and daily data

GET /api/balance
Returns: { usdc, matic }
```

#### News
```
GET /api/news
Returns: Array of RSS feed items
```

### WebSocket Events

```javascript
// Connect
ws://localhost:3005/ws

// Events
- market_update: { type, data: markets[] }
- edge_update: { type, data: opportunities[] }
- trade_update: { type, data: trade }
- news_update: { type, data: newsItems[] }
```

---

## Recent Updates

### Latest Changes (January 5, 2026)

1. **Increased Market Coverage**
   - Limit increased from 100 to 500 markets
   - Won't miss opportunities anymore

2. **Fixed Category Filter**
   - Properly parses Polymarket's JSON tag strings
   - Searches labels, slugs, and descriptions

3. **Price Display Fix**
   - Handles Polymarket's string format for `outcomePrices`
   - Prices now show correctly as "65.0¢"

4. **Balance Display**
   - Added USDC balance in top right
   - Auto-updates every 30 seconds

5. **News Auto-Refresh**
   - Refreshes every 10 minutes automatically
   - No manual refresh needed

6. **Clear Trades Button**
   - One-click to delete all trade history
   - Confirmation dialog for safety

7. **Enhanced Logging**
   - Detailed console output for debugging
   - Shows market counts and edge detection progress

8. **Single-Page Layout**
   - Removed tabs for better UX
   - Grid layout with scrollable sections

9. **TypeScript Migration**
   - Full codebase converted to TypeScript
   - Better type safety and IDE support

10. **Real-time Updates**
    - WebSocket implementation
    - Live market and edge updates

---

## Best Practices

### Finding Edges

1. **Start Broad** - Let edge detection run
2. **Check Alerts** - Look for 🔥 high-confidence opportunities
3. **Cross-Reference News** - Match with relevant articles
4. **Verify Volume** - Ensure sufficient liquidity
5. **Check Expiry** - Avoid markets closing soon

### Risk Management

1. **Position Sizing** - Use Kelly Criterion
2. **Max Trade Size** - Don't exceed configured limit
3. **Diversification** - Multiple small bets > one large
4. **Stop Losses** - Monitor P&L and exit losers
5. **Liquidity** - Ensure ability to exit positions

### Performance Optimization

1. **Lower Thresholds** - For testing/development
2. **Higher Thresholds** - For production trading
3. **Monitor Volume** - Focus on liquid markets
4. **Track Win Rate** - Adjust strategy based on results

---

## Support & Maintenance

### Log Files

```bash
# Server logs
tail -f server.log

# Database
sqlite3 database/polymarket.db ".tables"

# Check market count
sqlite3 database/polymarket.db "SELECT COUNT(*) FROM markets;"
```

### Database Maintenance

```bash
# Backup database
cp database/polymarket.db database/backup_$(date +%Y%m%d).db

# Clear old trades
sqlite3 database/polymarket.db "DELETE FROM trades WHERE created_at < DATE('now', '-30 days');"

# Vacuum database
sqlite3 database/polymarket.db "VACUUM;"
```

### Performance Tips

1. **Increase Market Limit** - Up to 1000 if needed
2. **Optimize Edge Detection** - Adjust algorithm weights
3. **Cache Responses** - Reduce API calls
4. **Database Indexing** - For faster queries

---

## Security Considerations

### Private Key Safety

⚠️ **CRITICAL**: Never commit `poly.env` to git!

```bash
# Add to .gitignore
echo "poly.env" >> .gitignore

# Use separate wallet for trading
# Not your main funds!
```

### Production Deployment

1. **Use Environment Variables** - Not .env files
2. **Enable Authentication** - Add API key protection
3. **Rate Limiting** - Prevent abuse
4. **HTTPS Only** - Secure connections
5. **Wallet Permissions** - Limit trade sizes

---

## Development

### Project Structure

```
polymarket-dashboard/
├── src/
│   ├── server.ts           # Express server
│   ├── types.ts            # TypeScript definitions
│   ├── database/
│   │   └── init.ts         # Database setup
│   └── utils/
│       ├── edge-detector.ts       # Edge algorithms
│       ├── trade-executor.ts      # Trade execution
│       └── realtime-monitor.ts    # WebSocket server
├── public/
│   ├── index.html          # Dashboard UI
│   ├── app.js              # Frontend logic
│   └── styles.css          # Styles
├── database/
│   └── polymarket.db       # SQLite database
├── poly.env                # Configuration
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

### Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Start server
npm start

# Run tests
npm test
```

---

## FAQ

**Q: How often does data refresh?**
A: Markets - real-time via WebSocket; News - every 10 minutes; Balance - every 30 seconds

**Q: Can I trade automatically?**
A: Yes, set `AUTO_TRADE_ENABLED=true` in poly.env (use with caution)

**Q: How many markets are tracked?**
A: Up to 500 active markets, configurable in server.ts

**Q: What's the minimum edge to trade?**
A: Default 5% (0.05), configurable via MIN_EDGE_THRESHOLD

**Q: Does it work on mobile?**
A: Responsive design works on tablets, limited on phones

**Q: Can I customize edge algorithms?**
A: Yes, edit src/utils/edge-detector.ts

**Q: How do I reset everything?**
A: Delete database/polymarket.db and restart

---

## License & Disclaimer

**Educational purposes only.** Trading prediction markets involves risk. Past performance does not guarantee future results. Use at your own risk.

---

## Contact & Support

For issues or questions:
1. Check console logs (F12)
2. Review this documentation
3. Check server.log file
4. Verify configuration in poly.env

---

*Built with Node.js, Express, SQLite, and TypeScript*
*Powered by Polymarket CLOB API*

