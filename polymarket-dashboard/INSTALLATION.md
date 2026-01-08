# Installation & Setup Guide

## Prerequisites

- Node.js 16+ installed
- (Optional) Polymarket API credentials
- (Optional) Ethereum wallet with USDC on Polygon network

## Quick Start

1. **Navigate to the project directory:**
```bash
cd polymarket-dashboard
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp poly.env
# Edit .env with your settings
```

4. **Start the server:**
```bash
npm start
# Or for development:
npm run dev
```

5. **Open your browser:**
```
http://localhost:3005
```

## Configuration Options

### `.env` File Settings

```env
# Polymarket API (Optional - for live trading)
POLYMARKET_API_KEY=your_api_key_here
POLYMARKET_PRIVATE_KEY=your_wallet_private_key

# Trading Safety Settings
AUTO_TRADE_ENABLED=false        # Set to 'true' to enable automated trading
MAX_TRADE_SIZE=100              # Maximum trade size in USD
MIN_EDGE_THRESHOLD=0.05         # Minimum edge (5%) required to flag opportunity
RISK_PERCENTAGE=0.02            # Max 2% of bankroll per trade

# Server Configuration
PORT=3005                        # Server port
NODE_ENV=development

# Database
DB_PATH=./database/polymarket.db

# RSS Feed
RSS_FEED_URL=https://mashable.com/feeds/rss/all
RSS_REFRESH_INTERVAL=300000     # 5 minutes
```

## Features Overview

### 1. **Markets Tab**
- Browse all active Polymarket markets
- Search and filter by category
- View current YES/NO prices
- Click to open trade modal

### 2. **Edge Opportunities Tab**
- Automated edge detection based on:
  - Volume analysis (thin markets)
  - Spread inefficiencies
  - News correlation
  - Arbitrage opportunities
  - Market mispricing
- Shows edge score, confidence level, and reasoning
- Click to trade directly

### 3. **Trades Tab**
- View all trade history
- Filter by status (pending, executed, closed, failed)
- Track P&L per trade
- Monitor trade execution

### 4. **P&L Tab**
- Total profit/loss summary
- Win rate and trade statistics
- Cumulative P&L chart
- Win/loss ratio visualization

### 5. **News Feed Tab**
- Live Mashable RSS feed
- Auto-refresh every 5 minutes
- Click to read full article
- Used for news correlation edge detection

## Edge Detection Algorithm

The dashboard uses multiple strategies to identify mispriced markets:

### 1. **Volume-Based Edge**
- Targets markets with <$10k volume
- Extreme prices (>80% or <20%) in thin markets often indicate inefficiency

### 2. **Spread Analysis**
- Efficient markets should have YES + NO ≈ 100¢
- Deviations >15% suggest arbitrage opportunities

### 3. **News Correlation**
- Matches market keywords with recent news articles
- Performs sentiment analysis on matched articles
- Flags markets where sentiment contradicts current pricing

### 4. **Pure Arbitrage**
- Identifies markets where YES + NO < 95¢
- Can buy both outcomes for guaranteed profit

### 5. **Market Inefficiency**
- Focuses on niche markets with low liquidity
- Near-expiration markets with extreme prices

## Trading Workflow

### Manual Trading (Recommended)
1. Browse markets or edge opportunities
2. Click on a market to open trade modal
3. Select YES or NO side
4. Enter position size and limit price
5. Review potential payout and profit
6. Click "Place Trade"
7. Trade is saved to database (not executed)

### Automated Trading (Advanced)
1. Set `AUTO_TRADE_ENABLED=true` in `.env`
2. Add your `POLYMARKET_PRIVATE_KEY`
3. Configure `MAX_TRADE_SIZE` and `MIN_EDGE_THRESHOLD`
4. Trades will execute automatically when edge detected
5. **WARNING**: Only enable if you understand the risks

## Safety Features

- **Trade Limits**: Configurable maximum position size
- **Edge Threshold**: Only trades with sufficient edge
- **Kelly Criterion**: Optimal position sizing (25% fractional Kelly)
- **Manual Approval**: Default mode requires manual trade confirmation
- **Trade Logging**: Complete audit trail in database
- **Simulated Mode**: Test without real money

## Database Schema

### Tables:
- `markets` - Active market data
- `trades` - All trade history
- `edge_opportunities` - Detected edges
- `news_items` - RSS feed cache
- `market_news_correlations` - News-market relationships

## API Endpoints

### Markets
- `GET /api/markets` - List all active markets
- `GET /api/markets/:id` - Get market details
- `GET /api/markets/:id/orderbook` - Get market orderbook

### Edge Detection
- `GET /api/edge-opportunities` - Get detected edges

### Trading
- `POST /api/trades` - Create new trade
- `GET /api/trades` - Get trade history
- `PATCH /api/trades/:id` - Update trade (close position)

### Analytics
- `GET /api/pnl` - Get P&L summary and charts

### News
- `GET /api/news` - Get RSS feed items

## Scheduled Tasks

- **Markets refresh**: Every 5 minutes
- **News refresh**: Every 5 minutes
- **Edge detection**: Every 10 minutes

## Troubleshooting

### Port already in use
```bash
# Change PORT in .env file
PORT=3006
```

### Database errors
```bash
# Delete and recreate database
rm database/polymarket.db
npm start
```

### API rate limits
```bash
# Increase refresh intervals in server.js
# Change cron schedules to run less frequently
```

## Development

### Run with auto-reload:
```bash
npm run dev
```

### Logs location:
- Console output shows all API calls and edge detection
- Trade execution logs in database

## Security Notes

- Never commit `.env` file to git
- Keep your private key secure
- Start with small trade sizes
- Use simulated mode for testing
- Monitor automated trades closely

## Support

For issues or questions, check:
1. Console logs for errors
2. Database for trade records
3. API responses in browser DevTools

## License

MIT License - Use at your own risk

