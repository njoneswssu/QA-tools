# Monitors

This folder contains various monitoring scripts for betting markets, stock tracking, and prediction markets.

## Available Monitors

### 1. NBA Player Monitor (`nba_player_monitor.py`)

Monitors NBA player point props from multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) and alerts on significant line movements.

**Features:**
- Monitors player point totals (over/under lines)
- Alerts when lines move ≥2 points (configurable)
- Tracks historical movements
- Supports Discord webhook notifications
- Documents all found props and movements

**Usage:**
```bash
cd monitors
python3 nba_player_monitor.py --api-key "your_key"
```

**Configuration:**
- `--api-key, -ak`: API key (Prop-Odds or The Odds API)
- `--api-provider, -ap`: API provider (`prop_odds` or `odds_api`, default: `prop_odds`)
- `--interval, -i`: Check interval in seconds (default: 1800 = 30 minutes)
- `--movement-threshold, -m`: Line movement threshold in points (default: 2.0)
- `--bookmakers`: Specific bookmakers to monitor (default: all)
- `--discord-webhook, -dw`: Discord webhook URL for notifications

**Data Files:**
- `nba_player_props_history.json` - Historical props data (internal tracking)
- `original_lines.json` - **Consolidated file** for all original lines (games + player props)
- `line_movements.json` - **Consolidated file** for all line movements (games + player props)
- `nba_player_props_alerts.log` - Alert log file

See `NBA_PLAYER_README.md` for detailed documentation.

---

### 2. Betting Monitor (`betting_monitor.py`)

Comprehensive betting market monitor that tracks multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) for point totals and spreads.

**Features:**
- Monitors sportsbook spreads and totals
- Alerts on significant movements (≥2 points by default)
- Documents all found games
- Supports Discord webhook notifications

**Usage:**
```bash
cd monitors
python3 betting_monitor.py
```

See `BETTING_MONITOR_README.md` for detailed documentation.

---

### 3. Stock Tracker Web (`stock_tracker_web.py`)

Web-based stock tracking application with real-time data, charts, and watchlist management.

**Features:**
- Real-time stock data
- Interactive charts with price and volume
- Watchlist management
- Modern web interface

**Usage:**
```bash
cd monitors
python3 stock_tracker_web.py
```

Then open your browser to `http://localhost:8080`

See `README_stock_tracker.md` for detailed documentation.

---

## Common Requirements

### Python Dependencies

Install required packages:
```bash
pip install requests plyer
```

For betting monitors, you'll also need:
- BALLDONTLIE API key (for NBA player monitor - recommended, see https://nba.balldontlie.io/)
- OR The Odds API key (free tier available at https://the-odds-api.com/)

For stock tracker:
```bash
pip install flask yfinance plotly
```

### Environment Variables

Set these environment variables for convenience:

```bash
# BALLDONTLIE API (for NBA player monitor - recommended for player props)
export BALLDONTLIE_API_KEY="your_balldontlie_api_key"

# The Odds API (for betting monitors)
export ODDS_API_KEY="your_odds_api_key"

# Discord (for notifications)
export DISCORD_WEBHOOK_URL="your_webhook_url"
```

---

## Data Files

All monitors store their data files in the `monitor-data` directory:

- **Consolidated Files** (shared by multiple monitors):
  - `original_lines.json` - All original lines (betting games + NBA player props)
  - `line_movements.json` - All line movements (betting games + NBA player props)

- Betting Monitor:
  - All data stored in `original_lines.json` and `line_movements.json`

- NBA Player Monitor:
  - `nba_player_props_history.json` - Internal tracking (not consolidated)
  - `nba_player_props_alerts.log`

---

## Notes

- All monitors use the same line movement threshold logic (2.0 points by default)
- Data files are stored in the project root for easy access
- All monitors support Discord webhook notifications
- Check individual README files for specific configuration options

