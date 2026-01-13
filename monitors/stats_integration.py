#!/usr/bin/env python3
"""
Stats Integration Module
- Fetches NBA stats from nba_api
- Scrapes teamrankings.com for team stats (NFL, NBA, college football, college basketball)
- Calculates game total and player point projections
- Provides justifications based on advanced stats
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re

# Configure urllib3 timeout for NBA API
try:
    import urllib3
    # Increase default timeout to 60 seconds
    urllib3.util.timeout.Timeout.DEFAULT_TIMEOUT = 60.0
except:
    pass

try:
    import requests
    from bs4 import BeautifulSoup
    REQUESTS_AVAILABLE = True
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    BEAUTIFULSOUP_AVAILABLE = False
    print("Warning: requests or beautifulsoup4 not available. Install with: pip install requests beautifulsoup4")

try:
    from nba_api.stats.endpoints import (
        teamgamelog, playergamelog, teamdashboardbygeneralsplits,
        playerdashboardbygeneralsplits, leaguedashteamstats, leaguedashplayerstats,
        commonplayerinfo, boxscoretraditionalv2
    )
    from nba_api.stats.static import teams, players
    from nba_api.live.nba.endpoints import scoreboard
    NBA_API_AVAILABLE = True
except ImportError:
    NBA_API_AVAILABLE = False
    print("Warning: nba_api not available. Install with: pip install nba_api")


class StatsIntegration:
    """Integrates NBA stats API and teamrankings.com data for projections"""
    
    # Cache for team stats to avoid repeated API calls
    _team_stats_cache = {}
    _player_stats_cache = {}
    _teamrankings_cache = {}
    _cache_expiry = 3600  # 1 hour cache
    
    def __init__(self):
        """Initialize stats integration"""
        self.nba_api_available = NBA_API_AVAILABLE
        self.scraping_available = REQUESTS_AVAILABLE and BEAUTIFULSOUP_AVAILABLE
        
        if not self.nba_api_available:
            print("⚠️  nba_api not available. NBA stats will be limited.")
        if not self.scraping_available:
            print("⚠️  Web scraping not available. TeamRankings data will be limited.")
    
    def get_nba_team_id(self, team_name: str) -> Optional[int]:
        """
        Get NBA team ID from team name
        
        Args:
            team_name: Team name (e.g., "Lakers", "Los Angeles Lakers")
            
        Returns:
            Team ID or None if not found
        """
        if not self.nba_api_available:
            return None
        
        try:
            # Try exact match first
            nba_teams = teams.get_teams()
            team_name_lower = team_name.lower()
            
            for team in nba_teams:
                if team_name_lower in team['full_name'].lower() or team_name_lower in team['nickname'].lower():
                    return team['id']
            
            # Try abbreviation match
            for team in nba_teams:
                if team_name_lower == team['abbreviation'].lower():
                    return team['id']
        except Exception as e:
            print(f"⚠️  Error getting NBA team ID for {team_name}: {e}")
        
        return None
    
    def get_nba_player_id(self, player_name: str) -> Optional[int]:
        """
        Get NBA player ID from player name
        
        Args:
            player_name: Player name (e.g., "LeBron James")
            
        Returns:
            Player ID or None if not found
        """
        if not self.nba_api_available:
            return None
        
        try:
            nba_players = players.get_players()
            player_name_lower = player_name.lower().strip()
            
            # Try exact match
            for player in nba_players:
                full_name = f"{player['first_name']} {player['last_name']}".lower()
                if player_name_lower == full_name:
                    return player['id']
            
            # Try partial match (last name)
            last_name = player_name_lower.split()[-1] if ' ' in player_name_lower else player_name_lower
            for player in nba_players:
                if player['last_name'].lower() == last_name:
                    return player['id']
        except Exception as e:
            print(f"⚠️  Error getting NBA player ID for {player_name}: {e}")
        
        return None
    
    def get_team_stats_nba(self, team_name: str, season: str = None) -> Optional[Dict]:
        """
        Get NBA team stats from nba_api with retry logic
        
        Args:
            team_name: Team name
            season: Season (e.g., "2023-24"), defaults to current season
            
        Returns:
            Dictionary with team stats or None
        """
        if not self.nba_api_available:
            return None
        
        # Check cache
        cache_key = f"{team_name}_{season}"
        if cache_key in self._team_stats_cache:
            cached_data, cached_time = self._team_stats_cache[cache_key]
            if time.time() - cached_time < self._cache_expiry:
                return cached_data
        
        # Retry logic for API calls
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                team_id = self.get_nba_team_id(team_name)
                if not team_id:
                    return None
                
                # Get current season if not specified
                if not season:
                    current_year = datetime.now().year
                    if datetime.now().month >= 10:  # NBA season starts in October
                        season = f"{current_year}-{str(current_year + 1)[-2:]}"
                    else:
                        season = f"{current_year - 1}-{str(current_year)[-2:]}"
                
                # Get base stats for PPG and other basic stats
                base_stats = leaguedashteamstats.LeagueDashTeamStats(season=season)
                base_df = base_stats.get_data_frames()[0]
                
                # Get advanced stats for defensive rating, pace, and offensive rating
                advanced_df = None
                try:
                    advanced_stats = leaguedashteamstats.LeagueDashTeamStats(
                        season=season,
                        measure_type_detailed_defense='Advanced'
                    )
                    advanced_df = advanced_stats.get_data_frames()[0]
                except Exception as e:
                    # Advanced stats not critical, continue without them
                    if attempt == max_retries - 1:  # Only log on last attempt
                        print(f"⚠️  Could not fetch advanced stats for {team_name}: {e}")
                    advanced_df = None
                
                if base_df.empty:
                    return None
                
                # Find the team in base stats
                base_team_row = base_df[base_df['TEAM_ID'] == team_id]
                if base_team_row.empty:
                    return None
                
                base_team_row = base_team_row.iloc[0]
                
                # Find the team in advanced stats if available
                advanced_team_row = None
                if advanced_df is not None and not advanced_df.empty:
                    advanced_team_row = advanced_df[advanced_df['TEAM_ID'] == team_id]
                    if not advanced_team_row.empty:
                        advanced_team_row = advanced_team_row.iloc[0]
                
                # Calculate PPG from total points and games played
                games_played = float(base_team_row['GP']) if 'GP' in base_team_row.index else 1.0
                total_points = float(base_team_row['PTS']) if 'PTS' in base_team_row.index else None
                ppg = total_points / games_played if total_points and games_played > 0 else None
                
                # Extract key stats
                stats = {
                    'team_id': team_id,
                    'team_name': team_name,
                    'season': season,
                    'ppg': ppg,
                    'opp_ppg': None,  # Will calculate from defensive rating
                    'pace': float(advanced_team_row['PACE']) if advanced_team_row is not None and 'PACE' in advanced_team_row.index else None,
                    'off_rating': float(advanced_team_row['OFF_RATING']) if advanced_team_row is not None and 'OFF_RATING' in advanced_team_row.index else None,
                    'def_rating': float(advanced_team_row['DEF_RATING']) if advanced_team_row is not None and 'DEF_RATING' in advanced_team_row.index else None,
                    'fg_pct': float(base_team_row['FG_PCT']) if 'FG_PCT' in base_team_row.index else None,
                    'three_pct': float(base_team_row['FG3_PCT']) if 'FG3_PCT' in base_team_row.index else None,
                    'ft_pct': float(base_team_row['FT_PCT']) if 'FT_PCT' in base_team_row.index else None,
                    'rebounds': float(base_team_row['REB']) if 'REB' in base_team_row.index else None,
                    'assists': float(base_team_row['AST']) if 'AST' in base_team_row.index else None,
                    'turnovers': float(base_team_row['TOV']) if 'TOV' in base_team_row.index else None,
                    'games_played': int(games_played) if games_played else 0,
                }
                
                # Calculate points allowed per game from defensive rating and pace
                # Defensive rating = points allowed per 100 possessions
                # Pace = possessions per game
                # Points allowed = (DEF_RATING / 100) * PACE
                if stats.get('def_rating') and stats.get('pace'):
                    stats['opp_ppg'] = (stats['def_rating'] / 100.0) * stats['pace']
                
                # Cache the result
                self._team_stats_cache[cache_key] = (stats, time.time())
                
                return stats
                
            except Exception as e:
                error_msg = str(e).lower()
                is_timeout = 'timeout' in error_msg or 'timed out' in error_msg
                
                if attempt < max_retries - 1:
                    # Retry with exponential backoff
                    wait_time = retry_delay * (2 ** attempt)
                    if is_timeout:
                        print(f"⚠️  Timeout fetching stats for {team_name} (attempt {attempt + 1}/{max_retries}). Retrying in {wait_time}s...")
                    else:
                        print(f"⚠️  Error fetching stats for {team_name} (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    # Last attempt failed
                    if is_timeout:
                        print(f"⚠️  Timeout getting NBA team stats for {team_name} after {max_retries} attempts. The NBA API may be slow or unavailable.")
                    else:
                        print(f"⚠️  Error getting NBA team stats for {team_name} after {max_retries} attempts: {e}")
                    return None
        
        return None
    
    def get_player_stats_nba(self, player_name: str, season: str = None) -> Optional[Dict]:
        """
        Get NBA player stats from nba_api with retry logic
        
        Args:
            player_name: Player name
            season: Season (e.g., "2023-24"), defaults to current season
            
        Returns:
            Dictionary with player stats or None
        """
        if not self.nba_api_available:
            return None
        
        # Check cache
        cache_key = f"{player_name}_{season}"
        if cache_key in self._player_stats_cache:
            cached_data, cached_time = self._player_stats_cache[cache_key]
            if time.time() - cached_time < self._cache_expiry:
                return cached_data
        
        # Retry logic for API calls
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                player_id = self.get_nba_player_id(player_name)
                if not player_id:
                    return None
                
                # Get current season if not specified
                if not season:
                    current_year = datetime.now().year
                    if datetime.now().month >= 10:
                        season = f"{current_year}-{str(current_year + 1)[-2:]}"
                    else:
                        season = f"{current_year - 1}-{str(current_year)[-2:]}"
                
                # Get player stats from game log (more reliable than dashboard)
                game_log = playergamelog.PlayerGameLog(
                    player_id=player_id,
                    season=season
                )
                game_log_df = game_log.get_data_frames()[0]
                if game_log_df.empty:
                    return None
                
                # Calculate averages from game log
                df = game_log_df
                
                # Extract key stats from game log (calculate averages)
                stats = {
                    'player_id': player_id,
                    'player_name': player_name,
                    'season': season,
                    'ppg': float(df['PTS'].mean()) if 'PTS' in df.columns else None,
                    'rpg': float(df['REB'].mean()) if 'REB' in df.columns else None,
                    'apg': float(df['AST'].mean()) if 'AST' in df.columns else None,
                    'fg_pct': float(df['FG_PCT'].mean()) if 'FG_PCT' in df.columns else None,
                    'three_pct': float(df['FG3_PCT'].mean()) if 'FG3_PCT' in df.columns else None,
                    'ft_pct': float(df['FT_PCT'].mean()) if 'FT_PCT' in df.columns else None,
                    'minutes': float(df['MIN'].mean()) if 'MIN' in df.columns else None,
                    'games_played': len(df) if not df.empty else 0,
                }
                
                # Get recent form (last 10 and last 5 games)
                if len(df) >= 5:
                    recent_games = df.head(10)
                    stats['recent_ppg'] = float(recent_games['PTS'].mean()) if 'PTS' in recent_games.columns else None
                    stats['last_5_ppg'] = float(recent_games.head(5)['PTS'].mean()) if 'PTS' in recent_games.columns else None
                
                # Try to get usage rate from player dashboard if available
                try:
                    player_dashboard = playerdashboardbygeneralsplits.PlayerDashboardByGeneralSplits(
                        player_id=player_id,
                        season=season
                    )
                    dashboard_df = player_dashboard.get_data_frames()[0]
                    if not dashboard_df.empty and 'USG_PCT' in dashboard_df.columns:
                        stats['usage_pct'] = float(dashboard_df['USG_PCT'].iloc[0])
                except:
                    # Usage rate not critical, continue without it
                    stats['usage_pct'] = None
                
                # Cache the result
                self._player_stats_cache[cache_key] = (stats, time.time())
                
                return stats
                
            except Exception as e:
                error_msg = str(e).lower()
                is_timeout = 'timeout' in error_msg or 'timed out' in error_msg
                
                if attempt < max_retries - 1:
                    # Retry with exponential backoff
                    wait_time = retry_delay * (2 ** attempt)
                    if is_timeout:
                        print(f"⚠️  Timeout fetching player stats for {player_name} (attempt {attempt + 1}/{max_retries}). Retrying in {wait_time}s...")
                    else:
                        print(f"⚠️  Error fetching player stats for {player_name} (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    # Last attempt failed
                    if is_timeout:
                        print(f"⚠️  Timeout getting NBA player stats for {player_name} after {max_retries} attempts. The NBA API may be slow or unavailable.")
                    else:
                        print(f"⚠️  Error getting NBA player stats for {player_name} after {max_retries} attempts: {e}")
                    return None
        
        return None
    
    def scrape_teamrankings(self, sport: str, team_name: str) -> Optional[Dict]:
        """
        Scrape team stats from teamrankings.com
        
        Args:
            sport: Sport ('nfl', 'nba', 'ncaaf', 'ncaab')
            team_name: Team name
            
        Returns:
            Dictionary with team stats or None
        """
        if not self.scraping_available:
            return None
        
        # Check cache
        cache_key = f"{sport}_{team_name}"
        if cache_key in self._teamrankings_cache:
            cached_data, cached_time = self._teamrankings_cache[cache_key]
            if time.time() - cached_time < self._cache_expiry:
                return cached_data
        
        try:
            # Map sport to teamrankings URL path
            sport_paths = {
                'nfl': 'nfl',
                'nba': 'nba',
                'ncaaf': 'college-football',
                'ncaab': 'college-basketball'
            }
            
            sport_path = sport_paths.get(sport.lower())
            if not sport_path:
                return None
            
            # Construct URL - teamrankings uses team name in URL
            # Format: https://www.teamrankings.com/nba/team/{team-name}/stats
            team_slug = team_name.lower().replace(' ', '-').replace('.', '')
            url = f"https://www.teamrankings.com/{sport_path}/team/{team_slug}/stats"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract key stats from the page
            stats = {
                'team_name': team_name,
                'sport': sport,
                'ppg': None,
                'opp_ppg': None,
                'pace': None,
                'off_rating': None,
                'def_rating': None,
            }
            
            # Try to find stats tables
            # TeamRankings structure varies, so we'll look for common patterns
            stat_tables = soup.find_all('table', class_=re.compile(r'stats|data'))
            
            for table in stat_tables:
                rows = table.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        label = cells[0].get_text(strip=True).lower()
                        value = cells[1].get_text(strip=True)
                        
                        # Match common stat labels
                        if 'points per game' in label or 'ppg' in label:
                            try:
                                stats['ppg'] = float(value)
                            except:
                                pass
                        elif 'opponent points' in label or 'opp ppg' in label or 'points allowed' in label:
                            try:
                                stats['opp_ppg'] = float(value)
                            except:
                                pass
                        elif 'pace' in label:
                            try:
                                stats['pace'] = float(value)
                            except:
                                pass
                        elif 'offensive rating' in label or 'off rating' in label:
                            try:
                                stats['off_rating'] = float(value)
                            except:
                                pass
                        elif 'defensive rating' in label or 'def rating' in label:
                            try:
                                stats['def_rating'] = float(value)
                            except:
                                pass
            
            # Cache the result
            self._teamrankings_cache[cache_key] = (stats, time.time())
            
            return stats
            
        except Exception as e:
            print(f"⚠️  Error scraping TeamRankings for {sport} {team_name}: {e}")
            return None
    
    def project_game_total(self, home_team: str, away_team: str, sport: str = 'nba') -> Dict:
        """
        Project game total using team stats
        
        Args:
            home_team: Home team name
            away_team: Away team name
            sport: Sport ('nba', 'nfl', 'ncaaf', 'ncaab')
            
        Returns:
            Dictionary with projection and justification
        """
        projection = {
            'projected_total': None,
            'justification': [],
            'home_team_stats': None,
            'away_team_stats': None,
            'confidence': 'medium'
        }
        
        # Get team stats
        if sport.lower() == 'nba':
            home_stats = self.get_team_stats_nba(home_team)
            away_stats = self.get_team_stats_nba(away_team)
        else:
            home_stats = self.scrape_teamrankings(sport, home_team)
            away_stats = self.scrape_teamrankings(sport, away_team)
        
        if not home_stats or not away_stats:
            projection['justification'].append("⚠️  Unable to fetch team stats for projection")
            return projection
        
        projection['home_team_stats'] = home_stats
        projection['away_team_stats'] = away_stats
        
        # Calculate projection based on available stats
        home_ppg = home_stats.get('ppg')
        away_ppg = away_stats.get('ppg')
        home_opp_ppg = home_stats.get('opp_ppg')  # Points home team allows
        away_opp_ppg = away_stats.get('opp_ppg')  # Points away team allows
        
        # Get defensive ratings for analysis
        home_def_rating = home_stats.get('def_rating')
        away_def_rating = away_stats.get('def_rating')
        home_off_rating = home_stats.get('off_rating')
        away_off_rating = away_stats.get('off_rating')
        
        if home_ppg and away_ppg:
            # Projected total = (Home PPG + Away PPG allowed) + (Away PPG + Home PPG allowed) / 2
            # This accounts for each team's offense vs the opponent's defense
            if home_opp_ppg and away_opp_ppg:
                # Use actual points allowed
                home_projected = home_ppg + away_opp_ppg  # Home offense vs away defense
                away_projected = away_ppg + home_opp_ppg  # Away offense vs home defense
                projected_total = (home_projected + away_projected) / 2
            else:
                # Fallback: simple average if points allowed not available
                projected_total = home_ppg + away_ppg
            
            # Adjust for pace if available (NBA)
            pace_adjustment = 1.0
            if sport.lower() == 'nba':
                home_pace = home_stats.get('pace')
                away_pace = away_stats.get('pace')
                if home_pace and away_pace:
                    avg_pace = (home_pace + away_pace) / 2
                    # League average pace is ~100, adjust if significantly different
                    if avg_pace > 102:
                        pace_adjustment = 1.02  # Fast pace = more points
                        projection['justification'].append(f"Fast pace matchup (avg: {avg_pace:.1f})")
                    elif avg_pace < 98:
                        pace_adjustment = 0.98  # Slow pace = fewer points
                        projection['justification'].append(f"Slow pace matchup (avg: {avg_pace:.1f})")
                    else:
                        projection['justification'].append(f"Average pace (avg: {avg_pace:.1f})")
            
            # Adjust based on defensive matchups (similar to player props)
            def_adjustment = 1.0
            def_analysis = []
            
            if sport.lower() == 'nba' and home_def_rating and away_def_rating:
                league_avg_def_rating = 110.0
                league_avg_off_rating = 110.0
                
                # Analyze home team defense vs away team offense
                # Lower defensive rating = better defense
                # Higher offensive rating = better offense
                if away_off_rating and home_def_rating:
                    # If home defense is strong (low DRtg) and away offense is weak (low ORtg), reduce total
                    # If home defense is weak (high DRtg) and away offense is strong (high ORtg), increase total
                    home_def_strength = league_avg_def_rating - home_def_rating  # Positive = strong defense
                    away_off_strength = away_off_rating - league_avg_off_rating  # Positive = strong offense
                    
                    matchup_diff = home_def_strength + away_off_strength  # Net defensive advantage
                    if matchup_diff < -3:  # Weak defense vs strong offense
                        def_adjustment *= 1.01
                        def_analysis.append(f"{home_team} weak defense (DRtg: {home_def_rating:.1f}) vulnerable to {away_team} strong offense (ORtg: {away_off_rating:.1f})")
                    elif matchup_diff > 3:  # Strong defense vs weak offense
                        def_adjustment *= 0.99
                        def_analysis.append(f"{home_team} strong defense (DRtg: {home_def_rating:.1f}) limiting {away_team} offense (ORtg: {away_off_rating:.1f})")
                
                # Analyze away team defense vs home team offense
                if home_off_rating and away_def_rating:
                    away_def_strength = league_avg_def_rating - away_def_rating  # Positive = strong defense
                    home_off_strength = home_off_rating - league_avg_off_rating  # Positive = strong offense
                    
                    matchup_diff = away_def_strength + home_off_strength  # Net defensive advantage
                    if matchup_diff < -3:  # Weak defense vs strong offense
                        def_adjustment *= 1.01
                        def_analysis.append(f"{away_team} weak defense (DRtg: {away_def_rating:.1f}) vulnerable to {home_team} strong offense (ORtg: {home_off_rating:.1f})")
                    elif matchup_diff > 3:  # Strong defense vs weak offense
                        def_adjustment *= 0.99
                        def_analysis.append(f"{away_team} strong defense (DRtg: {away_def_rating:.1f}) limiting {home_team} offense (ORtg: {home_off_rating:.1f})")
            
            # Factor in injuries for NBA games
            injury_adjustment = 0.0
            injury_notes = []
            
            if sport.lower() == 'nba':
                # Get injuries for both teams
                home_injuries = self.get_team_injuries_nba(home_team)
                away_injuries = self.get_team_injuries_nba(away_team)
                
                # Get starting lineups to check if starters are injured
                home_starters = self.get_starting_lineup_nba(home_team)
                away_starters = self.get_starting_lineup_nba(away_team)
                
                # Create sets of starter names for quick lookup
                home_starter_names = {s['player_name'].lower() for s in home_starters}
                away_starter_names = {s['player_name'].lower() for s in away_starters}
                
                # Check home team injuries
                home_injured_starters = []
                for injury in home_injuries:
                    player_name = injury['player_name']
                    status = injury['status']
                    injury_desc = injury.get('injury', '')
                    
                    # Only count Out or Doubtful starters as significant
                    if status in ['Out', 'Doubtful']:
                        # Check if this player is a starter
                        is_starter = any(player_name.lower() in starter_name or starter_name in player_name.lower() 
                                       for starter_name in home_starter_names)
                        
                        if is_starter:
                            home_injured_starters.append({
                                'player': player_name,
                                'status': status,
                                'injury': injury_desc,
                                'ppg': next((s['ppg'] for s in home_starters if player_name.lower() in s['player_name'].lower() or s['player_name'].lower() in player_name.lower()), 0)
                            })
                
                # Check away team injuries
                away_injured_starters = []
                for injury in away_injuries:
                    player_name = injury['player_name']
                    status = injury['status']
                    injury_desc = injury.get('injury', '')
                    
                    # Only count Out or Doubtful starters as significant
                    if status in ['Out', 'Doubtful']:
                        # Check if this player is a starter
                        is_starter = any(player_name.lower() in starter_name or starter_name in player_name.lower() 
                                       for starter_name in away_starter_names)
                        
                        if is_starter:
                            away_injured_starters.append({
                                'player': player_name,
                                'status': status,
                                'injury': injury_desc,
                                'ppg': next((s['ppg'] for s in away_starters if player_name.lower() in s['player_name'].lower() or s['player_name'].lower() in player_name.lower()), 0)
                            })
                
                # Calculate injury adjustment
                # Each injured starter reduces total by 2-4 points based on their PPG
                for injured in home_injured_starters:
                    # More impactful players (higher PPG) have bigger impact
                    ppg = injured['ppg']
                    if ppg >= 20:
                        adjustment = -4.0  # Star player out
                    elif ppg >= 15:
                        adjustment = -3.0  # Key starter out
                    elif ppg >= 10:
                        adjustment = -2.0  # Regular starter out
                    else:
                        adjustment = -1.5  # Bench/role player
                    
                    injury_adjustment += adjustment
                    injury_notes.append(f"{home_team}: {injured['player']} {injured['status']} ({injured['injury']}) - {abs(adjustment):.1f} pts")
                
                for injured in away_injured_starters:
                    # More impactful players (higher PPG) have bigger impact
                    ppg = injured['ppg']
                    if ppg >= 20:
                        adjustment = -4.0  # Star player out
                    elif ppg >= 15:
                        adjustment = -3.0  # Key starter out
                    elif ppg >= 10:
                        adjustment = -2.0  # Regular starter out
                    else:
                        adjustment = -1.5  # Bench/role player
                    
                    injury_adjustment += adjustment
                    injury_notes.append(f"{away_team}: {injured['player']} {injured['status']} ({injured['injury']}) - {abs(adjustment):.1f} pts")
            
            # Apply all adjustments
            projected_total = projected_total * pace_adjustment * def_adjustment + injury_adjustment
            projection['projected_total'] = round(projected_total, 1)
            
            # Build justification with defensive metrics
            projection['justification'].append(f"{home_team} averages {home_ppg:.1f} PPG")
            projection['justification'].append(f"{away_team} averages {away_ppg:.1f} PPG")
            
            if home_opp_ppg:
                projection['justification'].append(f"{home_team} allows {home_opp_ppg:.1f} PPG")
            if away_opp_ppg:
                projection['justification'].append(f"{away_team} allows {away_opp_ppg:.1f} PPG")
            
            # Add defensive ratings to justification
            if home_def_rating:
                projection['justification'].append(f"{home_team} defensive rating: {home_def_rating:.1f}")
            if away_def_rating:
                projection['justification'].append(f"{away_team} defensive rating: {away_def_rating:.1f}")
            
            # Add matchup analysis (more detailed than summary)
            for analysis in def_analysis:
                projection['justification'].append(analysis)
            
            # Add injury information
            if injury_notes:
                projection['justification'].append("⚠️ Injuries affecting projection:")
                for note in injury_notes:
                    projection['justification'].append(f"  • {note}")
                if injury_adjustment < 0:
                    projection['justification'].append(f"  Total adjusted by {injury_adjustment:.1f} points due to injuries")
            
            # Confidence assessment
            if home_stats.get('games_played', 0) > 20 and away_stats.get('games_played', 0) > 20:
                projection['confidence'] = 'high'
            elif home_stats.get('games_played', 0) > 10 and away_stats.get('games_played', 0) > 10:
                projection['confidence'] = 'medium'
            else:
                projection['confidence'] = 'low'
        
        return projection
    
    def get_team_injuries_nba(self, team_name: str) -> List[Dict]:
        """
        Get injury reports for an NBA team by scraping ESPN
        
        Args:
            team_name: Team name (e.g., "Lakers", "Los Angeles Lakers")
            
        Returns:
            List of dictionaries with injury information:
            [{'player_name': str, 'status': str, 'injury': str, 'position': str}]
            Status can be: 'Out', 'Doubtful', 'Questionable', 'Probable', 'Available'
        """
        if not self.scraping_available:
            return []
        
        injuries = []
        
        try:
            # Map team names to ESPN team abbreviations/IDs
            team_abbrev_map = {
                'atlanta hawks': 'atl', 'boston celtics': 'bos', 'brooklyn nets': 'bkn',
                'charlotte hornets': 'cha', 'chicago bulls': 'chi', 'cleveland cavaliers': 'cle',
                'dallas mavericks': 'dal', 'denver nuggets': 'den', 'detroit pistons': 'det',
                'golden state warriors': 'gs', 'houston rockets': 'hou', 'indiana pacers': 'ind',
                'los angeles clippers': 'lac', 'los angeles lakers': 'lal', 'memphis grizzlies': 'mem',
                'miami heat': 'mia', 'milwaukee bucks': 'mil', 'minnesota timberwolves': 'min',
                'new orleans pelicans': 'no', 'new york knicks': 'ny', 'oklahoma city thunder': 'okc',
                'orlando magic': 'orl', 'philadelphia 76ers': 'phi', 'phoenix suns': 'phx',
                'portland trail blazers': 'por', 'sacramento kings': 'sac', 'san antonio spurs': 'sa',
                'toronto raptors': 'tor', 'utah jazz': 'utah', 'washington wizards': 'wsh'
            }
            
            team_name_lower = team_name.lower()
            team_abbrev = None
            
            # Find team abbreviation
            for key, abbrev in team_abbrev_map.items():
                if key in team_name_lower or team_name_lower in key:
                    team_abbrev = abbrev
                    break
            
            if not team_abbrev:
                return []
            
            # ESPN injury report URL
            url = f"https://www.espn.com/nba/team/injuries/_/name/{team_abbrev}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find injury table
            injury_table = soup.find('table', class_=re.compile(r'injury|player', re.I))
            if not injury_table:
                # Try alternative selectors
                injury_table = soup.find('div', class_=re.compile(r'injury', re.I))
            
            if injury_table:
                rows = injury_table.find_all('tr')[1:] if injury_table.name == 'table' else injury_table.find_all('div', class_=re.compile(r'row|player', re.I))
                
                for row in rows:
                    try:
                        cells = row.find_all(['td', 'div'])
                        if len(cells) >= 3:
                            player_name = cells[0].get_text(strip=True)
                            status = cells[1].get_text(strip=True)
                            injury = cells[2].get_text(strip=True) if len(cells) > 2 else ''
                            
                            # Normalize status
                            status_lower = status.lower()
                            if 'out' in status_lower:
                                normalized_status = 'Out'
                            elif 'doubtful' in status_lower:
                                normalized_status = 'Doubtful'
                            elif 'questionable' in status_lower:
                                normalized_status = 'Questionable'
                            elif 'probable' in status_lower:
                                normalized_status = 'Probable'
                            else:
                                normalized_status = 'Available'
                            
                            injuries.append({
                                'player_name': player_name,
                                'status': normalized_status,
                                'injury': injury,
                                'position': ''  # ESPN doesn't always show position in injury table
                            })
                    except Exception as e:
                        continue
        except Exception as e:
            # Silently fail - injuries are optional
            pass
        
        return injuries
    
    def get_starting_lineup_nba(self, team_name: str, game_date: str = None) -> List[Dict]:
        """
        Get typical starting lineup for an NBA team
        Uses recent game data to determine most common starters
        
        Args:
            team_name: Team name
            game_date: Game date (YYYY-MM-DD format), defaults to today
            
        Returns:
            List of dictionaries with player info:
            [{'player_name': str, 'position': str, 'ppg': float}]
        """
        if not self.nba_api_available:
            return []
        
        starters = []
        
        try:
            team_id = self.get_nba_team_id(team_name)
            if not team_id:
                return []
            
            # Get current season
            current_year = datetime.now().year
            if datetime.now().month >= 10:
                season = f"{current_year}-{str(current_year + 1)[-2:]}"
            else:
                season = f"{current_year - 1}-{str(current_year)[-2:]}"
            
            # Get team game log to find recent games
            team_games = teamgamelog.TeamGameLog(team_id=team_id, season=season)
            games_df = team_games.get_data_frames()[0]
            
            if games_df.empty:
                return []
            
            # Get last 10 games to determine typical starters
            recent_games = games_df.head(10)
            game_ids = recent_games['Game_ID'].tolist()
            
            # Get player stats for recent games to find most common starters
            # We'll use a simplified approach: get top 5 players by minutes in recent games
            player_minutes = {}
            
            for game_id in game_ids[:5]:  # Check last 5 games
                try:
                    boxscore = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
                    player_stats = boxscore.get_data_frames()[0]
                    
                    # Filter for this team
                    team_players = player_stats[player_stats['TEAM_ID'] == team_id]
                    
                    # Get top 5 by minutes played
                    top_players = team_players.nlargest(5, 'MIN')
                    
                    for _, player in top_players.iterrows():
                        player_id = player['PLAYER_ID']
                        player_name = player['PLAYER_NAME']
                        minutes = player['MIN']
                        
                        if player_id not in player_minutes:
                            player_minutes[player_id] = {
                                'name': player_name,
                                'total_minutes': 0,
                                'games': 0,
                                'ppg': 0,
                                'total_points': 0
                            }
                        
                        player_minutes[player_id]['total_minutes'] += minutes
                        player_minutes[player_id]['games'] += 1
                        player_minutes[player_id]['total_points'] += player.get('PTS', 0)
                except Exception:
                    continue
            
            # Get top 5 players by average minutes (typical starters)
            sorted_players = sorted(player_minutes.items(), 
                                  key=lambda x: x[1]['total_minutes'] / max(x[1]['games'], 1), 
                                  reverse=True)[:5]
            
            for player_id, player_data in sorted_players:
                avg_ppg = player_data['total_points'] / max(player_data['games'], 1)
                starters.append({
                    'player_name': player_data['name'],
                    'position': '',  # Would need additional API call to get position
                    'ppg': avg_ppg
                })
        except Exception as e:
            # Silently fail - starting lineup is optional
            pass
        
        return starters
    
    def get_player_team(self, player_name: str) -> Optional[str]:
        """
        Get the current team for a player
        
        Args:
            player_name: Player name
            
        Returns:
            Team name or None if not found
        """
        if not self.nba_api_available:
            return None
        
        try:
            player_id = self.get_nba_player_id(player_name)
            if not player_id:
                return None
            
            player_info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
            df = player_info.get_data_frames()[0]
            
            if not df.empty and 'TEAM_ABBREVIATION' in df.columns:
                team_abbr = df['TEAM_ABBREVIATION'].iloc[0]
                # Convert abbreviation to full team name
                nba_teams = teams.get_teams()
                for team in nba_teams:
                    if team['abbreviation'] == team_abbr:
                        return team['full_name']
        except Exception as e:
            # Silently fail - team lookup is optional
            pass
        
        return None
    
    def project_player_points(self, player_name: str, home_team: str = None, away_team: str = None, 
                             opponent_team: str = None, sport: str = 'nba') -> Dict:
        """
        Project player points using advanced stats with opponent defensive analysis
        
        Args:
            player_name: Player name
            home_team: Home team name (optional)
            away_team: Away team name (optional)
            opponent_team: Opponent team name (optional, will be determined if not provided)
            sport: Sport (currently only 'nba' supported)
            
        Returns:
            Dictionary with projection and justification
        """
        projection = {
            'projected_points': None,
            'justification': [],
            'player_stats': None,
            'opponent_stats': None,
            'confidence': 'medium'
        }
        
        if sport.lower() != 'nba':
            projection['justification'].append("⚠️  Player projections currently only supported for NBA")
            return projection
        
        # Get player stats
        player_stats = self.get_player_stats_nba(player_name)
        if not player_stats:
            projection['justification'].append(f"⚠️  Unable to fetch stats for {player_name}")
            return projection
        
        projection['player_stats'] = player_stats
        
        # Base projection: season average PPG
        base_projection = player_stats.get('ppg', 0)
        
        # Adjust for recent form (last 5 games)
        if player_stats.get('last_5_ppg'):
            recent_ppg = player_stats['last_5_ppg']
            # Weight: 70% season average, 30% recent form
            base_projection = (base_projection * 0.7) + (recent_ppg * 0.3)
            projection['justification'].append(f"Season average: {player_stats['ppg']:.1f} PPG")
            projection['justification'].append(f"Last 5 games: {recent_ppg:.1f} PPG")
        
        # Determine opponent team if not provided
        if not opponent_team and (home_team or away_team):
            # Try to get player's current team
            player_team = self.get_player_team(player_name)
            if player_team:
                # Determine opponent based on which team the player is on
                if home_team and player_team.lower() in home_team.lower():
                    opponent_team = away_team
                elif away_team and player_team.lower() in away_team.lower():
                    opponent_team = home_team
                else:
                    # Can't determine, use away team as default
                    opponent_team = away_team or home_team
            else:
                # Can't determine player team, use away team as default
                opponent_team = away_team or home_team
        
        # Adjust for opponent defense using comprehensive defensive stats
        if opponent_team:
            opponent_stats = self.get_team_stats_nba(opponent_team)
            if opponent_stats:
                projection['opponent_stats'] = opponent_stats
                
                # Get multiple defensive metrics
                opp_def_rating = opponent_stats.get('def_rating')
                opp_ppg_allowed = opponent_stats.get('opp_ppg')  # Points allowed per game
                
                # Calculate adjustment based on defensive rating
                # League average defensive rating is ~110
                # Lower = better defense, higher = worse defense
                def_adjustment = 1.0
                def_reason = []
                
                if opp_def_rating:
                    # More granular adjustment based on how far from league average
                    league_avg_def_rating = 110.0
                    rating_diff = opp_def_rating - league_avg_def_rating
                    
                    # Adjust by percentage: every 2 points above/below average = 1% adjustment
                    # Strong defense (DRtg < 108): reduce by 1-3%
                    # Average defense (108-112): minimal adjustment
                    # Weak defense (DRtg > 112): increase by 1-3%
                    if rating_diff < -2:  # Very strong defense (DRtg < 108)
                        def_adjustment = 0.97  # Reduce by 3%
                        def_reason.append(f"{opponent_team} has elite defense (DRtg: {opp_def_rating:.1f}, league avg: {league_avg_def_rating:.1f})")
                    elif rating_diff < 0:  # Strong defense (108-110)
                        def_adjustment = 0.98  # Reduce by 2%
                        def_reason.append(f"{opponent_team} has strong defense (DRtg: {opp_def_rating:.1f})")
                    elif rating_diff > 2:  # Very weak defense (DRtg > 112)
                        def_adjustment = 1.03  # Increase by 3%
                        def_reason.append(f"{opponent_team} has weak defense (DRtg: {opp_def_rating:.1f}, league avg: {league_avg_def_rating:.1f})")
                    elif rating_diff > 0:  # Weak defense (110-112)
                        def_adjustment = 1.02  # Increase by 2%
                        def_reason.append(f"{opponent_team} has below-average defense (DRtg: {opp_def_rating:.1f})")
                    else:
                        def_reason.append(f"{opponent_team} has average defense (DRtg: {opp_def_rating:.1f})")
                
                # Also consider points allowed per game
                if opp_ppg_allowed:
                    # League average is ~110 PPG allowed
                    league_avg_ppg_allowed = 110.0
                    ppg_diff = opp_ppg_allowed - league_avg_ppg_allowed
                    
                    if ppg_diff < -3:  # Allows 3+ fewer points than average
                        def_adjustment *= 0.99  # Additional 1% reduction
                        def_reason.append(f"Allows {opp_ppg_allowed:.1f} PPG (league avg: {league_avg_ppg_allowed:.1f})")
                    elif ppg_diff > 3:  # Allows 3+ more points than average
                        def_adjustment *= 1.01  # Additional 1% increase
                        def_reason.append(f"Allows {opp_ppg_allowed:.1f} PPG (league avg: {league_avg_ppg_allowed:.1f})")
                
                # Apply defensive adjustment
                base_projection *= def_adjustment
                
                # Add all defensive reasons to justification
                for reason in def_reason:
                    projection['justification'].append(reason)
        
        # Adjust for usage rate
        usage_pct = player_stats.get('usage_pct')
        if usage_pct:
            if usage_pct > 0.28:
                # High usage player, slight boost
                base_projection *= 1.02
                projection['justification'].append(f"High usage rate: {usage_pct*100:.1f}%")
            elif usage_pct < 0.20:
                # Low usage player, slight reduction
                base_projection *= 0.98
                projection['justification'].append(f"Low usage rate: {usage_pct*100:.1f}%")
        
        projection['projected_points'] = round(base_projection, 1)
        
        # Confidence assessment
        games_played = player_stats.get('games_played', 0)
        if games_played > 20:
            projection['confidence'] = 'high'
        elif games_played > 10:
            projection['confidence'] = 'medium'
        else:
            projection['confidence'] = 'low'
        
        return projection

