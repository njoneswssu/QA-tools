// Team name to ESPN slug mapping
const TEAM_SLUGS = {
  'NBA': {
    'Atlanta': 'atl',
    'Boston': 'bos',
    'Brooklyn': 'bkn',
    'Charlotte': 'cha',
    'Chicago': 'chi',
    'Cleveland': 'cle',
    'Dallas': 'dal',
    'Denver': 'den',
    'Detroit': 'det',
    'Golden State': 'gs',
    'Houston': 'hou',
    'Indiana': 'ind',
    'LA Clippers': 'lac',
    'Los Angeles': 'lal',
    'Memphis': 'mem',
    'Miami': 'mia',
    'Milwaukee': 'mil',
    'Minnesota': 'min',
    'New Orleans': 'no',
    'New York': 'ny',
    'Oklahoma City': 'okc',
    'Orlando': 'orl',
    'Philadelphia': 'phi',
    'Phoenix': 'phx',
    'Portland': 'por',
    'Sacramento': 'sac',
    'San Antonio': 'sa',
    'Toronto': 'tor',
    'Utah': 'utah',
    'Washington': 'wsh',
    // Common abbreviations
    'ATL': 'atl',
    'BOS': 'bos',
    'BKN': 'bkn',
    'CHA': 'cha',
    'CHI': 'chi',
    'CLE': 'cle',
    'DAL': 'dal',
    'DEN': 'den',
    'DET': 'det',
    'GS': 'gs',
    'GSW': 'gs',
    'HOU': 'hou',
    'IND': 'ind',
    'LAC': 'lac',
    'LAL': 'lal',
    'MEM': 'mem',
    'MIA': 'mia',
    'MIL': 'mil',
    'MIN': 'min',
    'NO': 'no',
    'NOP': 'no',
    'NY': 'ny',
    'NYK': 'ny',
    'OKC': 'okc',
    'ORL': 'orl',
    'PHI': 'phi',
    'PHX': 'phx',
    'POR': 'por',
    'SAC': 'sac',
    'SA': 'sa',
    'SAS': 'sa',
    'TOR': 'tor',
    'UTA': 'utah',
    'WAS': 'wsh',
    'WSH': 'wsh'
  },
  'NFL': {
    'Arizona': 'ari',
    'Atlanta': 'atl',
    'Baltimore': 'bal',
    'Buffalo': 'buf',
    'Carolina': 'car',
    'Chicago': 'chi',
    'Cincinnati': 'cin',
    'Cleveland': 'cle',
    'Dallas': 'dal',
    'Denver': 'den',
    'Detroit': 'det',
    'Green Bay': 'gb',
    'Houston': 'hou',
    'Indianapolis': 'ind',
    'Jacksonville': 'jax',
    'Kansas City': 'kc',
    'Las Vegas': 'lv',
    'LA Chargers': 'lac',
    'LA Rams': 'lar',
    'Miami': 'mia',
    'Minnesota': 'min',
    'New England': 'ne',
    'New Orleans': 'no',
    'NY Giants': 'nyg',
    'NY Jets': 'nyj',
    'Philadelphia': 'phi',
    'Pittsburgh': 'pit',
    'San Francisco': 'sf',
    'Seattle': 'sea',
    'Tampa Bay': 'tb',
    'Tennessee': 'ten',
    'Washington': 'wsh'
  }
};

function getTeamSlug(teamName, sport = 'NBA') {
  const sportMapping = TEAM_SLUGS[sport.toUpperCase()] || TEAM_SLUGS['NBA'];
  
  // Try exact match first
  if (sportMapping[teamName]) {
    return sportMapping[teamName];
  }
  
  // Try case-insensitive match
  const teamLower = teamName.toLowerCase();
  for (const [key, value] of Object.entries(sportMapping)) {
    if (key.toLowerCase() === teamLower) {
      return value;
    }
  }
  
  // Fallback: convert to slug manually
  return teamName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/los-angeles/g, 'lal')
    .replace(/new-york/g, 'ny')
    .replace(/golden-state/g, 'gs')
    .replace(/san-antonio/g, 'sa')
    .replace(/oklahoma-city/g, 'okc')
    .replace(/new-orleans/g, 'no');
}

module.exports = { getTeamSlug, TEAM_SLUGS };

