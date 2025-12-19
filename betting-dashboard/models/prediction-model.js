const sqlite3 = require('sqlite3').verbose();

// Simple AI prediction model
// In production, this would use machine learning, but for now we'll use statistical analysis
async function generateProjections(db) {
  console.log('🤖 Generating AI projections...');
  
  // Get all upcoming games
  const games = await new Promise((resolve, reject) => {
    db.all(`
      SELECT id, home_team, away_team, game_date 
      FROM games 
      WHERE game_date >= date('now')
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  // Get players from games (not just betting lines) - we want projections for all players
  const gamePlayers = await new Promise((resolve, reject) => {
    db.all(`
      SELECT DISTINCT gp.game_id, gp.player_name
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE g.game_date >= date('now')
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  // Get betting lines to identify which stats have lines
  const lines = await new Promise((resolve, reject) => {
    db.all(`
      SELECT DISTINCT game_id, player_name, stat_type 
      FROM betting_lines
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  // Create a map of stat types that have lines
  const statTypesWithLines = new Set();
  lines.forEach(line => {
    statTypesWithLines.add(`${line.game_id}-${line.player_name}-${line.stat_type}`);
  });
  
  // Generate projections for all players in games - always generate for points, rebounds, and assists
  const projectionsToGenerate = [];
  for (const player of gamePlayers) {
    // Always generate projections for points, rebounds, and assists
    ['points', 'rebounds', 'assists'].forEach(statType => {
      projectionsToGenerate.push({
        game_id: player.game_id,
        player_name: player.player_name,
        stat_type: statType
      });
    });
    
    // Also generate for other stats if they have betting lines
    ['threes'].forEach(statType => {
      const key = `${player.game_id}-${player.player_name}-${statType}`;
      if (statTypesWithLines.has(key)) {
        projectionsToGenerate.push({
          game_id: player.game_id,
          player_name: player.player_name,
          stat_type: statType
        });
      }
    });
  }
  
  console.log(`Generating projections for ${projectionsToGenerate.length} player/stat combinations`);
  
  // Get player historical averages
  const playerAverages = await new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        player_name,
        stat_type,
        AVG(stat_value) as avg_value,
        COUNT(*) as game_count
      FROM player_game_history
      GROUP BY player_name, stat_type
    `, (err, rows) => {
      if (err) reject(err);
      else {
        const averages = {};
        rows.forEach(row => {
          if (!averages[row.player_name]) {
            averages[row.player_name] = {};
          }
          averages[row.player_name][row.stat_type] = {
            avg: row.avg_value,
            games: row.game_count
          };
        });
        resolve(averages);
      }
    });
  });
  
  // Generate projections for each player/stat combination
  for (const line of projectionsToGenerate) {
    const playerName = line.player_name;
    const statType = line.stat_type;
    
    // Get player average from recent games or season average
    let playerAvg = playerAverages[playerName]?.[statType];
    
    // If no recent game data, try to get season average
    if (!playerAvg || playerAvg.games < 3) {
      const seasonAvg = await new Promise((resolve, reject) => {
        db.get(`
          SELECT AVG(stat_value) as avg_value, COUNT(*) as game_count
          FROM player_game_history
          WHERE player_name = ? AND stat_type = ? AND opponent = 'Season Average'
        `, [playerName, statType], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (seasonAvg && seasonAvg.game_count > 0) {
        playerAvg = {
          avg: seasonAvg.avg_value,
          games: seasonAvg.game_count
        };
      }
    }
    
    if (playerAvg && playerAvg.games >= 1) {
      // Base projection on average
      let projection = playerAvg.avg;
      let confidence = 0.6;
      let reasoning = `Based on ${playerAvg.games >= 3 ? playerAvg.games + ' recent games' : 'season average'}, averaging ${playerAvg.avg.toFixed(1)} ${statType}`;
      
      // Add some variance for realism
      const variance = projection * 0.1; // 10% variance
      projection = projection + (Math.random() * variance * 2 - variance);
      
      // Adjust confidence based on sample size
      if (playerAvg.games >= 10) {
        confidence = 0.75;
        reasoning += ' (high confidence - large sample size)';
      } else if (playerAvg.games >= 5) {
        confidence = 0.65;
        reasoning += ' (moderate confidence)';
      } else if (playerAvg.games >= 3) {
        confidence = 0.55;
        reasoning += ' (lower confidence - limited sample)';
      } else {
        confidence = 0.5;
        reasoning += ' (low confidence - using season average)';
      }
      
      // Check if there's a betting line to compare
      const bettingLine = await new Promise((resolve, reject) => {
        db.get(`
          SELECT line FROM betting_lines 
          WHERE game_id = ? AND player_name = ? AND stat_type = ?
          LIMIT 1
        `, [line.game_id, playerName, statType], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (bettingLine) {
        const lineValue = bettingLine.line;
        const difference = Math.abs(projection - lineValue);
        
        if (difference < 2) {
          reasoning += `. Model aligns closely with sportsbook line (${lineValue}).`;
          confidence += 0.05;
        } else if (projection > lineValue) {
          reasoning += `. Model projects ${(projection - lineValue).toFixed(1)} above sportsbook line (${lineValue}).`;
        } else {
          reasoning += `. Model projects ${(lineValue - projection).toFixed(1)} below sportsbook line (${lineValue}).`;
        }
      }
      
      // Insert or update projection (UNIQUE constraint on game_id, player_name, stat_type ensures no duplicates)
      db.run(`
        INSERT OR REPLACE INTO player_projections 
        (game_id, player_name, stat_type, projection, confidence, reasoning, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [line.game_id, playerName, statType, projection.toFixed(2), confidence, reasoning], (err) => {
        if (err) console.error(`Error inserting projection for ${playerName} ${statType}:`, err);
      });
    } else {
      // No historical data - use default projection
      const defaultProjections = {
        points: 15.0,
        rebounds: 5.0,
        assists: 3.0,
        threes: 2.0
      };
      
      const projection = defaultProjections[statType] || 10.0;
      const reasoning = `Default projection - insufficient historical data for ${playerName}`;
      
      db.run(`
        INSERT OR REPLACE INTO player_projections 
        (game_id, player_name, stat_type, projection, confidence, reasoning, updated_at)
        VALUES (?, ?, ?, ?, 0.4, ?, CURRENT_TIMESTAMP)
      `, [line.game_id, playerName, statType, projection, reasoning], (err) => {
        if (err) console.error(`Error inserting default projection for ${playerName} ${statType}:`, err);
      });
    }
  }
  
  console.log(`✅ Generated projections for ${projectionsToGenerate.length} player/stat combinations`);
}

module.exports = { generateProjections };

