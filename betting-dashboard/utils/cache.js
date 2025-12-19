const sqlite3 = require('sqlite3').verbose();

// Check if data needs to be scraped (cache check + data existence check)
async function shouldScrape(db, source, sport = null, cacheHours = 6) {
  return new Promise((resolve, reject) => {
    // First check if data exists in database
    let dataCheckQuery;
    let dataCheckParams;
    
    if (source === 'espn') {
      // Check if games exist for this sport
      dataCheckQuery = 'SELECT COUNT(*) as count FROM games WHERE sport = ? AND game_date >= date("now")';
      dataCheckParams = [sport ? sport.toUpperCase() : 'NBA'];
    } else if (source === 'player-stats') {
      // Check if players exist for this sport
      dataCheckQuery = `
        SELECT COUNT(*) as count 
        FROM game_players gp
        JOIN games g ON gp.game_id = g.id
        WHERE g.sport = ? AND g.game_date >= date("now")
      `;
      dataCheckParams = [sport ? sport.toUpperCase() : 'NBA'];
    } else if (source === 'fanduel' || source === 'betmgm' || source === 'draftkings') {
      // Check if betting lines exist
      dataCheckQuery = 'SELECT COUNT(*) as count FROM betting_lines WHERE sportsbook = ?';
      dataCheckParams = [source === 'fanduel' ? 'FanDuel' : source === 'betmgm' ? 'BetMGM' : 'DraftKings'];
    } else {
      // Unknown source, check cache only
      dataCheckQuery = null;
    }
    
    // Check if data exists
    if (dataCheckQuery) {
      db.get(dataCheckQuery, dataCheckParams, (err, dataRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        // If no data exists, we should scrape
        if (!dataRow || dataRow.count === 0) {
          console.log(`No data found for ${source}${sport ? ` (${sport})` : ''}, will scrape`);
          resolve(true);
          return;
        }
        
        // Data exists, check cache timestamp
        checkCacheTimestamp();
      });
    } else {
      // No data check query, just check cache
      checkCacheTimestamp();
    }
    
    function checkCacheTimestamp() {
      const query = sport 
        ? 'SELECT last_scraped FROM scrape_cache WHERE source = ? AND sport = ?'
        : 'SELECT last_scraped FROM scrape_cache WHERE source = ? AND sport IS NULL';
      
      const params = sport ? [source, sport] : [source];
      
      db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          // No cache entry but data exists, update cache and don't scrape
          console.log(`Data exists for ${source}${sport ? ` (${sport})` : ''} but no cache entry, updating cache`);
          updateScrapeCache(db, source, sport).catch(console.error);
          resolve(false);
          return;
        }
        
        const lastScraped = new Date(row.last_scraped);
        const now = new Date();
        const hoursSinceScrape = (now - lastScraped) / (1000 * 60 * 60);
        
        // Scrape if cache is older than cacheHours
        const needsScrape = hoursSinceScrape >= cacheHours;
        if (!needsScrape) {
          console.log(`Cache is fresh for ${source}${sport ? ` (${sport})` : ''} (${hoursSinceScrape.toFixed(1)} hours old, threshold: ${cacheHours} hours)`);
        }
        resolve(needsScrape);
      });
    }
  });
}

// Update scrape cache
async function updateScrapeCache(db, source, sport = null) {
  return new Promise((resolve, reject) => {
    const query = sport
      ? 'INSERT OR REPLACE INTO scrape_cache (source, sport, last_scraped) VALUES (?, ?, CURRENT_TIMESTAMP)'
      : 'INSERT OR REPLACE INTO scrape_cache (source, last_scraped) VALUES (?, CURRENT_TIMESTAMP)';
    
    const params = sport ? [source, sport] : [source];
    
    db.run(query, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { shouldScrape, updateScrapeCache };

