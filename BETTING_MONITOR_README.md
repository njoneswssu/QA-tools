# Comprehensive Betting Market Monitor

A unified Python script that monitors both **Robinhood prediction markets** and **DraftKings sports betting odds**, documenting all contracts and alerting on significant movements.

## Features

### Robinhood Prediction Markets
- 🔐 Secure authentication
- 📊 Real-time contract monitoring
- 🚨 Alerts when contracts exceed 80% price
- 📝 **Automatic contract documentation** - All found contracts are saved to `documented_contracts.json`

### DraftKings Sports Betting
- 📈 Monitors point spreads and totals
- 🔔 Alerts when spreads/totals move ≥2 points
- 📊 Tracks historical movements
- 🏀 Supports multiple sports (NBA, NFL, etc.)
- 📝 **Documents all games** found

### Unified Features
- 🔔 Desktop notifications (optional)
- 📝 Comprehensive logging
- ⚙️ Configurable thresholds
- 🔄 Concurrent monitoring of both platforms

## Installation

1. Install required dependencies:
```bash
pip3 install -r requirements_robinhood.txt
```

Or install individually:
```bash
pip3 install robin-stocks plyer requests
```

2. Get a free API key for DraftKings monitoring:
   - Visit: https://the-odds-api.com/
   - Sign up for a free account (500 requests/month free tier)
   - Get your API key

## Configuration

### Environment Variables

```bash
# Robinhood credentials
export ROBINHOOD_USERNAME="your_username"
export ROBINHOOD_PASSWORD="your_password"
export ROBINHOOD_MFA="your_mfa_code"  # Optional

# DraftKings API (The Odds API)
export ODDS_API_KEY="your_odds_api_key"
```

## Usage

### Monitor Both Platforms

```bash
python3 betting_monitor.py
```

### Monitor Only Robinhood

```bash
python3 betting_monitor.py --robinhood-only
```

### Monitor Only DraftKings

```bash
python3 betting_monitor.py --draftkings-only --odds-api-key "your_key"
```

### Advanced Options

```bash
# Custom check interval (60 seconds)
python3 betting_monitor.py --interval 60

# Custom Robinhood threshold (75%)
python3 betting_monitor.py --threshold 0.75

# Custom movement threshold (3 points)
python3 betting_monitor.py --movement-threshold 3.0

# Combine options
python3 betting_monitor.py \
  --interval 45 \
  --threshold 0.85 \
  --movement-threshold 2.5 \
  --odds-api-key "your_key"
```

## Command Line Options

- `--robinhood-username, -ru`: Robinhood username
- `--robinhood-password, -rp`: Robinhood password
- `--robinhood-mfa, -rm`: Robinhood MFA code
- `--odds-api-key, -ok`: The Odds API key
- `--interval, -i`: Check interval in seconds (default: 30)
- `--threshold, -t`: Robinhood price threshold 0.0-1.0 (default: 0.80)
- `--movement-threshold, -m`: DraftKings movement threshold in points (default: 2.0)
- `--robinhood-only`: Only monitor Robinhood
- `--draftkings-only`: Only monitor DraftKings

## Contract Documentation

### Robinhood Contracts

All discovered Robinhood prediction market contracts are automatically documented in `documented_contracts.json`:

```json
{
  "robinhood_contracts": [
    {
      "id": "CONTRACT-SYMBOL",
      "name": "Contract Name",
      "symbol": "SYMBOL",
      "source": "robinhood",
      "discovered_at": "2024-01-15T10:30:00",
      "data": { /* Full contract data */ }
    }
  ],
  "last_updated": "2024-01-15T10:30:00",
  "total_contracts": 1
}
```

### DraftKings Games

All discovered DraftKings games are documented in the same file:

```json
{
  "draftkings_contracts": [
    {
      "id": "game-id",
      "name": "Team A vs Team B",
      "source": "draftkings",
      "discovered_at": "2024-01-15T10:30:00",
      "data": { /* Full game data */ }
    }
  ]
}
```

## DraftKings Monitoring

### How It Works

1. **Fetches odds** from The Odds API for DraftKings
2. **Tracks spreads and totals** for each game
3. **Detects movements** of ≥2 points (configurable)
4. **Alerts** when significant movements occur
5. **Logs history** to `draftkings_history.json`

### Supported Sports

Default sports monitored:
- `basketball_nba` - NBA basketball
- `americanfootball_nfl` - NFL football

You can modify the script to add more sports. See The Odds API documentation for available sports.

### Movement Tracking

The script tracks:
- **Spread movements**: When the point spread changes by ≥2 points
- **Total movements**: When the over/under total changes by ≥2 points

Example alert:
```
📊 DRAFTKINGS SPREAD ALERT [2024-01-15 10:35:22]
Game: Lakers @ Warriors
Spread Movement: -5.5 → -7.5
Change: -2.0 points
```

## Log Files

### Robinhood Alerts
- `robinhood_alerts.log` - All Robinhood price alerts

### DraftKings Alerts
- `draftkings_alerts.log` - All DraftKings movement alerts

### History Files
- `documented_contracts.json` - All discovered contracts/games
- `draftkings_history.json` - Historical odds data and movements

## Example Output

```
✓ Successfully authenticated as your_username
✓ Documented new robinhood contract: Will it rain tomorrow?

Starting Robinhood monitoring...
Checking every 30 seconds
Alert threshold: 80.0%

Starting DraftKings monitoring...
Checking every 30 seconds
Movement threshold: 2.0 points
Sports: basketball_nba, americanfootball_nfl

[10:30:00] Checking basketball_nba...
Found 5 games
✓ Documented new draftkings contract: Lakers @ Warriors

============================================================
📊 DRAFTKINGS SPREAD ALERT [2024-01-15 10:35:22]
Game: Lakers @ Warriors
Spread Movement: -5.5 → -7.5
Change: -2.0 points
============================================================
```

## API Rate Limits

### The Odds API (Free Tier)
- 500 requests per month
- The script checks every 30 seconds by default
- ~2,880 requests per day if running 24/7
- **Recommendation**: Increase interval to 60+ seconds for 24/7 monitoring

### Robinhood API
- Unofficial API - rate limits not publicly documented
- Script includes delays to avoid rate limiting
- If you encounter rate limits, increase `--interval`

## Troubleshooting

### No DraftKings Games Found

- Verify your API key is correct
- Check that games are scheduled (no games = no data)
- Ensure you have remaining API requests
- Check The Odds API status page

### No Robinhood Contracts Found

- Verify your credentials are correct
- Check that prediction markets are available in your region
- The API structure may have changed - check `robin_stocks` library updates
- Create `robinhood_contracts.json` manually with contract symbols

### Authentication Issues

**Robinhood:**
- Verify username/password
- If MFA is enabled, provide MFA code
- Check account status

**DraftKings (The Odds API):**
- Verify API key is correct
- Check API key status in The Odds API dashboard
- Ensure you haven't exceeded rate limits

## Security Notes

⚠️ **Important:**
- Never commit credentials to version control
- Use environment variables for production
- The Odds API key should be kept secure
- Robinhood API is unofficial - use at your own risk
- Ensure compliance with all Terms of Service

## Requirements

- Python 3.7+
- `robin-stocks` library
- `plyer` library (optional, for desktop notifications)
- `requests` library
- Active Robinhood account (for Robinhood monitoring)
- The Odds API account (for DraftKings monitoring)

## License

This script is provided as-is for educational and personal use. Use at your own risk.

## Disclaimer

- This script uses unofficial APIs that may change without notice
- Always verify compliance with Terms of Service
- Not responsible for any losses or issues arising from use
- Sports betting involves risk - gamble responsibly

