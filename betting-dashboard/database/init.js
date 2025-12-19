const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'betting_data.db');

function initDatabase() {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log('✅ Connected to SQLite database');
    }
  });

  // Create tables
  db.serialize(() => {
    // Games table
    db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        espn_id TEXT UNIQUE,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        game_date TEXT NOT NULL,
        game_time TEXT,
        sport TEXT DEFAULT 'NBA',
        status TEXT DEFAULT 'scheduled',
        home_score INTEGER,
        away_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Betting lines table
    db.run(`
      CREATE TABLE IF NOT EXISTS betting_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        sportsbook TEXT NOT NULL,
        player_name TEXT NOT NULL,
        stat_type TEXT NOT NULL,
        line REAL NOT NULL,
        over_odds INTEGER,
        under_odds INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id),
        UNIQUE(game_id, sportsbook, player_name, stat_type)
      )
    `);

    // Player projections table
    db.run(`
      CREATE TABLE IF NOT EXISTS player_projections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        player_name TEXT NOT NULL,
        stat_type TEXT NOT NULL,
        projection REAL NOT NULL,
        confidence REAL DEFAULT 0.5,
        reasoning TEXT,
        model_version TEXT DEFAULT '1.0',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id),
        UNIQUE(game_id, player_name, stat_type)
      )
    `);

    // Player game history table
    db.run(`
      CREATE TABLE IF NOT EXISTS player_game_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        game_date TEXT NOT NULL,
        opponent TEXT,
        stat_type TEXT NOT NULL,
        stat_value REAL NOT NULL,
        minutes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_name, game_date, stat_type)
      )
    `);

    // Game players table - links players to games
    db.run(`
      CREATE TABLE IF NOT EXISTS game_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        player_name TEXT NOT NULL,
        team TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id),
        UNIQUE(game_id, player_name)
      )
    `);

    // Scrape cache table - store when data was last scraped
    db.run(`
      CREATE TABLE IF NOT EXISTS scrape_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        sport TEXT,
        last_scraped DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source, sport)
      )
    `);

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_games_sport ON games(sport)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_lines_game ON betting_lines(game_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_projections_game ON player_projections(game_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_history_player ON player_game_history(player_name, game_date DESC)`);

    console.log('✅ Database tables initialized');
  });

  return db;
}

module.exports = { initDatabase };

