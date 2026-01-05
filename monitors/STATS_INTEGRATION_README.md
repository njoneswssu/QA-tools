# Stats Integration & Projections

This module provides statistical analysis and projections for both game totals and player point props using NBA stats APIs and TeamRankings.com data.

## Features

- **Game Total Projections**: Calculates projected point totals for games using team offensive/defensive stats
- **Player Point Projections**: Calculates projected points for NBA players using advanced stats and matchup analysis
- **Justifications**: Provides detailed justifications for each projection based on statistical analysis
- **Multi-Sport Support**: Supports NBA, NFL, college football, and college basketball

## Installation

### Required Dependencies

```bash
# Core dependencies
pip install requests beautifulsoup4

# NBA stats API (for NBA projections)
pip install nba_api
```

### Optional Dependencies

- `plyer` - For desktop notifications (already installed if using monitors)

## Configuration

No additional configuration is required. The stats integration automatically:
- Uses `nba_api` for NBA player and team stats
- Scrapes TeamRankings.com for team stats (NFL, NBA, college sports)
- Caches data for 1 hour to reduce API calls

## How It Works

### Game Total Projections

When a game is first documented, the system:

1. **Fetches Team Stats**:
   - For NBA: Uses `nba_api` to get team PPG, pace, offensive/defensive ratings
   - For other sports: Scrapes TeamRankings.com for team stats

2. **Calculates Projection**:
   - Averages both teams' offensive PPG
   - Averages both teams' defensive PPG (points allowed)
   - Applies weighted formula: `(avg_offense * 0.6) + (avg_defense * 0.4) * 2`
   - Adjusts for pace (NBA only) if significantly different from league average

3. **Provides Justification**:
   - Lists each team's PPG
   - Lists each team's points allowed
   - Includes pace information (NBA)
   - Confidence level based on sample size

### Player Point Projections

When a player prop is first documented, the system:

1. **Fetches Player Stats**:
   - Season average PPG
   - Recent form (last 5 games average)
   - Usage rate
   - Shooting percentages

2. **Calculates Projection**:
   - Base: Season average PPG
   - Adjusted for recent form (70% season, 30% recent)
   - Adjusted for opponent defense (if available)
   - Adjusted for usage rate

3. **Provides Justification**:
   - Season average PPG
   - Recent form (last 5 games)
   - Opponent defensive rating (if available)
   - Usage rate
   - Confidence level based on games played

## Usage

Projections are automatically calculated and displayed when:

1. **Betting Monitor**: A new game is documented
   - Projection appears in console output
   - Included in Discord notifications for total movements
   - Stored in `original_lines.json` under `projection` field

2. **NBA Player Monitor**: A new player prop is documented
   - Projection appears in console output
   - Included in Discord notifications for line movements
   - Stored in `nba_player_props_history.json` under `projection` field

## Example Output

### Game Total Projection

```
✓ Documented original lines for: Lakers @ Warriors (NBA)
  Bookmakers: DraftKings, FanDuel, BetMGM
  📊 Projected Total: 228.5 (high confidence)
     • Lakers averages 115.2 PPG
     • Warriors averages 118.3 PPG
     • Lakers allows 112.8 PPG
     • Warriors allows 114.5 PPG
     • Combined pace: 101.2
  Saved to: monitor-data/original_lines.json
```

### Player Point Projection

```
✓ Documented original line for: LeBron James (DraftKings (-110)) - Lakers @ Warriors
  Line: 25.5 points
  📊 Projected Points: 26.8 (high confidence)
     • Season average: 25.2 PPG
     • Last 5 games: 28.5 PPG
     • Warriors has weak defense (DRtg: 115.2)
     • High usage rate: 32.5%
  Saved to: monitor-data/nba_player_props_history.json
```

## Projection Data Structure

### Game Projection

```json
{
  "projection": {
    "projected_total": 228.5,
    "confidence": "high",
    "justification": [
      "Lakers averages 115.2 PPG",
      "Warriors averages 118.3 PPG",
      "Lakers allows 112.8 PPG",
      "Warriors allows 114.5 PPG",
      "Combined pace: 101.2"
    ]
  }
}
```

### Player Projection

```json
{
  "projection": {
    "projected_points": 26.8,
    "confidence": "high",
    "justification": [
      "Season average: 25.2 PPG",
      "Last 5 games: 28.5 PPG",
      "Warriors has weak defense (DRtg: 115.2)",
      "High usage rate: 32.5%"
    ]
  }
}
```

## Confidence Levels

- **High**: Based on 20+ games of data
- **Medium**: Based on 10-20 games of data
- **Low**: Based on <10 games of data

## Limitations

1. **NBA API**: 
   - Free and open-source
   - May have rate limits
   - Data updates may lag slightly

2. **TeamRankings.com Scraping**:
   - Website structure may change
   - Requires internet connection
   - May be blocked by rate limiting

3. **Projections**:
   - Based on historical data, not real-time
   - Don't account for injuries, rest, or lineup changes
   - Should be used as a guide, not absolute predictions

## Troubleshooting

### "Stats integration not available"

**Solution**: Install required dependencies:
```bash
pip install nba_api beautifulsoup4 requests
```

### "Unable to fetch team stats"

**Possible causes**:
- Team name doesn't match NBA API format
- TeamRankings.com structure changed
- Network connectivity issues

**Solution**: Check team name spelling and ensure internet connection

### Projections seem inaccurate

**Note**: Projections are based on historical averages and don't account for:
- Injuries
- Rest days
- Lineup changes
- Recent trades
- Weather (for outdoor sports)

Use projections as a guide alongside other factors.

## API Credits

- **nba_api**: Open-source Python wrapper for NBA.com stats
- **TeamRankings.com**: Public sports statistics website

