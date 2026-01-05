#!/usr/bin/env python3
"""
Line History Search Tool
Search for betting line history for specific teams across all sports
Also supports NBA player props search
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Optional
import argparse

# File paths - updated to use monitor-data folder
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_data_dir = os.path.join(_base_dir, "monitor-data")

ORIGINAL_LINES_FILE = os.path.join(_data_dir, "original_lines.json")
LINE_MOVEMENTS_FILE = os.path.join(_data_dir, "line_movements.json")
# NBA player props are now in the consolidated files
# Use the same files as betting monitor
NBA_PLAYER_PROPS_FILE = ORIGINAL_LINES_FILE  # Same file, different section
NBA_PLAYER_MOVEMENTS_FILE = LINE_MOVEMENTS_FILE  # Same file, different section

# Sport categories mapping
SPORT_CATEGORIES = {
    'basketball_nba': 'NBA',
    'americanfootball_nfl': 'NFL',
    'basketball_ncaab': 'NCAA Basketball',
    'americanfootball_ncaaf': 'NCAA Football'
}


class LineHistorySearcher:
    """Search tool for betting line history and NBA player props"""
    
    def __init__(self):
        self.original_lines = self.load_file(ORIGINAL_LINES_FILE, {})
        self.line_movements = self.load_file(LINE_MOVEMENTS_FILE, {})
        self.nba_player_props = self.load_file(NBA_PLAYER_PROPS_FILE, {})
        self.nba_player_movements = self.load_file(NBA_PLAYER_MOVEMENTS_FILE, {})
    
    def load_file(self, filename: str, default: Dict) -> Dict:
        """Load JSON file"""
        if os.path.exists(filename):
            try:
                with open(filename, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading {filename}: {e}")
        return default
    
    def search_by_team(self, team_name: str, sport: Optional[str] = None) -> Dict:
        """
        Search for all line history for a specific team
        
        Args:
            team_name: Team name to search for (case-insensitive)
            sport: Optional sport category to filter by
            
        Returns:
            Dictionary with search results
        """
        team_name_lower = team_name.lower()
        results = {
            'team': team_name,
            'sport': sport,
            'original_lines': [],
            'movements': [],
            'current_lines': []
        }
        
        # Search original lines (games section)
        if 'games' in self.original_lines:
            for game_id, game_data in self.original_lines['games'].items():
                home_team = game_data.get('home_team', '').lower()
                away_team = game_data.get('away_team', '').lower()
                
                # Check if team matches
                if team_name_lower in home_team or team_name_lower in away_team:
                    # Check sport filter if provided
                    if sport:
                        # Try to determine sport from game data if available
                        pass  # Sport info might not be in original_lines
                    
                    results['original_lines'].append({
                        'game_id': game_id,
                        'home_team': game_data.get('home_team'),
                        'away_team': game_data.get('away_team'),
                        'game_time': game_data.get('game_time'),
                        'first_seen': game_data.get('first_seen_readable'),
                        'spreads': game_data.get('spreads', {}),
                        'totals': game_data.get('totals', {})
                    })
        
        # Search line movements (game_movements section)
        if 'game_movements' in self.line_movements:
            for movement in self.line_movements['game_movements']:
                home_team = movement.get('home_team', '').lower()
                away_team = movement.get('away_team', '').lower()
                
                if team_name_lower in home_team or team_name_lower in away_team:
                    results['movements'].append(movement)
        
        # Search current lines from original_lines.json (now contains current values)
        if 'games' in self.original_lines:
            for game_id, game_data in self.original_lines['games'].items():
                home_team = game_data.get('home_team', '').lower()
                away_team = game_data.get('away_team', '').lower()
                
                if team_name_lower in home_team or team_name_lower in away_team:
                    current_lines_entry = {
                        'game_id': game_id,
                        'home_team': game_data.get('home_team'),
                        'away_team': game_data.get('away_team'),
                        'spreads': game_data.get('spreads', {}),
                        'totals': game_data.get('totals', {})
                    }
                    
                    results['current_lines'].append(current_lines_entry)
        
        return results
    
    def search_player_props(self, player_name: Optional[str] = None, 
                           game_matchup: Optional[str] = None,
                           min_line: Optional[float] = None,
                           max_line: Optional[float] = None,
                           bookmaker: Optional[str] = None) -> Dict:
        """
        Search for NBA player props
        
        Args:
            player_name: Player name to search for (case-insensitive, partial match)
            game_matchup: Game matchup to filter by (e.g., "Lakers @ Warriors")
            min_line: Minimum point line value
            max_line: Maximum point line value
            bookmaker: Bookmaker to filter by
            
        Returns:
            Dictionary with player props search results
        """
        results = {
            'player_name': player_name,
            'game_matchup': game_matchup,
            'props': [],
            'movements': []
        }
        
        player_name_lower = player_name.lower() if player_name else None
        game_matchup_lower = game_matchup.lower() if game_matchup else None
        bookmaker_lower = bookmaker.lower() if bookmaker else None
        
        # Search player props
        if 'player_props' in self.nba_player_props:
            for prop_id, prop_data in self.nba_player_props['player_props'].items():
                # Filter by player name
                if player_name_lower:
                    prop_player = prop_data.get('player_name', '').lower()
                    if player_name_lower not in prop_player:
                        continue
                
                # Filter by game matchup
                if game_matchup_lower:
                    prop_matchup = prop_data.get('game_matchup', '').lower()
                    if game_matchup_lower not in prop_matchup:
                        continue
                
                # Filter by line range
                line_value = prop_data.get('original_line')
                if line_value is not None:
                    if min_line is not None and line_value < min_line:
                        continue
                    if max_line is not None and line_value > max_line:
                        continue
                
                # Filter by bookmaker
                if bookmaker_lower:
                    bookmakers = prop_data.get('bookmakers', [])
                    has_bookmaker = any(
                        bookmaker_lower in b.get('bookmaker', '').lower() or 
                        bookmaker_lower in b.get('bookmaker_name', '').lower()
                        for b in bookmakers
                    )
                    if not has_bookmaker:
                        continue
                
                results['props'].append(prop_data)
        
        # Search player prop movements
        if 'player_prop_movements' in self.nba_player_movements:
            for movement in self.nba_player_movements['player_prop_movements']:
                # Filter by player name
                if player_name_lower:
                    move_player = movement.get('player_name', '').lower()
                    if player_name_lower not in move_player:
                        continue
                
                # Filter by game matchup
                if game_matchup_lower:
                    move_matchup = movement.get('game_matchup', '').lower()
                    if game_matchup_lower not in move_matchup:
                        continue
                
                # Filter by bookmaker
                if bookmaker_lower:
                    bookmakers = movement.get('bookmakers', [])
                    has_bookmaker = any(
                        bookmaker_lower in b.get('bookmaker', '').lower() or 
                        bookmaker_lower in b.get('bookmaker_name', '').lower()
                        for b in bookmakers
                    )
                    if not has_bookmaker:
                        continue
                
                results['movements'].append(movement)
        
        return results
    
    def search_by_sport(self, sport: str) -> Dict:
        """
        Search for all games in a specific sport category
        
        Args:
            sport: Sport category (e.g., 'NBA', 'NFL', 'NCAA Basketball', 'NCAA Football')
            
        Returns:
            Dictionary with all games in that sport
        """
        results = {
            'sport': sport,
            'games': []
        }
        
        # Map sport name to sport key
        sport_key_map = {
            'nba': 'basketball_nba',
            'nfl': 'americanfootball_nfl',
            'ncaa basketball': 'basketball_ncaab',
            'ncaa football': 'americanfootball_ncaaf',
            'college basketball': 'basketball_ncaab',
            'college football': 'americanfootball_ncaaf'
        }
        sport_key = sport_key_map.get(sport.lower(), sport.lower().replace(' ', '_'))
        sport_lower = sport.lower()
        
        # Search in original_lines.json (now contains all game data)
        if 'games' in self.original_lines:
            for game_id, game_data in self.original_lines['games'].items():
                # Check if sport matches
                game_sport = game_data.get('sport', '').lower()
                game_sport_display = game_data.get('sport_display', '').lower()
                if sport_lower not in game_sport and sport_lower not in game_sport_display and sport_key not in game_sport:
                    continue
                
                game_entry = {
                    'game_id': game_id,
                    'home_team': game_data.get('home_team'),
                    'away_team': game_data.get('away_team'),
                    'sport': game_data.get('sport'),
                    'sport_display': game_data.get('sport_display'),
                    'spreads': game_data.get('spreads', {}),
                    'totals': game_data.get('totals', {}),
                    'first_seen': game_data.get('first_seen'),
                    'game_time': game_data.get('game_time')
                }
                results['games'].append(game_entry)
        
        return results
    
    def search_by_game(self, home_team: str, away_team: str) -> Dict:
        """
        Search for a specific game between two teams
        
        Args:
            home_team: Home team name
            away_team: Away team name
            
        Returns:
            Dictionary with game information
        """
        home_lower = home_team.lower()
        away_lower = away_team.lower()
        
        results = {
            'home_team': home_team,
            'away_team': away_team,
            'original_lines': None,
            'movements': [],
            'current_lines': None
        }
        
        # Search for matching game in original_lines.json
        if 'games' in self.original_lines:
            for game_id, game_data in self.original_lines['games'].items():
                game_home = game_data.get('home_team', '').lower()
                game_away = game_data.get('away_team', '').lower()
                
                if (home_lower in game_home and away_lower in game_away) or \
                   (home_lower in game_away and away_lower in game_home):
                    
                    # Get original lines (same as game_data)
                    results['original_lines'] = game_data
                    
                    # Get movements for this game
                    if 'game_movements' in self.line_movements:
                        for movement in self.line_movements['game_movements']:
                            if movement.get('game_id') == game_id:
                                results['movements'].append(movement)
                    
                    # Get current lines (same structure as original_lines)
                    results['current_lines'] = {
                        'spreads': game_data.get('spreads', {}),
                        'totals': game_data.get('totals', {})
                    }
                    
                    break
        
        return results
    
    def display_results(self, results: Dict, format: str = 'table'):
        """
        Display search results in a readable format
        
        Args:
            results: Search results dictionary
            format: Display format ('table', 'json', 'detailed')
        """
        if format == 'json':
            print(json.dumps(results, indent=2))
            return
        
        # Table format
        if 'team' in results:
            print(f"\n{'='*80}")
            print(f"SEARCH RESULTS FOR: {results['team'].upper()}")
            if results['sport']:
                print(f"Sport Filter: {results['sport']}")
            print(f"{'='*80}\n")
            
            # Original Lines
            if results['original_lines']:
                print(f"📋 ORIGINAL LINES ({len(results['original_lines'])} games found)")
                print("-" * 80)
                for game in results['original_lines']:
                    print(f"\nGame: {game['away_team']} @ {game['home_team']}")
                    print(f"  Game Time: {game.get('game_time', 'N/A')}")
                    print(f"  First Seen: {game.get('first_seen', 'N/A')}")
                    print(f"  Spreads:")
                    for spread_key, spread_data in game.get('spreads', {}).items():
                        bookmaker_names = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {spread_data.get('spread', spread_key)}: Bookmaker: {bookmakers_str}")
                        if 'favored_team' in spread_data:
                            print(f"      Favored Team: {spread_data['favored_team']}")
                    
                    print(f"  Totals:")
                    for total_key, total_data in game.get('totals', {}).items():
                        bookmaker_names = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {total_data.get('total', total_key)}: Bookmaker: {bookmakers_str}")
                print()
            
            # Current Lines
            if results['current_lines']:
                print(f"📊 CURRENT LINES ({len(results['current_lines'])} games)")
                print("-" * 80)
                for game in results['current_lines']:
                    print(f"\nGame: {game['away_team']} @ {game['home_team']}")
                    print(f"  Spreads:")
                    for spread_key, spread_data in game.get('spreads', {}).items():
                        bookmaker_names = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {spread_data.get('spread', spread_key)}: Bookmaker: {bookmakers_str}")
                        if 'favored_team' in spread_data:
                            print(f"      Favored Team: {spread_data['favored_team']}")
                    
                    print(f"  Totals:")
                    for total_key, total_data in game.get('totals', {}).items():
                        bookmaker_names = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {total_data.get('total', total_key)}: Bookmaker: {bookmakers_str}")
                print()
            
            # Movements
            if results['movements']:
                print(f"📈 LINE MOVEMENTS ({len(results['movements'])} movements found)")
                print("-" * 80)
                for movement in results['movements']:
                    # Handle both old format (single bookmaker) and new format (bookmakers list)
                    bookmaker_display = 'N/A'
                    if 'bookmakers' in movement:
                        bookmaker_names = [b.get('bookmaker_name', b.get('bookmaker', 'Unknown')) for b in movement['bookmakers']]
                        bookmaker_display = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                    elif 'bookmaker_name' in movement:
                        bookmaker_display = movement['bookmaker_name']
                    
                    print(f"\n{movement.get('detected_at_readable', 'N/A')} - Bookmaker: {bookmaker_display}")
                    print(f"  Game: {movement.get('away_team')} @ {movement.get('home_team')}")
                    print(f"  Type: {movement.get('type', 'N/A').upper()}")
                    print(f"  Previous: {movement.get('previous_value', 'N/A')} → New: {movement.get('new_value', 'N/A')}")
                    print(f"  Change: {movement.get('change', 'N/A'):+.1f} points ({movement.get('direction', 'N/A')})")
                    if 'movement_towards' in movement:
                        print(f"  Movement: {movement.get('movement_towards', 'N/A')}")
                print()
        
        elif 'sport' in results and 'games' in results:
            # Sport search
            print(f"\n{'='*80}")
            print(f"SPORT: {results['sport']}")
            print(f"Total Games: {len(results['games'])}")
            print(f"{'='*80}\n")
            
            for game in results['games']:
                print(f"Game: {game.get('away_team')} @ {game.get('home_team')}")
                if game.get('spreads'):
                    print(f"  Spreads:")
                    for spread_key, spread_data in game['spreads'].items():
                        bookmaker_names = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {spread_data.get('spread', spread_key)}: Bookmaker: {bookmakers_str}")
                        if 'favored_team' in spread_data:
                            print(f"      Favored Team: {spread_data['favored_team']}")
                
                if game.get('totals'):
                    print(f"  Totals:")
                    for total_key, total_data in game['totals'].items():
                        bookmaker_names = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {total_data.get('total', total_key)}: Bookmaker: {bookmakers_str}")
                print()
        
        elif 'player_name' in results:
            # Player props search
            print(f"\n{'='*80}")
            print(f"PLAYER PROPS SEARCH: {results['player_name']}")
            if results.get('game_matchup'):
                print(f"Game: {results['game_matchup']}")
            print(f"{'='*80}\n")
            
            if results.get('props'):
                print(f"📊 PLAYER PROPS ({len(results['props'])} props found)")
                print("-" * 80)
                for prop in results['props']:
                    print(f"\n{prop.get('player_name', 'N/A')}")
                    print(f"  Game: {prop.get('game_matchup', 'N/A')}")
                    print(f"  Line: {prop.get('original_line', 'N/A'):.1f} points ({prop.get('outcome_type', 'N/A')})")
                    bookmakers = prop.get('bookmakers', [])
                    if bookmakers:
                        bookmaker_strs = []
                        for b in bookmakers:
                            name = b.get('bookmaker_name', b.get('bookmaker', 'Unknown'))
                            if 'american_odds' in b and b['american_odds'] is not None:
                                odds_str = f"{b['american_odds']:+d}" if isinstance(b['american_odds'], (int, float)) else str(b['american_odds'])
                                bookmaker_strs.append(f"{name} ({odds_str})")
                            else:
                                bookmaker_strs.append(name)
                        print(f"  Bookmakers: {', '.join(bookmaker_strs)}")
                    print(f"  Documented: {prop.get('documented_at_readable', 'N/A')}")
                print()
            
            if results.get('movements'):
                print(f"📈 LINE MOVEMENTS ({len(results['movements'])} movements)")
                print("-" * 80)
                for movement in sorted(results['movements'], key=lambda x: x.get('detected_at', ''), reverse=True):
                    print(f"\n{movement.get('detected_at_readable', 'N/A')}")
                    print(f"  Player: {movement.get('player_name', 'N/A')}")
                    print(f"  Game: {movement.get('game_matchup', 'N/A')}")
                    bookmakers = movement.get('bookmakers', [])
                    if bookmakers:
                        bookmaker_strs = []
                        for b in bookmakers:
                            name = b.get('bookmaker_name', b.get('bookmaker', 'Unknown'))
                            if 'american_odds' in b and b['american_odds'] is not None:
                                odds_str = f"{b['american_odds']:+d}" if isinstance(b['american_odds'], (int, float)) else str(b['american_odds'])
                                bookmaker_strs.append(f"{name} ({odds_str})")
                            else:
                                bookmaker_strs.append(name)
                        print(f"  Bookmakers: {', '.join(bookmaker_strs)}")
                    print(f"  Previous: {movement.get('previous_line', 'N/A'):.1f} → New: {movement.get('new_line', 'N/A'):.1f}")
                    print(f"  Change: {movement.get('change', 0):+.1f} points ({movement.get('direction', 'N/A')})")
                print()
        
        elif 'home_team' in results:
            # Game-specific search
            print(f"\n{'='*80}")
            print(f"GAME: {results['away_team']} @ {results['home_team']}")
            print(f"{'='*80}\n")
            
            if results['original_lines']:
                print("📋 ORIGINAL LINES")
                print("-" * 80)
                if results['original_lines'].get('spreads'):
                    print("  Spreads:")
                    for spread_key, spread_data in results['original_lines']['spreads'].items():
                        bookmaker_names = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {spread_data.get('spread', spread_key)}: Bookmaker: {bookmakers_str}")
                        if 'favored_team' in spread_data:
                            print(f"      Favored Team: {spread_data['favored_team']}")
                
                if results['original_lines'].get('totals'):
                    print("  Totals:")
                    for total_key, total_data in results['original_lines']['totals'].items():
                        bookmaker_names = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {total_data.get('total', total_key)}: Bookmaker: {bookmakers_str}")
                print()
            
            if results['current_lines']:
                print("📊 CURRENT LINES")
                print("-" * 80)
                if results['current_lines'].get('spreads'):
                    print("  Spreads:")
                    for spread_key, spread_data in results['current_lines']['spreads'].items():
                        bookmaker_names = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {spread_data.get('spread', spread_key)}: Bookmaker: {bookmakers_str}")
                        if 'favored_team' in spread_data:
                            print(f"      Favored Team: {spread_data['favored_team']}")
                
                if results['current_lines'].get('totals'):
                    print("  Totals:")
                    for total_key, total_data in results['current_lines']['totals'].items():
                        bookmaker_names = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                        print(f"    {total_data.get('total', total_key)}: Bookmaker: {bookmakers_str}")
                print()
            
            if results['movements']:
                print(f"📈 LINE MOVEMENTS ({len(results['movements'])} movements)")
                print("-" * 80)
                for movement in sorted(results['movements'], key=lambda x: x.get('detected_at', '')):
                    # Handle both old format (single bookmaker) and new format (bookmakers list)
                    bookmaker_display = 'N/A'
                    if 'bookmakers' in movement:
                        bookmaker_names = [b.get('bookmaker_name', b.get('bookmaker', 'Unknown')) for b in movement['bookmakers']]
                        bookmaker_display = ', '.join(bookmaker_names) if bookmaker_names else 'N/A'
                    elif 'bookmaker_name' in movement:
                        bookmaker_display = movement['bookmaker_name']
                    
                    print(f"  {movement.get('detected_at_readable', 'N/A')} - Bookmaker: {bookmaker_display}")
                    print(f"    {movement.get('type', 'N/A').upper()}: {movement.get('previous_value', 'N/A')} → {movement.get('new_value', 'N/A')}")
                    print(f"    Change: {movement.get('change', 'N/A'):+.1f} points")
                    if 'movement_towards' in movement:
                        print(f"    {movement.get('movement_towards', 'N/A')}")
                print()


def interactive_search():
    """Interactive search mode for easier use"""
    searcher = LineHistorySearcher()
    
    print("\n" + "="*80)
    print("🏀 BETTING LINE & PLAYER PROPS SEARCH TOOL")
    print("="*80)
    print("\nSearch Options:")
    print("  1. Search by Team")
    print("  2. Search by Game")
    print("  3. Search by Sport")
    print("  4. Search NBA Player Props by Player Name")
    print("  5. Search NBA Player Props by Game")
    print("  6. Search NBA Player Props by Line Range")
    print("  7. Exit")
    print()
    
    while True:
        try:
            choice = input("Enter your choice (1-7): ").strip()
            
            if choice == '1':
                team = input("Enter team name: ").strip()
                if team:
                    sport = input("Enter sport (NBA/NFL/NCAA Basketball/NCAA Football) or press Enter for all: ").strip()
                    sport = sport if sport else None
                    results = searcher.search_by_team(team, sport)
                    searcher.display_results(results)
            
            elif choice == '2':
                home = input("Enter home team: ").strip()
                away = input("Enter away team: ").strip()
                if home and away:
                    results = searcher.search_by_game(home, away)
                    searcher.display_results(results)
            
            elif choice == '3':
                sport = input("Enter sport (NBA/NFL/NCAA Basketball/NCAA Football): ").strip()
                if sport:
                    results = searcher.search_by_sport(sport)
                    searcher.display_results(results)
            
            elif choice == '4':
                player = input("Enter player name (partial match OK): ").strip()
                if player:
                    game = input("Enter game matchup (optional, e.g. 'Lakers @ Warriors') or press Enter: ").strip()
                    game = game if game else None
                    bookmaker = input("Enter bookmaker (optional: DraftKings/FanDuel/BetMGM/Bet365) or press Enter: ").strip()
                    bookmaker = bookmaker if bookmaker else None
                    results = searcher.search_player_props(player_name=player, game_matchup=game, bookmaker=bookmaker)
                    searcher.display_results(results)
            
            elif choice == '5':
                game = input("Enter game matchup (e.g. 'Lakers @ Warriors'): ").strip()
                if game:
                    player = input("Enter player name (optional) or press Enter: ").strip()
                    player = player if player else None
                    results = searcher.search_player_props(player_name=player, game_matchup=game)
                    searcher.display_results(results)
            
            elif choice == '6':
                min_line = input("Enter minimum line (optional) or press Enter: ").strip()
                min_line = float(min_line) if min_line else None
                max_line = input("Enter maximum line (optional) or press Enter: ").strip()
                max_line = float(max_line) if max_line else None
                player = input("Enter player name (optional) or press Enter: ").strip()
                player = player if player else None
                results = searcher.search_player_props(player_name=player, min_line=min_line, max_line=max_line)
                searcher.display_results(results)
            
            elif choice == '7':
                print("Goodbye!")
                break
            
            else:
                print("Invalid choice. Please enter 1-7.")
            
            print("\n" + "-"*80 + "\n")
            
        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Search betting line history for teams and games, plus NBA player props',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode (easiest to use)
  python3 search_lines.py --interactive
  
  # Search for a specific team
  python3 search_lines.py --team "Lakers"
  
  # Search for a team in a specific sport
  python3 search_lines.py --team "Lakers" --sport "NBA"
  
  # Search for a specific game
  python3 search_lines.py --game "Lakers" "Warriors"
  
  # Search all games in a sport
  python3 search_lines.py --sport "NBA"
  
  # Search NBA player props by player name
  python3 search_lines.py --player "Stephen Curry"
  
  # Search NBA player props by player and game
  python3 search_lines.py --player "Curry" --player-game "Warriors @ Lakers"
  
  # Search NBA player props by line range
  python3 search_lines.py --player-line-min 20 --player-line-max 30
  
  # Output as JSON
  python3 search_lines.py --player "Curry" --format json
        """
    )
    
    parser.add_argument('--team', '-t', help='Team name to search for')
    parser.add_argument('--sport', '-s', 
                       choices=['NBA', 'NFL', 'NCAA Basketball', 'NCAA Football'],
                       help='Sport category to filter by')
    parser.add_argument('--game', '-g', nargs=2, metavar=('HOME', 'AWAY'),
                       help='Search for specific game (home team and away team)')
    parser.add_argument('--player', '-p', help='Search NBA player props by player name')
    parser.add_argument('--player-game', help='Search NBA player props by game matchup')
    parser.add_argument('--player-line-min', type=float, help='Minimum line value for player props')
    parser.add_argument('--player-line-max', type=float, help='Maximum line value for player props')
    parser.add_argument('--bookmaker', '-b', help='Filter by bookmaker (DraftKings/FanDuel/BetMGM/Bet365)')
    parser.add_argument('--format', '-f', choices=['table', 'json', 'detailed'],
                       default='table', help='Output format (default: table)')
    parser.add_argument('--movements-only', action='store_true',
                       help='Show only line movements')
    parser.add_argument('--current-only', action='store_true',
                       help='Show only current lines')
    parser.add_argument('--interactive', '-i', action='store_true',
                       help='Run in interactive mode (easiest to use)')
    
    args = parser.parse_args()
    
    # Interactive mode
    if args.interactive:
        interactive_search()
        return
    
    # Check if any search criteria provided
    has_search = any([
        args.team, args.game, args.sport, args.player, 
        args.player_game, args.player_line_min is not None, args.player_line_max is not None
    ])
    
    if not has_search:
        parser.print_help()
        sys.exit(1)
    
    searcher = LineHistorySearcher()
    
    # Determine search type
    if args.player or args.player_game or args.player_line_min is not None or args.player_line_max is not None:
        # Player props search
        results = searcher.search_player_props(
            player_name=args.player,
            game_matchup=args.player_game,
            min_line=args.player_line_min,
            max_line=args.player_line_max,
            bookmaker=args.bookmaker
        )
    elif args.game:
        # Search for specific game
        results = searcher.search_by_game(args.game[0], args.game[1])
    elif args.team:
        # Search by team
        results = searcher.search_by_team(args.team, args.sport)
    elif args.sport:
        # Search by sport
        results = searcher.search_by_sport(args.sport)
    else:
        parser.print_help()
        sys.exit(1)
    
    # Filter results if requested
    if args.movements_only and 'movements' in results:
        results = {'movements': results['movements']}
    elif args.current_only:
        if 'current_lines' in results:
            results = {'current_lines': results['current_lines']}
        elif 'current_lines' in results and results['current_lines']:
            results = {'current_lines': results['current_lines']}
    
    # Display results
    searcher.display_results(results, format=args.format)


if __name__ == "__main__":
    main()

