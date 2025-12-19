const { chromium } = require('playwright');

async function scrapePlayerGameHistory(db, sport = 'NBA') {
  console.log(`📊 Scraping player game-by-game history from ESPN for ${sport}...`);
  
  // Get all unique players from upcoming games
  const players = await new Promise((resolve, reject) => {
    db.all(`
      SELECT DISTINCT gp.player_name
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE g.sport = ? AND g.game_date >= date('now')
      LIMIT 50
    `, [sport.toUpperCase()], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (players.length === 0) {
    console.log('No players found to scrape game history for');
    return;
  }
  
  console.log(`Found ${players.length} players to scrape game history for`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  
  let successCount = 0;
  
  try {
    for (const playerRow of players) {
      const playerName = playerRow.player_name;
      
      try {
        // Construct player URL
        const playerSlug = playerName.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/\./g, '')
          .replace(/'/g, '');
        
        const playerUrl = `https://www.espn.com/${sport.toLowerCase()}/player/_/name/${playerSlug}`;
        
        await page.goto(playerUrl, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(3000);
        
        // Check if we're on the player page
        const pageTitle = await page.title();
        if (pageTitle.toLowerCase().includes('not found') || pageTitle.toLowerCase().includes('404')) {
          console.log(`  ⚠️  Player page not found for ${playerName}`);
          continue;
        }
        
        // Extract game-by-game stats
        const gameStats = await page.evaluate(() => {
          const games = [];
          
          // Find game log table
          const tables = document.querySelectorAll('table.Table, table[class*="Table"], table[class*="game-log"]');
          
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            
            rows.forEach((row, index) => {
              // Skip header rows
              if (row.querySelector('th') || index === 0) return;
              
              const cells = row.querySelectorAll('td, th');
              if (cells.length < 5) return;
              
              // Try to find date (usually first or second cell)
              let gameDate = null;
              let opponent = '';
              let points = 0;
              let rebounds = 0;
              let assists = 0;
              
              // Look for date pattern
              cells.forEach((cell, idx) => {
                const text = cell.textContent.trim();
                
                // Date patterns: "Mon 1/15", "1/15/2025", etc.
                if (text.match(/\d{1,2}\/\d{1,2}/) && !gameDate) {
                  gameDate = text;
                }
                
                // Opponent (usually team abbreviation or name)
                if (text.length === 3 && text.match(/^[A-Z]{3}$/)) {
                  opponent = text;
                } else if (text.length > 3 && text.length < 20 && !text.match(/^\d+$/) && !opponent) {
                  // Could be opponent name
                  const teamNames = ['Atlanta', 'Boston', 'Brooklyn', 'Charlotte', 'Chicago', 'Cleveland', 'Dallas', 'Denver', 'Detroit', 'Golden State', 'Houston', 'Indiana', 'LA Clippers', 'Los Angeles', 'Memphis', 'Miami', 'Milwaukee', 'Minnesota', 'New Orleans', 'New York', 'Oklahoma City', 'Orlando', 'Philadelphia', 'Phoenix', 'Portland', 'Sacramento', 'San Antonio', 'Toronto', 'Utah', 'Washington'];
                  if (teamNames.some(name => text.includes(name) || name.includes(text))) {
                    opponent = text;
                  }
                }
                
                // Parse numbers for stats
                const num = parseFloat(text);
                if (!isNaN(num) && num > 0) {
                  // Points: usually 0-60 range
                  if (num >= 0 && num <= 60 && points === 0 && idx > 2) {
                    points = num;
                  }
                  // Rebounds: usually 0-25 range
                  else if (num >= 0 && num <= 25 && rebounds === 0 && idx > 3) {
                    rebounds = num;
                  }
                  // Assists: usually 0-20 range
                  else if (num >= 0 && num <= 20 && assists === 0 && idx > 4) {
                    assists = num;
                  }
                }
              });
              
              // If we found stats, add the game
              if (gameDate && (points > 0 || rebounds > 0 || assists > 0)) {
                games.push({
                  date: gameDate,
                  opponent: opponent || 'Unknown',
                  points: points,
                  rebounds: rebounds,
                  assists: assists
                });
              }
            });
          });
          
          return games;
        });
        
        // Store game-by-game stats in database
        if (gameStats.length > 0) {
          for (const game of gameStats) {
            // Parse date and convert to YYYY-MM-DD format
            let gameDateStr = null;
            try {
              // Try to parse date (format: "Mon 1/15" or "1/15/2025")
              const dateMatch = game.date.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
              if (dateMatch) {
                const month = parseInt(dateMatch[1]);
                const day = parseInt(dateMatch[2]);
                const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
                gameDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              }
            } catch (e) {
              // Use today's date if parsing fails
              gameDateStr = new Date().toISOString().split('T')[0];
            }
            
            if (!gameDateStr) continue;
            
            // Store points
            if (game.points > 0) {
              db.run(`
                INSERT OR REPLACE INTO player_game_history 
                (player_name, game_date, opponent, stat_type, stat_value, minutes, created_at)
                VALUES (?, ?, ?, 'points', ?, NULL, CURRENT_TIMESTAMP)
              `, [playerName, gameDateStr, game.opponent, game.points], (err) => {
                if (err) console.error(`Error storing game points for ${playerName}:`, err);
              });
            }
            
            // Store rebounds
            if (game.rebounds > 0) {
              db.run(`
                INSERT OR REPLACE INTO player_game_history 
                (player_name, game_date, opponent, stat_type, stat_value, minutes, created_at)
                VALUES (?, ?, ?, 'rebounds', ?, NULL, CURRENT_TIMESTAMP)
              `, [playerName, gameDateStr, game.opponent, game.rebounds], (err) => {
                if (err) console.error(`Error storing game rebounds for ${playerName}:`, err);
              });
            }
            
            // Store assists
            if (game.assists > 0) {
              db.run(`
                INSERT OR REPLACE INTO player_game_history 
                (player_name, game_date, opponent, stat_type, stat_value, minutes, created_at)
                VALUES (?, ?, ?, 'assists', ?, NULL, CURRENT_TIMESTAMP)
              `, [playerName, gameDateStr, game.opponent, game.assists], (err) => {
                if (err) console.error(`Error storing game assists for ${playerName}:`, err);
              });
            }
          }
          
          console.log(`  ✓ Scraped ${gameStats.length} games for ${playerName}`);
          successCount++;
        } else {
          console.log(`  ⚠️  No game stats found for ${playerName}`);
        }
        
        // Wait between players to avoid rate limiting
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.error(`  ✗ Error scraping game history for ${playerName}:`, error.message);
        continue;
      }
    }
    
    console.log(`\n✅ Scraped game history for ${successCount}/${players.length} players`);
    
  } catch (error) {
    console.error(`❌ Error scraping player game history:`, error.message);
  } finally {
    await browser.close();
  }
}

module.exports = { scrapePlayerGameHistory };

