#!/usr/bin/env python3
"""
Comprehensive Betting Market Monitor
- Monitors Robinhood prediction market contracts
- Monitors multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) point totals and spreads
- Documents all found contracts
- Alerts on significant movements
"""

import time
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import sys

# Robinhood imports
try:
    import robin_stocks.robinhood as rh
    ROBINHOOD_AVAILABLE = True
except ImportError:
    ROBINHOOD_AVAILABLE = False
    print("Warning: robin_stocks not available. Robinhood monitoring disabled.")

# HTTP requests for Sportsbook API
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("Warning: requests library not available. Install with: pip install requests")

# Notifications
try:
    from plyer import notification
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False

# Configuration
CHECK_INTERVAL = 1800  # Check every 30 minutes (1800 seconds) for football and NBA
PRICE_THRESHOLD = 0.80  # 80% threshold for Robinhood
SPREAD_MOVEMENT_THRESHOLD = 2.0  # Minimum 2 point movement for sportsbooks
TOTAL_MOVEMENT_THRESHOLD = 2.0  # Minimum 2 point movement for totals

# Tracking
ALERTED_CONTRACTS = set()
DOCUMENTED_CONTRACTS_FILE = "documented_contracts.json"
DRAFTKINGS_HISTORY_FILE = "draftkings_history.json"
LINE_MOVEMENTS_FILE = "line_movements.json"
ORIGINAL_LINES_FILE = "original_lines.json"

# Discord webhook (optional)
DISCORD_WEBHOOK_URL = os.getenv('DISCORD_WEBHOOK_URL')


class ContractDocumenter:
    """Documents all found contracts to a JSON file"""
    
    def __init__(self, filename: str = DOCUMENTED_CONTRACTS_FILE):
        self.filename = filename
        self.contracts = self.load_documented_contracts()
    
    def load_documented_contracts(self) -> Dict:
        """Load previously documented contracts"""
        if os.path.exists(self.filename):
            try:
                with open(self.filename, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading documented contracts: {e}")
        return {
            'robinhood_contracts': [],
            'sportsbook_contracts': [],
            'last_updated': None,
            'total_contracts': 0
        }
    
    def document_contract(self, contract: Dict, source: str = 'robinhood'):
        """
        Document a contract when found
        
        Args:
            contract: Contract dictionary
            source: Source of the contract ('robinhood' or 'sportsbook')
        """
        contract_id = contract.get('symbol') or contract.get('id') or contract.get('event_id', 'unknown')
        
        # Check if already documented
        key = f'{source}_contracts'
        existing_ids = [c.get('id') for c in self.contracts.get(key, [])]
        
        if contract_id not in existing_ids:
            contract_entry = {
                'id': contract_id,
                'name': contract.get('name', contract.get('title', 'Unknown')),
                'symbol': contract.get('symbol', 'N/A'),
                'source': source,
                'discovered_at': datetime.now().isoformat(),
                'data': contract  # Store full contract data
            }
            
            if key not in self.contracts:
                self.contracts[key] = []
            
            self.contracts[key].append(contract_entry)
            self.contracts['last_updated'] = datetime.now().isoformat()
            self.contracts['total_contracts'] = len(self.contracts.get('robinhood_contracts', [])) + \
                                                 len(self.contracts.get('sportsbook_contracts', []))
            
            self.save()
            print(f"✓ Documented new {source} contract: {contract_entry['name']}")
        # If contract already exists, don't update anything - no need to save
    
    def save(self):
        """Save documented contracts to file"""
        try:
            with open(self.filename, 'w') as f:
                json.dump(self.contracts, f, indent=2)
        except Exception as e:
            print(f"Error saving documented contracts: {e}")


class DiscordNotifier:
    """Handles Discord webhook notifications"""
    
    def __init__(self, webhook_url: str = None):
        """
        Initialize Discord notifier
        
        Args:
            webhook_url: Discord webhook URL (or set DISCORD_WEBHOOK_URL env var)
        """
        self.webhook_url = webhook_url or DISCORD_WEBHOOK_URL
        self.enabled = bool(self.webhook_url and REQUESTS_AVAILABLE)
    
    def send_webhook(self, title: str, description: str, color: int = 0x00ff00, fields: List[Dict] = None):
        """
        Send a message to Discord webhook
        
        Args:
            title: Message title
            description: Message description
            color: Embed color (hex as int, default: green)
            fields: List of field dictionaries with 'name' and 'value' keys
        """
        if not self.enabled:
            return
        
        try:
            embed = {
                'title': title,
                'description': description,
                'color': color,
                'timestamp': datetime.now().isoformat(),
                'fields': fields or []
            }
            
            payload = {
                'embeds': [embed]
            }
            
            response = requests.post(self.webhook_url, json=payload, timeout=10)
            response.raise_for_status()
        except Exception as e:
            print(f"Error sending Discord webhook: {e}")
    
    def send_grouped_spread_alert(self, game: Dict, movements: List[Dict]):
        """Send grouped spread movement alert to Discord for multiple bookmakers with same movement"""
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        
        # All movements should have the same values (grouped by same change)
        first_movement = movements[0]
        direction_emoji = "📈" if first_movement['movement'] > 0 else "📉"
        
        # Get bookmaker names
        bookmaker_names = [m.get('bookmaker_name', m.get('bookmaker', 'Unknown')) for m in movements]
        bookmakers_str = ', '.join(bookmaker_names)
        
        title = f"{direction_emoji} Spread Movement Alert ({len(movements)} bookmakers)"
        description = f"**{away_team} @ {home_team}**"
        
        fields = [
            {'name': 'Previous Spread', 'value': f"{first_movement['old_spread']:.1f}", 'inline': True},
            {'name': 'New Spread', 'value': f"{first_movement['new_spread']:.1f}", 'inline': True},
            {'name': 'Change', 'value': f"{first_movement['movement']:+.1f} points", 'inline': True},
            {'name': 'Direction', 'value': first_movement.get('direction', 'unknown').title(), 'inline': True},
            {'name': 'Bookmakers', 'value': bookmakers_str, 'inline': False},
            {'name': 'Time', 'value': first_movement.get('readable_timestamp', 'N/A'), 'inline': True}
        ]
        
        if 'movement_towards' in first_movement:
            fields.append({
                'name': 'Movement Direction',
                'value': first_movement['movement_towards'],
                'inline': False
            })
        
        # Color: red for large movements, orange for medium, green for small
        absolute_change = first_movement.get('absolute_movement', 0)
        if absolute_change >= 5:
            color = 0xff0000  # Red
        elif absolute_change >= 3:
            color = 0xffaa00  # Orange
        else:
            color = 0x00ff00  # Green
        
        self.send_webhook(title, description, color, fields)
    
    def send_spread_alert(self, game: Dict, movement: Dict):
        """Send spread movement alert to Discord (single bookmaker)"""
        self.send_grouped_spread_alert(game, [movement])
    
    def send_grouped_total_alert(self, game: Dict, movements: List[Dict]):
        """Send grouped total movement alert to Discord for multiple bookmakers with same movement"""
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        
        # All movements should have the same values (grouped by same change)
        first_movement = movements[0]
        direction_emoji = "📈" if first_movement['movement'] > 0 else "📉"
        
        # Get bookmaker names
        bookmaker_names = [m.get('bookmaker_name', m.get('bookmaker', 'Unknown')) for m in movements]
        bookmakers_str = ', '.join(bookmaker_names)
        
        title = f"{direction_emoji} Total Movement Alert ({len(movements)} bookmakers)"
        description = f"**{away_team} @ {home_team}**"
        
        fields = [
            {'name': 'Previous Total', 'value': f"{first_movement['old_total']:.1f}", 'inline': True},
            {'name': 'New Total', 'value': f"{first_movement['new_total']:.1f}", 'inline': True},
            {'name': 'Change', 'value': f"{first_movement['movement']:+.1f} points", 'inline': True},
            {'name': 'Direction', 'value': first_movement.get('direction', 'unknown').title(), 'inline': True},
            {'name': 'Bookmakers', 'value': bookmakers_str, 'inline': False},
            {'name': 'Time', 'value': first_movement.get('readable_timestamp', 'N/A'), 'inline': True}
        ]
        
        # Color based on movement size
        absolute_change = first_movement.get('absolute_movement', 0)
        if absolute_change >= 5:
            color = 0xff0000  # Red
        elif absolute_change >= 3:
            color = 0xffaa00  # Orange
        else:
            color = 0x00ff00  # Green
        
        self.send_webhook(title, description, color, fields)
    
    def send_total_alert(self, game: Dict, movement: Dict):
        """Send total movement alert to Discord (single bookmaker)"""
        self.send_grouped_total_alert(game, [movement])
    
    def send_robinhood_alert(self, contract: Dict, price: float):
        """Send Robinhood contract alert to Discord"""
        contract_name = contract.get('name', contract.get('symbol', 'Unknown Contract'))
        contract_symbol = contract.get('symbol', 'N/A')
        price_percent = price * 100
        
        title = "🚨 Robinhood Prediction Market Alert"
        description = f"**{contract_name}** ({contract_symbol})"
        
        fields = [
            {'name': 'Price', 'value': f"{price_percent:.2f}%", 'inline': True},
            {'name': 'Threshold', 'value': f"{PRICE_THRESHOLD*100}%", 'inline': True},
            {'name': 'Symbol', 'value': contract_symbol, 'inline': True},
            {'name': 'Time', 'value': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'inline': True}
        ]
        
        self.send_webhook(title, description, 0xff6b6b, fields)


class SportsbookMonitor:
    """Monitors multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) for point totals and spreads"""
    
    # Supported bookmakers
    BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'bet365']
    BOOKMAKER_NAMES = {
        'draftkings': 'DraftKings',
        'fanduel': 'FanDuel',
        'betmgm': 'BetMGM',
        'bet365': 'Bet365'
    }
    
    def __init__(self, api_key: str = None, bookmakers: List[str] = None, discord_webhook: str = None):
        """
        Initialize sportsbook monitor
        
        Args:
            api_key: The Odds API key (get free key from https://the-odds-api.com/)
            bookmakers: List of bookmakers to monitor (default: all supported)
            discord_webhook: Discord webhook URL for notifications
        """
        self.api_key = api_key or os.getenv('ODDS_API_KEY')
        self.base_url = "https://api.the-odds-api.com/v4"
        self.bookmakers = bookmakers or self.BOOKMAKERS
        self.history = self.load_history()
        self.documenter = ContractDocumenter()
        self.discord = DiscordNotifier(webhook_url=discord_webhook)
    
    def load_history(self) -> Dict:
        """Load historical odds data"""
        if os.path.exists(DRAFTKINGS_HISTORY_FILE):
            try:
                with open(DRAFTKINGS_HISTORY_FILE, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading sportsbook history: {e}")
        return {}
    
    def save_history(self):
        """Save historical odds data"""
        try:
            with open(DRAFTKINGS_HISTORY_FILE, 'w') as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f"Error saving sportsbook history: {e}")
    
    def get_sportsbook_odds(self, sport: str = 'basketball_nba') -> List[Dict]:
        """
        Get odds from multiple sportsbooks via The Odds API
        
        Args:
            sport: Sport to get odds for (default: basketball_nba)
            
        Returns:
            List of game odds dictionaries with all bookmakers
        """
        if not self.api_key:
            print("⚠️  ODDS_API_KEY not set. Sportsbook monitoring disabled.")
            print("   Get a free API key from: https://the-odds-api.com/")
            return []
        
        if not REQUESTS_AVAILABLE:
            print("⚠️  requests library not available. Install with: pip install requests")
            return []
        
        try:
            # The Odds API endpoint - get odds from all specified bookmakers
            url = f"{self.base_url}/sports/{sport}/odds"
            bookmakers_str = ','.join(self.bookmakers)
            
            params = {
                'apiKey': self.api_key,
                'regions': 'us',
                'markets': 'spreads,totals',
                'bookmakers': bookmakers_str,
                'oddsFormat': 'american'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Only document new games (document_contract checks if already exists)
            for game in data:
                self.documenter.document_contract(game, source='sportsbook')
            
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Network error fetching sportsbook odds for {sport}: {e}")
            return []
        except Exception as e:
            print(f"⚠️  Unexpected error fetching sportsbook odds for {sport}: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def parse_spread_and_total(self, game: Dict, bookmaker_key: str) -> Tuple[Optional[float], Optional[float], Optional[str]]:
        """
        Parse spread and total from game data for a specific bookmaker
        
        Args:
            game: Game dictionary from API
            bookmaker_key: The bookmaker key (e.g., 'draftkings', 'fanduel')
            
        Returns:
            Tuple of (spread, total, favored_team) or (None, None, None) if not found
            favored_team: The team name that is favored (negative spread)
        """
        spread = None
        total = None
        favored_team = None
        
        try:
            # Navigate through the API response structure
            bookmakers = game.get('bookmakers', [])
            for bookmaker in bookmakers:
                if bookmaker.get('key') == bookmaker_key:
                    markets = bookmaker.get('markets', [])
                    
                    for market in markets:
                        # Get spread
                        if market.get('key') == 'spreads':
                            outcomes = market.get('outcomes', [])
                            if outcomes:
                                # Get home team name from game data
                                home_team = game.get('home_team', '')
                                away_team = game.get('away_team', '')
                                
                                # Find the home team's spread value (consistent tracking)
                                # This ensures we always track the same reference point
                                for outcome in outcomes:
                                    if outcome.get('name') == home_team:
                                        spread = float(outcome.get('point', 0))
                                        # If home team has negative spread, they're favored
                                        # If home team has positive spread, away team is favored
                                        if spread < 0:
                                            favored_team = home_team
                                        elif spread > 0:
                                            favored_team = away_team
                                        break
                                
                                # If home team not found in outcomes, find negative spread (favored team)
                                if spread is None:
                                    for outcome in outcomes:
                                        point = float(outcome.get('point', 0))
                                        if point < 0:
                                            spread = point
                                            favored_team = outcome.get('name', 'Unknown')
                                            break
                                
                                # Fallback: use first outcome if still not found
                                if spread is None and outcomes:
                                    spread = float(outcomes[0].get('point', 0))
                                    # Check if it's negative to determine favored team
                                    if spread < 0:
                                        favored_team = outcomes[0].get('name', 'Unknown')
                                    elif spread > 0:
                                        # If first outcome is positive, find the other team
                                        for outcome in outcomes:
                                            if outcome.get('name') != outcomes[0].get('name'):
                                                favored_team = outcome.get('name', 'Unknown')
                                                break
                        
                        # Get total
                        elif market.get('key') == 'totals':
                            outcomes = market.get('outcomes', [])
                            if outcomes:
                                # Total is the point value
                                total = float(outcomes[0].get('point', 0))
                    
                    break  # Found the bookmaker, no need to check others
        except Exception as e:
            print(f"Error parsing spread/total for {bookmaker_key}: {e}")
        
        return spread, total, favored_team
    
    def get_all_bookmaker_odds(self, game: Dict) -> Dict[str, Dict]:
        """
        Get spreads and totals from all bookmakers for a game
        
        Args:
            game: Game dictionary from API
            
        Returns:
            Dictionary mapping bookmaker keys to their odds data including favored team
        """
        bookmaker_odds = {}
        
        for bookmaker_key in self.bookmakers:
            spread, total, favored_team = self.parse_spread_and_total(game, bookmaker_key)
            if spread is not None or total is not None:
                bookmaker_odds[bookmaker_key] = {
                    'spread': spread,
                    'total': total,
                    'favored_team': favored_team
                }
        
        return bookmaker_odds
    
    def check_movements(self, current_games: List[Dict]):
        """
        Check for significant movements in spreads and totals across all bookmakers
        Documents all movements with timestamps and previous values
        
        Args:
            current_games: List of current game data
        """
        current_time = datetime.now().isoformat()
        readable_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        for game in current_games:
            game_id = game.get('id', 'unknown')
            home_team = game.get('home_team', 'Unknown')
            away_team = game.get('away_team', 'Unknown')
            commence_time = game.get('commence_time', '')
            
            # Get odds from all bookmakers for this game
            bookmaker_odds = self.get_all_bookmaker_odds(game)
            
            if game_id not in self.history:
                # First time seeing this game, store initial values for all bookmakers
                self.history[game_id] = {
                    'home_team': home_team,
                    'away_team': away_team,
                    'bookmakers': {},
                    'first_seen': current_time,
                    'last_updated': current_time
                }
                
                # Initialize each bookmaker's data
                for bookmaker_key, odds in bookmaker_odds.items():
                    self.history[game_id]['bookmakers'][bookmaker_key] = {
                        'initial_spread': odds.get('spread'),
                        'initial_total': odds.get('total'),
                        'current_spread': odds.get('spread'),
                        'current_total': odds.get('total'),
                        'favored_team': odds.get('favored_team'),
                        'spread_movements': [],
                        'total_movements': []
                    }
                
                # Document original lines in separate file
                self.document_original_lines(game, bookmaker_odds, current_time)
                
                # Save initial state
                self.save_history()
            else:
                # Check for movements in each bookmaker
                history = self.history[game_id]
                movement_occurred = False
                
                # Initialize bookmaker data if not exists
                if 'bookmakers' not in history:
                    history['bookmakers'] = {}
                
                # Collect all movements first, then group and notify
                spread_movements = []  # List of all spread movements
                total_movements = []   # List of all total movements
                
                for bookmaker_key, odds in bookmaker_odds.items():
                    # Initialize bookmaker if first time seeing it
                    if bookmaker_key not in history['bookmakers']:
                        history['bookmakers'][bookmaker_key] = {
                            'initial_spread': odds.get('spread'),
                            'initial_total': odds.get('total'),
                            'current_spread': odds.get('spread'),
                            'current_total': odds.get('total'),
                            'favored_team': odds.get('favored_team'),
                            'spread_movements': [],
                            'total_movements': [],
                            'last_seen': current_time
                        }
                        # Document original lines for this new bookmaker
                        self.document_original_lines(game, {bookmaker_key: odds}, current_time)
                        # Save the new bookmaker initialization
                        history['last_updated'] = current_time
                        self.save_history()
                        continue
                    
                    bookmaker_history = history['bookmakers'][bookmaker_key]
                    # Use the last saved values as the baseline (from previous run or last check)
                    old_spread = bookmaker_history.get('current_spread')
                    old_total = bookmaker_history.get('current_total')
                    old_favored_team = bookmaker_history.get('favored_team')
                    new_spread = odds.get('spread')
                    new_total = odds.get('total')
                    new_favored_team = odds.get('favored_team')
                    
                    # Check spread movement
                    if new_spread is not None and old_spread is not None:
                        spread_change = abs(new_spread - old_spread)
                        if spread_change >= SPREAD_MOVEMENT_THRESHOLD:
                            # Determine movement direction towards teams
                            movement_towards = self.determine_spread_movement_direction(
                                game, old_spread, new_spread, old_favored_team, new_favored_team
                            )
                            
                            movement = {
                                'timestamp': current_time,
                                'readable_timestamp': readable_time,
                                'bookmaker': bookmaker_key,
                                'bookmaker_name': self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key),
                                'old_spread': old_spread,
                                'new_spread': new_spread,
                                'movement': new_spread - old_spread,
                                'absolute_movement': spread_change,
                                'direction': 'increased' if new_spread > old_spread else 'decreased',
                                'movement_towards': movement_towards,
                                'old_favored_team': old_favored_team,
                                'new_favored_team': new_favored_team
                            }
                            bookmaker_history['spread_movements'].append(movement)
                            
                            # Document the movement in the contracts file (still individual)
                            self.document_movement(game, 'spread', movement, bookmaker_key)
                            
                            # Collect for grouping
                            spread_movements.append(movement)
                            movement_occurred = True
                            # Update current value after movement detected
                            bookmaker_history['current_spread'] = new_spread
                            bookmaker_history['favored_team'] = new_favored_team
                        else:
                            # No significant movement, but still update current value for next comparison
                            bookmaker_history['current_spread'] = new_spread
                    elif new_spread is not None:
                        # First time seeing this spread value, update it
                        bookmaker_history['current_spread'] = new_spread
                        bookmaker_history['favored_team'] = new_favored_team
                    
                    # Check total movement
                    if new_total is not None and old_total is not None:
                        total_change = abs(new_total - old_total)
                        if total_change >= TOTAL_MOVEMENT_THRESHOLD:
                            movement = {
                                'timestamp': current_time,
                                'readable_timestamp': readable_time,
                                'bookmaker': bookmaker_key,
                                'bookmaker_name': self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key),
                                'old_total': old_total,
                                'new_total': new_total,
                                'movement': new_total - old_total,
                                'absolute_movement': total_change,
                                'direction': 'increased' if new_total > old_total else 'decreased'
                            }
                            bookmaker_history['total_movements'].append(movement)
                            
                            # Document the movement in the contracts file (still individual)
                            self.document_movement(game, 'total', movement, bookmaker_key)
                            
                            # Collect for grouping
                            total_movements.append(movement)
                            movement_occurred = True
                            # Update current value after movement detected
                            bookmaker_history['current_total'] = new_total
                        else:
                            # No significant movement, but still update current value for next comparison
                            bookmaker_history['current_total'] = new_total
                    elif new_total is not None:
                        # First time seeing this total value, update it
                        bookmaker_history['current_total'] = new_total
                    
                    # Update last_seen timestamp for this bookmaker
                    bookmaker_history['last_seen'] = current_time
                
                # Group and send notifications for spread movements
                if spread_movements:
                    # Group by same old_spread, new_spread, and movement amount
                    spread_groups = {}
                    for movement in spread_movements:
                        # Create a key based on the movement values
                        group_key = (
                            movement['old_spread'],
                            movement['new_spread'],
                            movement['movement'],
                            movement.get('movement_towards', '')
                        )
                        if group_key not in spread_groups:
                            spread_groups[group_key] = []
                        spread_groups[group_key].append(movement)
                    
                    # Send grouped notifications
                    for group_movements in spread_groups.values():
                        if len(group_movements) > 1:
                            # Multiple bookmakers with same movement - send grouped notification
                            self.send_grouped_spread_alert_console(game, group_movements)
                            self.discord.send_grouped_spread_alert(game, group_movements)
                        else:
                            # Single bookmaker - send individual notification
                            self.send_spread_alert(game, group_movements[0])
                
                # Group and send notifications for total movements
                if total_movements:
                    # Group by same old_total, new_total, and movement amount
                    total_groups = {}
                    for movement in total_movements:
                        # Create a key based on the movement values
                        group_key = (
                            movement['old_total'],
                            movement['new_total'],
                            movement['movement']
                        )
                        if group_key not in total_groups:
                            total_groups[group_key] = []
                        total_groups[group_key].append(movement)
                    
                    # Send grouped notifications
                    for group_movements in total_groups.values():
                        if len(group_movements) > 1:
                            # Multiple bookmakers with same movement - send grouped notification
                            self.send_grouped_total_alert_console(game, group_movements)
                            self.discord.send_grouped_total_alert(game, group_movements)
                        else:
                            # Single bookmaker - send individual notification
                            self.send_total_alert(game, group_movements[0])
                
                # Always update last_updated and save history (even if no movement)
                # This ensures we remember the current lines for the next run
                history['last_updated'] = current_time
                self.save_history()
    
    def determine_spread_movement_direction(self, game: Dict, old_spread: float, new_spread: float, 
                                           old_favored_team: Optional[str], new_favored_team: Optional[str]) -> str:
        """
        Determine which team the spread movement is favoring
        
        Args:
            game: Game dictionary with home_team and away_team
            old_spread: Previous spread value
            new_spread: New spread value
            old_favored_team: Previously favored team name
            new_favored_team: Currently favored team name
            
        Returns:
            String describing movement direction (e.g., "towards home team", "towards away team", "favorite getting more points")
        """
        home_team = game.get('home_team', 'Home Team')
        away_team = game.get('away_team', 'Away Team')
        
        # If favored team changed, that's a significant shift
        if old_favored_team and new_favored_team and old_favored_team != new_favored_team:
            if new_favored_team == home_team:
                return f"shifted to favor {home_team} (home team)"
            elif new_favored_team == away_team:
                return f"shifted to favor {away_team} (away team)"
            else:
                return f"shifted to favor {new_favored_team}"
        
        # Spread moved more negative (favorite getting more points)
        if new_spread < old_spread:
            if old_favored_team == home_team:
                return f"towards {home_team} (home team getting more points)"
            elif old_favored_team == away_team:
                return f"towards {away_team} (away team getting more points)"
            else:
                return "favorite getting more points"
        
        # Spread moved more positive (favorite getting fewer points, underdog improving)
        elif new_spread > old_spread:
            if old_favored_team == home_team:
                return f"towards {away_team} (away team improving, home team getting fewer points)"
            elif old_favored_team == away_team:
                return f"towards {home_team} (home team improving, away team getting fewer points)"
            else:
                return "underdog improving (favorite getting fewer points)"
        
        return "unknown direction"
    
    def load_original_lines(self) -> Dict:
        """Load original lines from file"""
        if os.path.exists(ORIGINAL_LINES_FILE):
            try:
                with open(ORIGINAL_LINES_FILE, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading original lines: {e}")
        return {
            'games': {},
            'last_updated': None,
            'total_games': 0
        }
    
    def save_original_lines(self, original_lines_data: Dict):
        """Save original lines to file"""
        try:
            with open(ORIGINAL_LINES_FILE, 'w') as f:
                json.dump(original_lines_data, f, indent=2)
        except Exception as e:
            print(f"Error saving original lines: {e}")
    
    def document_original_lines(self, game: Dict, bookmaker_odds: Dict, timestamp: str):
        """
        Document the original lines for a game when first discovered
        
        Args:
            game: Game dictionary
            bookmaker_odds: Dictionary of bookmaker keys to their odds
            timestamp: ISO timestamp when lines were first seen
        """
        game_id = game.get('id', 'unknown')
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        commence_time = game.get('commence_time', '')
        readable_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Load existing original lines
        original_lines_data = self.load_original_lines()
        
        # Check if game already exists
        if game_id not in original_lines_data['games']:
            # Create game entry
            game_entry = {
                'game_id': game_id,
                'home_team': home_team,
                'away_team': away_team,
                'game_time': commence_time,
                'first_seen': timestamp,
                'first_seen_readable': readable_time,
                'bookmakers': {}
            }
            
            # Add original lines for each bookmaker
            for bookmaker_key, odds in bookmaker_odds.items():
                bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                game_entry['bookmakers'][bookmaker_key] = {
                    'bookmaker_name': bookmaker_name,
                    'original_spread': odds.get('spread'),
                    'original_total': odds.get('total'),
                    'documented_at': timestamp,
                    'documented_at_readable': readable_time
                }
            
            original_lines_data['games'][game_id] = game_entry
            original_lines_data['last_updated'] = timestamp
            original_lines_data['total_games'] = len(original_lines_data['games'])
            
            # Save to file
            self.save_original_lines(original_lines_data)
            
            print(f"✓ Documented original lines for: {away_team} @ {home_team}")
            print(f"  Bookmakers: {', '.join([self.BOOKMAKER_NAMES.get(b, b) for b in bookmaker_odds.keys()])}")
            print(f"  Saved to: {ORIGINAL_LINES_FILE}")
        else:
            # Game exists, check if we need to add new bookmakers
            game_entry = original_lines_data['games'][game_id]
            updated = False
            
            for bookmaker_key, odds in bookmaker_odds.items():
                if bookmaker_key not in game_entry['bookmakers']:
                    bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                    game_entry['bookmakers'][bookmaker_key] = {
                        'bookmaker_name': bookmaker_name,
                        'original_spread': odds.get('spread'),
                        'original_total': odds.get('total'),
                        'documented_at': timestamp,
                        'documented_at_readable': readable_time
                    }
                    updated = True
            
            if updated:
                original_lines_data['last_updated'] = timestamp
                self.save_original_lines(original_lines_data)
                print(f"✓ Updated original lines for: {away_team} @ {home_team} (new bookmakers added)")
    
    def load_line_movements(self) -> Dict:
        """Load line movements from file"""
        if os.path.exists(LINE_MOVEMENTS_FILE):
            try:
                with open(LINE_MOVEMENTS_FILE, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading line movements: {e}")
        return {
            'movements': [],
            'last_updated': None,
            'total_movements': 0
        }
    
    def save_line_movements(self, movements_data: Dict):
        """Save line movements to file"""
        try:
            with open(LINE_MOVEMENTS_FILE, 'w') as f:
                json.dump(movements_data, f, indent=2)
        except Exception as e:
            print(f"Error saving line movements: {e}")
    
    def document_movement(self, game: Dict, movement_type: str, movement: Dict, bookmaker_key: str):
        """
        Document a significant movement in a separate line movements file
        Records when the change was detected and what the previous value was
        
        Args:
            game: Game dictionary
            movement_type: 'spread' or 'total'
            movement: Movement dictionary with timestamp and values
            bookmaker_key: The bookmaker that had the movement
        """
        game_id = game.get('id', 'unknown')
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        bookmaker_name = movement.get('bookmaker_name', bookmaker_key)
        commence_time = game.get('commence_time', '')
        
        # Load existing movements
        movements_data = self.load_line_movements()
        
        # Create movement entry with all details
        movement_entry = {
            'game_id': game_id,
            'home_team': home_team,
            'away_team': away_team,
            'game_time': commence_time,
            'type': movement_type,
            'bookmaker': bookmaker_key,
            'bookmaker_name': bookmaker_name,
            'detected_at': movement['timestamp'],
            'detected_at_readable': movement['readable_timestamp'],
            'previous_value': movement.get(f'old_{movement_type}'),
            'new_value': movement.get(f'new_{movement_type}'),
            'change': movement['movement'],
            'absolute_change': movement['absolute_movement'],
            'direction': movement['direction']
        }
        
        # Add spread-specific movement direction if available
        if movement_type == 'spread' and 'movement_towards' in movement:
            movement_entry['movement_towards'] = movement['movement_towards']
            movement_entry['old_favored_team'] = movement.get('old_favored_team')
            movement_entry['new_favored_team'] = movement.get('new_favored_team')
        
        # Add to movements list
        movements_data['movements'].append(movement_entry)
        movements_data['last_updated'] = datetime.now().isoformat()
        movements_data['total_movements'] = len(movements_data['movements'])
        
        # Save to separate file
        self.save_line_movements(movements_data)
        
        print(f"✓ Documented {movement_type} movement ({bookmaker_name}): {away_team} @ {home_team}")
        print(f"  Previous: {movement_entry['previous_value']:.1f} → New: {movement_entry['new_value']:.1f}")
        print(f"  Change: {movement_entry['change']:+.1f} points ({movement_entry['direction']})")
        if 'movement_towards' in movement_entry:
            print(f"  Movement: {movement_entry['movement_towards']}")
        print(f"  Detected at: {movement_entry['detected_at_readable']}")
        print(f"  Saved to: {LINE_MOVEMENTS_FILE}")
    
    def send_grouped_spread_alert_console(self, game: Dict, movements: List[Dict]):
        """Send grouped spread alert to console"""
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        first_movement = movements[0]
        direction = "↑" if first_movement['movement'] > 0 else "↓"
        
        bookmaker_names = [m.get('bookmaker_name', m.get('bookmaker', 'Unknown')) for m in movements]
        bookmakers_str = ', '.join(bookmaker_names)
        
        timestamp = first_movement.get('readable_timestamp', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print(f"\n{'='*60}")
        print(f"📊 SPREAD ALERT - {len(movements)} BOOKMAKERS [{timestamp}]")
        print(f"Game: {away_team} @ {home_team}")
        print(f"Bookmakers: {bookmakers_str}")
        print(f"Previous Spread: {first_movement['old_spread']:.1f}")
        print(f"New Spread: {first_movement['new_spread']:.1f}")
        print(f"Change: {first_movement['movement']:+.1f} points ({first_movement.get('direction', 'unknown')})")
        if 'movement_towards' in first_movement:
            print(f"Movement: {first_movement['movement_towards']}")
        print(f"Movement detected at: {timestamp}")
        print(f"{'='*60}\n")
        
        # Log each movement individually
        for movement in movements:
            self.log_alert('spread', game, movement)
    
    def send_grouped_total_alert_console(self, game: Dict, movements: List[Dict]):
        """Send grouped total alert to console"""
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        first_movement = movements[0]
        direction = "↑" if first_movement['movement'] > 0 else "↓"
        
        bookmaker_names = [m.get('bookmaker_name', m.get('bookmaker', 'Unknown')) for m in movements]
        bookmakers_str = ', '.join(bookmaker_names)
        
        timestamp = first_movement.get('readable_timestamp', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print(f"\n{'='*60}")
        print(f"📊 TOTAL ALERT - {len(movements)} BOOKMAKERS [{timestamp}]")
        print(f"Game: {away_team} @ {home_team}")
        print(f"Bookmakers: {bookmakers_str}")
        print(f"Previous Total: {first_movement['old_total']:.1f}")
        print(f"New Total: {first_movement['new_total']:.1f}")
        print(f"Change: {first_movement['movement']:+.1f} points ({first_movement.get('direction', 'unknown')})")
        print(f"Movement detected at: {timestamp}")
        print(f"{'='*60}\n")
        
        # Log each movement individually
        for movement in movements:
            self.log_alert('total', game, movement)
    
    def send_spread_alert(self, game: Dict, movement: Dict):
        """Send alert for spread movement (single bookmaker)"""
        self.send_grouped_spread_alert_console(game, [movement])
        
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        bookmaker_name = movement.get('bookmaker_name', movement.get('bookmaker', 'Unknown'))
        direction = "↑" if movement['movement'] > 0 else "↓"
        
        message = f"{bookmaker_name}: {away_team} @ {home_team}\nSpread moved {direction} {abs(movement['movement']):.1f} points\n{movement['old_spread']:.1f} → {movement['new_spread']:.1f}"
        
        if NOTIFICATIONS_AVAILABLE:
            try:
                notification.notify(
                    title=f"{bookmaker_name} Spread Movement Alert",
                    message=message,
                    timeout=10
                )
            except:
                pass
        
        # Send Discord webhook notification
        self.discord.send_spread_alert(game, movement)
    
    def send_total_alert(self, game: Dict, movement: Dict):
        """Send alert for total movement (single bookmaker)"""
        self.send_grouped_total_alert_console(game, [movement])
        
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        bookmaker_name = movement.get('bookmaker_name', movement.get('bookmaker', 'Unknown'))
        direction = "↑" if movement['movement'] > 0 else "↓"
        
        message = f"{bookmaker_name}: {away_team} @ {home_team}\nTotal moved {direction} {abs(movement['movement']):.1f} points\n{movement['old_total']:.1f} → {movement['new_total']:.1f}"
        
        if NOTIFICATIONS_AVAILABLE:
            try:
                notification.notify(
                    title=f"{bookmaker_name} Total Movement Alert",
                    message=message,
                    timeout=10
                )
            except:
                pass
        
        # Send Discord webhook notification
        self.discord.send_total_alert(game, movement)
    
    def log_alert(self, alert_type: str, game: Dict, movement: Dict):
        """Log alert to file"""
        log_file = "sportsbook_alerts.log"
        timestamp = datetime.now().isoformat()
        
        log_entry = {
            'timestamp': timestamp,
            'type': alert_type,
            'game': {
                'id': game.get('id'),
                'home_team': game.get('home_team'),
                'away_team': game.get('away_team')
            },
            'movement': movement
        }
        
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            print(f"Could not write to log file: {e}")
    
    def monitor(self, sports: List[str] = None):
        """
        Monitor sportsbook odds for movements across all bookmakers
        
        Args:
            sports: List of sports to monitor (default: ['basketball_nba', 'americanfootball_nfl', 
                    'basketball_ncaab', 'americanfootball_ncaaf'])
        """
        if sports is None:
            sports = ['basketball_nba', 'americanfootball_nfl', 'basketball_ncaab', 'americanfootball_ncaaf']
        
        bookmakers_str = ', '.join([self.BOOKMAKER_NAMES.get(b, b) for b in self.bookmakers])
        
        # Map sport keys to readable names
        sport_names = {
            'basketball_nba': 'NBA',
            'americanfootball_nfl': 'NFL',
            'basketball_ncaab': 'NCAA Basketball',
            'americanfootball_ncaaf': 'NCAA Football'
        }
        sports_display = [sport_names.get(s, s) for s in sports]
        
        interval_minutes = CHECK_INTERVAL / 60
        print(f"\nStarting Sportsbook monitoring...")
        print(f"Bookmakers: {bookmakers_str}")
        print(f"Checking every {interval_minutes} minutes ({CHECK_INTERVAL} seconds)")
        print(f"Movement threshold: {SPREAD_MOVEMENT_THRESHOLD} points")
        print(f"Sports: {', '.join(sports_display)}")
        print(f"Press Ctrl+C to stop\n")
        
        try:
            while True:
                try:
                    for sport in sports:
                        sport_display = sport_names.get(sport, sport)
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking {sport_display}...")
                        games = self.get_sportsbook_odds(sport)
                        
                        if games:
                            print(f"Found {len(games)} games")
                            self.check_movements(games)
                        else:
                            print(f"No games found for {sport_display}")
                        
                        time.sleep(1)  # Small delay between sports
                    
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Cycle complete. Next check in {CHECK_INTERVAL/60:.1f} minutes...\n")
                    time.sleep(CHECK_INTERVAL)
                    
                except KeyboardInterrupt:
                    raise  # Re-raise to exit outer loop
                except Exception as e:
                    print(f"\n⚠️  Error during sportsbook check: {e}")
                    import traceback
                    traceback.print_exc()
                    print(f"Continuing monitoring in {CHECK_INTERVAL/60:.1f} minutes...\n")
                    time.sleep(CHECK_INTERVAL)  # Wait before retrying
                
        except KeyboardInterrupt:
            print("\n\nSportsbook monitoring stopped.")
        except Exception as e:
            print(f"\nFatal error in sportsbook monitoring: {e}")
            import traceback
            traceback.print_exc()


class EnhancedPredictionMarketMonitor:
    """Enhanced Robinhood monitor with contract documentation"""
    
    def __init__(self, username: str = None, password: str = None, mfa_code: str = None, discord_webhook: str = None):
        self.username = username or os.getenv('ROBINHOOD_USERNAME')
        self.password = password or os.getenv('ROBINHOOD_PASSWORD')
        self.mfa_code = mfa_code or os.getenv('ROBINHOOD_MFA')
        self.authenticated = False
        self.contracts_cache = []
        self.documenter = ContractDocumenter()
        self.discord = DiscordNotifier(webhook_url=discord_webhook)
    
    def login(self) -> bool:
        """Authenticate with Robinhood"""
        if not ROBINHOOD_AVAILABLE:
            return False
        
        if not self.username or not self.password:
            print("Error: Robinhood credentials not provided.")
            return False
        
        try:
            if self.mfa_code:
                rh.login(self.username, self.password, mfa_code=self.mfa_code)
            else:
                rh.login(self.username, self.password)
            
            self.authenticated = True
            print(f"✓ Successfully authenticated as {self.username}")
            return True
        except Exception as e:
            print(f"✗ Authentication failed: {e}")
            return False
    
    def get_prediction_market_contracts(self) -> List[Dict]:
        """Fetch all prediction market contracts from Robinhood"""
        if not ROBINHOOD_AVAILABLE:
            return []
        
        contracts = []
        
        # Try multiple methods to get contracts
        methods = [
            ('get_prediction_markets', []),
            ('get_all_instruments', []),
        ]
        
        for method_name, args in methods:
            try:
                if hasattr(rh, method_name):
                    result = getattr(rh, method_name)(*args)
                    if result:
                        if method_name == 'get_all_instruments':
                            # Filter for prediction contracts
                            for item in result:
                                if self._is_prediction_contract(item):
                                    contracts.append(item)
                        else:
                            contracts = result if isinstance(result, list) else [result]
                        
                        if contracts:
                            print(f"Found {len(contracts)} contracts via {method_name}()")
                            break
            except Exception as e:
                continue
        
        # Only document new contracts (document_contract checks if already exists)
        for contract in contracts:
            self.documenter.document_contract(contract, source='robinhood')
        
        return contracts
    
    def _is_prediction_contract(self, instrument: Dict) -> bool:
        """Determine if an instrument is a prediction market contract"""
        name = str(instrument.get('name', '')).lower()
        symbol = str(instrument.get('symbol', '')).lower()
        type_field = str(instrument.get('type', '')).lower()
        
        prediction_keywords = ['prediction', 'yes', 'no', 'contract', 'market']
        return any(keyword in name or keyword in symbol or keyword in type_field 
                  for keyword in prediction_keywords)
    
    def get_contract_price(self, contract: Dict) -> Optional[float]:
        """Get the current price of a contract"""
        if not ROBINHOOD_AVAILABLE:
            return None
        
        try:
            symbol = contract.get('symbol') or contract.get('id')
            if not symbol:
                return None
            
            price_data = rh.get_latest_price(symbol)
            if price_data and len(price_data) > 0:
                price = float(price_data[0])
                if price > 1.0:
                    price = price / 100.0
                return price
            return None
        except:
            return None
    
    def send_notification(self, contract: Dict, price: float):
        """Send notification when contract exceeds threshold"""
        contract_name = contract.get('name', contract.get('symbol', 'Unknown Contract'))
        contract_symbol = contract.get('symbol', 'N/A')
        price_percent = price * 100
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{'='*60}")
        print(f"🚨 ROBINHOOD ALERT [{timestamp}]")
        print(f"Contract: {contract_name}")
        print(f"Symbol: {contract_symbol}")
        print(f"Price: {price_percent:.2f}% (exceeds {PRICE_THRESHOLD*100}% threshold)")
        print(f"{'='*60}\n")
        
        if NOTIFICATIONS_AVAILABLE:
            try:
                notification.notify(
                    title="Robinhood Prediction Market Alert",
                    message=f"{contract_name} is at {price_percent:.2f}%",
                    timeout=10
                )
            except:
                pass
        
        # Send Discord webhook notification
        self.discord.send_robinhood_alert(contract, price)
    
    def monitor_contracts(self):
        """Main monitoring loop"""
        if not self.authenticated:
            return
        
        interval_minutes = CHECK_INTERVAL / 60
        print(f"\nStarting Robinhood monitoring...")
        print(f"Checking every {interval_minutes} minutes ({CHECK_INTERVAL} seconds)")
        print(f"Alert threshold: {PRICE_THRESHOLD*100}%")
        print(f"Press Ctrl+C to stop\n")
        
        try:
            while True:
                try:
                    if not self.contracts_cache:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching contracts...")
                        self.contracts_cache = self.get_prediction_market_contracts()
                        print(f"Monitoring {len(self.contracts_cache)} contracts")
                    
                    for contract in self.contracts_cache:
                        price = self.get_contract_price(contract)
                        if price is None:
                            continue
                        
                        contract_id = contract.get('symbol') or contract.get('id', 'unknown')
                        
                        if price >= PRICE_THRESHOLD:
                            if contract_id not in ALERTED_CONTRACTS:
                                self.send_notification(contract, price)
                                ALERTED_CONTRACTS.add(contract_id)
                        else:
                            ALERTED_CONTRACTS.discard(contract_id)
                        
                        time.sleep(0.5)
                    
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Next check in {CHECK_INTERVAL/60:.1f} minutes...\n")
                    time.sleep(CHECK_INTERVAL)
                    
                except KeyboardInterrupt:
                    raise  # Re-raise to exit outer loop
                except Exception as e:
                    print(f"\n⚠️  Error during Robinhood check: {e}")
                    import traceback
                    traceback.print_exc()
                    print(f"Continuing monitoring in {CHECK_INTERVAL/60:.1f} minutes...\n")
                    time.sleep(CHECK_INTERVAL)  # Wait before retrying
                
        except KeyboardInterrupt:
            print("\n\nRobinhood monitoring stopped.")
        except Exception as e:
            print(f"\nFatal error in Robinhood monitoring: {e}")
            import traceback
            traceback.print_exc()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Monitor Robinhood prediction markets and Sportsbook odds (DraftKings, FanDuel, BetMGM, Bet365)'
    )
    parser.add_argument('--robinhood-username', '-ru', help='Robinhood username')
    parser.add_argument('--robinhood-password', '-rp', help='Robinhood password')
    parser.add_argument('--robinhood-mfa', '-rm', help='Robinhood MFA code')
    parser.add_argument('--odds-api-key', '-ok', help='The Odds API key')
    parser.add_argument('--interval', '-i', type=int, default=1800,
                       help='Check interval in seconds (default: 1800 = 30 minutes)')
    parser.add_argument('--threshold', '-t', type=float, default=0.80,
                       help='Robinhood price threshold (default: 0.80)')
    parser.add_argument('--movement-threshold', '-m', type=float, default=2.0,
                       help='Sportsbook movement threshold in points (default: 2.0)')
    parser.add_argument('--robinhood-only', action='store_true',
                       help='Only monitor Robinhood (skip sportsbooks)')
    parser.add_argument('--sportsbook-only', action='store_true',
                       help='Only monitor sportsbooks (skip Robinhood)')
    parser.add_argument('--bookmakers', nargs='+', 
                       choices=['draftkings', 'fanduel', 'betmgm', 'bet365'],
                       help='Specific bookmakers to monitor (default: all)')
    parser.add_argument('--discord-webhook', '-dw', 
                       help='Discord webhook URL for notifications')
    
    args = parser.parse_args()
    
    # Update global configuration
    global CHECK_INTERVAL, PRICE_THRESHOLD, SPREAD_MOVEMENT_THRESHOLD, TOTAL_MOVEMENT_THRESHOLD
    CHECK_INTERVAL = args.interval
    PRICE_THRESHOLD = args.threshold
    SPREAD_MOVEMENT_THRESHOLD = args.movement_threshold
    TOTAL_MOVEMENT_THRESHOLD = args.movement_threshold
    
    import threading
    
    # Start Robinhood monitoring
    if not args.sportsbook_only and ROBINHOOD_AVAILABLE:
        rh_monitor = EnhancedPredictionMarketMonitor(
            username=args.robinhood_username,
            password=args.robinhood_password,
            mfa_code=args.robinhood_mfa,
            discord_webhook=args.discord_webhook
        )
        
        if rh_monitor.login():
            if args.robinhood_only:
                rh_monitor.monitor_contracts()
            else:
                rh_thread = threading.Thread(target=rh_monitor.monitor_contracts, daemon=True)
                rh_thread.start()
    
    # Start Sportsbook monitoring
    if not args.robinhood_only:
        sb_monitor = SportsbookMonitor(
            api_key=args.odds_api_key, 
            bookmakers=args.bookmakers,
            discord_webhook=args.discord_webhook
        )
        if args.sportsbook_only:
            sb_monitor.monitor()
        else:
            sb_thread = threading.Thread(target=sb_monitor.monitor, daemon=True)
            sb_thread.start()
            
            # Keep main thread alive
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n\nMonitoring stopped.")


if __name__ == "__main__":
    main()

