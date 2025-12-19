const { chromium } = require('playwright');

// Sport URL mapping for player search
const SPORT_SEARCH_URLS = {
  'NBA': 'https://www.espn.com/nba/players',
  'NFL': 'https://www.espn.com/nfl/players',
  'NCAAM': 'https://www.espn.com/mens-college-basketball/players',
  'NCAAF': 'https://www.espn.com/college-football/players'
};

async function searchPlayerStats(playerName, sport = 'NBA') {
  console.log(`🔍 Searching for ${playerName} in ${sport}...`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set longer timeout
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  
  try {
    // Navigate to sport players page
    const searchUrl = SPORT_SEARCH_URLS[sport.toUpperCase()];
    if (!searchUrl) {
      throw new Error(`Unsupported sport: ${sport}`);
    }
    
    await page.goto(searchUrl, { 
      waitUntil: 'load',
      timeout: 60000 
    });
    await page.waitForTimeout(2000);
    
    // Try to find search input
    try {
      const searchInput = await page.$('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
      if (searchInput) {
        await searchInput.fill(playerName);
        await page.waitForTimeout(1000);
        await page.press('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]', 'Enter');
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('Search input not found, trying direct navigation...');
    }
    
    // Try to find and click player link
    let playerFound = false;
    try {
      const playerLinks = await page.$$(`a[href*="/player/"]`);
      for (const link of playerLinks) {
        const text = await link.textContent();
        if (text && text.toLowerCase().includes(playerName.toLowerCase())) {
          await link.click();
          await page.waitForTimeout(3000);
          playerFound = true;
          break;
        }
      }
    } catch (e) {
      console.log('Could not find player via search, trying direct URL...');
    }
    
    // If not found via search, try direct URL
    if (!playerFound) {
      const playerSlug = playerName.toLowerCase().replace(/\s+/g, '-');
      const directUrl = `${searchUrl}/${playerSlug}`;
      await page.goto(directUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }
    
    // Extract player stats
    const playerData = await page.evaluate((sport) => {
      const data = {
        name: '',
        position: '',
        team: '',
        seasonStats: {},
        recentGames: []
      };
      
      // Get player name
      const nameElement = document.querySelector('h1, [class*="player-name"], [data-testid="player-name"]');
      if (nameElement) {
        data.name = nameElement.textContent.trim();
      }
      
      // Get position and team
      const infoElements = document.querySelectorAll('[class*="player-info"], [class*="PlayerHeader"] span, .player-metadata span');
      infoElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.includes('Position') || text.match(/^[A-Z]{1,3}$/)) {
          data.position = text.replace('Position:', '').trim();
        }
        if (text.includes('Team') || (text.length > 2 && !text.match(/^[A-Z]{1,3}$/))) {
          data.team = text.replace('Team:', '').trim();
        }
      });
      
      // Get season stats from stats table
      const statTables = document.querySelectorAll('table, [class*="Table"], [class*="stats"]');
      statTables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 3) {
            const statName = cells[0]?.textContent?.trim().toLowerCase();
            const statValue = parseFloat(cells[1]?.textContent?.trim() || '0');
            
            if (statName && !isNaN(statValue)) {
              // Map common stat names
              if (statName.includes('point') || statName === 'ppg') {
                data.seasonStats.points = statValue;
              } else if (statName.includes('rebound') || statName === 'rpg') {
                data.seasonStats.rebounds = statValue;
              } else if (statName.includes('assist') || statName === 'apg') {
                data.seasonStats.assists = statValue;
              } else if (statName.includes('three') || statName.includes('3pt')) {
                data.seasonStats.threes = statValue;
              }
            }
          }
        });
      });
      
      // Get recent games from game log
      const gameLogRows = document.querySelectorAll('[class*="game-log"] tr, table tr');
      gameLogRows.forEach((row, index) => {
        if (index === 0) return; // Skip header
        
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 5) {
          const date = cells[0]?.textContent?.trim();
          const opponent = cells[1]?.textContent?.trim();
          const points = parseFloat(cells[2]?.textContent?.trim() || '0');
          const rebounds = parseFloat(cells[3]?.textContent?.trim() || '0');
          const assists = parseFloat(cells[4]?.textContent?.trim() || '0');
          
          if (date && opponent && !isNaN(points)) {
            data.recentGames.push({
              date,
              opponent,
              points,
              rebounds,
              assists
            });
          }
        }
      });
      
      return data;
    }, sport);
    
    await browser.close();
    
    // If we found player data, return it
    if (playerData.name || Object.keys(playerData.seasonStats).length > 0) {
      return playerData;
    }
    
    // Return empty result if nothing found
    return {
      name: playerName,
      position: '',
      team: '',
      seasonStats: {},
      recentGames: [],
      message: 'Player not found or stats not available'
    };
  } catch (error) {
    console.error(`❌ Error searching for player ${playerName}:`, error);
    await browser.close();
    return {
      name: playerName,
      error: error.message,
      seasonStats: {},
      recentGames: []
    };
  }
}

module.exports = { searchPlayerStats };
