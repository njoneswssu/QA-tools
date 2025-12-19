const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { initDatabase } = require('./database/init');
const { scrapeESPN } = require('./scrapers/espn');
const { scrapeFanDuel } = require('./scrapers/fanduel');
const { scrapeBetMGM } = require('./scrapers/betmgm');
const { scrapeDraftKings } = require('./scrapers/draftkings');
const { getPlayerRecentGames } = require('./scrapers/player-history');
const { searchPlayerStats } = require('./scrapers/player-search');
const { scrapePlayerStatsForGames } = require('./scrapers/player-stats');
const { generateProjections } = require('./models/prediction-model');
const { shouldScrape, updateScrapeCache } = require('./utils/cache');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
let db;
try {
  db = initDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// API Routes

// Get all current games with projections and lines
app.get('/api/games', async (req, res) => {
  try {
    const sport = req.query.sport; // Filter by sport if provided
    
    let query = `
      SELECT 
        g.*,
        json_group_array(
          json_object(
            'sportsbook', l.sportsbook,
            'player', l.player_name,
            'stat_type', l.stat_type,
            'line', l.line,
            'over_odds', l.over_odds,
            'under_odds', l.under_odds,
            'updated_at', l.updated_at
          )
        ) as lines,
        json_group_array(
          json_object(
            'player', p.player_name,
            'stat_type', p.stat_type,
            'projection', p.projection,
            'confidence', p.confidence,
            'reasoning', p.reasoning,
            'updated_at', p.updated_at
          )
        ) as projections,
        (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count
      FROM games g
      LEFT JOIN betting_lines l ON g.id = l.game_id
      LEFT JOIN player_projections p ON g.id = p.game_id
      WHERE g.game_date >= date('now')
    `;
    
    const params = [];
    if (sport) {
      query += ` AND g.sport = ?`;
      params.push(sport.toUpperCase());
    }
    
    query += ` GROUP BY g.id ORDER BY g.game_date, g.game_time`;
    
    const games = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const formattedGames = games.map(game => ({
      ...game,
      lines: game.lines ? JSON.parse(game.lines).filter(l => l.player) : [],
      projections: game.projections ? JSON.parse(game.projections).filter(p => p.player) : []
    }));

    res.json(formattedGames);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific game details
app.get('/api/games/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    
    const game = await new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM games WHERE id = ?
      `, [gameId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const lines = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM betting_lines WHERE game_id = ? ORDER BY player_name, stat_type
      `, [gameId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const projections = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM player_projections WHERE game_id = ? ORDER BY player_name, stat_type
      `, [gameId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      ...game,
      lines,
      projections
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get players for a specific game
app.get('/api/games/:gameId/players', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    
    const players = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          gp.*,
          (SELECT stat_value FROM player_game_history 
           WHERE player_name = gp.player_name 
           AND opponent = 'Season Average' 
           AND stat_type = 'points' 
           ORDER BY created_at DESC LIMIT 1) as season_points,
          (SELECT stat_value FROM player_game_history 
           WHERE player_name = gp.player_name 
           AND opponent = 'Season Average' 
           AND stat_type = 'rebounds' 
           ORDER BY created_at DESC LIMIT 1) as season_rebounds,
          (SELECT stat_value FROM player_game_history 
           WHERE player_name = gp.player_name 
           AND opponent = 'Season Average' 
           AND stat_type = 'assists' 
           ORDER BY created_at DESC LIMIT 1) as season_assists
        FROM game_players gp
        WHERE gp.game_id = ?
        ORDER BY gp.team, gp.player_name
      `, [gameId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json(players);
  } catch (error) {
    console.error('Error fetching game players:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get player details (stats, history, averages)
app.get('/api/players/:playerName/details', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.playerName);
    
    // Get season averages
    const seasonAverages = await new Promise((resolve, reject) => {
      db.all(`
        SELECT stat_type, stat_value, created_at
        FROM player_game_history
        WHERE player_name = ? AND opponent = 'Season Average'
        ORDER BY stat_type, created_at DESC
      `, [playerName], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Get recent game history (last 10 games, excluding season averages)
    const recentGames = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          game_date,
          opponent,
          stat_type,
          stat_value,
          minutes
        FROM player_game_history
        WHERE player_name = ? AND opponent != 'Season Average'
        ORDER BY game_date DESC
        LIMIT 30
      `, [playerName], (err, rows) => {
        if (err) reject(err);
        else {
          // Group by game_date to get all stats for each game
          const gamesMap = new Map();
          rows.forEach(row => {
            if (!gamesMap.has(row.game_date)) {
              gamesMap.set(row.game_date, {
                date: row.game_date,
                opponent: row.opponent,
                points: 0,
                rebounds: 0,
                assists: 0,
                minutes: row.minutes
              });
            }
            const game = gamesMap.get(row.game_date);
            if (row.stat_type === 'points') game.points = row.stat_value;
            else if (row.stat_type === 'rebounds') game.rebounds = row.stat_value;
            else if (row.stat_type === 'assists') game.assists = row.stat_value;
          });
          resolve(Array.from(gamesMap.values()).slice(0, 10));
        }
      });
    });
    
    // Get current projections
    const projections = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          p.*,
          g.home_team,
          g.away_team,
          g.game_date,
          g.game_time
        FROM player_projections p
        JOIN games g ON p.game_id = g.id
        WHERE p.player_name = ? AND g.game_date >= date('now')
        ORDER BY g.game_date
      `, [playerName], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate averages from recent games
    const averages = {
      points: 0,
      rebounds: 0,
      assists: 0,
      games: recentGames.length
    };
    
    if (recentGames.length > 0) {
      recentGames.forEach(game => {
        averages.points += game.points;
        averages.rebounds += game.rebounds;
        averages.assists += game.assists;
      });
      averages.points = averages.points / recentGames.length;
      averages.rebounds = averages.rebounds / recentGames.length;
      averages.assists = averages.assists / recentGames.length;
    } else {
      // Use season averages if no recent games
      seasonAverages.forEach(avg => {
        if (avg.stat_type === 'points') averages.points = avg.stat_value;
        else if (avg.stat_type === 'rebounds') averages.rebounds = avg.stat_value;
        else if (avg.stat_type === 'assists') averages.assists = avg.stat_value;
      });
    }
    
    res.json({
      playerName,
      seasonAverages: seasonAverages.reduce((acc, avg) => {
        acc[avg.stat_type] = avg.stat_value;
        return acc;
      }, {}),
      recentGames,
      averages,
      projections
    });
  } catch (error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get player recent games
app.get('/api/players/:playerName/recent-games', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.playerName);
    const limit = parseInt(req.query.limit) || 10;
    
    const recentGames = await getPlayerRecentGames(playerName, limit);
    res.json(recentGames);
  } catch (error) {
    console.error('Error fetching player recent games:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual scrape
app.post('/api/scrape', async (req, res) => {
  try {
    const { source, sports } = req.body;
    
    // Default to NBA if no sports specified
    const sportsToScrape = sports && sports.length > 0 ? sports : ['NBA'];
    
    console.log(`Starting scrape for: ${source || 'all'}, sports: ${sportsToScrape.join(', ')}`);
    
    if (!source || source === 'all' || source === 'espn') {
      // Scrape ESPN for each sport - continue even if one fails
      for (const sport of sportsToScrape) {
        try {
          const needsScrape = await shouldScrape(db, 'espn', sport, 6);
          if (needsScrape) {
            await scrapeESPN(db, sport);
            await updateScrapeCache(db, 'espn', sport);
          } else {
            console.log(`⏭️  Skipping ESPN scrape for ${sport} - cached data is recent`);
          }
        } catch (error) {
          console.error(`Failed to scrape ${sport}:`, error.message);
          // Continue with next sport
        }
      }
    }
    
    // Scrape player stats for games BEFORE sportsbook lines
    if (!source || source === 'all') {
      for (const sport of sportsToScrape) {
        try {
          const needsScrape = await shouldScrape(db, 'player-stats', sport, 12);
          if (needsScrape) {
            await scrapePlayerStatsForGames(db, sport);
            await updateScrapeCache(db, 'player-stats', sport);
          } else {
            console.log(`⏭️  Skipping player stats scrape for ${sport} - cached data is recent`);
          }
        } catch (error) {
          console.error(`Failed to scrape player stats for ${sport}:`, error.message);
        }
      }
    }
    
    // Generate projections before scraping sportsbook lines (so we have projections to match)
    if (!source || source === 'all') {
      await generateProjections(db);
    }
    
    // Now scrape sportsbook lines
    if (!source || source === 'all' || source === 'fanduel') {
      try {
        const needsScrape = await shouldScrape(db, 'fanduel', null, 2);
        if (needsScrape) {
          await scrapeFanDuel(db);
          await updateScrapeCache(db, 'fanduel');
        } else {
          console.log(`⏭️  Skipping FanDuel scrape - cached data is recent`);
        }
      } catch (error) {
        console.error('Failed to scrape FanDuel:', error.message);
      }
    }
    
    if (!source || source === 'all' || source === 'betmgm') {
      try {
        const needsScrape = await shouldScrape(db, 'betmgm', null, 2);
        if (needsScrape) {
          await scrapeBetMGM(db);
          await updateScrapeCache(db, 'betmgm');
        } else {
          console.log(`⏭️  Skipping BetMGM scrape - cached data is recent`);
        }
      } catch (error) {
        console.error('Failed to scrape BetMGM:', error.message);
      }
    }
    
    if (!source || source === 'all' || source === 'draftkings') {
      try {
        const needsScrape = await shouldScrape(db, 'draftkings', null, 2);
        if (needsScrape) {
          await scrapeDraftKings(db);
          await updateScrapeCache(db, 'draftkings');
        } else {
          console.log(`⏭️  Skipping DraftKings scrape - cached data is recent`);
        }
      } catch (error) {
        console.error('Failed to scrape DraftKings:', error.message);
      }
    }
    
    res.json({ success: true, message: `Scrape completed for ${sportsToScrape.join(', ')}` });
  } catch (error) {
    console.error('Error during scrape:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search for player stats
app.get('/api/players/search', async (req, res) => {
  try {
    const playerName = req.query.name;
    const sport = req.query.sport || 'NBA';
    
    if (!playerName) {
      return res.status(400).json({ error: 'Player name is required' });
    }
    
    const playerStats = await searchPlayerStats(playerName, sport);
    res.json(playerStats);
  } catch (error) {
    console.error('Error searching for player:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get stats summary
app.get('/api/stats', async (req, res) => {
  try {
    const sport = req.query.sport;
    
    let query = `
      SELECT 
        (SELECT COUNT(*) FROM games WHERE game_date >= date('now') ${sport ? 'AND sport = ?' : ''}) as upcoming_games,
        (SELECT COUNT(*) FROM betting_lines) as total_lines,
        (SELECT COUNT(*) FROM player_projections) as total_projections,
        (SELECT COUNT(DISTINCT player_name) FROM player_projections) as unique_players
    `;
    
    const params = sport ? [sport.toUpperCase()] : [];
    
    const stats = await new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available sports
app.get('/api/sports', (req, res) => {
  res.json({
    sports: [
      { code: 'NBA', name: 'NBA' },
      { code: 'NFL', name: 'NFL' },
      { code: 'NCAAM', name: 'NCAA Men\'s Basketball' },
      { code: 'NCAAF', name: 'NCAA Football' }
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Betting Dashboard server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
});

// Don't auto-scrape on startup or schedule automatic scrapes
// Users should manually trigger scrapes via the "Refresh Data" button
// This prevents unnecessary scraping and respects the cache system
// The cache system will check if data exists in the database before scraping

module.exports = { app, db };

