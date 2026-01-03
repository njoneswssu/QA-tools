# NBA Player Monitor

A Python script that monitors NBA player point props from multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) and alerts on significant line movements.

## Features

- 📊 Monitors player point totals (over/under lines) from multiple sportsbooks
- 🔔 Alerts when lines move ≥2 points (configurable threshold)
- 📝 Documents all found props and tracks historical movements
- 🎯 Tracks movements across all bookmakers
- 🔔 Desktop notifications (optional)
- 💬 Discord webhook notifications (optional)
- 📈 Comprehensive logging and data storage

## Installation

1. Install required dependencies:
```bash
pip install requests plyer
```

2. Get an API key from one of these providers:

   **Option 1: BALLDONTLIE API (Recommended for player props)**
   - Visit: https://nba.balldontlie.io/
   - Sign up for an account
   - Get your API key
   - Supports player props with real-time data

   **Option 2: The Odds API**
   - Visit: https://the-odds-api.com/
   - Sign up for a free account (500 requests/month free tier)
   - Get your API key
   - **Note**: May require paid subscription for player props

   **Option 3: Optimal Bet API**
   - Visit: https://api.optimal-bet.com/
   - Sign up for an account
   - Get your API key
   - Comprehensive player prop coverage

## Configuration

### Environment Variables

```bash
# BALLDONTLIE API key (recommended for player props)
export BALLDONTLIE_API_KEY="your_balldontlie_api_key"

# OR The Odds API key
export ODDS_API_KEY="your_odds_api_key"

# API Provider selection (optional, default: balldontlie)
export PROPS_API_PROVIDER="balldontlie"  # or "odds_api"

# Discord webhook (optional)
export DISCORD_WEBHOOK_URL="your_discord_webhook_url"
```

## Usage

### Basic Usage

```bash
cd monitors
# Using BALLDONTLIE API (recommended for player props)
python3 nba_player_monitor.py --api-key "your_balldontlie_key" --api-provider balldontlie

# OR using The Odds API
python3 nba_player_monitor.py --api-key "your_odds_api_key" --api-provider odds_api
```

### Advanced Options

```bash
# Custom check interval (60 minutes)
python3 nba_player_monitor.py --api-key "your_key" --interval 3600

# Custom movement threshold (3 points)
python3 nba_player_monitor.py --api-key "your_key" --movement-threshold 3.0

# Monitor specific bookmakers only
python3 nba_player_monitor.py --api-key "your_key" --bookmakers draftkings fanduel

# With Discord notifications
python3 nba_player_monitor.py --api-key "your_key" --discord-webhook "your_webhook_url"

# Combine options
python3 nba_player_monitor.py \
  --api-key "your_key" \
  --interval 1800 \
  --movement-threshold 2.5 \
  --bookmakers draftkings fanduel betmgm \
  --discord-webhook "your_webhook_url"
```

## Command Line Options

- `--api-key, -ak`: API key (BALLDONTLIE or The Odds API)
- `--api-provider, -ap`: API provider to use (`balldontlie` or `odds_api`, default: `balldontlie`)
- `--odds-api-key, -ok`: The Odds API key (deprecated, use `--api-key` instead)
- `--interval, -i`: Check interval in seconds (default: 1800 = 30 minutes)
- `--movement-threshold, -m`: Line movement threshold in points (default: 2.0)
- `--bookmakers`: Specific bookmakers to monitor (choices: draftkings, fanduel, betmgm, bet365, default: all)
- `--discord-webhook, -dw`: Discord webhook URL for notifications

## How It Works

1. **Fetches player props** from BALLDONTLIE API (or The Odds API) for NBA games
2. **Tracks point lines** for each player from each bookmaker
3. **Detects movements** of ≥2 points (configurable)
4. **Alerts** when significant movements occur
5. **Logs history** to JSON files

## API Providers

### BALLDONTLIE API (Recommended - Default)

- **Supports**: Player props (points, rebounds, assists, etc.)
- **Real-time data**: Live player prop betting data
- **Website**: https://nba.balldontlie.io/
- **Documentation**: Check their website for API docs
- **Note**: Check their website for pricing and API key requirements

### The Odds API (Alternative)

- **Free Tier**: 500 requests/month
- **Supports**: May require paid subscription for player props
- **Website**: https://the-odds-api.com/
- **Documentation**: https://the-odds-api.com/liveapi/guides/v4/
- **Note**: Player props may require a paid subscription tier

## Data Files

All data files are stored in the `monitor-data` directory:

- `nba_player_props_history.json` - Historical props data and movements (internal tracking)
- `original_lines.json` - **Consolidated file** for all original lines (games + player props)
- `line_movements.json` - **Consolidated file** for all line movements (games + player props)
- `nba_player_props_alerts.log` - Alert log file (JSON format)

**Note**: Original lines and movements are now stored in consolidated files shared with the betting monitor for easier management.

## Example Output

```
Starting NBA Player Props monitoring...
Bookmakers: DraftKings, FanDuel, BetMGM, Bet365
Checking every 30.0 minutes (1800 seconds)
Movement threshold: 2.0 points
Press Ctrl+C to stop

[10:30:00] Checking NBA player props...
Found 45 player props
✓ Documented original line for: LeBron James (DraftKings) - Lakers @ Warriors
  Line: 25.5 points
  Saved to: monitor-data/original_lines.json

============================================================
📊 NBA PLAYER PROP ALERT [2024-01-15 10:35:22]
Player: LeBron James
Game: Lakers @ Warriors
Bookmaker: DraftKings
Line Movement: 25.5 → 27.5
Change: +2.0 points (increased)
Movement detected at: 2024-01-15 10:35:22
============================================================
```

## Supported Bookmakers

- **DraftKings** - DraftKings Sportsbook
- **FanDuel** - FanDuel Sportsbook
- **BetMGM** - BetMGM Sportsbook
- **Bet365** - Bet365 Sportsbook

## Movement Threshold

The default movement threshold is **2.0 points**. This means the monitor will only alert when a player's point line moves by 2.0 points or more in either direction.

You can customize this threshold using the `--movement-threshold` option.

## Notifications

The script provides multiple notification methods:

1. **Console Alerts**: Printed to terminal with timestamp and prop details
2. **Desktop Notifications**: System notifications (if `plyer` is installed)
3. **Discord Webhooks**: Rich embed notifications (if webhook URL is provided)
4. **Log File**: All alerts are saved to `nba_player_props_alerts.log` in JSON format

## API Rate Limits

### BALLDONTLIE API
- Check their website for current rate limits and pricing
- The script checks every 30 minutes by default
- **Recommendation**: Check API documentation for rate limits and adjust interval accordingly

### The Odds API (Free Tier)
- 500 requests per month
- The script checks every 30 minutes by default
- ~48 requests per day if running 24/7
- **Recommendation**: Increase interval to 60+ minutes for 24/7 monitoring
- **Note**: Player props may require a paid subscription tier

## Troubleshooting

### No Player Props Found / 422 Error

**Important Note**: The Odds API may not support player props in the free tier, or may require a paid subscription. The monitor will try multiple market name variations, but if you get a 422 error, it likely means player props are not available.

**Solutions:**
1. **Try BALLDONTLIE API**: Switch to BALLDONTLIE API which specializes in player props
   ```bash
   python3 nba_player_monitor.py --api-key "your_balldontlie_key" --api-provider balldontlie
   ```
2. **Check API Subscription**: Player props may require a paid subscription to The Odds API
3. **Verify API Key**: Ensure your API key is correct and active
4. **Check API Documentation**: 
   - BALLDONTLIE: https://nba.balldontlie.io/
   - The Odds API: https://the-odds-api.com/liveapi/guides/v4/#markets
5. **Alternative APIs**: Consider using other APIs that specialize in player props:
   - Optimal Bet API: https://api.optimal-bet.com/
   - OddsPapi: https://oddspapi.io/
6. **Check Available Markets**: The monitor will attempt to detect available markets and show them in error messages

**Common Issues:**
- 422 Unprocessable Entity: Market name not supported (player props may not be available)
- No games scheduled: No NBA games = no props available
- Rate limit exceeded: Too many API requests
- Invalid API key: Check your API key is correct

### Authentication Issues

- Verify API key is correct
- Check API key status in The Odds API dashboard
- Ensure you haven't exceeded rate limits

### Missing Bookmakers

- Some bookmakers may not offer player props for all games
- The script will only track props that are available
- Check The Odds API documentation for bookmaker availability

## Requirements

- Python 3.7+
- `requests` library
- `plyer` library (optional, for desktop notifications)
- API account from one of the supported providers:
  - BALLDONTLIE API (recommended)
  - The Odds API
  - Or other compatible player props APIs

## Security Notes

⚠️ **Important:**
- Never commit API keys to version control
- Use environment variables for production
- The Odds API key should be kept secure
- Ensure compliance with all Terms of Service

## License

This script is provided as-is for educational and personal use. Use at your own risk.

## Disclaimer

- This script uses The Odds API which may have rate limits
- Always verify compliance with Terms of Service
- Not responsible for any losses or issues arising from use
- Sports betting involves risk - gamble responsibly

