# Polymarket Dashboard - Quick Reference

## 🚀 Quick Start

```bash
cd polymarket-dashboard
npm install
cp .env.example .env
npm start
```

Open browser: http://localhost:3005

## 📊 Dashboard Features

### Markets Tab
- Browse 100+ active Polymarket markets
- Search by keyword
- Filter by category
- View real-time YES/NO prices
- Click any market to trade

### Edge Opportunities Tab
- **Automated edge detection** runs every 10 minutes
- Shows edge %, confidence level, and reasoning
- Multiple detection strategies:
  - 📉 Thin market inefficiencies
  - 📊 Spread arbitrage
  - 📰 News correlation
  - 🎯 Pure arbitrage
  - 🔍 Market mispricing

### Trades Tab
- Complete trade history
- Filter by status
- Track P&L per trade
- Monitor execution

### P&L Tab
- Total profit/loss
- Win rate statistics
- Cumulative P&L chart
- Win/loss ratio pie chart

### News Feed Tab
- Live Mashable RSS feed
- Auto-refreshes every 5 minutes
- Used for news correlation analysis

## 🎯 How to Find Edge

### 1. Let the Algorithm Work
- Go to "Edge Opportunities" tab
- Click "Refresh Edge Detection"
- Review opportunities sorted by edge %
- Look for high confidence opportunities

### 2. Manual Analysis
- Browse markets for unusual prices
- Check low volume markets (<$10k)
- Look for YES + NO ≠ 100¢
- Check news for market-relevant events

### 3. Trade Execution
- Click on any opportunity
- Review market details
- Select side (YES/NO)
- Enter position size
- Set limit price
- Click "Place Trade"

## ⚙️ Configuration

### Safe Mode (Default)
```env
AUTO_TRADE_ENABLED=false
MAX_TRADE_SIZE=100
MIN_EDGE_THRESHOLD=0.05
```
- Trades require manual approval
- Saved to database only
- No real execution

### Auto-Trade Mode (Advanced)
```env
AUTO_TRADE_ENABLED=true
POLYMARKET_PRIVATE_KEY=your_key
MAX_TRADE_SIZE=100
MIN_EDGE_THRESHOLD=0.05
```
- Automatically executes high-edge trades
- ⚠️ **REAL MONEY AT RISK**
- Use with caution

## 🧮 Edge Detection Strategies

### Volume Edge
```
Markets with < $10k volume
+ Extreme prices (>80% or <20%)
= Potential mispricing
```

### Spread Edge
```
Efficient markets: YES + NO ≈ 100¢
If YES + NO < 95¢
= Arbitrage opportunity
```

### News Edge
```
Recent news about market topic
+ Sentiment contradicts price
= Potential edge
```

### Inefficiency Edge
```
Niche market
+ Low liquidity
+ Near expiration
= Potential edge
```

## 📈 P&L Tracking

### Metrics Tracked:
- Total P&L
- Number of trades
- Win rate %
- Average trade P&L
- Best/worst trades
- Daily P&L

### Charts:
- Cumulative P&L over time
- Win/loss ratio
- Trade volume

## 🔒 Safety Features

1. **Position Sizing**
   - Kelly Criterion (25% fractional)
   - Configurable max size
   - Risk percentage limits

2. **Trade Validation**
   - Edge threshold requirements
   - Market liquidity checks
   - Price sanity checks

3. **Audit Trail**
   - All trades logged to database
   - Timestamps and execution data
   - Complete history

## 📱 UI Navigation

```
Header:
├── Markets (Browse all markets)
├── Edge (View opportunities)
├── Trades (Trade history)
├── P&L (Performance charts)
└── News (RSS feed)

Trade Modal:
├── Market details
├── Current prices
├── Side selection (YES/NO)
├── Position size input
├── Limit price input
├── Potential payout calculator
└── Execute button
```

## 🔄 Auto-Refresh Schedule

- Markets: Every 5 minutes
- News: Every 5 minutes
- Edge Detection: Every 10 minutes

## 💡 Tips for Success

1. **Start Small**
   - Use small position sizes initially
   - Learn the platform before scaling

2. **Diversify**
   - Don't put all capital in one market
   - Spread across multiple opportunities

3. **Be Selective**
   - Focus on high confidence edges
   - Avoid markets you don't understand

4. **Monitor News**
   - Check news feed regularly
   - Look for market-moving events

5. **Track Performance**
   - Review P&L weekly
   - Analyze winning vs losing trades
   - Adjust strategy based on data

## 🐛 Common Issues

### "Failed to load markets"
- Check internet connection
- Polymarket API may be down
- Wait and retry

### "Trade execution failed"
- Check wallet has sufficient USDC
- Verify private key is correct
- Check Polygon network status

### Database errors
```bash
rm database/polymarket.db
npm start
```

## 📚 Resources

- [Polymarket Docs](https://docs.polymarket.com)
- [CLOB API](https://docs.polymarket.com/api)
- [Polygon Network](https://polygon.technology)

## ⚠️ Disclaimer

This software is for educational purposes. 
Trading involves risk. Never invest more than you can afford to lose.
Past performance does not guarantee future results.

---

**Version:** 1.0.0  
**Updated:** January 2026

