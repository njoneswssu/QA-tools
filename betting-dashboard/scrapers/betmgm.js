const { chromium } = require('playwright');

async function scrapeBetMGM(db) {
  console.log('📊 Scraping BetMGM for betting lines...');
  
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
    console.log('No upcoming games found');
    return;
  }
  
  console.log(`Found ${games.length} games to scrape from BetMGM`);
  
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
    await page.goto('https://sports.betmgm.com/en/sports/basketball/nba', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(5000);
    
    const pageTitle = await page.title();
    if (pageTitle.toLowerCase().includes('denied') || pageTitle.toLowerCase().includes('access')) {
      console.log('⚠️  BetMGM access denied');
      await browser.close();
      return;
    }
    
    let totalLines = 0;
    for (const game of games) {
      try {
        console.log(`\nScraping BetMGM for: ${game.away_team} @ ${game.home_team}`);
        const lines = await scrapeGameFromBetMGM(page, game);
        
        for (const line of lines) {
          db.run(`
            INSERT OR REPLACE INTO betting_lines 
            (game_id, sportsbook, player_name, stat_type, line, updated_at)
            VALUES (?, 'BetMGM', ?, ?, ?, CURRENT_TIMESTAMP)
          `, [game.id, line.playerName, line.statType, line.line], (err) => {
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
    
    console.log(`\n✅ Scraped ${totalLines} total lines from BetMGM`);
  } catch (error) {
    console.error('❌ Error scraping BetMGM:', error);
  } finally {
    await browser.close();
  }
}

async function scrapeGameFromBetMGM(page, game) {
  try {
    const gameLink = await page.evaluateHandle((awayTeam, homeTeam) => {
      const links = Array.from(document.querySelectorAll('a, [role="button"], [class*="game"], [class*="match"], [class*="event"]'));
      for (const link of links) {
        const text = (link.textContent || '').toLowerCase();
        const awayLower = awayTeam.toLowerCase();
        const homeLower = homeTeam.toLowerCase();
        
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
      
      try {
        await page.click('text=Player Props', { timeout: 3000 });
        await page.waitForTimeout(2000);
      } catch (e) {}
    }
  } catch (e) {
    console.log('  Could not find game link, extracting from current page...');
  }
  
  const lines = await page.evaluate(() => {
    const extractedLines = [];
    
    const selectors = [
      '[class*="player"]',
      '[data-testid*="player"]',
      '.market-row',
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
    
    if (propElements.length === 0) {
      const allElements = document.querySelectorAll('div, span, tr, td, li');
      propElements = Array.from(allElements).filter(el => {
        const text = el.textContent || '';
        return text.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/) && 
               text.match(/\d+\.?\d*/) && 
               text.length < 500;
      }).slice(0, 100);
    }
    
    propElements.forEach((element) => {
      try {
        const fullText = element.textContent || '';
        const playerName = element.querySelector('[class*="name"], [class*="player-name"]')?.textContent?.trim() ||
                          fullText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)?.[1];
        
        const statText = fullText.toLowerCase();
        let statType = 'points';
        if (statText.includes('rebound')) statType = 'rebounds';
        else if (statText.includes('assist')) statType = 'assists';
        
        const lineMatch = fullText.match(/(\d+\.?\d*)/);
        const line = lineMatch ? parseFloat(lineMatch[1]) : null;
        
        if (playerName && playerName.length > 2 && line !== null && !isNaN(line) && line > 0) {
          extractedLines.push({
            playerName: playerName.trim(),
            statType,
            line
          });
        }
      } catch (e) {}
    });
    
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

module.exports = { scrapeBetMGM };
