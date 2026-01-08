# 📈 Stock Pattern Monitor - Complete Guide

A comprehensive Python-based stock monitoring system that identifies technical chart patterns in the top 100 tech stocks and sends Discord webhook notifications with **visual charts** and **entry price suggestions** for trading signals.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Features](#-features)
3. [Installation](#-installation)
4. [Configuration](#-configuration)
5. [Usage](#-usage)
6. [Pattern Details](#-pattern-details)
7. [Discord Notifications](#-discord-notifications)
8. [Technical Indicators](#-technical-indicators)
9. [File Overview](#-file-overview)
10. [Troubleshooting](#-troubleshooting)
11. [Advanced Configuration](#-advanced-configuration)
12. [Risk Management](#️-risk-management)
13. [Support](#-support)

---

## 🚀 Quick Start

### 3-Step Setup (5 Minutes)

#### Step 1: Install Dependencies
```bash
cd stock-monitor
pip install -r requirements_stock.txt
```

#### Step 2: Configure Discord Webhook
1. Open Discord → Your Server → Channel Settings
2. Integrations → Webhooks → New Webhook
3. Copy the Webhook URL
4. Edit `stock_monitor_config.json`:
```json
{
  "discord_webhook": "YOUR_WEBHOOK_URL_HERE",
  "check_interval_minutes": 60,
  "lookback_days": 90,
  "chart_display_days": 90,
  "min_confidence": 0.75
}
```

#### Step 3: Test Discord Webhook
```bash
# Test your Discord webhook (recommended first step!)
python stock_pattern_monitor.py test-webhook

# Test with a specific stock
python stock_pattern_monitor.py test-webhook NVDA
```

#### Step 4: Run!
```bash
# Test with examples (safe, no notifications)
python stock_monitor_example.py

# Single scan (test mode)
python stock_pattern_monitor.py scan

# Continuous monitoring
./start_stock_monitor.sh    # Mac/Linux
start_stock_monitor.bat      # Windows
```

---

## 🎯 Features

### 8 Pattern Detection Algorithms

#### 🟢 Bullish Patterns (Buy Signals)
1. **Cup and Handle** - Classic continuation pattern with breakout potential
2. **Bull Flag** - Short-term consolidation after strong upward movement
3. **Inverse Head & Shoulders** - Reversal from bearish to bullish trend
4. **Double Bottom** - Support confirmation with upward reversal
5. **Ascending Triangle** - Consolidation with upward breakout
6. **Falling Wedge** - Converging downtrend lines with upward breakout

#### 🔴 Bearish Patterns (Sell Signals)
7. **Head and Shoulders** - Reversal from bullish to bearish trend
8. **Double Top** - Resistance confirmation with downward reversal

### 🎨 Visual Chart Generation
- Automatic chart generation for each detected pattern
- Pattern highlighted on price chart
- Support/resistance levels marked
- Entry price clearly indicated
- Sent directly to Discord webhook

### 💡 Smart Entry Price Suggestions
- Calculated based on pattern characteristics
- Considers support/resistance levels
- Accounts for risk/reward ratios
- Conservative entry recommendations

### 📊 Advanced Features
- ✅ Monitors 100 tech stocks (customizable)
- ✅ Confidence scoring (0-100%)
- ✅ Price targets and stop-loss recommendations
- ✅ Support/resistance level identification
- ✅ Volume analysis and confirmation
- ✅ Technical indicator integration (RSI, MACD, Bollinger Bands, ATR)
- ✅ Comprehensive logging system
- ✅ Duplicate signal prevention
- ✅ Rate limiting for API protection

---

## 📦 Installation

### Requirements
- Python 3.8 or higher
- Internet connection for real-time stock data
- Discord webhook URL (for notifications)

### Install Dependencies

```bash
pip install -r requirements_stock.txt
```

**Required Packages:**
- `yfinance>=0.2.32` - Stock data from Yahoo Finance
- `pandas>=2.0.0` - Data manipulation
- `numpy>=1.24.0` - Numerical computing
- `scipy>=1.10.0` - Scientific computing (peak detection)
- `requests>=2.31.0` - HTTP requests for Discord
- `matplotlib>=3.7.0` - Chart generation
- `pillow>=10.0.0` - Image processing

---

## ⚙️ Configuration

### Configuration File: `stock_monitor_config.json`

```json
{
  "discord_webhook": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL",
  "check_interval_minutes": 60,
  "lookback_days": 90,
  "min_confidence": 0.75,
  "custom_stocks": []
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `discord_webhook` | string | `""` | Your Discord webhook URL |
| `check_interval_minutes` | integer | `60` | Minutes between scans |
| `lookback_days` | integer | `90` | Historical data window (days) for analysis |
| `chart_display_days` | integer | `90` | Days to display in chart images (max: lookback_days) |
| `min_confidence` | float | `0.75` | Minimum confidence threshold (0-1) |
| `custom_stocks` | array | `[]` | Custom stock list (optional) |

### Configuration Templates

#### Day Trading (High Frequency)
```json
{
  "check_interval_minutes": 15,
  "lookback_days": 20,
  "min_confidence": 0.65
}
```

#### Swing Trading (Balanced)
```json
{
  "check_interval_minutes": 60,
  "lookback_days": 60,
  "min_confidence": 0.75
}
```

#### Position Trading (Conservative)
```json
{
  "check_interval_minutes": 240,
  "lookback_days": 120,
  "min_confidence": 0.85
}
```

#### Sector-Specific (Semiconductors)
```json
{
  "custom_stocks": ["NVDA", "AMD", "INTC", "QCOM", "AVGO", "MU", "TXN"],
  "check_interval_minutes": 30,
  "min_confidence": 0.75
}
```

---

## 🎮 Usage

### Test Discord Webhook (Recommended First!)
Test your Discord configuration before running live:

```bash
# Test with default stock (AAPL)
python stock_pattern_monitor.py test-webhook

# Test with a specific stock
python stock_pattern_monitor.py test-webhook TSLA
```

This will:
- Verify your Discord webhook is configured correctly
- Send a test notification with a sample chart
- Show you how notifications will look
- Confirm chart display settings

### Run Single Scan (Test Mode)
Perform one-time analysis of all stocks:

```bash
python stock_pattern_monitor.py scan
```

**Output Example:**
```
Starting scan of 100 stocks...
Analyzing AAPL (1/100)
Found Cup and Handle for AAPL (bullish, 85.2%)
Analyzing NVDA (2/100)
Found Bull Flag for NVDA (bullish, 78.9%)
...
Scan complete. Found 5 signals
```

### Run Continuous Monitoring
Monitor stocks continuously at configured intervals:

```bash
# Direct execution
python stock_pattern_monitor.py

# Or use startup scripts
./start_stock_monitor.sh    # Mac/Linux
start_stock_monitor.bat      # Windows
```

### Run in Background (Mac/Linux)
```bash
# Start in background
nohup python stock_pattern_monitor.py > stock_monitor.out 2>&1 &

# Check if running
ps aux | grep stock_pattern_monitor

# Stop background process
pkill -f stock_pattern_monitor.py

# View logs in real-time
tail -f stock_monitor.log
```

### Run Interactive Examples
Test the system without sending notifications:

```bash
python stock_monitor_example.py
```

**Examples Include:**
1. Single stock analysis
2. Multiple stock analysis
3. Pattern filtering by confidence
4. Risk/reward calculations
5. Custom configuration demos

---

## 📊 Pattern Details

### 1. Cup and Handle Pattern (Bullish)

**Characteristics:**
- U-shaped cup formation (10-30% depth)
- Small handle (pullback) after cup
- Left and right rims at similar heights
- Breakout above handle resistance
- Volume increases on breakout

**Trading Strategy:**
- **Entry**: Breakout above handle resistance + suggested entry price
- **Target**: Cup depth projected upward from breakout
- **Stop Loss**: Below handle low
- **Typical Duration**: 1-6 months

**What to Look For:**
- Clean cup shape (not too sharp or too flat)
- Handle should be 1/3 to 1/2 of cup height
- Strong volume on cup formation
- Decreasing volume during handle
- Volume surge on breakout

---

### 2. Bull Flag Pattern (Bullish)

**Characteristics:**
- Strong upward move (flagpole)
- Tight rectangular consolidation (flag)
- Flag slopes slightly downward
- Volume decreases during consolidation
- Breakout continues original trend

**Trading Strategy:**
- **Entry**: Breakout above flag resistance + suggested entry
- **Target**: Flagpole height projected from breakout
- **Stop Loss**: Below flag low
- **Typical Duration**: 1-4 weeks

**What to Look For:**
- Sharp flagpole (20%+ gain)
- Clean flag boundaries
- Low volume during consolidation
- Quick breakout (don't wait too long)

---

### 3. Head and Shoulders Pattern (Bearish)

**Characteristics:**
- Three peaks: left shoulder, head (highest), right shoulder
- Neckline connects troughs between peaks
- Volume typically decreases through pattern
- Breakdown below neckline confirms pattern

**Trading Strategy:**
- **Entry**: Breakdown below neckline + suggested entry
- **Target**: Head-to-neckline distance projected down
- **Stop Loss**: Above right shoulder
- **Typical Duration**: 3-6 months

**What to Look For:**
- Symmetrical shoulders (similar height)
- Clear head formation (tallest peak)
- Declining volume on right shoulder (bearish)
- Strong breakdown volume

---

### 4. Inverse Head and Shoulders Pattern (Bullish)

**Characteristics:**
- Three troughs: left shoulder, head (lowest), right shoulder
- Neckline connects peaks between troughs
- Volume increases on breakout
- Breakout above neckline confirms pattern

**Trading Strategy:**
- **Entry**: Breakout above neckline + suggested entry
- **Target**: Neckline-to-head distance projected up
- **Stop Loss**: Below right shoulder
- **Typical Duration**: 3-6 months

---

### 5. Double Bottom Pattern (Bullish)

**Characteristics:**
- Two distinct lows at similar price level (within 3-4%)
- Peak between the bottoms creates resistance
- Second bottom often on lower volume (bullish sign)
- Breakout above resistance confirms pattern

**Trading Strategy:**
- **Entry**: Breakout above resistance + suggested entry
- **Target**: Bottom-to-resistance distance projected up
- **Stop Loss**: Below second bottom
- **Typical Duration**: 1-3 months

---

### 6. Double Top Pattern (Bearish)

**Characteristics:**
- Two distinct highs at similar price level (within 3-4%)
- Trough between the tops creates support
- Second top often on lower volume (bearish sign)
- Breakdown below support confirms pattern

**Trading Strategy:**
- **Entry**: Breakdown below support + suggested entry
- **Target**: Support-to-top distance projected down
- **Stop Loss**: Above second top
- **Typical Duration**: 1-3 months

---

### 7. Ascending Triangle Pattern (Bullish)

**Characteristics:**
- Flat horizontal resistance line
- Rising support line (higher lows)
- Converging price action
- Typically breaks upward

**Trading Strategy:**
- **Entry**: Breakout above resistance + suggested entry
- **Target**: Triangle height projected upward
- **Stop Loss**: Below recent support
- **Typical Duration**: 1-3 months

---

### 8. Falling Wedge Pattern (Bullish)

**Characteristics:**
- Both support and resistance declining
- Resistance declines faster (converging lines)
- Volume typically decreases
- Typically breaks upward

**Trading Strategy:**
- **Entry**: Breakout above resistance + suggested entry
- **Target**: Initial wedge height projected from breakout
- **Stop Loss**: Below recent low
- **Typical Duration**: 1-3 months

---

## 📱 Discord Notifications

### Enhanced Notification Features

Each Discord notification now includes:

1. **Visual Chart** 📊
   - Price chart with pattern highlighted
   - Support/resistance levels marked
   - Entry price clearly indicated
   - Volume bars at bottom
   - Pattern-specific annotations

2. **Entry Price Suggestion** 💰
   - Calculated optimal entry point
   - Based on pattern characteristics
   - Conservative recommendations
   - Risk/reward optimized

3. **Comprehensive Data**
   - Pattern name and type
   - Signal type (BULLISH/BEARISH)
   - Confidence percentage
   - Current price
   - Volume analysis
   - Target price
   - Stop loss recommendation
   - Detailed reasoning

### Example Discord Notification

```
🚨 Cup and Handle Pattern Detected: AAPL

[CHART IMAGE ATTACHED]

Cup and Handle pattern detected:
- Cup formed with 18.5% depth
- Left and right rim aligned within 2.1%
- Handle pullback of 9.3%
- Current price $175.50 near breakout at $178.20
- Strong volume confirmation on cup formation
- Decreasing volume during handle (bullish)
- RSI at 58.3 (healthy momentum)
- MACD showing positive divergence
- Price above 50-day MA ($168.40)

Signal Type: BULLISH
Confidence: 85.2%
Current Price: $175.50
💰 Suggested Entry: $178.50 (on breakout confirmation)
🎯 Target Price: $195.80 (+11.6% from entry)
🛑 Stop Loss: $168.90 (-5.4% from entry)
Risk/Reward: 1:2.2
Volume: 52,389,000
```

### Notification Colors
- 🟢 **Green Embed** = Bullish signals
- 🔴 **Red Embed** = Bearish signals

---

## 📈 Technical Indicators

The system calculates and uses multiple technical indicators:

### Moving Averages
- **SMA 20, 50, 200**: Simple Moving Averages for trend identification
- **EMA 12, 26**: Exponential Moving Averages for MACD

### Momentum Indicators
- **MACD**: Moving Average Convergence Divergence
  - Signal line crossovers
  - Histogram analysis
  - Divergence detection
- **RSI**: Relative Strength Index (14-period)
  - Overbought (>70) / Oversold (<30)
  - Momentum confirmation

### Volatility Indicators
- **Bollinger Bands**: 20-period with 2 standard deviations
  - Price position relative to bands
  - Band squeeze detection
- **ATR**: Average True Range (14-period)
  - Volatility measurement
  - Stop-loss calculation

### Volume Indicators
- **Volume SMA**: 20-period volume average
- **Volume Ratio**: Current vs average volume
- **On-Balance Volume (OBV)**: Cumulative volume indicator

---

## 📁 File Overview

### Core Application Files

#### 1. `stock_pattern_monitor.py` (Main Application)
- **Size**: ~2,200 lines
- **Purpose**: Core monitoring system with pattern detection and chart generation

**Key Components:**
- 8 pattern detection methods
- Technical indicator calculations
- Chart generation with pattern visualization
- Entry price calculation
- Discord webhook integration with images
- Confidence scoring system

**Main Classes:**
- `PatternSignal`: Data structure for detected patterns
- `StockPatternMonitor`: Main monitoring class

**Usage:**
```bash
python stock_pattern_monitor.py scan       # Single scan
python stock_pattern_monitor.py           # Continuous monitoring
```

#### 2. `stock_monitor_config.json` (Configuration)
User configuration file with all customizable settings.

#### 3. `requirements_stock.txt` (Dependencies)
Python package dependencies - install with:
```bash
pip install -r requirements_stock.txt
```

### Utility Scripts

#### 4. `start_stock_monitor.sh` (Mac/Linux Startup)
Easy startup script with:
- Python installation check
- Dependency verification
- Configuration validation
- Error handling

**Usage:**
```bash
chmod +x start_stock_monitor.sh
./start_stock_monitor.sh
```

#### 5. `start_stock_monitor.bat` (Windows Startup)
Windows equivalent of the shell script.

#### 6. `stock_monitor_example.py` (Examples & Demos)
Interactive examples demonstrating all features:
1. Single stock analysis
2. Multiple stock analysis
3. Custom configuration
4. Pattern filtering
5. Risk/reward analysis

### Generated Files

#### 7. `stock_monitor.log` (Log File)
Auto-generated log containing:
- Scan timestamps
- Stocks analyzed
- Patterns detected
- Discord notification status
- Errors and warnings

**View logs:**
```bash
tail -f stock_monitor.log
```

#### 8. `charts/` (Chart Images Directory)
Auto-generated directory containing pattern chart images.
Charts are temporary and deleted after being sent to Discord.

---

## 🐛 Troubleshooting

### No Patterns Detected
**Issue**: Scans complete but no patterns found

**Solutions:**
- ✅ Lower `min_confidence` to 0.65-0.70
- ✅ Increase `lookback_days` for more historical data
- ✅ Check logs for analysis details
- ✅ Normal! Patterns don't occur every day

### Discord Notifications Not Working
**Issue**: Patterns detected but not appearing in Discord

**Solutions:**
1. Verify webhook URL in config file
2. Test webhook with curl:
   ```bash
   curl -X POST "YOUR_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}'
   ```
3. Check Discord channel permissions
4. Review logs for HTTP error codes

### Module Import Errors
**Issue**: `ModuleNotFoundError: No module named 'xxx'`

**Solutions:**
```bash
# Update pip
pip install --upgrade pip

# Install requirements
pip install -r requirements_stock.txt

# If issues persist, install individually:
pip install yfinance pandas numpy scipy requests matplotlib pillow
```

### Chart Generation Errors
**Issue**: Charts not generating or displaying correctly

**Solutions:**
- ✅ Verify matplotlib and pillow are installed
- ✅ Check `charts/` directory permissions
- ✅ Ensure sufficient disk space
- ✅ Review logs for specific errors

### API Rate Limiting
**Issue**: Yahoo Finance rate limit errors

**Solutions:**
- ✅ Increase `check_interval_minutes` to 120+
- ✅ Reduce number of stocks in `custom_stocks`
- ✅ Add delays (already implemented: 0.5s between requests)
- ✅ Yahoo Finance limits: ~2000 requests/hour

### Slow Performance
**Issue**: Scans taking too long

**Solutions:**
- ✅ Reduce `lookback_days` (e.g., 60 instead of 90)
- ✅ Use `custom_stocks` for smaller watchlists
- ✅ Increase `min_confidence` for faster filtering
- ✅ Check internet connection speed

### Memory Issues
**Issue**: High memory usage or out of memory errors

**Solutions:**
- ✅ Reduce `lookback_days`
- ✅ Scan fewer stocks at once
- ✅ Close other applications
- ✅ Restart the monitor periodically

---

## 🔧 Advanced Configuration

### Customize Pattern Detection Sensitivity

Edit detection methods in `stock_pattern_monitor.py`:

**Example: Make Cup and Handle more sensitive**
```python
# Find the detect_cup_and_handle method
# Original thresholds:
if (rim_diff < 0.05 and 0.12 < cup_depth < 0.35 and ...

# More sensitive (detects more patterns):
if (rim_diff < 0.08 and 0.10 < cup_depth < 0.40 and ...

# More strict (higher quality only):
if (rim_diff < 0.03 and 0.15 < cup_depth < 0.30 and ...
```

### Add Custom Patterns

Create a new detection method:

```python
def detect_my_custom_pattern(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
    """Detect my custom pattern"""
    try:
        # Your pattern detection logic here
        
        # If pattern found, return PatternSignal
        if pattern_detected:
            entry_price = calculate_entry_price(...)
            
            return PatternSignal(
                symbol=symbol,
                pattern="My Custom Pattern",
                signal="bullish",  # or "bearish"
                confidence=0.85,
                price=current_price,
                volume=current_volume,
                reasoning="Pattern detected because...",
                timestamp=datetime.now().isoformat(),
                entry_price=entry_price,
                target_price=target,
                stop_loss=stop,
                support_level=support,
                resistance_level=resistance
            )
    except Exception as e:
        logger.error(f"Error in custom pattern detection: {e}")
        return None
```

Then add to the analyzer:

```python
# Find the analyze_stock method
detectors = [
    self.detect_cup_and_handle,
    self.detect_bull_flag,
    # ... other detectors
    self.detect_my_custom_pattern,  # Add your detector
]
```

### Filter by Market Cap

Add market cap filtering to stock selection:

```python
def get_top_tech_stocks(self) -> List[str]:
    stocks = [...your stock list...]
    
    filtered = []
    for symbol in stocks:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            market_cap = info.get('marketCap', 0)
            
            # Only include stocks with market cap > $10B
            if market_cap > 10_000_000_000:
                filtered.append(symbol)
        except:
            continue
    
    return filtered
```

### Integrate with Trading APIs

Add automated order placement (use with extreme caution):

```python
def execute_trade(self, signal: PatternSignal):
    """Execute trade based on signal (EXAMPLE ONLY)"""
    # WARNING: Test thoroughly with paper trading first!
    
    if signal.signal == 'bullish' and signal.confidence > 0.80:
        # Your broker API integration here
        # Example: Alpaca, Interactive Brokers, TD Ameritrade, etc.
        
        quantity = calculate_position_size(signal.entry_price, signal.stop_loss)
        
        # Place limit order at entry price
        # order = broker_api.place_limit_order(
        #     symbol=signal.symbol,
        #     side='buy',
        #     quantity=quantity,
        #     limit_price=signal.entry_price
        # )
        
        # Place stop-loss order
        # stop_order = broker_api.place_stop_order(
        #     symbol=signal.symbol,
        #     side='sell',
        #     quantity=quantity,
        #     stop_price=signal.stop_loss
        # )
        
        logger.info(f"Trade executed for {signal.symbol}")
```

---

## ⚖️ Risk Management

### Trading Guidelines

#### Position Sizing
- **Never risk more than 1-2% of account per trade**
- Calculate position size based on stop-loss distance
- Example: $10,000 account, 1% risk = $100 max loss
  - If stop-loss is 5% away, max position = $2,000

#### Stop-Loss Rules
- ✅ **Always use stop-losses** (provided in signals)
- ✅ Place stops below pattern lows for long positions
- ✅ Don't move stops against your position
- ✅ Consider using trailing stops for profits

#### Risk/Reward Ratios
- ✅ Minimum 1:2 risk/reward ratio
- ✅ Better: 1:3 or higher
- ✅ Calculated automatically in signals
- ✅ Skip trades with poor R/R ratios

#### Diversification
- ✅ Don't put all capital in one trade
- ✅ Maximum 5-10 positions simultaneously
- ✅ Spread across different sectors
- ✅ Mix of pattern types and timeframes

### Paper Trading First

**Before trading real money:**
1. Paper trade for at least 2 weeks
2. Track every signal's outcome
3. Calculate win rate and average R/R
4. Identify best patterns for your style
5. Adjust confidence thresholds
6. Start with small real positions

### Performance Tracking

Create a trading journal:

```python
import sqlite3

def track_signal_performance(signal: PatternSignal, outcome: str, profit_loss: float):
    """Track signal performance in database"""
    conn = sqlite3.connect('trading_journal.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO trades (symbol, pattern, entry_price, target_price, 
                           stop_loss, outcome, profit_loss, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (signal.symbol, signal.pattern, signal.entry_price, 
          signal.target_price, signal.stop_loss, outcome, 
          profit_loss, datetime.now()))
    
    conn.commit()
    conn.close()
```

### Warning Signs to Avoid

🚫 **Don't Trade If:**
- Pattern confidence < 70%
- Volume is unusually low
- Major news/earnings upcoming
- Market in extreme volatility
- Multiple conflicting signals
- Outside normal market hours
- You're emotional or stressed

---

## 📚 Learning Resources

### Technical Analysis Books
- "Technical Analysis of the Financial Markets" by John Murphy (comprehensive)
- "Encyclopedia of Chart Patterns" by Thomas Bulkowski (pattern encyclopedia)
- "Japanese Candlestick Charting Techniques" by Steve Nison (candlesticks)
- "Trading for a Living" by Alexander Elder (psychology & risk)

### Online Resources
- [Investopedia](https://www.investopedia.com/) - Pattern definitions and tutorials
- [TradingView](https://www.tradingview.com/) - Chart analysis and community
- [StockCharts](https://www.stockcharts.com/) - Technical analysis education
- [Yahoo Finance](https://finance.yahoo.com/) - Data source used by this tool

### APIs and Tools
- [yfinance Documentation](https://pypi.org/project/yfinance/) - Yahoo Finance API
- [Discord Webhooks Guide](https://discord.com/developers/docs/resources/webhook) - Notification setup
- [Pandas Documentation](https://pandas.pydata.org/) - Data analysis library
- [Matplotlib Documentation](https://matplotlib.org/) - Chart generation

---

## 🆘 Support

### Getting Help

1. **Check the logs**: `tail -f stock_monitor.log`
2. **Run examples**: `python stock_monitor_example.py`
3. **Verify configuration**: Check `stock_monitor_config.json`
4. **Test dependencies**: `pip list | grep -E "yfinance|pandas|numpy|scipy|requests|matplotlib"`
5. **Review this documentation**: Search for your specific issue

### Common Command Reference

```bash
# Installation
pip install -r requirements_stock.txt

# Configuration
nano stock_monitor_config.json

# Test Discord Webhook
python stock_pattern_monitor.py test-webhook
python stock_pattern_monitor.py test-webhook NVDA

# Testing
python stock_monitor_example.py

# Single Scan
python stock_pattern_monitor.py scan

# Continuous Monitoring
python stock_pattern_monitor.py
./start_stock_monitor.sh

# Background Mode (Mac/Linux)
nohup python stock_pattern_monitor.py > output.log 2>&1 &

# Check if Running
ps aux | grep stock_pattern_monitor

# Stop Background Process
pkill -f stock_pattern_monitor.py

# View Logs
tail -f stock_monitor.log
cat stock_monitor.log | grep "Found"

# Clear Old Logs
> stock_monitor.log

# Help
python stock_pattern_monitor.py help
```

---

## ⚠️ Disclaimer

**IMPORTANT: READ CAREFULLY**

This software is provided for **educational and informational purposes only**. It is NOT financial advice, investment advice, trading advice, or any other sort of advice.

### Risk Disclosure
- Stock trading involves substantial risk of loss
- Past performance does not guarantee future results
- Pattern detection has false positives and false negatives
- Algorithmic signals should not be your only analysis
- You can lose all invested capital

### User Responsibilities
**You are responsible for:**
- ✅ Your own research and due diligence
- ✅ Understanding the risks involved
- ✅ Your trading decisions
- ✅ Complying with all applicable regulations
- ✅ Consulting with licensed financial professionals

### No Warranties
- The software is provided "AS IS" without warranties
- No guarantee of accuracy, reliability, or profitability
- Authors and contributors assume no liability for losses
- Use at your own risk

### Best Practices
- ✅ Test extensively with paper trading first
- ✅ Never invest more than you can afford to lose
- ✅ Use proper risk management (stop-losses, position sizing)
- ✅ Combine technical analysis with fundamental analysis
- ✅ Stay informed about market conditions
- ✅ Keep emotions out of trading decisions

---

## 🎓 Advanced Topics

### Default Stock List

The monitor tracks 100 top tech stocks including:

**Major Tech Giants:**
AAPL, MSFT, GOOGL, GOOG, AMZN, META, NVDA, TSLA

**Semiconductors:**
AMD, INTC, QCOM, AVGO, TXN, MU, AMAT, LRCX, KLAC, MCHP, ADI, NXPI, MRVL, ON, MPWR, SWKS, QRVO, WOLF, ASML

**Software & Cloud:**
CRM, ADBE, ORCL, NOW, INTU, PANW, CRWD, SNPS, CDNS, WDAY, ZS, DDOG, NET, SNOW, MDB, TEAM, ZM, DOCU, OKTA, TWLO, SPLK, VEEV, HUBS, RNG, ESTC, CFLT

**Cybersecurity:**
FTNT, CHKP, CYBR, S, TENB, RPD

**Payments/Fintech:**
PYPL, SQ, V, MA, FISV, FIS

**Other Tech:**
UBER, LYFT, DASH, COIN, ROKU, TTD, PLTR, AI, SHOP, MELI, EBAY, BKNG, ABNB

(See code for complete list)

### Performance Tips

**Optimize Scan Time:**
- Reduce `lookback_days` for faster processing
- Use `custom_stocks` for focused watchlists
- Run scans during off-peak hours
- Cache frequently accessed data

**Reduce False Signals:**
- Increase `min_confidence` threshold (0.80+)
- Add volume confirmation requirements
- Combine multiple pattern confirmations
- Filter by additional indicators (RSI, MACD)

**Better Discord Organization:**
- Create separate channels for bullish/bearish signals
- Use different webhooks for different confidence levels
- Set up role mentions for high-confidence signals (>85%)
- Archive old notifications periodically

---

## 🎉 You're Ready!

You now have a **professional-grade stock pattern monitoring system** with:

✅ Visual chart generation  
✅ Entry price suggestions  
✅ 8 pattern detection algorithms  
✅ Technical indicator analysis  
✅ Discord notifications with images  
✅ Comprehensive risk management tools  
✅ Production-ready code  

### Quick Start Checklist

- [ ] Installed Python 3.8+
- [ ] Installed dependencies (`pip install -r requirements_stock.txt`)
- [ ] Created Discord webhook
- [ ] Configured `stock_monitor_config.json`
- [ ] Ran examples (`python stock_monitor_example.py`)
- [ ] Tested single scan (`python stock_pattern_monitor.py scan`)
- [ ] Received Discord notification with chart
- [ ] Started continuous monitoring

### Remember

- Start with paper trading
- Always use stop-losses
- Track your results
- Adjust based on performance
- Never risk more than you can afford to lose

---

**Happy Trading! 📈💰**

*Built with Python 🐍 • Powered by yfinance 📊 • Charts by matplotlib 📉 • Notifications via Discord 🔔*

---

*Last Updated: January 6, 2026*
