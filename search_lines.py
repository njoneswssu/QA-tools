#!/usr/bin/env python3
"""
Line History Search Tool
Search for betting line history for specific teams across all sports
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Optional
import argparse

# File paths
ORIGINAL_LINES_FILE = "original_lines.json"
LINE_MOVEMENTS_FILE = "line_movements.json"
DRAFTKINGS_HISTORY_FILE = "draftkings_history.json"

# Sport categories mapping
SPORT_CATEGORIES = {
    'basketball_nba': 'NBA',
    'americanfootball_nfl': 'NFL',
    'basketball_ncaab': 'NCAA Basketball',
    'americanfootball_ncaaf': 'NCAA Football'
}


class LineHistorySearcher:
    """Search tool for betting line history"""
    
    def __init__(self):
        self.original_lines = self.load_file(ORIGINAL_LINES_FILE, {})
        self.line_movements = self.load_file(LINE_MOVEMENTS_FILE, {})
        self.history = self.load_file(DRAFTKINGS_HISTORY_FILE, {})
    
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
        
        # Search original lines
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
                        'bookmakers': game_data.get('bookmakers', {})
                    })
        
        # Search line movements
        if 'movements' in self.line_movements:
            for movement in self.line_movements['movements']:
                home_team = movement.get('home_team', '').lower()
                away_team = movement.get('away_team', '').lower()
                
                if team_name_lower in home_team or team_name_lower in away_team:
                    results['movements'].append(movement)
        
        # Search current lines from history
        for game_id, game_data in self.history.items():
            home_team = game_data.get('home_team', '').lower()
            away_team = game_data.get('away_team', '').lower()
            
            if team_name_lower in home_team or team_name_lower in away_team:
                current_lines_entry = {
                    'game_id': game_id,
                    'home_team': game_data.get('home_team'),
                    'away_team': game_data.get('away_team'),
                    'bookmakers': {}
                }
                
                # Get current lines from each bookmaker
                if 'bookmakers' in game_data:
                    for bookmaker_key, bookmaker_data in game_data['bookmakers'].items():
                        current_lines_entry['bookmakers'][bookmaker_key] = {
                            'current_spread': bookmaker_data.get('current_spread'),
                            'current_total': bookmaker_data.get('current_total'),
                            'favored_team': bookmaker_data.get('favored_team'),
                            'initial_spread': bookmaker_data.get('initial_spread'),
                            'initial_total': bookmaker_data.get('initial_total'),
                            'last_seen': bookmaker_data.get('last_seen')
                        }
                
                results['current_lines'].append(current_lines_entry)
        
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
        
        # Search in history file (most complete data)
        for game_id, game_data in self.history.items():
            game_entry = {
                'game_id': game_id,
                'home_team': game_data.get('home_team'),
                'away_team': game_data.get('away_team'),
                'bookmakers': game_data.get('bookmakers', {}),
                'first_seen': game_data.get('first_seen'),
                'last_updated': game_data.get('last_updated')
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
        
        # Search for matching game
        for game_id, game_data in self.history.items():
            game_home = game_data.get('home_team', '').lower()
            game_away = game_data.get('away_team', '').lower()
            
            if (home_lower in game_home and away_lower in game_away) or \
               (home_lower in game_away and away_lower in game_home):
                
                # Get original lines
                if 'games' in self.original_lines and game_id in self.original_lines['games']:
                    results['original_lines'] = self.original_lines['games'][game_id]
                
                # Get movements for this game
                if 'movements' in self.line_movements:
                    for movement in self.line_movements['movements']:
                        if movement.get('game_id') == game_id:
                            results['movements'].append(movement)
                
                # Get current lines
                results['current_lines'] = {
                    'bookmakers': game_data.get('bookmakers', {})
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
                    print(f"  Bookmakers:")
                    for bookmaker_key, bookmaker_data in game.get('bookmakers', {}).items():
                        print(f"    {bookmaker_data.get('bookmaker_name', bookmaker_key)}:")
                        print(f"      Original Spread: {bookmaker_data.get('original_spread', 'N/A')}")
                        print(f"      Original Total: {bookmaker_data.get('original_total', 'N/A')}")
                print()
            
            # Current Lines
            if results['current_lines']:
                print(f"📊 CURRENT LINES ({len(results['current_lines'])} games)")
                print("-" * 80)
                for game in results['current_lines']:
                    print(f"\nGame: {game['away_team']} @ {game['home_team']}")
                    print(f"  Bookmakers:")
                    for bookmaker_key, bookmaker_data in game.get('bookmakers', {}).items():
                        print(f"    {bookmaker_key.upper()}:")
                        print(f"      Current Spread: {bookmaker_data.get('current_spread', 'N/A')}")
                        print(f"      Current Total: {bookmaker_data.get('current_total', 'N/A')}")
                        print(f"      Favored Team: {bookmaker_data.get('favored_team', 'N/A')}")
                        print(f"      Initial Spread: {bookmaker_data.get('initial_spread', 'N/A')}")
                        print(f"      Initial Total: {bookmaker_data.get('initial_total', 'N/A')}")
                print()
            
            # Movements
            if results['movements']:
                print(f"📈 LINE MOVEMENTS ({len(results['movements'])} movements found)")
                print("-" * 80)
                for movement in results['movements']:
                    print(f"\n{movement.get('detected_at_readable', 'N/A')} - {movement.get('bookmaker_name', 'N/A')}")
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
                if game.get('bookmakers'):
                    print(f"  Bookmakers:")
                    for bookmaker_key, bookmaker_data in game['bookmakers'].items():
                        print(f"    {bookmaker_key.upper()}:")
                        print(f"      Spread: {bookmaker_data.get('current_spread', 'N/A')}")
                        print(f"      Total: {bookmaker_data.get('current_total', 'N/A')}")
                        print(f"      Favored: {bookmaker_data.get('favored_team', 'N/A')}")
                print()
        
        elif 'home_team' in results:
            # Game-specific search
            print(f"\n{'='*80}")
            print(f"GAME: {results['away_team']} @ {results['home_team']}")
            print(f"{'='*80}\n")
            
            if results['original_lines']:
                print("📋 ORIGINAL LINES")
                print("-" * 80)
                for bookmaker_key, bookmaker_data in results['original_lines'].get('bookmakers', {}).items():
                    print(f"  {bookmaker_data.get('bookmaker_name', bookmaker_key)}:")
                    print(f"    Spread: {bookmaker_data.get('original_spread', 'N/A')}")
                    print(f"    Total: {bookmaker_data.get('original_total', 'N/A')}")
                print()
            
            if results['current_lines']:
                print("📊 CURRENT LINES")
                print("-" * 80)
                for bookmaker_key, bookmaker_data in results['current_lines'].get('bookmakers', {}).items():
                    print(f"  {bookmaker_key.upper()}:")
                    print(f"    Spread: {bookmaker_data.get('current_spread', 'N/A')}")
                    print(f"    Total: {bookmaker_data.get('current_total', 'N/A')}")
                    print(f"    Favored: {bookmaker_data.get('favored_team', 'N/A')}")
                print()
            
            if results['movements']:
                print(f"📈 LINE MOVEMENTS ({len(results['movements'])} movements)")
                print("-" * 80)
                for movement in sorted(results['movements'], key=lambda x: x.get('detected_at', '')):
                    print(f"  {movement.get('detected_at_readable', 'N/A')} - {movement.get('bookmaker_name', 'N/A')}")
                    print(f"    {movement.get('type', 'N/A').upper()}: {movement.get('previous_value', 'N/A')} → {movement.get('new_value', 'N/A')}")
                    print(f"    Change: {movement.get('change', 'N/A'):+.1f} points")
                    if 'movement_towards' in movement:
                        print(f"    {movement.get('movement_towards', 'N/A')}")
                print()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Search betting line history for teams and games',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Search for a specific team
  python3 search_lines.py --team "Lakers"
  
  # Search for a team in a specific sport
  python3 search_lines.py --team "Lakers" --sport "NBA"
  
  # Search for a specific game
  python3 search_lines.py --game "Lakers" "Warriors"
  
  # Search all games in a sport
  python3 search_lines.py --sport "NBA"
  
  # Output as JSON
  python3 search_lines.py --team "Lakers" --format json
        """
    )
    
    parser.add_argument('--team', '-t', help='Team name to search for')
    parser.add_argument('--sport', '-s', 
                       choices=['NBA', 'NFL', 'NCAA Basketball', 'NCAA Football'],
                       help='Sport category to filter by')
    parser.add_argument('--game', '-g', nargs=2, metavar=('HOME', 'AWAY'),
                       help='Search for specific game (home team and away team)')
    parser.add_argument('--format', '-f', choices=['table', 'json', 'detailed'],
                       default='table', help='Output format (default: table)')
    parser.add_argument('--movements-only', action='store_true',
                       help='Show only line movements')
    parser.add_argument('--current-only', action='store_true',
                       help='Show only current lines')
    
    args = parser.parse_args()
    
    if not args.team and not args.game and not args.sport:
        parser.print_help()
        sys.exit(1)
    
    searcher = LineHistorySearcher()
    
    if args.game:
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

