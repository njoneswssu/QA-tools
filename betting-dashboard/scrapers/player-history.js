const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();

async function getPlayerRecentGames(playerName, limit = 10) {
  console.log(`📊 Fetching recent games for ${playerName}...`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set longer timeout
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  
  try {
    // Search for player on ESPN
    const searchUrl = `https://www.espn.com/nba/player/_/name/${encodeURIComponent(playerName.replace(/\s+/g, '-').toLowerCase())}`;
    await page.goto(searchUrl, { 
      waitUntil: 'load',
      timeout: 60000 
    });
    await page.waitForTimeout(3000);
    
    // Try alternative search if direct URL doesn't work
    if (page.url().includes('search') || !page.url().includes('player')) {
      await page.goto('https://www.espn.com/nba/players');
      await page.waitForTimeout(2000);
      await page.fill('input[type="search"], input[placeholder*="Search"]', playerName);
      await page.press('input[type="search"], input[placeholder*="Search"]', 'Enter');
      await page.waitForTimeout(3000);
      
      // Click first result
      try {
        await page.click('a[href*="/player/"]', { timeout: 5000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('Could not find player page');
        return [];
      }
    }
    
    // Extract recent game stats
    const recentGames = await page.evaluate((limit) => {
      const games = [];
      
      // Look for game log table
      const gameRows = document.querySelectorAll('table tr, [class*="game-log"] tr, [class*="Table"] tr');
      
      gameRows.forEach((row, index) => {
        if (index === 0) return; // Skip header
        
        const cells = row.querySelectorAll('td, th');
        if (cells.length < 5) return;
        
        try {
          const date = cells[0]?.textContent?.trim();
          const opponent = cells[1]?.textContent?.trim();
          const points = parseFloat(cells[2]?.textContent?.trim() || '0');
          const rebounds = parseFloat(cells[3]?.textContent?.trim() || '0');
          const assists = parseFloat(cells[4]?.textContent?.trim() || '0');
          const minutes = cells[5]?.textContent?.trim() || '';
          
          if (date && opponent && !isNaN(points)) {
            games.push({
              date,
              opponent,
              points,
              rebounds,
              assists,
              minutes
            });
          }
        } catch (e) {
          // Skip invalid rows
        }
      });
      
      return games.slice(0, limit);
    }, limit);
    
    await browser.close();
    
    return recentGames;
  } catch (error) {
    console.error(`❌ Error fetching recent games for ${playerName}:`, error);
    await browser.close();
    return [];
  }
}

module.exports = { getPlayerRecentGames };

