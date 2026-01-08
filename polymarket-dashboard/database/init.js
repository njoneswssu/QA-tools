const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'polymarket.db');

function initDatabase() {
    const db = new Database(DB_PATH);
    
    // Create trades table
    db.exec(`
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_id TEXT NOT NULL,
            market_name TEXT NOT NULL,
            side TEXT NOT NULL,
            size REAL NOT NULL,
            price REAL NOT NULL,
            edge REAL,
            status TEXT DEFAULT 'pending',
            executed_at INTEGER,
            closed_at INTEGER,
            pnl REAL DEFAULT 0,
            notes TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    
    // Create markets table for tracking
    db.exec(`
        CREATE TABLE IF NOT EXISTS markets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            end_date INTEGER,
            volume REAL DEFAULT 0,
            liquidity REAL DEFAULT 0,
            yes_price REAL,
            no_price REAL,
            last_updated INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    
    // Create edge opportunities table
    db.exec(`
        CREATE TABLE IF NOT EXISTS edge_opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_id TEXT NOT NULL,
            market_name TEXT NOT NULL,
            edge_score REAL NOT NULL,
            reason TEXT,
            yes_price REAL,
            no_price REAL,
            detected_at INTEGER DEFAULT (strftime('%s', 'now')),
            status TEXT DEFAULT 'active',
            FOREIGN KEY (market_id) REFERENCES markets(id)
        )
    `);
    
    // Create news items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS news_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            link TEXT UNIQUE,
            description TEXT,
            pub_date TEXT,
            content TEXT,
            fetched_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    
    // Create market-news correlations
    db.exec(`
        CREATE TABLE IF NOT EXISTS market_news_correlations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_id TEXT NOT NULL,
            news_id INTEGER NOT NULL,
            relevance_score REAL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (market_id) REFERENCES markets(id),
            FOREIGN KEY (news_id) REFERENCES news_items(id)
        )
    `);
    
    console.log('Database initialized successfully');
    db.close();
}

function getDatabase() {
    return new Database(DB_PATH);
}

module.exports = { initDatabase, getDatabase, DB_PATH };

