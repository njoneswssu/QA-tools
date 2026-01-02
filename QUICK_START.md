# Quick Start Guide - Betting Monitor

## Setup (5 minutes)

### 1. Install Dependencies
```bash
pip3 install -r requirements_robinhood.txt
```

### 2. Get DraftKings API Key (Free)
1. Go to https://the-odds-api.com/
2. Sign up (free tier: 500 requests/month)
3. Copy your API key

### 3. Set Environment Variables
```bash
# Add to ~/.zshrc or ~/.bashrc for persistence
export ROBINHOOD_USERNAME="your_username"
export ROBINHOOD_PASSWORD="your_password"
export ODDS_API_KEY="your_odds_api_key"
```

Or run once in terminal:
```bash
export ROBINHOOD_USERNAME="your_username"
export ROBINHOOD_PASSWORD="your_password"
export ODDS_API_KEY="your_odds_api_key"
```

## Run

### Monitor Everything
```bash
python3 betting_monitor.py
```

### Monitor Only DraftKings
```bash
python3 betting_monitor.py --draftkings-only --odds-api-key "your_key"
```

### Monitor Only Robinhood
```bash
python3 betting_monitor.py --robinhood-only
```

## What Gets Documented

All contracts/games are automatically saved to:
- `documented_contracts.json` - All discovered contracts and games

## Alerts

### Robinhood
- Alerts when contract price > 80%
- Logged to: `robinhood_alerts.log`

### DraftKings
- Alerts when spread/total moves ≥2 points
- Logged to: `draftkings_alerts.log`
- History saved to: `draftkings_history.json`

## Customize Thresholds

```bash
# Alert at 75% instead of 80%
python3 betting_monitor.py --threshold 0.75

# Alert on 3-point movements instead of 2
python3 betting_monitor.py --movement-threshold 3.0

# Check every 60 seconds instead of 30
python3 betting_monitor.py --interval 60
```

## Troubleshooting

**"pip: command not found"**
→ Use `pip3` instead

**"ODDS_API_KEY not set"**
→ Set environment variable or use `--odds-api-key` flag

**"No contracts found"**
→ Check credentials and API status

**Rate limit errors**
→ Increase `--interval` to check less frequently

