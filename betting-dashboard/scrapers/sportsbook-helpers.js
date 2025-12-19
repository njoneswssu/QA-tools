// Helper functions for sportsbook team name conversions

// Convert team names to sportsbook-specific formats
function getTeamSlugForSportsbook(teamName, sportsbook) {
  const teamMap = {
    'FanDuel': {
      'Atlanta': 'atlanta-hawks',
      'Boston': 'boston-celtics',
      'Brooklyn': 'brooklyn-nets',
      'Charlotte': 'charlotte-hornets',
      'Chicago': 'chicago-bulls',
      'Cleveland': 'cleveland-cavaliers',
      'Dallas': 'dallas-mavericks',
      'Denver': 'denver-nuggets',
      'Detroit': 'detroit-pistons',
      'Golden State': 'golden-state-warriors',
      'Houston': 'houston-rockets',
      'Indiana': 'indiana-pacers',
      'LA Clippers': 'la-clippers',
      'Los Angeles': 'los-angeles-lakers',
      'Memphis': 'memphis-grizzlies',
      'Miami': 'miami-heat',
      'Milwaukee': 'milwaukee-bucks',
      'Minnesota': 'minnesota-timberwolves',
      'New Orleans': 'new-orleans-pelicans',
      'New York': 'new-york-knicks',
      'Oklahoma City': 'oklahoma-city-thunder',
      'Orlando': 'orlando-magic',
      'Philadelphia': 'philadelphia-76ers',
      'Phoenix': 'phoenix-suns',
      'Portland': 'portland-trail-blazers',
      'Sacramento': 'sacramento-kings',
      'San Antonio': 'san-antonio-spurs',
      'Toronto': 'toronto-raptors',
      'Utah': 'utah-jazz',
      'Washington': 'washington-wizards'
    },
    'BetMGM': {
      'Atlanta': 'atlanta-hawks',
      'Boston': 'boston-celtics',
      'Brooklyn': 'brooklyn-nets',
      'Charlotte': 'charlotte-hornets',
      'Chicago': 'chicago-bulls',
      'Cleveland': 'cleveland-cavaliers',
      'Dallas': 'dallas-mavericks',
      'Denver': 'denver-nuggets',
      'Detroit': 'detroit-pistons',
      'Golden State': 'golden-state-warriors',
      'Houston': 'houston-rockets',
      'Indiana': 'indiana-pacers',
      'LA Clippers': 'la-clippers',
      'Los Angeles': 'los-angeles-lakers',
      'Memphis': 'memphis-grizzlies',
      'Miami': 'miami-heat',
      'Milwaukee': 'milwaukee-bucks',
      'Minnesota': 'minnesota-timberwolves',
      'New Orleans': 'new-orleans-pelicans',
      'New York': 'new-york-knicks',
      'Oklahoma City': 'oklahoma-city-thunder',
      'Orlando': 'orlando-magic',
      'Philadelphia': 'philadelphia-76ers',
      'Phoenix': 'phoenix-suns',
      'Portland': 'portland-trail-blazers',
      'Sacramento': 'sacramento-kings',
      'San Antonio': 'san-antonio-spurs',
      'Toronto': 'toronto-raptors',
      'Utah': 'utah-jazz',
      'Washington': 'washington-wizards'
    },
    'DraftKings': {
      'Atlanta': 'atlanta-hawks',
      'Boston': 'boston-celtics',
      'Brooklyn': 'brooklyn-nets',
      'Charlotte': 'charlotte-hornets',
      'Chicago': 'chicago-bulls',
      'Cleveland': 'cleveland-cavaliers',
      'Dallas': 'dallas-mavericks',
      'Denver': 'denver-nuggets',
      'Detroit': 'detroit-pistons',
      'Golden State': 'golden-state-warriors',
      'Houston': 'houston-rockets',
      'Indiana': 'indiana-pacers',
      'LA Clippers': 'la-clippers',
      'Los Angeles': 'los-angeles-lakers',
      'Memphis': 'memphis-grizzlies',
      'Miami': 'miami-heat',
      'Milwaukee': 'milwaukee-bucks',
      'Minnesota': 'minnesota-timberwolves',
      'New Orleans': 'new-orleans-pelicans',
      'New York': 'new-york-knicks',
      'Oklahoma City': 'oklahoma-city-thunder',
      'Orlando': 'orlando-magic',
      'Philadelphia': 'philadelphia-76ers',
      'Phoenix': 'phoenix-suns',
      'Portland': 'portland-trail-blazers',
      'Sacramento': 'sacramento-kings',
      'San Antonio': 'san-antonio-spurs',
      'Toronto': 'toronto-raptors',
      'Utah': 'utah-jazz',
      'Washington': 'washington-wizards'
    }
  };
  
  const mapping = teamMap[sportsbook];
  if (!mapping) {
    // Fallback: convert to lowercase with hyphens
    return teamName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
  }
  
  return mapping[teamName] || teamName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
}

// Construct game URL for sportsbook
function getGameUrl(sportsbook, homeTeam, awayTeam, sport = 'NBA') {
  const homeSlug = getTeamSlugForSportsbook(homeTeam, sportsbook);
  const awaySlug = getTeamSlugForSportsbook(awayTeam, sportsbook);
  
  const baseUrls = {
    'FanDuel': `https://sportsbook.fanduel.com`,
    'BetMGM': `https://sports.betmgm.com/en`,
    'DraftKings': `https://sportsbook.draftkings.com`
  };
  
  const baseUrl = baseUrls[sportsbook];
  if (!baseUrl) return null;
  
  // Try different URL patterns - sportsbooks may use different formats
  // We'll try to find the game by searching or using a common pattern
  if (sportsbook === 'FanDuel') {
    // FanDuel: Navigate to NBA page and search for game
    return `${baseUrl}/navigation/${sport.toLowerCase()}`;
  } else if (sportsbook === 'BetMGM') {
    return `${baseUrl}/sports/basketball/${sport.toLowerCase()}`;
  } else if (sportsbook === 'DraftKings') {
    return `${baseUrl}/leagues/basketball/${sport.toLowerCase()}`;
  }
  
  return null;
}

module.exports = { getTeamSlugForSportsbook, getGameUrl };

