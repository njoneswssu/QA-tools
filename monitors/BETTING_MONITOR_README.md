# Comprehensive Betting Market Monitor

A Python script that monitors multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) for sports betting odds, documenting all games and alerting on significant movements.

## Features

### Sportsbook Monitoring
- 📈 Monitors point spreads and totals
- 🔔 Alerts when spreads/totals move ≥2 points
- 📊 Tracks historical movements
- 🏀 Supports multiple sports (NBA, NFL, etc.)
- 📝 **Documents all games** in `original_lines.json`

### Additional Features
- 🔔 Desktop notifications (optional)
- 📝 Comprehensive logging
- ⚙️ Configurable thresholds
- 🔄 Discord webhook notifications

## Installation

1. Install required dependencies:
```bash
pip3 install plyer requests
```

2. Get a free API key for DraftKings monitoring:
   - Visit: https://the-odds-api.com/
   - Sign up for a free account (500 requests/month free tier)
   - Get your API key

## Configuration

### Environment Variables

```bash
# The Odds API (for sportsbook monitoring)
export ODDS_API_KEY="your_odds_api_key"

# Discord (for notifications - optional)
export DISCORD_WEBHOOK_URL="your_webhook_url"
```

## Usage

### Basic Usage

```bash
python3 betting_monitor.py
```

The monitor will prompt you to select which sports to monitor.

### Advanced Options

```bash
# Custom check interval (60 seconds)
python3 betting_monitor.py --interval 60

# Custom movement threshold (3 points)
python3 betting_monitor.py --movement-threshold 3.0

# Specific bookmakers
python3 betting_monitor.py --bookmakers draftkings fanduel

# Combine options
python3 betting_monitor.py \
  --interval 45 \
  --movement-threshold 2.5 \
  --odds-api-key "your_key" \
  --discord-webhook "your_webhook_url"
```

## Command Line Options

- `--odds-api-key, -ok`: The Odds API key
- `--interval, -i`: Check interval in seconds (default: 1800 = 30 minutes)
- `--movement-threshold, -m`: Movement threshold in points (default: 2.0)
- `--bookmakers`: Specific bookmakers to monitor (choices: draftkings, fanduel, betmgm, bet365)
- `--discord-webhook, -dw`: Discord webhook URL for notifications

## Game Documentation

All discovered games are automatically documented in `original_lines.json`:

```json
{
  "games": {
    "game-id": {
      "game_id": "game-id",
      "sport": "americanfootball_nfl",
      "sport_display": "NFL",
      "home_team": "Team A",
      "away_team": "Team B",
      "game_time": "2024-01-15T18:00:00Z",
      "first_seen": "2024-01-15T10:30:00",
      "bookmakers": {
        "draftkings": {
          "bookmaker_name": "DraftKings",
          "original_spread": -3.5,
          "original_total": 45.5,
          "documented_at": "2024-01-15T10:30:00"
        }
      }
    }
  }
}
```

## Sportsbook Monitoring

### How It Works

1. **Fetches odds** from The Odds API for multiple sportsbooks
2. **Tracks spreads and totals** for each game
3. **Documents original lines** in `original_lines.json` when first discovered
4. **Detects movements** of ≥2 points (configurable)
5. **Alerts** when significant movements occur
6. **Logs movements** to `line_movements.json`
7. **Tracks history** in `draftkings_history.json`

### Supported Sports

The monitor supports all sports available through The Odds API, including:
- `basketball_nba` - NBA basketball
- `americanfootball_nfl` - NFL football
- `americanfootball_ncaaf` - College football
- `basketball_ncaab` - College basketball
- And many more...

You'll be prompted to select which sports to monitor when you start the script.

### Movement Tracking

The script tracks:
- **Spread movements**: When the point spread changes by ≥2 points
- **Total movements**: When the over/under total changes by ≥2 points

Example alert:
```
📊 SPREAD MOVEMENT ALERT [2024-01-15 10:35:22]
Game: Lakers @ Warriors
Bookmakers: DraftKings, FanDuel
Spread Movement: -5.5 → -7.5
Change: -2.0 points
```

## Data Files

All data files are stored in the `monitor-data` directory:

- `original_lines.json` - Original lines (when first discovered) and current values (for movement tracking)
- `line_movements.json` - All detected line movements with timestamps

## Example Output

```
Starting sportsbook monitoring...
Select sports to monitor:
1. NBA
2. NFL
3. College Football
...
✓ Documented original lines for: Lakers @ Warriors (NBA)
  Bookmakers: DraftKings, FanDuel, BetMGM
  Saved to: monitor-data/original_lines.json
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

### No Games Found

- Verify your API key is correct
- Check that games are scheduled (no games = no data)
- Ensure you have remaining API requests
- Check The Odds API status page
- Verify the sport you selected has games available

### Authentication Issues

**The Odds API:**
- Verify API key is correct
- Check API key status in The Odds API dashboard
- Ensure you haven't exceeded rate limits
- Free tier allows 500 requests per month

## Security Notes

⚠️ **Important:**
- Never commit API keys to version control
- Use environment variables for production
- The Odds API key should be kept secure
- Ensure compliance with all Terms of Service

## Requirements

- Python 3.7+
- `plyer` library (optional, for desktop notifications)
- `requests` library
- The Odds API account (free tier available at https://the-odds-api.com/)

## License

This script is provided as-is for educational and personal use. Use at your own risk.

## Disclaimer

- This script uses unofficial APIs that may change without notice
- Always verify compliance with Terms of Service
- Not responsible for any losses or issues arising from use
- Sports betting involves risk - gamble responsibly

