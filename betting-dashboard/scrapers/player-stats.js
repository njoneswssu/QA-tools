const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();
const { getTeamSlug } = require('./team-mapping');
const { scrapePlayerGameHistory } = require('./player-game-history');

async function scrapePlayerStatsForGames(db, sport = 'NBA') {
  console.log(`📊 Scraping player stats for ${sport} games...`);
  
  // Get all upcoming games (no limit - get all games)
  const games = await new Promise((resolve, reject) => {
    db.all(`
      SELECT id, home_team, away_team, game_date, sport 
      FROM games 
      WHERE sport = ? AND game_date >= date('now')
      ORDER BY game_date
    `, [sport.toUpperCase()], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (games.length === 0) {
    console.log(`No upcoming ${sport} games found to scrape player stats for`);
    return;
  }
  
  console.log(`Found ${games.length} games, scraping player stats...`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  
  try {
    // Navigate to ESPN stats page for the sport
    const statsUrl = `https://www.espn.com/${sport.toLowerCase()}/stats`;
    await page.goto(statsUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Extract player stats from the stats page
    const playerStats = await page.evaluate(() => {
      const players = [];
      
      // Find stats tables - ESPN uses specific table structures
      const tables = document.querySelectorAll('table.Table, table[class*="Table"], [class*="Table"]');
      
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        
        rows.forEach((row, index) => {
          // Skip header rows
          if (row.querySelector('th') || index === 0) return;
          
          const cells = row.querySelectorAll('td, th');
          if (cells.length < 3) return;
          
          // Find player name - usually in a link
          let playerName = '';
          const playerLink = row.querySelector('a[href*="/player/"]');
          if (playerLink) {
            playerName = playerLink.textContent.trim();
          } else {
            // Try first cell
            const firstCell = cells[0]?.textContent?.trim();
            if (firstCell && firstCell.length > 2 && !firstCell.match(/^\d+$/)) {
              playerName = firstCell;
            }
          }
          
          if (!playerName || playerName.length < 2) return;
          
          // Extract stats - look for numbers in cells
          let points = 0;
          let rebounds = 0;
          let assists = 0;
          let games = 0;
          let team = '';
          
          // Try to find team (usually near player name)
          const teamLink = row.querySelector('a[href*="/team/"]');
          if (teamLink) {
            team = teamLink.textContent.trim();
          }
          
          // Parse stats from cells
          // NBA stats table usually has: RK, PLAYER, GP, MIN, PTS, REB, AST, etc.
          cells.forEach((cell, cellIndex) => {
            const text = cell.textContent.trim();
            const num = parseFloat(text);
            
            if (!isNaN(num) && num > 0) {
              // Games played is usually early (cellIndex 2-3)
              if (num >= 1 && num <= 100 && games === 0 && cellIndex < 5) {
                games = num;
              }
              // Points are usually higher (10-50 range) and in middle columns
              else if (num >= 10 && num <= 50 && points === 0 && cellIndex > 2 && cellIndex < 10) {
                points = num;
              }
              // Rebounds are usually 3-20 range
              else if (num >= 3 && num <= 20 && rebounds === 0 && cellIndex > 3) {
                rebounds = num;
              }
              // Assists are usually 2-15 range
              else if (num >= 2 && num <= 15 && assists === 0 && cellIndex > 4) {
                assists = num;
              }
            }
          });
          
          // If we found meaningful stats, add player
          if (points > 0 || rebounds > 0 || assists > 0) {
            players.push({
              name: playerName,
              team: team,
              points: points,
              rebounds: rebounds,
              assists: assists,
              games: games
            });
          }
        });
      });
      
      return players;
    });
    
    console.log(`Found ${playerStats.length} players with season stats`);
    
    // Store player stats in database
    let storedCount = 0;
    for (const player of playerStats) {
      // Store season averages in player_game_history
      const seasonDate = new Date().getFullYear() + '-01-01';
      
      // Store points
      if (player.points > 0) {
        db.run(`
          INSERT OR REPLACE INTO player_game_history 
          (player_name, game_date, opponent, stat_type, stat_value, minutes, created_at)
          VALUES (?, ?, 'Season Average', 'points', ?, NULL, CURRENT_TIMESTAMP)
        `, [player.name, seasonDate, player.points], (err) => {
          if (err) console.error(`Error storing points for ${player.name}:`, err);
        });
        storedCount++;
      }
      
      // Store rebounds
      if (player.rebounds > 0) {
        db.run(`
          INSERT OR REPLACE INTO player_game_history 
          (player_name, game_date, opponent, stat_type, stat_value, minutes, created_at)
          VALUES (?, ?, 'Season Average', 'rebounds', ?, NULL, CURRENT_TIMESTAMP)
        `, [player.name, seasonDate, player.rebounds], (err) => {
          if (err) console.error(`Error storing rebounds for ${player.name}:`, err);
        });
      }
      
      // Store assists
      if (player.assists > 0) {
        db.run(`
          INSERT OR REPLACE INTO player_game_history 
          (player_name, game_date, opponent, stat_type, stat_value, minutes, created_at)
          VALUES (?, ?, 'Season Average', 'assists', ?, NULL, CURRENT_TIMESTAMP)
        `, [player.name, seasonDate, player.assists], (err) => {
          if (err) console.error(`Error storing assists for ${player.name}:`, err);
        });
      }
    }
    
    console.log(`✅ Stored season stats for ${playerStats.length} players`);
    
    // Now get players from specific games by scraping team rosters
    for (const game of games) {
      await scrapePlayersFromGame(db, page, game, sport);
    }
    
    // Scrape actual game-by-game stats for players from ESPN player pages
    console.log(`\n📊 Scraping individual player game histories from ESPN...`);
    await scrapePlayerGameHistory(db, sport);
    
  } catch (error) {
    console.error(`❌ Error scraping player stats:`, error.message);
  } finally {
    await browser.close();
  }
}

async function scrapePlayersFromGame(db, page, game, sport) {
  try {
    // Get players from both teams
    const teams = [
      { name: game.home_team, type: 'home' },
      { name: game.away_team, type: 'away' }
    ];
    
    for (const team of teams) {
      // Use team mapping to get correct slug
      const teamSlug = getTeamSlug(team.name, sport);
      
      // Try multiple URL formats
      const urlFormats = [
        `https://www.espn.com/${sport.toLowerCase()}/team/roster/_/name/${teamSlug}`,
        `https://www.espn.com/${sport.toLowerCase()}/team/roster/_/name/${teamSlug.toLowerCase()}`,
        `https://www.espn.com/${sport.toLowerCase()}/team/_/name/${teamSlug}`,
      ];
      
      let players = [];
      let success = false;
      
      for (const rosterUrl of urlFormats) {
        try {
          await page.goto(rosterUrl, { waitUntil: 'load', timeout: 30000 });
          await page.waitForTimeout(3000);
          
          players = await page.evaluate(() => {
            const playerList = [];
            
            // Find player links in roster table - try multiple selectors
            const selectors = [
              'a[href*="/player/"]',
              'a[href*="/nba/player/"]',
              'a[href*="/nfl/player/"]',
              'table a[href*="/player/"]',
              '.Table a[href*="/player/"]'
            ];
            
            let playerLinks = [];
            for (const selector of selectors) {
              const links = document.querySelectorAll(selector);
              if (links.length > 0) {
                playerLinks = Array.from(links);
                break;
              }
            }
            
            playerLinks.forEach(link => {
              const name = link.textContent.trim();
              // Filter out invalid names
              if (name && 
                  name.length > 2 && 
                  name.length < 50 &&
                  !name.match(/^\d+$/) &&
                  !name.match(/^[A-Z]{2,4}$/) && // Not just abbreviations
                  !name.toLowerCase().includes('roster') &&
                  !name.toLowerCase().includes('player')) {
                playerList.push(name);
              }
            });
            
            // Remove duplicates
            return [...new Set(playerList)];
          });
          
          if (players.length > 0) {
            success = true;
            break;
          }
        } catch (e) {
          // Try next URL format
          continue;
        }
      }
      
      if (success && players.length > 0) {
        // Store players for this game
        for (const playerName of players) {
          db.run(`
            INSERT OR REPLACE INTO game_players 
            (game_id, player_name, team, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `, [game.id, playerName, team.name], (err) => {
            if (err) console.error(`Error storing player ${playerName} for game ${game.id}:`, err);
          });
        }
        
        console.log(`  ✓ Found ${players.length} players from ${team.name}`);
      } else {
        console.log(`  ⚠️  Could not get roster for ${team.name} (tried ${urlFormats.length} URL formats)`);
      }
    }
    
  } catch (error) {
    console.error(`Error scraping players from game ${game.id}:`, error.message);
  }
}

module.exports = { scrapePlayerStatsForGames };
