# AI Betting Model Dashboard

A comprehensive dashboard that tracks current games, AI-powered player projections, and sportsbook betting lines from multiple sources including ESPN, FanDuel, BetMGM, and DraftKings.

## Features

- 📅 **Game Schedule Tracking**: Automatically scrapes and displays current games from ESPN
- 🤖 **AI Player Projections**: Generates predictions for player stats (points, rebounds, assists, threes) with confidence levels and reasoning
- 🎰 **Multi-Sportsbook Lines**: Aggregates betting lines from FanDuel, BetMGM, and DraftKings
- 📊 **Player History**: View recent game performance for any player
- 🔄 **Auto-Refresh**: Automatically scrapes data hourly and on-demand
- 💾 **SQLite Database**: Stores all data locally for fast access

## Installation

1. **Install Dependencies**
   ```bash
   cd betting-dashboard
   npm install
   ```

2. **Install Playwright Browsers** (if not already installed)
   ```bash
   npx playwright install chromium
   ```

## Usage

### Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The dashboard will be available at: **http://localhost:3000**

### Manual Data Scraping

You can trigger a manual scrape via the API:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "all"}'
```

Or use the "Refresh Data" button in the dashboard UI.

## API Endpoints

- `GET /api/games` - Get all upcoming games with projections and lines
- `GET /api/games/:gameId` - Get specific game details
- `GET /api/players/:playerName/recent-games` - Get player's recent game history
- `POST /api/scrape` - Trigger manual data scrape
- `GET /api/stats` - Get dashboard statistics

## Project Structure

```
betting-dashboard/
├── server.js                 # Main Express server
├── database/
│   └── init.js              # Database initialization
├── scrapers/
│   ├── espn.js              # ESPN game schedule scraper
│   ├── fanduel.js           # FanDuel betting lines scraper
│   ├── betmgm.js            # BetMGM betting lines scraper
│   ├── draftkings.js        # DraftKings betting lines scraper
│   └── player-history.js    # Player recent games scraper
├── models/
│   └── prediction-model.js  # AI prediction model
└── public/
    ├── index.html           # Dashboard UI
    ├── styles.css           # Styling
    └── app.js               # Frontend JavaScript
```

## How It Works

1. **Data Collection**: The system uses Playwright to scrape:
   - ESPN for game schedules
   - FanDuel, BetMGM, and DraftKings for betting lines
   - ESPN player pages for recent game history

2. **AI Projections**: The prediction model:
   - Analyzes player historical performance
   - Compares with sportsbook lines
   - Generates projections with confidence scores
   - Provides reasoning for each projection

3. **Dashboard Display**: The frontend shows:
   - All upcoming games
   - Player projections with confidence badges
   - Sportsbook lines side-by-side
   - Clickable player names to view recent games

## Data Storage

All data is stored in a SQLite database (`database/betting_data.db`) with the following tables:

- `games` - Game schedule information
- `betting_lines` - Sportsbook betting lines
- `player_projections` - AI-generated projections
- `player_game_history` - Historical player performance

## Customization

### Adding More Sportsbooks

1. Create a new scraper file in `scrapers/` (e.g., `scrapers/caesars.js`)
2. Follow the pattern of existing scrapers
3. Add the scraper to `server.js` imports and scrape function

### Enhancing the Prediction Model

Edit `models/prediction-model.js` to:
- Add more sophisticated statistical analysis
- Incorporate machine learning models
- Factor in opponent strength, home/away, etc.

### Modifying Scrapers

The scrapers use Playwright to navigate websites. You may need to update selectors if websites change their structure. Check browser console for errors and adjust selectors accordingly.

## Notes

- **Web Scraping**: Be respectful of website terms of service. The scrapers include delays to avoid overloading servers.
- **Data Accuracy**: Sportsbook websites may require login or have anti-bot measures. You may need to adjust scrapers based on your needs.
- **Legal**: Ensure compliance with local laws regarding sports betting data collection.

## Troubleshooting

### Scrapers Not Working

- Check if websites have changed their structure
- Verify Playwright browsers are installed: `npx playwright install`
- Check browser console for JavaScript errors
- Some sites may require login or have CAPTCHA

### Database Errors

- Delete `database/betting_data.db` to reset
- Ensure write permissions in the `database/` directory

### Port Already in Use

Change the port by setting the `PORT` environment variable:
```bash
PORT=3001 npm start
```

## License

MIT

