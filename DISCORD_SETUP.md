# Discord Webhook Setup Guide

This guide explains how to set up Discord webhook notifications for betting line movements and Robinhood alerts.

## Creating a Discord Webhook

1. **Open Discord** and go to your server
2. **Go to Server Settings** → **Integrations** → **Webhooks**
3. **Click "New Webhook"**
4. **Configure the webhook**:
   - Name it (e.g., "Betting Alerts")
   - Choose which channel to post to
   - Copy the webhook URL
5. **Save the webhook**

## Setting Up the Webhook

### Option 1: Environment Variable (Recommended)

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
```

Add to `~/.zshrc` or `~/.bashrc` for persistence:
```bash
echo 'export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"' >> ~/.zshrc
source ~/.zshrc
```

### Option 2: Command Line Argument

```bash
python3 betting_monitor.py --discord-webhook "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
```

### Option 3: Combine with Other Options

```bash
python3 betting_monitor.py \
  --discord-webhook "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL" \
  --odds-api-key "your_odds_api_key" \
  --interval 1800
```

## What Gets Sent to Discord

### Sportsbook Alerts

When a spread or total moves ≥2 points, you'll receive a Discord message with:

- **Game**: Away team @ Home team
- **Bookmaker**: Which sportsbook (DraftKings, FanDuel, BetMGM, Bet365)
- **Previous Value**: The old spread/total
- **New Value**: The new spread/total
- **Change**: How many points it moved
- **Direction**: Which team the movement favors
- **Timestamp**: When the movement was detected

**Color Coding**:
- 🟢 **Green**: 2-2.9 point movement
- 🟠 **Orange**: 3-4.9 point movement
- 🔴 **Red**: 5+ point movement

### Robinhood Alerts

When a prediction market contract exceeds 80% price:

- **Contract Name**: The contract title
- **Symbol**: Contract symbol
- **Price**: Current price percentage
- **Threshold**: Alert threshold (80%)
- **Timestamp**: When detected

## Example Discord Message

```
📉 DraftKings Spread Movement Alert
Brooklyn Nets @ Washington Wizards

Previous Spread: -5.5
New Spread: -7.5
Change: -2.0 points
Direction: Decreased
Bookmaker: DraftKings
Time: 2026-01-02 13:20:02
Movement Direction: towards Brooklyn Nets (away team getting more points)
```

## Testing the Webhook

You can test your webhook by running the monitor and waiting for a movement, or you can test it manually:

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message from betting monitor"}'
```

## Security Notes

⚠️ **Important**:
- Never share your webhook URL publicly
- Don't commit webhook URLs to version control
- Webhook URLs can be used to post messages to your Discord channel
- If compromised, delete and create a new webhook

## Troubleshooting

### No Messages Appearing

1. **Check webhook URL**: Verify it's correct
2. **Check webhook status**: Make sure it's enabled in Discord
3. **Check channel permissions**: Bot needs permission to post
4. **Check script output**: Look for "Error sending Discord webhook" messages

### Messages Not Formatting Correctly

- Discord embeds should format automatically
- If fields aren't showing, check the webhook URL is valid
- Make sure `requests` library is installed: `pip3 install requests`

## Disabling Discord Notifications

Simply don't set the `DISCORD_WEBHOOK_URL` environment variable or `--discord-webhook` argument. The script will continue to work normally without Discord notifications.

