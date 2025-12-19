const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();

// Sport URL mapping
const SPORT_URLS = {
  'NBA': 'https://www.espn.com/nba/schedule',
  'NFL': 'https://www.espn.com/nfl/schedule',
  'NCAAM': 'https://www.espn.com/mens-college-basketball/schedule',
  'NCAAF': 'https://www.espn.com/college-football/schedule'
};

async function scrapeESPN(db, sport = 'NBA') {
  console.log(`📊 Scraping ESPN for ${sport} game schedules...`);
  
  const sportUrl = SPORT_URLS[sport.toUpperCase()];
  if (!sportUrl) {
    console.error(`❌ Unsupported sport: ${sport}`);
    return;
  }
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set longer timeout
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  
  try {
    // Navigate to ESPN schedule
    console.log(`Navigating to ${sportUrl}...`);
    await page.goto(sportUrl, { 
      waitUntil: 'load',
      timeout: 60000 
    });
    
    // Wait for content
    await page.waitForTimeout(5000);
    
    // Scroll to load all content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);
    
    // Debug: Get detailed page structure
    const debugInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        hasScheduleTables: document.querySelectorAll('div.ScheduleTables, [class*="ScheduleTables"]').length,
        hasTables: document.querySelectorAll('table').length,
        hasSchedule: document.querySelectorAll('[class*="schedule"], [class*="Schedule"]').length,
        allLinks: document.querySelectorAll('a[href*="/team/"]').length,
        scheduleTableStructure: []
      };
      
      // Check ScheduleTables structure
      const scheduleTables = document.querySelectorAll('div.ScheduleTables, [class*="ScheduleTables"]');
      scheduleTables.forEach((st, index) => {
        const dateHeaders = st.querySelectorAll('h2, h3, [class*="Table__Title"], [class*="date"], [class*="Date"]');
        const tables = st.querySelectorAll('table');
        const rows = st.querySelectorAll('tr');
        const teamLinks = st.querySelectorAll('a[href*="/team/"]');
        
        info.scheduleTableStructure.push({
          index,
          className: st.className,
          dateHeaders: Array.from(dateHeaders).map(h => h.textContent.trim()),
          tables: tables.length,
          rows: rows.length,
          teamLinks: teamLinks.length,
          firstRowText: rows.length > 0 ? rows[0].textContent.substring(0, 200) : ''
        });
      });
      
      // Check all tables
      const allTables = document.querySelectorAll('table');
      info.tableDetails = [];
      allTables.forEach((table, index) => {
        const rows = table.querySelectorAll('tr');
        const firstDataRow = Array.from(rows).find(r => !r.querySelector('th') && r.querySelectorAll('td').length > 0);
        info.tableDetails.push({
          index,
          rows: rows.length,
          hasHeader: table.querySelector('th') !== null,
          firstDataRowText: firstDataRow ? firstDataRow.textContent.substring(0, 200) : '',
          teamLinks: firstDataRow ? firstDataRow.querySelectorAll('a[href*="/team/"]').length : 0
        });
      });
      
      return info;
    });
    
    console.log('\n=== DEBUG INFO ===');
    console.log(`Title: ${debugInfo.title}`);
    console.log(`ScheduleTables divs: ${debugInfo.hasScheduleTables}`);
    console.log(`Total tables: ${debugInfo.hasTables}`);
    console.log(`Schedule elements: ${debugInfo.hasSchedule}`);
    console.log(`Team links: ${debugInfo.allLinks}`);
    
    if (debugInfo.scheduleTableStructure.length > 0) {
      console.log('\n--- ScheduleTables Structure ---');
      debugInfo.scheduleTableStructure.forEach((st, i) => {
        console.log(`ScheduleTable ${i}:`);
        console.log(`  Class: ${st.className}`);
        console.log(`  Date headers: ${st.dateHeaders.join(', ')}`);
        console.log(`  Tables: ${st.tables}, Rows: ${st.rows}, Team links: ${st.teamLinks}`);
        console.log(`  First row: ${st.firstRowText.substring(0, 100)}...`);
      });
    }
    
    if (debugInfo.tableDetails.length > 0) {
      console.log('\n--- Table Details ---');
      debugInfo.tableDetails.slice(0, 5).forEach((td, i) => {
        console.log(`Table ${i}: ${td.rows} rows, ${td.teamLinks} team links in first row`);
        console.log(`  First row text: ${td.firstDataRowText.substring(0, 100)}...`);
      });
    }
    console.log('==================\n');
    
    // Extract game data - focus on ScheduleTables structure
    const games = await page.evaluate(() => {
      const extractedGames = [];
      const debugInfo = { rowsProcessed: 0, gamesFound: 0, issues: [] };
      
      // Strategy 1: Find ScheduleTables divs (ESPN's main structure)
      const scheduleTables = document.querySelectorAll('div.ScheduleTables, [class*="ScheduleTables"], [class*="Schedule"]');
      
      scheduleTables.forEach((scheduleTable, stIndex) => {
        // Find date header - usually an h2 or div with date class
        let dateText = '';
        const dateSelectors = [
          'h2',
          'h3', 
          '[class*="Table__Title"]',
          '[class*="date"]',
          '[class*="Date"]',
          '[class*="Schedule__Title"]'
        ];
        
        for (const selector of dateSelectors) {
          const dateHeader = scheduleTable.querySelector(selector);
          if (dateHeader) {
            const text = dateHeader.textContent.trim();
            // Check if it looks like a date
            if (text.match(/\w+day,?\s+\w+\s+\d+/i) || text.match(/\d+\/\d+/) || text.length > 5) {
              dateText = text;
              break;
            }
          }
        }
        
        // Find all tables within this schedule section
        const tables = scheduleTable.querySelectorAll('table');
        
        tables.forEach((table, tableIndex) => {
          const rows = table.querySelectorAll('tr');
          
          rows.forEach((row, rowIndex) => {
            // Skip header rows
            if (row.querySelector('th')) return;
            
            const cells = row.querySelectorAll('td');
            if (cells.length < 1) return;
            
            // Get full row text for debugging
            const rowText = row.textContent || '';
            
            // Strategy A: Look for team links anywhere in the row
            const teamLinks = row.querySelectorAll('a[href*="/team/"], a[href*="/nba/team/"], a[href*="/nfl/team/"]');
            
            let awayTeam = null;
            let homeTeam = null;
            let timeText = '';
            
            if (teamLinks.length >= 2) {
              // Get team names from links
              awayTeam = teamLinks[0]?.textContent?.trim();
              homeTeam = teamLinks[1]?.textContent?.trim();
            } else if (teamLinks.length === 1) {
              // Sometimes only one link, try to get both from text
              const linkText = teamLinks[0]?.textContent?.trim();
              const rowWithoutLink = rowText.replace(linkText, '').trim();
              
              // Try to find the other team in the text
              const otherTeamMatch = rowWithoutLink.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*@\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
              if (otherTeamMatch) {
                awayTeam = otherTeamMatch[1].trim();
                homeTeam = otherTeamMatch[2].trim();
              }
            }
            
            // Strategy B: Parse from row text if links didn't work
            if (!awayTeam || !homeTeam) {
              // Try full team names first (e.g., "San Antonio @ New York")
              const fullNameMatch = rowText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+@\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
              
              if (fullNameMatch) {
                awayTeam = fullNameMatch[1].trim();
                homeTeam = fullNameMatch[2].trim();
              } else {
                // Try abbreviations (e.g., "SA @ NY")
                const abbrevMatch = rowText.match(/([A-Z]{2,4})\s*@\s*([A-Z]{2,4})/);
                if (abbrevMatch) {
                  awayTeam = abbrevMatch[1];
                  homeTeam = abbrevMatch[2];
                }
              }
            }
            
            // Extract time from row text or cells
            if (rowText) {
              const timeMatch = rowText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|ET)?)/i);
              if (timeMatch) {
                timeText = timeMatch[1].trim();
              }
            }
            
            // If still no time, check cells
            if (!timeText) {
              cells.forEach(cell => {
                const text = cell.textContent.trim();
                if (text.match(/\d{1,2}:\d{2}\s*(AM|PM|ET)/i) || text.match(/^\d{1,2}:\d{2}\s*PM?$/i)) {
                  timeText = text;
                }
              });
            }
            
            // If we found both teams, add the game
            if (awayTeam && homeTeam && awayTeam.length > 0 && homeTeam.length > 0) {
              // Clean team names - remove extra whitespace
              awayTeam = awayTeam.replace(/\s+/g, ' ').trim();
              homeTeam = homeTeam.replace(/\s+/g, ' ').trim();
              
              extractedGames.push({
                awayTeam,
                homeTeam,
                date: dateText,
                time: timeText,
                source: `schedule-table-${stIndex}-row-${rowIndex}`
              });
              debugInfo.gamesFound++;
            } else {
              debugInfo.issues.push(`Row ${rowIndex}: awayTeam=${awayTeam}, homeTeam=${homeTeam}, rowText=${rowText.substring(0, 100)}`);
            }
            debugInfo.rowsProcessed++;
          });
        });
      });
      
      // Strategy 2: Fallback - look for any tables with team links
      const allTables = document.querySelectorAll('table');
      
      allTables.forEach((table, tableIndex) => {
        // Skip if already processed in Strategy 1
        if (table.closest('div.ScheduleTables, [class*="ScheduleTables"]')) return;
        
        // Find date context
        let dateText = '';
        const tableParent = table.closest('section, div');
        if (tableParent) {
          const dateEl = tableParent.querySelector('h2, h3, [class*="Date"], [class*="Table__Title"]');
          if (dateEl) {
            dateText = dateEl.textContent.trim();
          }
        }
        
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          if (row.querySelector('th')) return;
          
          const teamLinks = row.querySelectorAll('a[href*="/team/"]');
          if (teamLinks.length >= 2) {
            const awayTeam = teamLinks[0]?.textContent?.trim();
            const homeTeam = teamLinks[1]?.textContent?.trim();
            
            if (awayTeam && homeTeam) {
              const cells = row.querySelectorAll('td');
              let timeText = '';
              cells.forEach(cell => {
                const text = cell.textContent.trim();
                if (text.match(/\d{1,2}:\d{2}\s*(AM|PM|ET)/i)) {
                  timeText = text;
                }
              });
              
              extractedGames.push({
                awayTeam,
                homeTeam,
                date: dateText,
                time: timeText,
                source: `fallback-table-${tableIndex}`
              });
            }
          }
        });
      });
      
      // Remove duplicates based on team names
      const unique = [];
      const seen = new Set();
      extractedGames.forEach(game => {
        const key = `${game.awayTeam}-${game.homeTeam}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(game);
        }
      });
      
      // Return games and debug info
      return {
        games: unique,
        debug: debugInfo
      };
    });
    
    // Extract games and debug info
    const extractedGames = games.games || [];
    const extractionDebug = games.debug || {};
    
    console.log(`\nExtraction Debug:`);
    console.log(`  Rows processed: ${extractionDebug.rowsProcessed}`);
    console.log(`  Games found: ${extractionDebug.gamesFound}`);
    if (extractionDebug.issues && extractionDebug.issues.length > 0) {
      console.log(`  Issues (first 5):`);
      extractionDebug.issues.slice(0, 5).forEach(issue => console.log(`    - ${issue}`));
    }
    
    console.log(`\nFound ${extractedGames.length} potential games, processing dates...`);
    
    if (extractedGames.length > 0) {
      console.log('Sample games found:');
      extractedGames.slice(0, 10).forEach((game, i) => {
        console.log(`  ${i + 1}. ${game.awayTeam} @ ${game.homeTeam} - Date: "${game.date}" - Time: "${game.time}" (${game.source})`);
      });
    } else {
      console.log('⚠️  No games extracted! Check selectors.');
    }
    
    // Parse dates and filter for current date and future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const validGames = [];
    
    for (const game of extractedGames) {
      if (!game.awayTeam || !game.homeTeam) {
        console.log(`Skipping game: missing team names`);
        continue;
      }
      
      let gameDate = new Date(today);
      
      // Parse date from dateText
      if (game.date) {
        // Clean date text - might have multiple dates/times, take first one
        const cleanDate = game.date.split(',')[0] + game.date.split(',').slice(1, 3).join(',').trim();
        const parsedDate = parseDate(cleanDate, today);
        if (parsedDate) {
          gameDate = parsedDate;
        } else {
          // Try parsing just the first part before comma
          const firstPart = game.date.split(',')[0].trim();
          const secondPart = game.date.split(',').slice(1).join(',').trim();
          const tryDate = parseDate(firstPart + ', ' + secondPart.split(/\d{1,2}:\d{2}/)[0], today);
          if (tryDate) {
            gameDate = tryDate;
          } else {
            console.log(`Could not parse date: "${game.date}"`);
          }
        }
      }
      
      // Only include games from today forward
      if (gameDate >= today) {
        const gameDateStr = gameDate.toISOString().split('T')[0];
        
        // Insert or update game
        db.run(`
          INSERT OR REPLACE INTO games (espn_id, home_team, away_team, game_date, game_time, sport, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          `espn-${sport}-${game.homeTeam}-${game.awayTeam}-${gameDateStr}`,
          game.homeTeam,
          game.awayTeam,
          gameDateStr,
          game.time,
          sport.toUpperCase()
        ], (err) => {
          if (err) console.error('Error inserting game:', err);
        });
        
        validGames.push(game);
        console.log(`  ✓ ${game.awayTeam} @ ${game.homeTeam} - ${gameDateStr} ${game.time || ''}`);
      } else {
        console.log(`  ✗ Skipping past game: ${game.awayTeam} @ ${game.homeTeam} - ${gameDate.toISOString().split('T')[0]}`);
      }
    }
    
    console.log(`\n✅ Scraped ${validGames.length} ${sport} games from ESPN (current date and future)`);
    
    if (validGames.length === 0) {
      console.log(`\n⚠️  No upcoming games found for ${sport}.`);
      console.log(`   Total games found on page: ${games.length}`);
      console.log(`   Try checking the ESPN page manually: ${sportUrl}`);
      console.log(`\n💡 Debugging tips:`);
      console.log(`   - Check if ScheduleTables divs were found: ${debugInfo.hasScheduleTables}`);
      console.log(`   - Check if tables were found: ${debugInfo.hasTables}`);
      console.log(`   - Check if team links were found: ${debugInfo.allLinks}`);
    }
  } catch (error) {
    console.error(`❌ Error scraping ESPN for ${sport}:`, error.message);
    console.error(error.stack);
  } finally {
    try {
      await browser.close();
    } catch (e) {
      // Ignore errors closing browser
    }
  }
}

// Helper function to parse date strings
function parseDate(dateText, referenceDate) {
  if (!dateText) return null;
  
  const text = dateText.toLowerCase().trim();
  const today = new Date(referenceDate);
  
  // Check for "Today"
  if (text.includes('today')) {
    return new Date(today);
  }
  
  // Check for "Tomorrow"
  if (text.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
      // Parse "Monday, January 15" or "Mon, Jan 15" or "Tuesday, December 16, 2025"
      // Also handle dates with times mixed in like "Tuesday, December 16, 2025, 8:30 PM"
      const dayMonthMatch = text.match(/(\w+day),?\s+(\w+)\s+(\d+)(?:,\s+(\d{4}))?/i);
      if (dayMonthMatch) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        const monthName = dayMonthMatch[2].toLowerCase();
        let month = monthNames.findIndex(m => m.startsWith(monthName));
        if (month === -1) {
          month = monthAbbr.findIndex(m => m.startsWith(monthName));
        }
        
        if (month >= 0) {
          const day = parseInt(dayMonthMatch[3]);
          let year = dayMonthMatch[4] ? parseInt(dayMonthMatch[4]) : today.getFullYear();
          
          // If month is in the past and no year specified, assume next year
          if (!dayMonthMatch[4] && (month < today.getMonth() || (month === today.getMonth() && day < today.getDate()))) {
            year = today.getFullYear() + 1;
          }
          
          const gameDate = new Date(year, month, day);
          return gameDate;
        }
      }
      
      // Try parsing just the date part if it has time mixed in
      const dateWithTime = text.match(/(\w+day),?\s+(\w+)\s+(\d+),?\s+(\d{4})?/i);
      if (dateWithTime) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        const monthName = dateWithTime[2].toLowerCase();
        let month = monthNames.findIndex(m => m.startsWith(monthName));
        if (month === -1) {
          month = monthAbbr.findIndex(m => m.startsWith(monthName));
        }
        
        if (month >= 0) {
          const day = parseInt(dateWithTime[3]);
          let year = dateWithTime[4] ? parseInt(dateWithTime[4]) : today.getFullYear();
          const gameDate = new Date(year, month, day);
          return gameDate;
        }
      }
  
  // Parse "1/15" or "01/15"
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slashMatch) {
    let month = parseInt(slashMatch[1]) - 1; // JS months are 0-indexed
    const day = parseInt(slashMatch[2]);
    let year = slashMatch[3] ? parseInt(slashMatch[3]) : today.getFullYear();
    
    // Handle 2-digit years
    if (year < 100) {
      year = year + 2000;
    }
    
    // If month is in the past, assume next year
    if (month < today.getMonth() || (month === today.getMonth() && day < today.getDate())) {
      year = today.getFullYear() + 1;
    }
    
    const gameDate = new Date(year, month, day);
    return gameDate;
  }
  
  return null;
}

module.exports = { scrapeESPN };
