#!/usr/bin/env python3
"""
Comprehensive Betting Market Monitor
- Monitors multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365) point totals and spreads
- Documents all found games
- Alerts on significant movements
"""

import time
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import sys

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
SPREAD_MOVEMENT_THRESHOLD = 2.0  # Minimum 2 point movement for sportsbooks
TOTAL_MOVEMENT_THRESHOLD = 2.0  # Minimum 2 point movement for totals

# Tracking (files stored in monitor-data directory)
ALERTED_CONTRACTS = set()
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_data_dir = os.path.join(_base_dir, "monitor-data")
os.makedirs(_data_dir, exist_ok=True)  # Ensure directory exists
LINE_MOVEMENTS_FILE = os.path.join(_data_dir, "line_movements.json")
ORIGINAL_LINES_FILE = os.path.join(_data_dir, "original_lines.json")

# Discord webhook (optional)
DISCORD_WEBHOOK_URL = os.getenv('DISCORD_WEBHOOK_URL')

# Stats integration for projections
try:
    from stats_integration import StatsIntegration
    STATS_AVAILABLE = True
except ImportError:
    STATS_AVAILABLE = False
    print("⚠️  Stats integration not available. Install nba_api and beautifulsoup4 for projections.")


class DiscordNotifier:
    """Handles Discord webhook notifications"""
    
    def __init__(self, webhook_url: str = None, monitor_instance=None):
        """
        Initialize Discord notifier
        
        Args:
            webhook_url: Discord webhook URL (or set DISCORD_WEBHOOK_URL env var)
        """
        self.webhook_url = webhook_url or DISCORD_WEBHOOK_URL
        self.enabled = bool(self.webhook_url and REQUESTS_AVAILABLE)
        self.monitor_instance = monitor_instance  # Reference to monitor for accessing stats
        
        # Debug: Log Discord webhook status
        if self.webhook_url:
            print(f"✓ Discord webhook configured: {self.webhook_url[:30]}... (enabled: {self.enabled})")
        else:
            print("⚠️  Discord webhook not configured. Set DISCORD_WEBHOOK_URL env var or use --discord-webhook")
    
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
            print("⚠️  Discord webhook not enabled (no webhook URL or requests library unavailable)")
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
            print(f"✓ Discord webhook notification sent successfully")
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Error sending Discord webhook: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    print(f"   Discord API Error: {error_detail}")
                except:
                    print(f"   HTTP Status: {e.response.status_code}")
                    if e.response.text:
                        print(f"   Response: {e.response.text[:200]}")
        except Exception as e:
            print(f"⚠️  Unexpected error sending Discord webhook: {e}")
            import traceback
            traceback.print_exc()
    
    def send_json_file(self, file_path: str, file_type: str = "original_lines"):
        """
        Send each game's totals and projections as separate Discord webhook notifications
        
        Args:
            file_path: Path to the JSON file
            file_type: Type of file (for display purposes)
        """
        if not self.enabled:
            print("⚠️  Discord webhook not enabled (no webhook URL or requests library unavailable)")
            return False
        
        if not os.path.exists(file_path):
            print(f"⚠️  File not found: {file_path}")
            return False
        
        try:
            # Read the JSON file
            with open(file_path, 'r') as f:
                json_data = json.load(f)
            
            games = json_data.get('games', {})
            if not games:
                print("⚠️  No games found in original_lines.json")
                return False
            
            print(f"📤 Sending {len(games)} game notifications to Discord...")
            
            # Send a separate notification for each game
            sent_count = 0
            for game_id, game in games.items():
                home_team = game.get('home_team', 'Unknown')
                away_team = game.get('away_team', 'Unknown')
                sport_display = game.get('sport_display', game.get('sport', 'Unknown').replace('_', ' ').title())
                
                # Create notification in the style of line movement alerts
                title = "📊 Game Lines"
                description = f"**{away_team} @ {home_team}**"
                
                fields = []
                
                # Add sport
                fields.append({
                    'name': 'Sport',
                    'value': sport_display,
                    'inline': True
                })
                
                # Add game time
                game_time = game.get('game_time', '')
                if game_time:
                    try:
                        dt = datetime.fromisoformat(game_time.replace('Z', '+00:00'))
                        readable_time = dt.strftime("%Y-%m-%d %H:%M:%S")
                    except:
                        readable_time = game_time
                    fields.append({
                        'name': 'Game Time',
                        'value': readable_time,
                        'inline': True
                    })
                
                # Add spreads
                spreads = game.get('spreads', {})
                if spreads:
                    spread_list = []
                    for spread_key, spread_data in spreads.items():
                        spread_value = spread_data.get('spread', spread_key)
                        bookmakers = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmakers)
                        favored = spread_data.get('favored_team', '')
                        spread_list.append(f"**{spread_value:.1f}** ({bookmakers_str})")
                        if favored:
                            spread_list[-1] += f" - Favored: {favored}"
                    
                    fields.append({
                        'name': 'Spread',
                        'value': '\n'.join(spread_list),
                        'inline': False
                    })
                
                # Add totals
                totals = game.get('totals', {})
                if totals:
                    total_list = []
                    for total_key, total_data in totals.items():
                        total_value = total_data.get('total', total_key)
                        bookmakers = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                        bookmakers_str = ', '.join(bookmakers)
                        total_list.append(f"**{total_value:.1f}** - Bookmaker: {bookmakers_str}")
                    
                    fields.append({
                        'name': 'Total',
                        'value': '\n'.join(total_list),
                        'inline': False
                    })
                
                # Add team defensive stats if available
                if self.monitor_instance and self.monitor_instance.stats:
                    sport = game.get('sport', '')
                    if 'basketball_nba' in sport:
                        # Get team stats for both teams
                        home_stats = self.monitor_instance.stats.get_team_stats_nba(home_team)
                        away_stats = self.monitor_instance.stats.get_team_stats_nba(away_team)
                        
                        if home_stats and away_stats:
                            home_opp_ppg = home_stats.get('opp_ppg')
                            away_opp_ppg = away_stats.get('opp_ppg')
                            home_def_rating = home_stats.get('def_rating')
                            away_def_rating = away_stats.get('def_rating')
                            
                            # Add defensive stats fields
                            home_def_text = ""
                            if home_opp_ppg is not None:
                                home_def_text += f"Allows {home_opp_ppg:.1f} PPG"
                            if home_def_rating is not None:
                                if home_def_text:
                                    home_def_text += f" | DRtg: {home_def_rating:.1f}"
                                else:
                                    home_def_text = f"DRtg: {home_def_rating:.1f}"
                            
                            away_def_text = ""
                            if away_opp_ppg is not None:
                                away_def_text += f"Allows {away_opp_ppg:.1f} PPG"
                            if away_def_rating is not None:
                                if away_def_text:
                                    away_def_text += f" | DRtg: {away_def_rating:.1f}"
                                else:
                                    away_def_text = f"DRtg: {away_def_rating:.1f}"
                            
                            if home_def_text:
                                fields.append({
                                    'name': f'🛡️ {home_team} Defense',
                                    'value': home_def_text,
                                    'inline': True
                                })
                            if away_def_text:
                                fields.append({
                                    'name': f'🛡️ {away_team} Defense',
                                    'value': away_def_text,
                                    'inline': True
                                })
                
                # Add projection if available
                projection = game.get('projection')
                if projection:
                    proj_total = projection.get('projected_total')
                    if proj_total:
                        fields.append({
                            'name': '📊 Projected Total',
                            'value': f"{proj_total:.1f} ({projection.get('confidence', 'medium')} confidence)",
                            'inline': False
                        })
                        
                        # Add justifications
                        justifications = projection.get('justification', [])
                        if justifications:
                            justification_text = '\n'.join(justifications[:5])  # First 5 justifications
                            fields.append({
                                'name': 'Justification',
                                'value': justification_text,
                                'inline': False
                            })
                
                # Color: blue for data updates
                color = 0x3498db
                
                # Send notification for this game
                self.send_webhook(title, description, color, fields)
                sent_count += 1
                
                # Small delay between notifications to avoid rate limiting
                time.sleep(0.5)
            
            print(f"✓ Sent {sent_count} game notifications to Discord")
            return True
                
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Error sending JSON file to Discord: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    print(f"   Discord API Error: {error_detail}")
                except:
                    print(f"   HTTP Status: {e.response.status_code}")
        except Exception as e:
            print(f"⚠️  Unexpected error sending JSON file: {e}")
            import traceback
            traceback.print_exc()
        
        return False
    
    def _send_json_summary(self, json_data: Dict, file_type: str, file_path: str):
        """Send a summary of large JSON files"""
        try:
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024 * 1024)
            
            embed = {
                'title': f'📊 {file_type.replace("_", " ").title()} Summary',
                'description': f'**File:** `{os.path.basename(file_path)}`\n**Size:** {file_size_mb:.2f} MB (too large to send)\n**Last Updated:** {json_data.get("last_updated", "N/A")}',
                'color': 0x3498db,
                'timestamp': datetime.now().isoformat(),
                'fields': []
            }
            
            # Add summary stats
            if 'games' in json_data:
                games = json_data.get('games', {})
                embed['fields'].append({
                    'name': 'Total Games',
                    'value': str(json_data.get('total_games', len(games))),
                    'inline': True
                })
                
                # Show sample of games
                if games:
                    sample_games = list(games.values())[:5]
                    game_list = []
                    for game in sample_games:
                        matchup = f"{game.get('away_team', 'Away')} @ {game.get('home_team', 'Home')}"
                        game_list.append(f"• {matchup}")
                    
                    if len(games) > 5:
                        game_list.append(f"... and {len(games) - 5} more games")
                    
                    embed['fields'].append({
                        'name': 'Sample Games',
                        'value': '\n'.join(game_list),
                        'inline': False
                    })
            
            if 'player_props' in json_data:
                props = json_data.get('player_props', {})
                embed['fields'].append({
                    'name': 'Total Props',
                    'value': str(json_data.get('total_props', len(props))),
                    'inline': True
                })
            
            payload = {
                'embeds': [embed]
            }
            
            response = requests.post(self.webhook_url, json=payload, timeout=30)
            response.raise_for_status()
            print(f"✓ Sent {file_type} summary to Discord (file too large: {file_size_mb:.2f} MB)")
            return True
            
        except Exception as e:
            print(f"⚠️  Error sending JSON summary: {e}")
            return False
    
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
        
        title = f"{direction_emoji} Spread Movement Alert"
        description = f"**{away_team} @ {home_team}**"
        
        fields = [
            {'name': 'Previous Spread', 'value': f"{first_movement['old_spread']:.1f}", 'inline': True},
            {'name': 'New Spread', 'value': f"{first_movement['new_spread']:.1f}", 'inline': True},
            {'name': 'Change', 'value': f"{first_movement['movement']:+.1f} points", 'inline': True},
            {'name': 'Direction', 'value': first_movement.get('direction', 'unknown').title(), 'inline': True},
            {'name': 'Bookmaker', 'value': bookmakers_str, 'inline': False},
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
        
        title = f"{direction_emoji} Total Movement Alert"
        description = f"**{away_team} @ {home_team}**"
        
        fields = [
            {'name': 'Previous Total', 'value': f"{first_movement['old_total']:.1f}", 'inline': True},
            {'name': 'New Total', 'value': f"{first_movement['new_total']:.1f}", 'inline': True},
            {'name': 'Change', 'value': f"{first_movement['movement']:+.1f} points", 'inline': True},
            {'name': 'Direction', 'value': first_movement.get('direction', 'unknown').title(), 'inline': True},
            {'name': 'Bookmaker', 'value': bookmakers_str, 'inline': False},
            {'name': 'Time', 'value': first_movement.get('readable_timestamp', 'N/A'), 'inline': True}
        ]
        
        # Add team defensive stats if available
        if self.monitor_instance and self.monitor_instance.stats:
            sport = game.get('sport', '')
            if 'basketball_nba' in sport:
                # Get team stats for both teams
                home_stats = self.monitor_instance.stats.get_team_stats_nba(home_team)
                away_stats = self.monitor_instance.stats.get_team_stats_nba(away_team)
                
                if home_stats and away_stats:
                    home_opp_ppg = home_stats.get('opp_ppg')
                    away_opp_ppg = away_stats.get('opp_ppg')
                    home_def_rating = home_stats.get('def_rating')
                    away_def_rating = away_stats.get('def_rating')
                    
                    # Add defensive stats fields
                    home_def_text = ""
                    if home_opp_ppg is not None:
                        home_def_text += f"Allows {home_opp_ppg:.1f} PPG"
                    if home_def_rating is not None:
                        if home_def_text:
                            home_def_text += f" | DRtg: {home_def_rating:.1f}"
                        else:
                            home_def_text = f"DRtg: {home_def_rating:.1f}"
                    
                    away_def_text = ""
                    if away_opp_ppg is not None:
                        away_def_text += f"Allows {away_opp_ppg:.1f} PPG"
                    if away_def_rating is not None:
                        if away_def_text:
                            away_def_text += f" | DRtg: {away_def_rating:.1f}"
                        else:
                            away_def_text = f"DRtg: {away_def_rating:.1f}"
                    
                    if home_def_text:
                        fields.append({
                            'name': f'🛡️ {home_team} Defense',
                            'value': home_def_text,
                            'inline': True
                        })
                    if away_def_text:
                        fields.append({
                            'name': f'🛡️ {away_team} Defense',
                            'value': away_def_text,
                            'inline': True
                        })
        
        # Add projection if available
        game_id = game.get('id')
        if game_id and self.monitor_instance and self.monitor_instance.stats:
            original_lines_data = self.monitor_instance.load_original_lines()
            game_entry = original_lines_data.get('games', {}).get(game_id)
            if game_entry and 'projection' in game_entry:
                proj = game_entry['projection']
                proj_total = proj.get('projected_total')
                if proj_total:
                    fields.append({
                        'name': '📊 Projected Total',
                        'value': f"{proj_total:.1f} ({proj.get('confidence', 'medium')} confidence)",
                        'inline': False
                    })
                    # Add justifications
                    justifications = proj.get('justification', [])
                    if justifications:
                        justification_text = '\n'.join(justifications[:3])  # First 3 justifications
                        fields.append({
                            'name': 'Justification',
                            'value': justification_text,
                            'inline': False
                        })
        
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
        
        # Initialize stats integration for projections
        if STATS_AVAILABLE:
            self.stats = StatsIntegration()
        else:
            self.stats = None
        
        # Initialize Discord notifier with reference to this monitor instance
        self.discord = DiscordNotifier(webhook_url=discord_webhook, monitor_instance=self)
    
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
        
        games_documented = 0
        games_already_existing = 0
        games_no_odds = 0
        
        for game in current_games:
            game_id = game.get('id', 'unknown')
            home_team = game.get('home_team', 'Unknown')
            away_team = game.get('away_team', 'Unknown')
            commence_time = game.get('commence_time', '')
            sport_display = game.get('sport_display', 'Unknown')
            
            # Get odds from all bookmakers for this game
            bookmaker_odds = self.get_all_bookmaker_odds(game)
            
            if not bookmaker_odds:
                games_no_odds += 1
                # Debug: Check if game has bookmakers in API response
                api_bookmakers = game.get('bookmakers', [])
                if api_bookmakers:
                    bookmaker_keys = [b.get('key', 'unknown') for b in api_bookmakers]
                    print(f"⚠️  Skipping {away_team} @ {home_team} ({sport_display}): No odds from configured bookmakers")
                    print(f"   API has bookmakers: {', '.join(bookmaker_keys)}")
                    print(f"   Configured bookmakers: {', '.join(self.bookmakers)}")
                else:
                    print(f"⚠️  Skipping {away_team} @ {home_team} ({sport_display}): No bookmakers in API response")
                continue
            
            # Load original lines data (single source of truth)
            original_lines_data = self.load_original_lines()
            games = original_lines_data.get('games', {})
            game_entry = games.get(game_id)
            
            if game_entry is None:
                # First time seeing this game - document it
                self.document_original_lines(game, bookmaker_odds, current_time)
                games_documented += 1
                # Reload to get the updated data
                original_lines_data = self.load_original_lines()
                game_entry = original_lines_data['games'][game_id]
            else:
                games_already_existing += 1
                # Check if projection is missing and add it if stats integration is available
                if 'projection' not in game_entry and self.stats:
                    game_home_team = game_entry.get('home_team', home_team)
                    game_away_team = game_entry.get('away_team', away_team)
                    game_sport = game_entry.get('sport', game.get('sport', 'basketball_nba'))
                    sport_key = game_sport.replace('basketball_', '').replace('football_', '').replace('_', '')
                    if sport_key == 'nba':
                        sport_key = 'nba'
                    elif sport_key == 'nfl':
                        sport_key = 'nfl'
                    elif 'college' in sport_key or 'ncaa' in sport_key:
                        if 'basketball' in sport_key:
                            sport_key = 'ncaab'
                        elif 'football' in sport_key:
                            sport_key = 'ncaaf'
                    
                    projection = self.stats.project_game_total(game_home_team, game_away_team, sport_key)
                    if projection.get('projected_total'):
                        game_entry['projection'] = {
                            'projected_total': projection['projected_total'],
                            'confidence': projection.get('confidence', 'medium'),
                            'justification': projection.get('justification', [])
                        }
                        # Save the updated game entry
                        original_lines_data['games'][game_id] = game_entry
                        original_lines_data['last_updated'] = current_time
                        self.save_original_lines(original_lines_data)
                        print(f"  📊 Added Projected Total for {game_away_team} @ {game_home_team}: {projection['projected_total']:.1f} ({projection.get('confidence', 'medium')} confidence)")
                # Check if we need to add new bookmakers (handle both old and new structure)
                # Old structure has 'bookmakers' dict, new structure has 'spreads' and 'totals'
                if 'bookmakers' in game_entry:
                    # Migrate old structure to new structure
                    spreads_dict = {}
                    totals_dict = {}
                    for bookmaker_key, bookmaker_data in game_entry.get('bookmakers', {}).items():
                        spread = bookmaker_data.get('original_spread')
                        total = bookmaker_data.get('original_total')
                        if spread is not None:
                            spread_key = str(spread)
                            if spread_key not in spreads_dict:
                                spreads_dict[spread_key] = {
                                    'spread': spread,
                                    'favored_team': bookmaker_data.get('favored_team'),
                                    'bookmakers': []
                                }
                            spreads_dict[spread_key]['bookmakers'].append({
                                'bookmaker': bookmaker_key,
                                'bookmaker_name': bookmaker_data.get('bookmaker_name', self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key))
                            })
                        if total is not None:
                            total_key = str(total)
                            if total_key not in totals_dict:
                                totals_dict[total_key] = {
                                    'total': total,
                                    'bookmakers': []
                                }
                            totals_dict[total_key]['bookmakers'].append({
                                'bookmaker': bookmaker_key,
                                'bookmaker_name': bookmaker_data.get('bookmaker_name', self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key))
                            })
                    game_entry['spreads'] = spreads_dict
                    game_entry['totals'] = totals_dict
                    # Remove old structure
                    if 'bookmakers' in game_entry:
                        del game_entry['bookmakers']
                    # Save migrated structure
                    original_lines_data['last_updated'] = current_time
                    self.save_original_lines(original_lines_data)
                
                # Check if we need to add new bookmakers to existing groups
                updated = False
                for bookmaker_key, odds in bookmaker_odds.items():
                    # Check if bookmaker exists in any spread group
                    bookmaker_in_spread = False
                    for spread_key, spread_data in game_entry.get('spreads', {}).items():
                        if any(b['bookmaker'] == bookmaker_key for b in spread_data.get('bookmakers', [])):
                            bookmaker_in_spread = True
                            break
                    
                    # Check if bookmaker exists in any total group
                    bookmaker_in_total = False
                    for total_key, total_data in game_entry.get('totals', {}).items():
                        if any(b['bookmaker'] == bookmaker_key for b in total_data.get('bookmakers', [])):
                            bookmaker_in_total = True
                            break
                    
                    if not bookmaker_in_spread or not bookmaker_in_total:
                        # Need to add this bookmaker
                        self.document_original_lines(game, {bookmaker_key: odds}, current_time)
                        updated = True
                
                if updated:
                    # Reload to get the updated data
                    original_lines_data = self.load_original_lines()
                    game_entry = original_lines_data['games'][game_id]
            
            # Now check for movements using current values from line_movements.json
                movement_occurred = False
                
            # Load current lines for movement tracking
            movements_data = self.load_line_movements()
            current_lines = movements_data.get('current_lines', {})
            
            # Initialize current_lines entry for this game if it doesn't exist
            if game_id not in current_lines:
                current_lines[game_id] = {
                    'spreads': {},  # Track current spread per bookmaker
                    'totals': {}   # Track current total per bookmaker
                }
            
            game_current_lines = current_lines[game_id]
            
            # Group current bookmaker odds by spread/total for comparison
            # We need to compare against original lines (grouped) and track current values per bookmaker
                spread_movements = []  # List of all spread movements
                total_movements = []   # List of all total movements
                
                for bookmaker_key, odds in bookmaker_odds.items():
                    new_spread = odds.get('spread')
                    new_total = odds.get('total')
                    new_favored_team = odds.get('favored_team')
                    
                # Get old values from current_lines tracking
                old_spread = game_current_lines['spreads'].get(bookmaker_key)
                old_total = game_current_lines['totals'].get(bookmaker_key)
                
                # If no current value, get from original lines (first time seeing this bookmaker)
                if old_spread is None:
                    # Try new structure first (grouped spreads)
                    for spread_key, spread_data in game_entry.get('spreads', {}).items():
                        if any(b['bookmaker'] == bookmaker_key for b in spread_data.get('bookmakers', [])):
                            old_spread = spread_data.get('spread')
                            break
                    
                    # Fallback to old structure if new structure not found
                    if old_spread is None and 'bookmakers' in game_entry:
                        bookmaker_entry = game_entry['bookmakers'].get(bookmaker_key)
                        if bookmaker_entry:
                            old_spread = bookmaker_entry.get('original_spread')
                
                if old_total is None:
                    # Try new structure first (grouped totals)
                    for total_key, total_data in game_entry.get('totals', {}).items():
                        if any(b['bookmaker'] == bookmaker_key for b in total_data.get('bookmakers', [])):
                            old_total = total_data.get('total')
                            break
                    
                    # Fallback to old structure if new structure not found
                    if old_total is None and 'bookmakers' in game_entry:
                        bookmaker_entry = game_entry['bookmakers'].get(bookmaker_key)
                        if bookmaker_entry:
                            old_total = bookmaker_entry.get('original_total')
                
                    # Check spread movement
                    if new_spread is not None and old_spread is not None:
                        spread_change = abs(new_spread - old_spread)
                        if spread_change >= SPREAD_MOVEMENT_THRESHOLD:
                        # Get old favored team from original lines
                        old_favored_team = None
                        for spread_key, spread_data in game_entry.get('spreads', {}).items():
                            if any(b['bookmaker'] == bookmaker_key for b in spread_data.get('bookmakers', [])):
                                old_favored_team = spread_data.get('favored_team')
                                break
                        
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
                            
                        # Document the movement
                            self.document_movement(game, 'spread', movement, bookmaker_key)
                            
                            # Collect for grouping
                            spread_movements.append(movement)
                            movement_occurred = True
                        # Update current value in current_lines tracking
                        game_current_lines['spreads'][bookmaker_key] = new_spread
                        else:
                            # No significant movement, but still update current value for next comparison
                        if new_spread is not None:
                            game_current_lines['spreads'][bookmaker_key] = new_spread
                    elif new_spread is not None:
                        # First time seeing this spread value, update it
                    game_current_lines['spreads'][bookmaker_key] = new_spread
                    
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
                            
                        # Document the movement
                            self.document_movement(game, 'total', movement, bookmaker_key)
                            
                            # Collect for grouping
                            total_movements.append(movement)
                            movement_occurred = True
                        # Update current value in current_lines tracking
                        game_current_lines['totals'][bookmaker_key] = new_total
                        else:
                            # No significant movement, but still update current value for next comparison
                        if new_total is not None:
                            game_current_lines['totals'][bookmaker_key] = new_total
                    elif new_total is not None:
                        # First time seeing this total value, update it
                    game_current_lines['totals'][bookmaker_key] = new_total
                    
            # Save updated current values to line_movements.json
            if movement_occurred or any(odds.get('spread') is not None or odds.get('total') is not None 
                                       for odds in bookmaker_odds.values()):
                movements_data['current_lines'] = current_lines
                movements_data['last_updated'] = current_time
                self.save_line_movements(movements_data)
                
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
                
        # Summary of games processed
        if games_documented > 0 or games_already_existing > 0 or games_no_odds > 0:
            print(f"\n📊 Games Summary:")
            if games_documented > 0:
                print(f"  ✓ Documented {games_documented} new game(s)")
            if games_already_existing > 0:
                print(f"  ℹ️  {games_already_existing} game(s) already in history")
            if games_no_odds > 0:
                print(f"  ⚠️  {games_no_odds} game(s) with no bookmaker odds found (see warnings above for details)")
            print()
    
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
        """Load original lines from file (consolidated with NBA player monitor)"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        if os.path.exists(ORIGINAL_LINES_FILE):
            # Check if file is empty before trying to parse
            file_size = os.path.getsize(ORIGINAL_LINES_FILE)
            if file_size == 0:
                print(f"⚠️  {ORIGINAL_LINES_FILE} is empty. Initializing with default structure...")
                default_data = {
                    'games': {},
                    'player_props': {},
                    'current_date': today,
                    'last_updated': None,
                    'total_games': 0,
                    'total_props': 0
                }
                # Save default structure
                with open(ORIGINAL_LINES_FILE, 'w') as f:
                    json.dump(default_data, f, indent=2)
                return default_data
            
            try:
                with open(ORIGINAL_LINES_FILE, 'r') as f:
                    content = f.read().strip()
                    if not content:
                        # File exists but is empty after reading
                        print(f"⚠️  {ORIGINAL_LINES_FILE} appears empty. Initializing with default structure...")
                        default_data = {
                            'games': {},
                            'player_props': {},
                            'current_date': today,
                            'last_updated': None,
                            'total_games': 0,
                            'total_props': 0
                        }
                        with open(ORIGINAL_LINES_FILE, 'w') as f:
                            json.dump(default_data, f, indent=2)
                        return default_data
                    
                    data = json.loads(content)
                    
                    # Check if it's a new day - clear old data if so
                    stored_date = data.get('current_date')
                    if stored_date != today:
                        print(f"📅 New day detected ({today}). Clearing previous day's data...")
                        # Clear games and player_props, but preserve structure
                        data = {
                            'games': {},
                            'player_props': {},
                            'current_date': today,
                            'last_updated': None,
                            'total_games': 0,
                            'total_props': 0
                        }
                        # Save the cleared data
                        with open(ORIGINAL_LINES_FILE, 'w') as f:
                            json.dump(data, f, indent=2)
                        print(f"✓ Cleared old data. Starting fresh for {today}")
                    else:
                        # Update current_date if not set
                        if 'current_date' not in data:
                            data['current_date'] = today
                    
                    # Ensure games section exists
                    if 'games' not in data:
                        data['games'] = {}
                    if 'player_props' not in data:
                        data['player_props'] = {}
                    return data
            except json.JSONDecodeError as e:
                print(f"⚠️  Error parsing JSON from {ORIGINAL_LINES_FILE}: {e}")
                print(f"   File may be corrupted. Creating backup and initializing new file...")
                # Create backup of corrupted file
                backup_path = f"{ORIGINAL_LINES_FILE}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                try:
                    import shutil
                    shutil.copy2(ORIGINAL_LINES_FILE, backup_path)
                    print(f"   Backup created: {backup_path}")
                except Exception as backup_error:
                    print(f"   Could not create backup: {backup_error}")
            except Exception as e:
                print(f"⚠️  Error loading original lines from {ORIGINAL_LINES_FILE}: {e}")
        
        # Return default structure if file doesn't exist or error occurred
        return {
            'games': {},  # For betting monitor games
            'player_props': {},  # For NBA player props
            'current_date': today,
            'last_updated': None,
            'total_games': 0,
            'total_props': 0
        }
    
    def save_original_lines(self, original_lines_data: Dict):
        """Save original lines to file (consolidated with NBA player monitor)"""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            
            # Load existing data to preserve player_props section
            existing_data = self.load_original_lines()
            # Update only the games section
            existing_data['games'] = original_lines_data.get('games', {})
            existing_data['total_games'] = len(existing_data['games'])
            existing_data['last_updated'] = original_lines_data.get('last_updated')
            existing_data['current_date'] = today  # Update date
            # Preserve player_props data if it exists
            if 'player_props' not in existing_data:
                existing_data['player_props'] = {}
            if 'total_props' not in existing_data:
                existing_data['total_props'] = len(existing_data.get('player_props', {}))
            
            with open(ORIGINAL_LINES_FILE, 'w') as f:
                json.dump(existing_data, f, indent=2)
        except Exception as e:
            print(f"Error saving original lines: {e}")
    
    def document_original_lines(self, game: Dict, bookmaker_odds: Dict, timestamp: str):
        """
        Document the original lines for a game when first discovered
        Groups bookmakers with the same spread/total together
        
        Args:
            game: Game dictionary (should include 'sport' and 'sport_display' fields)
            bookmaker_odds: Dictionary of bookmaker keys to their odds
            timestamp: ISO timestamp when lines were first seen
        """
        game_id = game.get('id', 'unknown')
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        commence_time = game.get('commence_time', '')
        sport = game.get('sport', 'unknown')
        sport_display = game.get('sport_display', sport.replace('_', ' ').title() if sport != 'unknown' else 'Unknown')
        readable_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Load existing original lines
        original_lines_data = self.load_original_lines()
        
        # Check if game already exists
        if game_id not in original_lines_data['games']:
            # Create game entry
            game_entry = {
                'game_id': game_id,
                'sport': sport,
                'sport_display': sport_display,
                'home_team': home_team,
                'away_team': away_team,
                'game_time': commence_time,
                'first_seen': timestamp,
                'first_seen_readable': readable_time,
                'spreads': {},  # Grouped by spread value
                'totals': {}    # Grouped by total value
            }
            
            # Group bookmakers by spread value
            spreads_dict = {}
            for bookmaker_key, odds in bookmaker_odds.items():
                spread = odds.get('spread')
                if spread is not None:
                    spread_key = str(spread)
                    if spread_key not in spreads_dict:
                        spreads_dict[spread_key] = {
                            'spread': spread,
                            'favored_team': odds.get('favored_team'),
                            'bookmakers': []
                        }
                bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                    spreads_dict[spread_key]['bookmakers'].append({
                        'bookmaker': bookmaker_key,
                        'bookmaker_name': bookmaker_name
                    })
            
            # Group bookmakers by total value
            totals_dict = {}
            for bookmaker_key, odds in bookmaker_odds.items():
                total = odds.get('total')
                if total is not None:
                    total_key = str(total)
                    if total_key not in totals_dict:
                        totals_dict[total_key] = {
                            'total': total,
                            'bookmakers': []
                        }
                    bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                    totals_dict[total_key]['bookmakers'].append({
                        'bookmaker': bookmaker_key,
                        'bookmaker_name': bookmaker_name
                    })
            
            game_entry['spreads'] = spreads_dict
            game_entry['totals'] = totals_dict
            game_entry['documented_at'] = timestamp
            game_entry['documented_at_readable'] = readable_time
            
            # Calculate game total projection if stats integration is available
            if self.stats:
                sport_key = sport.replace('basketball_', '').replace('football_', '').replace('_', '')
                if sport_key == 'nba':
                    sport_key = 'nba'
                elif sport_key == 'nfl':
                    sport_key = 'nfl'
                elif 'college' in sport_key or 'ncaa' in sport_key:
                    if 'basketball' in sport_key:
                        sport_key = 'ncaab'
                    elif 'football' in sport_key:
                        sport_key = 'ncaaf'
                
                projection = self.stats.project_game_total(home_team, away_team, sport_key)
                if projection.get('projected_total'):
                    game_entry['projection'] = {
                        'projected_total': projection['projected_total'],
                        'confidence': projection.get('confidence', 'medium'),
                        'justification': projection.get('justification', [])
                    }
                    print(f"  📊 Projected Total: {projection['projected_total']:.1f} ({projection.get('confidence', 'medium')} confidence)")
                    for justification in projection.get('justification', [])[:3]:  # Show first 3 justifications
                        print(f"     • {justification}")
            
            original_lines_data['games'][game_id] = game_entry
            original_lines_data['last_updated'] = timestamp
            original_lines_data['total_games'] = len(original_lines_data['games'])
            
            # Save to file
            self.save_original_lines(original_lines_data)
            
            # Format bookmakers display (grouped by spread/total)
            bookmaker_display = []
            for spread_key, spread_data in game_entry.get('spreads', {}).items():
                bookmaker_names = [b['bookmaker_name'] for b in spread_data.get('bookmakers', [])]
                if len(bookmaker_names) > 1:
                    bookmaker_display.append(f"Spread {spread_data['spread']:.1f}: {', '.join(bookmaker_names)}")
                else:
                    bookmaker_display.append(f"Spread {spread_data['spread']:.1f}: {bookmaker_names[0] if bookmaker_names else 'Unknown'}")
            
            for total_key, total_data in game_entry.get('totals', {}).items():
                bookmaker_names = [b['bookmaker_name'] for b in total_data.get('bookmakers', [])]
                if len(bookmaker_names) > 1:
                    bookmaker_display.append(f"Total {total_data['total']:.1f}: {', '.join(bookmaker_names)}")
                else:
                    bookmaker_display.append(f"Total {total_data['total']:.1f}: {bookmaker_names[0] if bookmaker_names else 'Unknown'}")
            
            print(f"✓ Documented original lines for: {away_team} @ {home_team} ({sport_display})")
            for display in bookmaker_display:
                print(f"  {display}")
            print(f"  Saved to: {ORIGINAL_LINES_FILE}")
        else:
            # Game exists, check if we need to add new bookmakers to existing groups
            game_entry = original_lines_data['games'][game_id]
            updated = False
            
            # Ensure spreads and totals dictionaries exist
            if 'spreads' not in game_entry:
                game_entry['spreads'] = {}
            if 'totals' not in game_entry:
                game_entry['totals'] = {}
            
            # Add new bookmakers to spread groups
            for bookmaker_key, odds in bookmaker_odds.items():
                spread = odds.get('spread')
                if spread is not None:
                    spread_key = str(spread)
                    bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                    
                    # Check if this bookmaker is already in any spread group
                    bookmaker_exists = False
                    for existing_spread_key, spread_data in game_entry['spreads'].items():
                        if any(b['bookmaker'] == bookmaker_key for b in spread_data.get('bookmakers', [])):
                            bookmaker_exists = True
                            break
                    
                    if not bookmaker_exists:
                        if spread_key not in game_entry['spreads']:
                            game_entry['spreads'][spread_key] = {
                                'spread': spread,
                                'favored_team': odds.get('favored_team'),
                                'bookmakers': []
                            }
                        game_entry['spreads'][spread_key]['bookmakers'].append({
                            'bookmaker': bookmaker_key,
                            'bookmaker_name': bookmaker_name
                        })
                    updated = True
                
                total = odds.get('total')
                if total is not None:
                    total_key = str(total)
                    bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                    
                    # Check if this bookmaker is already in any total group
                    bookmaker_exists = False
                    for existing_total_key, total_data in game_entry['totals'].items():
                        if any(b['bookmaker'] == bookmaker_key for b in total_data.get('bookmakers', [])):
                            bookmaker_exists = True
                            break
                    
                    if not bookmaker_exists:
                        if total_key not in game_entry['totals']:
                            game_entry['totals'][total_key] = {
                                'total': total,
                                'bookmakers': []
                            }
                        game_entry['totals'][total_key]['bookmakers'].append({
                            'bookmaker': bookmaker_key,
                            'bookmaker_name': bookmaker_name
                        })
                        updated = True
            
            # Check if projection is missing and add it if stats integration is available
            if 'projection' not in game_entry and self.stats:
                # Get sport from game_entry if not in current game data
                game_sport = game_entry.get('sport', sport)
                sport_key = game_sport.replace('basketball_', '').replace('football_', '').replace('_', '')
                if sport_key == 'nba':
                    sport_key = 'nba'
                elif sport_key == 'nfl':
                    sport_key = 'nfl'
                elif 'college' in sport_key or 'ncaa' in sport_key:
                    if 'basketball' in sport_key:
                        sport_key = 'ncaab'
                    elif 'football' in sport_key:
                        sport_key = 'ncaaf'
                
                projection = self.stats.project_game_total(home_team, away_team, sport_key)
                if projection.get('projected_total'):
                    game_entry['projection'] = {
                        'projected_total': projection['projected_total'],
                        'confidence': projection.get('confidence', 'medium'),
                        'justification': projection.get('justification', [])
                    }
                    updated = True
                    print(f"  📊 Added Projected Total: {projection['projected_total']:.1f} ({projection.get('confidence', 'medium')} confidence)")
            
            if updated:
                # Also update sport info if it wasn't set before
                if 'sport' not in game_entry or game_entry.get('sport') == 'unknown':
                    game_entry['sport'] = sport
                    game_entry['sport_display'] = sport_display
                
                original_lines_data['last_updated'] = timestamp
                self.save_original_lines(original_lines_data)
                print(f"✓ Updated original lines for: {away_team} @ {home_team} ({sport_display}) (new bookmakers added)")
    
    def load_line_movements(self) -> Dict:
        """Load line movements from file (consolidated with NBA player monitor)"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        if os.path.exists(LINE_MOVEMENTS_FILE):
            try:
                with open(LINE_MOVEMENTS_FILE, 'r') as f:
                    data = json.load(f)
                    
                    # Check if it's a new day - clear old data if so
                    stored_date = data.get('current_date')
                    if stored_date != today:
                        print(f"📅 New day detected ({today}). Clearing previous day's movements...")
                        # Clear movements and current_lines, but preserve structure
                        data = {
                            'game_movements': [],
                            'player_prop_movements': [],
                            'current_lines': {},  # Clear current tracking for new day
                            'current_date': today,
                            'last_updated': None,
                            'total_movements': 0
                        }
                        # Save the cleared data
                        with open(LINE_MOVEMENTS_FILE, 'w') as f:
                            json.dump(data, f, indent=2)
                        print(f"✓ Cleared old movements. Starting fresh for {today}")
                    else:
                        # Update current_date if not set
                        if 'current_date' not in data:
                            data['current_date'] = today
                    
                    # Return game_movements section, or create it if doesn't exist
                    if 'game_movements' not in data:
                        data['game_movements'] = []
                    if 'player_prop_movements' not in data:
                        data['player_prop_movements'] = []
                    if 'current_lines' not in data:
                        data['current_lines'] = {}
                    return data
            except Exception as e:
                print(f"Error loading line movements: {e}")
        
        return {
            'game_movements': [],  # For betting monitor movements
            'player_prop_movements': [],  # For NBA player prop movements
            'current_lines': {},  # Track current spread/total values for movement detection
            'current_date': today,
            'last_updated': None,
            'total_movements': 0
        }
    
    def save_line_movements(self, movements_data: Dict):
        """Save line movements to file (consolidated with NBA player monitor)"""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            
            # Load existing data to preserve player_prop_movements section
            existing_data = self.load_line_movements()
            # Update game_movements and current_lines
            existing_data['game_movements'] = movements_data.get('game_movements', [])
            existing_data['current_lines'] = movements_data.get('current_lines', existing_data.get('current_lines', {}))
            existing_data['last_updated'] = movements_data.get('last_updated', datetime.now().isoformat())
            existing_data['current_date'] = today  # Update date
            # Calculate total movements
            total_game_movements = len(existing_data['game_movements'])
            total_prop_movements = len(existing_data.get('player_prop_movements', []))
            existing_data['total_movements'] = total_game_movements + total_prop_movements
            # Preserve player_prop_movements if it exists
            if 'player_prop_movements' not in existing_data:
                existing_data['player_prop_movements'] = []
            
            with open(LINE_MOVEMENTS_FILE, 'w') as f:
                json.dump(existing_data, f, indent=2)
        except Exception as e:
            print(f"⚠️  Error saving line movements: {e}")
            import traceback
            traceback.print_exc()
    
    def document_movement(self, game: Dict, movement_type: str, movement: Dict, bookmaker_key: str):
        """
        Document a significant movement in a separate line movements file
        Consolidates bookmakers with the same movement into one entry
        
        Args:
            game: Game dictionary
            movement_type: 'spread' or 'total'
            movement: Movement dictionary with timestamp and values
            bookmaker_key: The bookmaker that had the movement
        """
        game_id = game.get('id', 'unknown')
        home_team = game.get('home_team', 'Unknown')
        away_team = game.get('away_team', 'Unknown')
        bookmaker_name = movement.get('bookmaker_name', self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key))
        commence_time = game.get('commence_time', '')
        sport = game.get('sport', 'unknown')
        sport_display = game.get('sport_display', sport.replace('_', ' ').title() if sport != 'unknown' else 'Unknown')
        
        # Load existing movements
        movements_data = self.load_line_movements()
        game_movements = movements_data.get('game_movements', [])
        
        previous_value = movement.get(f'old_{movement_type}')
        new_value = movement.get(f'new_{movement_type}')
        movement_amount = movement['movement']
        
        # Check if there's already a movement entry with the same values for this game
        # Group by: game_id, type, previous_value, new_value, movement_amount
        existing_movement = None
        for existing in game_movements:
            if (existing.get('game_id') == game_id and
                existing.get('type') == movement_type and
                existing.get('previous_value') == previous_value and
                existing.get('new_value') == new_value and
                existing.get('change') == movement_amount):
                existing_movement = existing
                break
        
        if existing_movement:
            # Add this bookmaker to the existing movement's bookmakers list
            if 'bookmakers' not in existing_movement:
                # Convert old single bookmaker format to list format
                existing_movement['bookmakers'] = [{
                    'bookmaker': existing_movement.get('bookmaker', 'unknown'),
                    'bookmaker_name': existing_movement.get('bookmaker_name', 'Unknown')
                }]
                # Remove old single bookmaker fields
                if 'bookmaker' in existing_movement:
                    del existing_movement['bookmaker']
                if 'bookmaker_name' in existing_movement:
                    del existing_movement['bookmaker_name']
            
            # Check if this bookmaker is already in the list
            bookmaker_exists = any(b.get('bookmaker') == bookmaker_key for b in existing_movement['bookmakers'])
            if not bookmaker_exists:
                existing_movement['bookmakers'].append({
                    'bookmaker': bookmaker_key,
                    'bookmaker_name': bookmaker_name
                })
        else:
            # Create new movement entry with bookmakers list
        movement_entry = {
            'game_id': game_id,
                'sport': sport,
                'sport_display': sport_display,
            'home_team': home_team,
            'away_team': away_team,
            'game_time': commence_time,
            'type': movement_type,
                'bookmakers': [{
            'bookmaker': bookmaker_key,
                    'bookmaker_name': bookmaker_name
                }],
            'detected_at': movement['timestamp'],
            'detected_at_readable': movement['readable_timestamp'],
                'previous_value': previous_value,
                'new_value': new_value,
                'change': movement_amount,
            'absolute_change': movement['absolute_movement'],
            'direction': movement['direction']
        }
        
        # Add spread-specific movement direction if available
        if movement_type == 'spread' and 'movement_towards' in movement:
            movement_entry['movement_towards'] = movement['movement_towards']
            movement_entry['old_favored_team'] = movement.get('old_favored_team')
            movement_entry['new_favored_team'] = movement.get('new_favored_team')
        
        # Add to movements list
            game_movements.append(movement_entry)
        
        movements_data['game_movements'] = game_movements
        movements_data['last_updated'] = datetime.now().isoformat()
        # Calculate total (game movements + prop movements)
        total_prop_movements = len(movements_data.get('player_prop_movements', []))
        movements_data['total_movements'] = len(game_movements) + total_prop_movements
        
        # Save to consolidated file
        self.save_line_movements(movements_data)
        
        # Get the movement entry (either existing or newly created)
        # If existing_movement was found, use it; otherwise movement_entry was already created in the else block
        if existing_movement:
            movement_entry = existing_movement
        
        # Format bookmakers for display
        bookmaker_list = movement_entry.get('bookmakers', [])
        bookmaker_names = [b['bookmaker_name'] for b in bookmaker_list]
        bookmakers_str = ', '.join(bookmaker_names) if len(bookmaker_names) > 1 else bookmaker_names[0]
        
        print(f"✓ Documented {movement_type} movement (Bookmaker: {bookmakers_str}): {away_team} @ {home_team}")
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
        print(f"📊 SPREAD ALERT [{timestamp}]")
        print(f"Game: {away_team} @ {home_team}")
        print(f"Bookmaker: {bookmakers_str}")
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
        print(f"📊 TOTAL ALERT [{timestamp}]")
        print(f"Game: {away_team} @ {home_team}")
        print(f"Bookmaker: {bookmakers_str}")
        print(f"Previous Total: {first_movement['old_total']:.1f}")
        print(f"New Total: {first_movement['new_total']:.1f}")
        print(f"Change: {first_movement['movement']:+.1f} points ({first_movement.get('direction', 'unknown')})")
        
        # Add projection if available
        game_id = game.get('id')
        if game_id and self.stats:
            original_lines_data = self.load_original_lines()
            game_entry = original_lines_data.get('games', {}).get(game_id)
            if game_entry and 'projection' in game_entry:
                proj = game_entry['projection']
                proj_total = proj.get('projected_total')
                if proj_total:
                    print(f"📊 Projected Total: {proj_total:.1f} ({proj.get('confidence', 'medium')} confidence)")
                    justifications = proj.get('justification', [])
                    if justifications:
                        print(f"   Justification:")
                        for j in justifications[:3]:
                            print(f"   • {j}")
        
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
        log_file = os.path.join(_data_dir, "sportsbook_alerts.log")
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
    
    def select_sports(self) -> List[str]:
        """
        Interactive sport selection menu
        
        Returns:
            List of selected sport keys
        """
        # Available sports with their display names
        available_sports = {
            '1': ('basketball_nba', 'NBA'),
            '2': ('americanfootball_nfl', 'NFL'),
            '3': ('basketball_ncaab', 'NCAA Basketball'),
            '4': ('americanfootball_ncaaf', 'NCAA Football'),
            '5': ('baseball_mlb', 'MLB'),
            '6': ('icehockey_nhl', 'NHL'),
            '7': ('soccer_usa_mls', 'MLS'),
            '8': ('soccer_epl', 'English Premier League'),
            '9': ('soccer_uefa_europa_league', 'UEFA Europa League'),
            '10': ('soccer_uefa_champs_league', 'UEFA Champions League')
        }
        
        print("\n" + "="*60)
        print("SPORT SELECTION")
        print("="*60)
        print("Select which sports you want to monitor (enter numbers separated by commas):")
        print()
        
        for key, (sport_key, sport_name) in available_sports.items():
            print(f"  {key}. {sport_name}")
        
        print()
        print("Example: Enter '1,2,3' to monitor NBA, NFL, and NCAA Basketball")
        print("Or press Enter to monitor all sports")
        print("="*60)
        
        while True:
            try:
                user_input = input("\nYour selection: ").strip()
                
                if not user_input:
                    # Default to all sports
                    selected = [sport_key for sport_key, _ in available_sports.values()]
                    print(f"\n✓ Selected all sports: {', '.join([name for _, name in available_sports.values()])}")
                    return selected
                
                # Parse comma-separated numbers
                selections = [s.strip() for s in user_input.split(',')]
                selected_sports = []
                selected_names = []
                
                for selection in selections:
                    if selection in available_sports:
                        sport_key, sport_name = available_sports[selection]
                        if sport_key not in selected_sports:
                            selected_sports.append(sport_key)
                            selected_names.append(sport_name)
                    else:
                        print(f"⚠️  Invalid selection: {selection}. Please try again.")
                        break
                else:
                    # All selections were valid
                    if selected_sports:
                        print(f"\n✓ Selected sports: {', '.join(selected_names)}")
                        return selected_sports
                    else:
                        print("⚠️  No valid sports selected. Please try again.")
                        
            except KeyboardInterrupt:
                print("\n\nSelection cancelled.")
                return []
            except Exception as e:
                print(f"⚠️  Error: {e}. Please try again.")
    
    def monitor(self, sports: List[str] = None):
        """
        Monitor sportsbook odds for movements across all bookmakers
        
        Args:
            sports: List of sports to monitor (if None, will prompt user to select)
        """
        if sports is None:
            sports = self.select_sports()
            if not sports:
                print("No sports selected. Exiting.")
                return
        
        bookmakers_str = ', '.join([self.BOOKMAKER_NAMES.get(b, b) for b in self.bookmakers])
        
        # Map sport keys to readable names
        sport_names = {
            'basketball_nba': 'NBA',
            'americanfootball_nfl': 'NFL',
            'basketball_ncaab': 'NCAA Basketball',
            'americanfootball_ncaaf': 'NCAA Football',
            'baseball_mlb': 'MLB',
            'icehockey_nhl': 'NHL',
            'soccer_usa_mls': 'MLS',
            'soccer_epl': 'English Premier League',
            'soccer_uefa_europa_league': 'UEFA Europa League',
            'soccer_uefa_champs_league': 'UEFA Champions League'
        }
        sports_display = [sport_names.get(s, s.replace('_', ' ').title()) for s in sports]
        
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
                            # Add sport information to each game
                            for game in games:
                                game['sport'] = sport
                                game['sport_display'] = sport_display
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


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Monitor Sportsbook odds (DraftKings, FanDuel, BetMGM, Bet365) for point totals and spreads'
    )
    parser.add_argument('--odds-api-key', '-ok', help='The Odds API key')
    parser.add_argument('--interval', '-i', type=int, default=1800,
                       help='Check interval in seconds (default: 1800 = 30 minutes)')
    parser.add_argument('--movement-threshold', '-m', type=float, default=2.0,
                       help='Sportsbook movement threshold in points (default: 2.0)')
    parser.add_argument('--bookmakers', nargs='+', 
                       choices=['draftkings', 'fanduel', 'betmgm', 'bet365'],
                       help='Specific bookmakers to monitor (default: all)')
    parser.add_argument('--discord-webhook', '-dw', 
                       help='Discord webhook URL for notifications')
    parser.add_argument('--send-json', action='store_true',
                       help='Send original_lines.json to Discord webhook and exit')
    
    args = parser.parse_args()
    
    # Update global configuration
    global CHECK_INTERVAL, SPREAD_MOVEMENT_THRESHOLD, TOTAL_MOVEMENT_THRESHOLD
    CHECK_INTERVAL = args.interval
    SPREAD_MOVEMENT_THRESHOLD = args.movement_threshold
    TOTAL_MOVEMENT_THRESHOLD = args.movement_threshold
    
    # Start Sportsbook monitoring
        sb_monitor = SportsbookMonitor(
            api_key=args.odds_api_key, 
            bookmakers=args.bookmakers,
            discord_webhook=args.discord_webhook
        )
    
    # Handle --send-json flag
    if args.send_json:
        if not sb_monitor.discord.enabled:
            print("⚠️  Discord webhook not configured. Cannot send JSON file.")
            print("   Set DISCORD_WEBHOOK_URL env var or use --discord-webhook")
            return
        
        print("📤 Sending original_lines.json to Discord...")
        success = sb_monitor.discord.send_json_file(ORIGINAL_LINES_FILE, "original_lines")
        if success:
            print("✓ Successfully sent original_lines.json to Discord")
        else:
            print("⚠️  Failed to send original_lines.json to Discord")
        return
    
    sb_monitor.monitor(sports=None)


if __name__ == "__main__":
    main()

