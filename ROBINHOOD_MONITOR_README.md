# Robinhood Prediction Market Monitor

A Python script that monitors Robinhood's prediction market contracts and sends notifications when a contract's price exceeds 80% (or a custom threshold).

## Features

- 🔐 Secure authentication with Robinhood
- 📊 Real-time monitoring of prediction market contracts
- 🚨 Alerts when contracts exceed price threshold (default: 80%)
- 📝 Logs all alerts to `robinhood_alerts.log`
- 🔔 Desktop notifications (optional, requires `plyer`)
- ⚙️ Configurable check interval and price threshold

## Installation

1. Install required dependencies:
```bash
pip install -r requirements_robinhood.txt
```

Or install individually:
```bash
pip install robin-stocks plyer
```

## Configuration

### Option 1: Environment Variables (Recommended)

Set your Robinhood credentials as environment variables:

```bash
export ROBINHOOD_USERNAME="your_username"
export ROBINHOOD_PASSWORD="your_password"
# Optional: if you have MFA enabled
export ROBINHOOD_MFA="your_mfa_code"
```

### Option 2: Command Line Arguments

Pass credentials as command line arguments:

```bash
python robinhood_prediction_monitor.py --username "your_username" --password "your_password"
```

## Usage

### Basic Usage

```bash
python robinhood_prediction_monitor.py
```

### Advanced Usage

```bash
# Custom check interval (check every 60 seconds)
python robinhood_prediction_monitor.py --interval 60

# Custom price threshold (alert at 75%)
python robinhood_prediction_monitor.py --threshold 0.75

# Combine options
python robinhood_prediction_monitor.py --interval 45 --threshold 0.85
```

### Command Line Options

- `--username, -u`: Robinhood username
- `--password, -p`: Robinhood password
- `--mfa, -m`: MFA code if required
- `--interval, -i`: Check interval in seconds (default: 30)
- `--threshold, -t`: Price threshold 0.0-1.0 (default: 0.80 for 80%)

## How It Works

1. **Authentication**: Logs into your Robinhood account
2. **Contract Discovery**: Fetches all available prediction market contracts
3. **Price Monitoring**: Continuously checks contract prices at specified intervals
4. **Alerting**: Sends notifications when a contract price exceeds the threshold
5. **Logging**: Records all alerts to `robinhood_alerts.log`

## Notifications

The script provides multiple notification methods:

1. **Console Alerts**: Printed to terminal with timestamp and contract details
2. **Desktop Notifications**: System notifications (if `plyer` is installed)
3. **Log File**: All alerts are saved to `robinhood_alerts.log` in JSON format

## Log File Format

Alerts are logged to `robinhood_alerts.log` in JSON format:

```json
{"timestamp": "2024-01-15T10:30:45.123456", "contract_name": "Will it rain tomorrow?", "contract_symbol": "RAIN-YES", "price": 0.85, "price_percent": 85.0}
```

## Security Notes

⚠️ **Important Security Considerations:**

- Never commit your credentials to version control
- Use environment variables for credentials in production
- The `robin-stocks` library uses an unofficial API that may change
- Ensure compliance with Robinhood's Terms of Service

## Troubleshooting

### Authentication Issues

- Verify your username and password are correct
- If you have MFA enabled, provide the MFA code
- Check that your account is in good standing

### No Contracts Found

- The API structure may have changed - you may need to update the contract detection logic
- Check that prediction markets are available in your region
- Verify your account has access to prediction markets

### Rate Limiting

- Increase the `--interval` value to check less frequently
- The script includes delays between contract checks to avoid rate limits

## Example Output

```
✓ Successfully authenticated as your_username

Starting monitoring...
Checking every 30 seconds
Alert threshold: 80.0%
Press Ctrl+C to stop

[10:30:00] Fetching contracts...
Found 15 contracts to monitor

============================================================
🚨 ALERT [2024-01-15 10:35:22]
Contract: Will it rain tomorrow?
Symbol: RAIN-YES
Price: 82.50% (exceeds 80.0% threshold)
============================================================
```

## Requirements

- Python 3.7+
- `robin-stocks` library
- `plyer` library (optional, for desktop notifications)
- Active Robinhood account with prediction market access

## License

This script is provided as-is for educational and personal use. Use at your own risk.

## Disclaimer

This script uses an unofficial API. Robinhood may change their API structure at any time, which could break functionality. Always verify compliance with Robinhood's Terms of Service before use.

