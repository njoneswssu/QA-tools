const { chromium } = require('playwright');

async function scrapeFanDuel(db) {
  console.log('📊 Scraping FanDuel for betting lines...');
  
  // Get games from database
  const games = await new Promise((resolve, reject) => {
    db.all(`
      SELECT id, home_team, away_team, game_date, sport 
      FROM games 
      WHERE game_date >= date('now') AND sport = 'NBA'
      ORDER BY game_date
      LIMIT 10
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (games.length === 0) {
    console.log('No upcoming games found in database');
    return;
  }
  
  console.log(`Found ${games.length} games to scrape from FanDuel`);
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });
  
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  
  try {
    // Navigate to FanDuel NBA page
    await page.goto('https://sportsbook.fanduel.com/navigation/nba', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    await page.waitForTimeout(5000);
    
    const pageTitle = await page.title();
    if (pageTitle.toLowerCase().includes('denied') || pageTitle.toLowerCase().includes('access')) {
      console.log('⚠️  FanDuel access denied');
      await browser.close();
      return;
    }
    
    // Scrape each game
    let totalLines = 0;
    for (const game of games) {
      try {
        console.log(`\nScraping FanDuel for: ${game.away_team} @ ${game.home_team}`);
        const lines = await scrapeGameFromFanDuel(page, game);
        
        // Store lines
        for (const line of lines) {
          db.run(`
            INSERT OR REPLACE INTO betting_lines 
            (game_id, sportsbook, player_name, stat_type, line, over_odds, under_odds, updated_at)
            VALUES (?, 'FanDuel', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [game.id, line.playerName, line.statType, line.line, line.overOdds, line.underOdds], (err) => {
            if (err) console.error(`Error inserting line:`, err);
          });
        }
        
        totalLines += lines.length;
        console.log(`  ✓ Found ${lines.length} betting lines`);
        
        await page.waitForTimeout(2000);
      } catch (error) {
        console.error(`  ✗ Error scraping game ${game.id}:`, error.message);
        continue;
      }
    }
    
    console.log(`\n✅ Scraped ${totalLines} total lines from FanDuel`);
  } catch (error) {
    console.error('❌ Error scraping FanDuel:', error);
  } finally {
    await browser.close();
  }
}

async function scrapeGameFromFanDuel(page, game) {
  // Try to find and click on the game
  try {
    // Look for game link containing both team names
    const gameLink = await page.evaluateHandle((awayTeam, homeTeam) => {
      const links = Array.from(document.querySelectorAll('a, [role="button"], [class*="game"], [class*="match"], [class*="event"]'));
      for (const link of links) {
        const text = (link.textContent || '').toLowerCase();
        const awayLower = awayTeam.toLowerCase();
        const homeLower = homeTeam.toLowerCase();
        
        // Check if link contains both teams (or abbreviations)
        if ((text.includes(awayLower) || text.includes(awayLower.split(' ')[0])) &&
            (text.includes(homeLower) || text.includes(homeLower.split(' ')[0]))) {
          return link;
        }
      }
      return null;
    }, game.away_team, game.home_team);
    
    if (gameLink && gameLink.asElement()) {
      await gameLink.asElement().click();
      await page.waitForTimeout(4000);
      
      // Try to click "Player Props" if available
      try {
        await page.click('text=Player Props', { timeout: 3000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        // Player Props might already be visible or have different text
      }
    }
  } catch (e) {
    console.log('  Could not find game link, extracting from current page...');
  }
  
  // Extract betting lines
  const lines = await page.evaluate(() => {
    const extractedLines = [];
    
    // Try multiple selectors for player props
    const selectors = [
      '[data-testid*="player"]',
      '[class*="player-prop"]',
      '[class*="PlayerProp"]',
      '[class*="market-row"]',
      '[class*="outcome-row"]',
      'tr[class*="player"]',
      '[class*="market"]',
      '[class*="bet"]'
    ];
    
    let propElements = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        propElements = Array.from(elements);
        break;
      }
    }
    
    // If no specific props, look for elements with player names and numbers
    if (propElements.length === 0) {
      const allElements = document.querySelectorAll('div, span, tr, td, li');
      propElements = Array.from(allElements).filter(el => {
        const text = el.textContent || '';
        return text.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/) && 
               text.match(/\d+\.?\d*/) && 
               text.length < 500 &&
               !text.match(/^\d+$/);
      }).slice(0, 100);
    }
    
    propElements.forEach((element) => {
      try {
        const fullText = element.textContent || '';
        
        // Extract player name
        let playerName = element.querySelector('[class*="player-name"], [class*="name"], [data-testid*="name"]')?.textContent?.trim();
        
        if (!playerName) {
          const nameMatch = fullText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          if (nameMatch) {
            playerName = nameMatch[1];
          }
        }
        
        // Extract stat type and line
        const statText = fullText.toLowerCase();
        let statType = 'points';
        if (statText.includes('rebound')) statType = 'rebounds';
        else if (statText.includes('assist')) statType = 'assists';
        else if (statText.includes('three') || statText.includes('3pt')) statType = 'threes';
        
        // Find line number (usually a decimal like 25.5)
        const lineMatch = fullText.match(/(\d+\.?\d*)/);
        const line = lineMatch ? parseFloat(lineMatch[1]) : null;
        
        // Find odds
        let overOdds = null;
        let underOdds = null;
        const oddsElements = element.querySelectorAll('[class*="odds"], [class*="price"], button, [class*="bet"]');
        
        if (oddsElements.length >= 2) {
          const overText = oddsElements[0]?.textContent?.trim() || '';
          const underText = oddsElements[1]?.textContent?.trim() || '';
          
          const overMatch = overText.match(/([+-]?\d+)/);
          const underMatch = underText.match(/([+-]?\d+)/);
          
          overOdds = overMatch ? parseInt(overMatch[1]) : null;
          underOdds = underMatch ? parseInt(underMatch[1]) : null;
        }
        
        if (playerName && playerName.length > 2 && line !== null && !isNaN(line) && line > 0) {
          extractedLines.push({
            playerName: playerName.trim(),
            statType,
            line,
            overOdds,
            underOdds
          });
        }
      } catch (e) {
        // Skip invalid elements
      }
    });
    
    // Remove duplicates
    const unique = [];
    const seen = new Set();
    extractedLines.forEach(line => {
      const key = `${line.playerName}-${line.statType}-${line.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(line);
      }
    });
    
    return unique;
  });
  
  return lines;
}

module.exports = { scrapeFanDuel };
