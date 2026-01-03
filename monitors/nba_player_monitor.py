#!/usr/bin/env python3
"""
NBA Player Monitor
- Monitors NBA player point props from multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365)
- Alerts on significant line movements (≥2 points by default)
- Documents all found props
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
CHECK_INTERVAL = 1800  # Check every 30 minutes (1800 seconds)
LINE_MOVEMENT_THRESHOLD = 2.0  # Minimum 2 point movement for player props

# Tracking (files stored in monitor-data directory)
# Using consolidated files - same as betting monitor
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_data_dir = os.path.join(_base_dir, "monitor-data")
os.makedirs(_data_dir, exist_ok=True)  # Ensure directory exists
LINE_MOVEMENTS_FILE = os.path.join(_data_dir, "line_movements.json")
PROPS_HISTORY_FILE = os.path.join(_data_dir, "nba_player_props_history.json")

# Discord webhook (optional)
DISCORD_WEBHOOK_URL = os.getenv('DISCORD_WEBHOOK_URL')


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
    
    def send_prop_alert(self, prop: Dict, movement: Dict):
        """Send player prop movement alert to Discord (consolidated across bookmakers)"""
        player_name = prop.get('player_name', 'Unknown Player')
        game_matchup = prop.get('game_matchup', 'Unknown Game')
        
        # Get bookmakers from movement or prop
        bookmakers = movement.get('bookmakers', prop.get('bookmakers', []))
        if not bookmakers:
            # Fallback: create from single bookmaker if old format
            bookmakers = [{
                'bookmaker': movement.get('bookmaker', prop.get('bookmaker', 'unknown')),
                'bookmaker_name': movement.get('bookmaker_name', prop.get('bookmaker_name', 'Unknown'))
            }]
        
        # Format bookmaker names with odds for Discord
        bookmaker_display = []
        for b in bookmakers:
            name = b['bookmaker_name']
            if 'american_odds' in b and b['american_odds'] is not None:
                odds_str = f"{b['american_odds']:+d}" if isinstance(b['american_odds'], (int, float)) else str(b['american_odds'])
                name = f"{name} ({odds_str})"
            bookmaker_display.append(name)
        bookmakers_str = ', '.join(bookmaker_display) if len(bookmaker_display) > 1 else bookmaker_display[0]
        
        direction_emoji = "📈" if movement['movement'] > 0 else "📉"
        
        title = f"{direction_emoji} NBA Player Prop Movement Alert"
        description = f"**{player_name}** - {game_matchup}"
        
        fields = [
            {'name': 'Previous Line', 'value': f"{movement['old_line']:.1f}", 'inline': True},
            {'name': 'New Line', 'value': f"{movement['new_line']:.1f}", 'inline': True},
            {'name': 'Change', 'value': f"{movement['movement']:+.1f} points", 'inline': True},
            {'name': 'Direction', 'value': movement.get('direction', 'unknown').title(), 'inline': True},
            {'name': 'Bookmakers', 'value': bookmakers_str, 'inline': True},
            {'name': 'Time', 'value': movement.get('readable_timestamp', 'N/A'), 'inline': True}
        ]
        
        # Color based on movement size
        absolute_change = movement.get('absolute_movement', 0)
        if absolute_change >= 5:
            color = 0xff0000  # Red
        elif absolute_change >= 3:
            color = 0xffaa00  # Orange
        else:
            color = 0x00ff00  # Green
        
        self.send_webhook(title, description, color, fields)


class NBAPlayerPropsMonitor:
    """Monitors NBA player point props from multiple sportsbooks"""
    
    # Supported bookmakers
    BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'bet365']
    BOOKMAKER_NAMES = {
        'draftkings': 'DraftKings',
        'fanduel': 'FanDuel',
        'betmgm': 'BetMGM',
        'bet365': 'Bet365'
    }
    
    # API providers
    API_PROVIDER_SPORTSGAMEODDS = 'sportsgameodds'
    API_PROVIDER_ODDS_API = 'odds_api'
    
    def __init__(self, api_key: str = None, bookmakers: List[str] = None, 
                 discord_webhook: str = None, api_provider: str = None):
        """
        Initialize NBA player props monitor
        
        Args:
            api_key: API key (SportsGameOdds API key)
            bookmakers: List of bookmakers to monitor (default: all supported)
            discord_webhook: Discord webhook URL for notifications
            api_provider: API provider to use ('sportsgameodds' or 'odds_api', default: 'sportsgameodds')
        """
        # Get API key - check command line arg first, then environment variables
        # Get API key - check command line arg first, then environment variables
        self.api_key = api_key or os.getenv('SPORTSGAMEODDS_API_KEY') or os.getenv('ODDS_API_KEY')
        
        # Strip any whitespace that might have been accidentally included
        if self.api_key:
            self.api_key = self.api_key.strip()
        
        self.api_provider = api_provider or os.getenv('PROPS_API_PROVIDER', self.API_PROVIDER_SPORTSGAMEODDS)
        
        # Debug: Verify API key is loaded (show first 8 chars only for security)
        if self.api_key:
            if len(self.api_key) < 10:
                print(f"⚠️  Warning: API key seems too short: {len(self.api_key)} characters")
            else:
                print(f"✓ API key loaded: {self.api_key[:8]}... (length: {len(self.api_key)} chars)")
        else:
            print("⚠️  No API key found")
            print("   Set SPORTSGAMEODDS_API_KEY environment variable or use --api-key")
        
        # Debug: Print API key status (first 8 chars only for security)
        if self.api_key:
            print(f"✓ API key loaded: {self.api_key[:8]}...")
        else:
            print("⚠️  No API key found")
        
        # Set base URLs based on provider
        if self.api_provider == self.API_PROVIDER_SPORTSGAMEODDS:
            self.base_url = "https://api.sportsgameodds.com"
        else:
            self.base_url = "https://api.the-odds-api.com/v4"
        
        self.bookmakers = bookmakers or self.BOOKMAKERS
        self.history = self.load_history()
        self.discord = DiscordNotifier(webhook_url=discord_webhook)
    
    def _map_bookmaker_id(self, bookmaker_id: str) -> str:
        """
        Map SportsGameOdds bookmaker ID to our internal bookmaker key
        
        Args:
            bookmaker_id: Bookmaker ID from API
            
        Returns:
            Mapped bookmaker key (draftkings, fanduel, betmgm, bet365)
        """
        bookmaker_id_lower = bookmaker_id.lower()
        
        # Common mappings
        if 'draftking' in bookmaker_id_lower or bookmaker_id_lower == 'dk':
            return 'draftkings'
        elif 'fanduel' in bookmaker_id_lower or bookmaker_id_lower == 'fd':
            return 'fanduel'
        elif 'betmgm' in bookmaker_id_lower or 'mgm' in bookmaker_id_lower:
            return 'betmgm'
        elif 'bet365' in bookmaker_id_lower or bookmaker_id_lower == '365':
            return 'bet365'
        
        # Return as-is if no mapping found
        return bookmaker_id_lower
    
    def load_history(self) -> Dict:
        """Load historical props data"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        if os.path.exists(PROPS_HISTORY_FILE):
            try:
                with open(PROPS_HISTORY_FILE, 'r') as f:
                    data = json.load(f)
                    
                    # Check if it's a new day - clear old data if so
                    stored_date = data.get('current_date')
                    if stored_date != today:
                        print(f"📅 New day detected ({today}). Clearing previous day's player props history...")
                        # Clear all props, but preserve structure
                        data = {
                            'current_date': today,
                            'last_updated': None
                        }
                        # Save the cleared data
                        with open(PROPS_HISTORY_FILE, 'w') as f:
                            json.dump(data, f, indent=2)
                        print(f"✓ Cleared old player props history. Starting fresh for {today}")
                    else:
                        # Update current_date if not set
                        if 'current_date' not in data:
                            data['current_date'] = today
                    
                    return data
            except Exception as e:
                print(f"Error loading props history: {e}")
        
        return {
            'current_date': today,
            'last_updated': None
        }
    
    def save_history(self):
        """Save historical props data"""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            # Ensure current_date is set
            if 'current_date' not in self.history:
                self.history['current_date'] = today
            self.history['last_updated'] = datetime.now().isoformat()
            
            with open(PROPS_HISTORY_FILE, 'w') as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f"Error saving props history: {e}")
    
    def get_available_markets(self) -> List[str]:
        """
        Get list of available markets for NBA from The Odds API
        Useful for debugging which markets are supported
        
        Returns:
            List of available market names
        """
        if not self.api_key or not REQUESTS_AVAILABLE:
            return []
        
        try:
            # Try to get markets endpoint (if available)
            url = f"{self.base_url}/sports/basketball_nba"
            params = {'apiKey': self.api_key}
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # Some APIs return available markets in the sport info
                if 'markets' in data:
                    return data['markets']
        except:
            pass
        
        # If we can't get markets list, try a known working market to test API
        try:
            url = f"{self.base_url}/sports/basketball_nba/odds"
            params = {
                'apiKey': self.api_key,
                'regions': 'us',
                'markets': 'spreads',  # Known working market
                'bookmakers': self.bookmakers[0] if self.bookmakers else 'draftkings',
                'oddsFormat': 'american'
            }
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                return ['spreads', 'totals']  # At least these work
        except:
            pass
        
        return []
    
    def get_player_props(self) -> List[Dict]:
        """
        Get NBA player point props from multiple sportsbooks
        
        Returns:
            List of player prop dictionaries with all bookmakers
        """
        if not self.api_key:
            print("⚠️  API key not set. Player props monitoring disabled.")
            if self.api_provider == self.API_PROVIDER_SPORTSGAMEODDS:
                print("   Get an API key from: https://sportsgameodds.com/")
                print("   Set SPORTSGAMEODDS_API_KEY environment variable or use --api-key")
            else:
                print("   Get a free API key from: https://the-odds-api.com/")
                print("   Set ODDS_API_KEY environment variable or use --api-key")
            return []
        
        if not REQUESTS_AVAILABLE:
            print("⚠️  requests library not available. Install with: pip install requests")
            return []
        
        # Route to appropriate API provider
        if self.api_provider == self.API_PROVIDER_SPORTSGAMEODDS:
            return self.get_player_props_sportsgameodds()
        else:
            return self.get_player_props_odds_api()
    
    def get_player_props_sportsgameodds(self) -> List[Dict]:
        """
        Get NBA player point props from SportsGameOdds API v2
        Based on documentation: https://sportsgameodds.com/docs/basics/cheat-sheet
        
        Returns:
            List of player prop dictionaries with all bookmakers
        """
        try:
            # SportsGameOdds API v2 endpoint - use leagueID (camelCase) not league
            url = f"{self.base_url}/v2/events"
            
            # According to docs, API key can be in header OR query param
            # Send in both for maximum compatibility
            headers = {
                'x-api-key': self.api_key  # lowercase header name per documentation
            }
            
            # Use leagueID parameter (required at this subscription tier)
            # Also include API key in query params per documentation
            params = {
                'leagueID': 'NBA',
                'oddsAvailable': 'true',
                'apiKey': self.api_key  # Also in query params per documentation
            }
            
            # Debug output (mask API key)
            print(f"   Making request to: {url}")
            print(f"   With params: leagueID=NBA, oddsAvailable=true, apiKey={self.api_key[:8]}...")
            
            response = requests.get(url, headers=headers, params=params, timeout=10)
            response.raise_for_status()
            
            response_data = response.json()
            
            # Response format: {"success": true, "data": [...], "error": "...", "nextCursor": "..."}
            if not response_data.get('success', False):
                error_msg = response_data.get('error', 'Unknown error')
                print(f"⚠️  API returned error: {error_msg}")
                return []
            
            events = response_data.get('data', [])
            
            print(f"   API Response: success=True, found {len(events)} events")
            
            if not events:
                print("⚠️  No NBA games found in response")
                return []
            
            # Debug: Show first event structure
            if events:
                first_event = events[0]
                print(f"   Sample event keys: {list(first_event.keys())[:10]}")
                if 'odds' in first_event:
                    odds_count = len(first_event.get('odds', {}))
                    print(f"   First event has {odds_count} odds markets")
                    # Show a few oddIDs to understand structure
                    odd_ids = list(first_event.get('odds', {}).keys())[:5]
                    print(f"   Sample oddIDs: {odd_ids}")
            
            props = []
            
            # Parse events and extract player point props from odds
            # According to docs: Event.odds.<oddID> contains odds data
            # oddID format: statID-statEntityID-periodID-betTypeID-sideID
            # For player points: statID="points", statEntityID=player name, betTypeID="ou" (over/under)
            for event in events:
                event_id = event.get('eventID') or event.get('id')
                if not event_id:
                    continue
                
                # Get teams - structure may vary, try multiple paths
                teams = event.get('teams', [])
                if isinstance(teams, list) and len(teams) >= 2:
                    away_team = teams[0].get('name', teams[0].get('teamName', 'Away'))
                    home_team = teams[1].get('name', teams[1].get('teamName', 'Home'))
                else:
                    # Try alternative structure
                    away_team = event.get('awayTeam', {}).get('name', 'Away')
                    home_team = event.get('homeTeam', {}).get('name', 'Home')
                
                game_matchup = f"{away_team} @ {home_team}"
                
                # Get odds data - player props are in Event.odds
                odds = event.get('odds', {})
                if not odds:
                    # Debug: Check if odds field exists but is empty
                    if 'odds' in event:
                        print(f"   Event {event_id} has odds field but it's empty")
                    continue
                
                # Iterate through all oddIDs to find player point props
                # oddID format: statID-statEntityID-periodID-betTypeID-sideID
                # For player points: points-PLAYER_NAME-game-ou-over (or under)
                points_odds_found = 0
                player_points_odds_found = 0
                
                for odd_id, odd_data in odds.items():
                    if not isinstance(odd_data, dict):
                        continue
                    
                    # Parse oddID: statID-statEntityID-periodID-betTypeID-sideID
                    odd_parts = odd_id.split('-')
                    if len(odd_parts) < 5:
                        continue
                    
                    stat_id = odd_parts[0]  # Should be "points"
                    stat_entity_id = odd_parts[1]  # Player name (e.g., "LEBRON_JAMES") or "home"/"away"
                    period_id = odd_parts[2]  # Usually "game"
                    bet_type_id = odd_parts[3]  # Should be "ou" for over/under
                    side_id = odd_parts[4]  # "over" or "under"
                    
                    # Count points odds for debugging
                    if stat_id.lower() == 'points' and bet_type_id.lower() == 'ou':
                        points_odds_found += 1
                        # Check if it's a player prop (not team-level)
                        if stat_entity_id.upper() not in ['HOME', 'AWAY', 'ALL']:
                            player_points_odds_found += 1
                    
                    # Only process point props (over/under)
                    if stat_id.lower() != 'points' or bet_type_id.lower() != 'ou':
                        continue
                    
                    # Skip team-level props (statEntityID would be "home" or "away")
                    if stat_entity_id.upper() in ['HOME', 'AWAY', 'ALL']:
                        continue
                    
                    # Get the line value from the odd data
                    # The line might be in the main odd_data or in byBookmaker entries
                    line_value = odd_data.get('line')
                    if line_value is None:
                        # Try alternative field names
                        line_value = odd_data.get('total') or odd_data.get('overUnder') or odd_data.get('value')
                    
                    # Get bookmaker-specific odds
                    by_bookmaker = odd_data.get('byBookmaker', {})
                    
                    # Debug: Log structure for first few player props
                    if player_points_odds_found <= 3 and not by_bookmaker:
                        print(f"   Debug: Player prop {stat_entity_id} - odd_data keys: {list(odd_data.keys())}")
                        print(f"   Debug: byBookmaker exists: {by_bookmaker is not None}, empty: {not by_bookmaker}")
                    
                    if not by_bookmaker:
                        # Try alternative structure - maybe bookmakers are at a different level
                        # Check if there's a direct bookmaker field or different structure
                        if 'bookmakers' in odd_data:
                            by_bookmaker = odd_data.get('bookmakers', {})
                        
                        if not by_bookmaker:
                            # If still no bookmaker data, skip this prop
                            continue
                    
                    # Process each bookmaker
                    bookmakers_processed = 0
                    for bookmaker_id, bookmaker_odds in by_bookmaker.items():
                        if not isinstance(bookmaker_odds, dict):
                            continue
                        
                        # Get line value from bookmaker-specific odds if not found in main data
                        bookmaker_line = bookmaker_odds.get('line') or bookmaker_odds.get('total') or bookmaker_odds.get('overUnder') or bookmaker_odds.get('value')
                        if bookmaker_line is not None:
                            line_value = bookmaker_line
                        
                        # If still no line value, try to get it from the main odd_data
                        if line_value is None:
                            # Maybe the line is only in the main odd_data, not per-bookmaker
                            line_value = odd_data.get('line') or odd_data.get('total') or odd_data.get('overUnder')
                        
                        # If still no line value, skip this bookmaker
                        if line_value is None:
                            continue
                        
                        # Extract American odds from bookmaker-specific odds
                        # Try various field names for American odds
                        american_odds = (
                            bookmaker_odds.get('americanOdds') or
                            bookmaker_odds.get('american') or
                            bookmaker_odds.get('odds') or
                            bookmaker_odds.get('price') or
                            bookmaker_odds.get('americanPrice') or
                            None
                        )
                        
                        # If not found in bookmaker_odds, try main odd_data
                        if american_odds is None:
                            american_odds = (
                                odd_data.get('americanOdds') or
                                odd_data.get('american') or
                                odd_data.get('odds') or
                                odd_data.get('price') or
                                None
                            )
                        
                        # Map bookmaker ID to our bookmaker keys
                        bookmaker_id_lower = str(bookmaker_id).lower().strip()
                        bookmaker_key = self._map_bookmaker_id(bookmaker_id)
                        
                        # Debug: Log bookmaker mapping for first few props
                        if player_points_odds_found <= 3 and bookmakers_processed == 0:
                            print(f"   Debug: Bookmaker ID '{bookmaker_id}' mapped to '{bookmaker_key}'")
                            print(f"   Debug: Looking for bookmakers: {[b.lower() for b in self.bookmakers]}")
                        
                        # Check if this bookmaker matches our filter - be more flexible
                        bookmaker_matches = (
                            bookmaker_key in [b.lower() for b in self.bookmakers] or
                            bookmaker_id_lower in [b.lower() for b in self.bookmakers] or
                            any(b.lower() in bookmaker_id_lower for b in self.bookmakers) or
                            any(bookmaker_id_lower in b.lower() for b in self.bookmakers)
                        )
                        
                        if not bookmaker_matches:
                            continue
                        
                        bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key.title())
                        
                        # Convert player name from format like "LEBRON_JAMES" to "LeBron James"
                        player_name = stat_entity_id.replace('_', ' ').title()
                        
                        prop_id = f"{event_id}_{bookmaker_key}_{player_name}_{line_value}_{side_id}"
                        
                        prop_entry = {
                            'prop_id': prop_id,
                            'game_id': str(event_id),
                            'player_name': player_name,
                            'game_matchup': game_matchup,
                            'home_team': home_team,
                            'away_team': away_team,
                            'bookmaker': bookmaker_key,
                            'bookmaker_name': bookmaker_name,
                            'point_line': float(line_value),
                            'outcome_type': side_id,  # "over" or "under"
                            'american_odds': american_odds,  # American odds (can be None)
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        props.append(prop_entry)
                        bookmakers_processed += 1
                    
                    # Debug: Log if we found props but didn't process any bookmakers
                    if player_points_odds_found <= 3 and bookmakers_processed == 0 and by_bookmaker:
                        print(f"   Debug: Found {len(by_bookmaker)} bookmakers but none matched our filter")
                        print(f"   Debug: Bookmaker IDs found: {list(by_bookmaker.keys())[:5]}")
                
                # Debug output for first event
                if event == events[0] and points_odds_found > 0:
                    print(f"   First event: Found {points_odds_found} point odds, {player_points_odds_found} player point odds")
                    print(f"   Props extracted from first event: {len([p for p in props if p['game_id'] == str(event_id)])}")
            
            if props:
                print(f"✓ Successfully fetched {len(props)} player props from SportsGameOdds API")
                # Show breakdown by bookmaker
                bookmaker_counts = {}
                for prop in props:
                    bk = prop['bookmaker']
                    bookmaker_counts[bk] = bookmaker_counts.get(bk, 0) + 1
                print(f"   Breakdown by bookmaker: {bookmaker_counts}")
            else:
                print(f"⚠️  No player props found after parsing {len(events)} events")
                print(f"   This could mean:")
                print(f"   - No player point props available for current games")
                print(f"   - Player props structure is different than expected")
                print(f"   - Bookmaker filtering excluded all props")
                print(f"   - Need to check API response structure")
            
            return props
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Network error fetching player props from SportsGameOdds: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    print(f"   API Error Details: {error_detail}")
                except:
                    print(f"   HTTP Status: {e.response.status_code}")
                    if e.response.text:
                        print(f"   Response: {e.response.text[:200]}")
            return []
        except Exception as e:
            print(f"⚠️  Unexpected error fetching player props from SportsGameOdds: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_player_props_odds_api(self) -> List[Dict]:
        """
        Get NBA player point props from The Odds API (original implementation)
        
        Returns:
            List of player prop dictionaries with all bookmakers
        """
        
        try:
            # The Odds API endpoint - try different market names for player props
            url = f"{self.base_url}/sports/basketball_nba/odds"
            bookmakers_str = ','.join(self.bookmakers)
            
            # Try different market names - The Odds API may use different names
            market_names_to_try = [
                'player_points',
                'player_points_over_under',
                'player_point_totals',
                'player_props'
            ]
            
            data = None
            last_error = None
            
            for market_name in market_names_to_try:
                try:
                    params = {
                        'apiKey': self.api_key,
                        'regions': 'us',
                        'markets': market_name,
                        'bookmakers': bookmakers_str,
                        'oddsFormat': 'american'
                    }
                    
                    response = requests.get(url, params=params, timeout=10)
                    response.raise_for_status()
                    
                    data = response.json()
                    print(f"✓ Successfully fetched data using market: {market_name}")
                    break
                    
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 422:
                        # 422 means invalid market, try next one
                        last_error = e
                        continue
                    else:
                        # Other HTTP errors, raise them
                        raise
                except requests.exceptions.RequestException as e:
                    last_error = e
                    continue
            
            if data is None:
                # None of the market names worked
                if last_error:
                    print(f"⚠️  Error fetching player props: {last_error}")
                    if hasattr(last_error, 'response') and last_error.response is not None:
                        try:
                            error_detail = last_error.response.json()
                            print(f"   API Error Details: {error_detail}")
                        except:
                            print(f"   HTTP Status: {last_error.response.status_code}")
                
                # Try to get available markets for debugging
                print(f"⚠️  Checking available markets...")
                available_markets = self.get_available_markets()
                if available_markets:
                    print(f"   Available markets: {', '.join(available_markets)}")
                else:
                    print(f"   Could not determine available markets")
                
                print(f"⚠️  Note: Player props may not be available in The Odds API free tier,")
                print(f"   or may require a different API endpoint or subscription level.")
                print(f"   Check The Odds API documentation: https://the-odds-api.com/liveapi/guides/v4/#markets")
                print(f"   Common markets: spreads, totals, h2h")
                print(f"   Player props may require a paid subscription or different API.")
                return []
            
            # Parse player props from the response
            props = self.parse_player_props(data)
            
            return props
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Network error fetching player props: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    print(f"   API Error Details: {error_detail}")
                except:
                    print(f"   HTTP Status: {e.response.status_code}")
            return []
        except Exception as e:
            print(f"⚠️  Unexpected error fetching player props: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def parse_player_props(self, games_data: List[Dict]) -> List[Dict]:
        """
        Parse player point props from games data
        
        Args:
            games_data: List of game dictionaries from API
            
        Returns:
            List of player prop dictionaries
        """
        props = []
        
        for game in games_data:
            game_id = game.get('id', 'unknown')
            home_team = game.get('home_team', 'Unknown')
            away_team = game.get('away_team', 'Unknown')
            game_matchup = f"{away_team} @ {home_team}"
            
            # Get bookmakers for this game
            bookmakers = game.get('bookmakers', [])
            
            for bookmaker in bookmakers:
                bookmaker_key = bookmaker.get('key', 'unknown')
                bookmaker_name = self.BOOKMAKER_NAMES.get(bookmaker_key, bookmaker_key)
                
                # Get player props markets
                markets = bookmaker.get('markets', [])
                
                for market in markets:
                    # Check for various player prop market keys
                    market_key = market.get('key', '')
                    if market_key in ['player_points', 'player_points_over_under', 'player_point_totals', 'player_props']:
                        outcomes = market.get('outcomes', [])
                        
                        for outcome in outcomes:
                            player_name = outcome.get('name', 'Unknown Player')
                            # Try different field names for the point line
                            point_line = outcome.get('point') or outcome.get('points') or outcome.get('line')
                            
                            if point_line is not None:
                                prop_id = f"{game_id}_{bookmaker_key}_{player_name}_{point_line}"
                                
                                # Extract American odds from outcome
                                american_odds = outcome.get('price') or outcome.get('odds') or outcome.get('americanOdds') or None
                                
                                prop = {
                                    'prop_id': prop_id,
                                    'game_id': game_id,
                                    'player_name': player_name,
                                    'game_matchup': game_matchup,
                                    'home_team': home_team,
                                    'away_team': away_team,
                                    'bookmaker': bookmaker_key,
                                    'bookmaker_name': bookmaker_name,
                                    'point_line': float(point_line),
                                    'outcome_type': outcome.get('name', ''),  # Over/Under
                                    'american_odds': american_odds,  # American odds (can be None)
                                    'timestamp': datetime.now().isoformat()
                                }
                                
                                props.append(prop)
        
        return props
    
    def check_movements(self, current_props: List[Dict]):
        """
        Check for significant movements in player point props across all bookmakers
        Groups props with the same line across multiple bookmakers together
        Consolidates all bookmakers offering the same line into one data point
        
        Args:
            current_props: List of current player prop data
        """
        current_time = datetime.now().isoformat()
        readable_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Group props by game_id, player_name, outcome_type, and point_line (consolidate bookmakers)
        # This groups all bookmakers offering the same line together
        props_by_line = {}
        for prop in current_props:
            # Key: game_id + player_name + outcome_type + line_value (not bookmaker)
            key = f"{prop['game_id']}_{prop['player_name']}_{prop.get('outcome_type', 'over')}_{prop['point_line']}"
            if key not in props_by_line:
                props_by_line[key] = []
            props_by_line[key].append(prop)
        
        # Group by prop_id (game_id + player_name + outcome_type) to track all lines for this player
        props_by_player = {}
        for key, props_list in props_by_line.items():
            if not props_list:
                continue
            
            base_prop = props_list[0]
            game_id = base_prop['game_id']
            player_name = base_prop['player_name']
            outcome_type = base_prop.get('outcome_type', 'over')
            prop_id = f"{game_id}_{player_name}_{outcome_type}"
            
            if prop_id not in props_by_player:
                props_by_player[prop_id] = {}
            
            # Store all props for this line value (consolidated bookmakers)
            line_value = base_prop['point_line']
            bookmakers_info = []
            for p in props_list:
                bookmaker_entry = {
                    'bookmaker': p['bookmaker'],
                    'bookmaker_name': p['bookmaker_name']
                }
                # Include American odds if available
                if 'american_odds' in p and p['american_odds'] is not None:
                    bookmaker_entry['american_odds'] = p['american_odds']
                bookmakers_info.append(bookmaker_entry)
            
            props_by_player[prop_id][line_value] = {
                'line': line_value,
                'bookmakers': bookmakers_info,
                'base_prop': base_prop
            }
        
        # Process each player prop
        for prop_id, lines_dict in props_by_player.items():
            if not lines_dict:
                continue
            
            # Check if this prop exists in history
            if prop_id in self.history:
                history = self.history[prop_id]
                primary_line = history.get('current_line')
            else:
                # First time seeing this player prop - use the line with most bookmakers
                best_line = None
                best_line_data = None
                max_bookmakers = 0
                
                for line_value, line_data in lines_dict.items():
                    num_bookmakers = len(line_data['bookmakers'])
                    if num_bookmakers > max_bookmakers:
                        max_bookmakers = num_bookmakers
                        best_line = line_value
                        best_line_data = line_data
                
                if best_line is None:
                    continue
                
                base_prop = best_line_data['base_prop']
                primary_line = best_line
                
                # Create initial history entry
                self.history[prop_id] = {
                    'game_id': base_prop['game_id'],
                    'player_name': base_prop['player_name'],
                    'game_matchup': base_prop['game_matchup'],
                    'home_team': base_prop['home_team'],
                    'away_team': base_prop['away_team'],
                    'outcome_type': base_prop.get('outcome_type', 'over'),
                    'lines': {},  # Store all lines with their bookmakers
                    'initial_line': primary_line,
                    'current_line': primary_line,
                    'first_seen': current_time,
                    'last_updated': current_time
                }
                history = self.history[prop_id]
            
            # Update lines dictionary with all current lines and their bookmakers (consolidated)
            history['lines'] = {}
            for line_value, line_data in lines_dict.items():
                history['lines'][str(line_value)] = {
                    'line': line_value,
                    'bookmakers': line_data['bookmakers']
                }
            
            # Determine which line to use for movement comparison
            # Use the most common line (line with most bookmakers) as the primary line
            best_line = primary_line
            best_line_bookmakers = []
            max_bookmakers = 0
            
            for line_value, line_data in lines_dict.items():
                num_bookmakers = len(line_data['bookmakers'])
                if num_bookmakers > max_bookmakers:
                    max_bookmakers = num_bookmakers
                    best_line = line_value
                    best_line_bookmakers = line_data['bookmakers']
            
            # Get base prop info from the best line
            base_prop = lines_dict[best_line]['base_prop']
            game_id = base_prop['game_id']
            player_name = base_prop['player_name']
            outcome_type = base_prop.get('outcome_type', 'over')
            
            # Check for movement using the best line
            old_line = history.get('current_line')
            current_line = best_line
            
            if old_line is not None and old_line != current_line:
                line_change = abs(current_line - old_line)
                
                if line_change >= LINE_MOVEMENT_THRESHOLD:
                    # Significant movement detected
                    # Get bookmakers for the new line
                    movement_bookmakers = best_line_bookmakers
                    
                    movement = {
                        'timestamp': current_time,
                        'readable_timestamp': readable_time,
                        'bookmakers': movement_bookmakers,  # All bookmakers with this movement
                        'old_line': old_line,
                        'new_line': current_line,
                        'movement': current_line - old_line,
                        'absolute_movement': line_change,
                        'direction': 'increased' if current_line > old_line else 'decreased'
                    }
                    
                    # Update history with new current line (movements are stored in line_movements.json only)
                    history['current_line'] = current_line
                    history['last_updated'] = current_time
                    
                    # Document the movement in line_movements.json (with all bookmakers)
                    consolidated_prop = {
                        'prop_id': prop_id,
                        'game_id': game_id,
                        'player_name': player_name,
                        'game_matchup': base_prop['game_matchup'],
                        'home_team': base_prop['home_team'],
                        'away_team': base_prop['away_team'],
                        'point_line': current_line,
                        'outcome_type': outcome_type,
                        'bookmakers': movement_bookmakers
                    }
                    self.document_movement(consolidated_prop, movement)
                    
                    # Send alert (with all bookmakers)
                    self.send_prop_alert(consolidated_prop, movement)
                    
                    # Save history
                    self.save_history()
                else:
                    # No significant movement, but update current line
                    history['current_line'] = current_line
                    history['last_updated'] = current_time
                    self.save_history()
            else:
                # First time seeing this line value or same line, update it
                if old_line != current_line:
                    history['current_line'] = current_line
                history['last_updated'] = current_time
                
                # Print confirmation for new props (only if this is the first time we're seeing this prop)
                if history.get('first_seen') == current_time:
                    bookmaker_display = []
                    for b in best_line_bookmakers:
                        name = b['bookmaker_name']
                        if 'american_odds' in b and b['american_odds'] is not None:
                            odds_str = f"{b['american_odds']:+d}" if isinstance(b['american_odds'], (int, float)) else str(b['american_odds'])
                            name = f"{name} ({odds_str})"
                        bookmaker_display.append(name)
                    bookmakers_str = ', '.join(bookmaker_display) if len(bookmaker_display) > 1 else bookmaker_display[0]
                    
                    print(f"✓ Documented original line for: {player_name} ({bookmakers_str}) - {base_prop['game_matchup']}")
                    print(f"  Line: {current_line:.1f} points")
                    print(f"  Saved to: {PROPS_HISTORY_FILE}")
                
                self.save_history()
    
    def load_line_movements(self) -> Dict:
        """Load line movements from file (consolidated with betting monitor)"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        if os.path.exists(LINE_MOVEMENTS_FILE):
            try:
                with open(LINE_MOVEMENTS_FILE, 'r') as f:
                    data = json.load(f)
                    
                    # Check if it's a new day - clear old data if so
                    stored_date = data.get('current_date')
                    if stored_date != today:
                        print(f"📅 New day detected ({today}). Clearing previous day's movements...")
                        # Clear movements, but preserve structure
                        data = {
                            'game_movements': [],
                            'player_prop_movements': [],
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
                    
                    # Return player_prop_movements section, or create it if doesn't exist
                    if 'player_prop_movements' not in data:
                        data['player_prop_movements'] = []
                    if 'game_movements' not in data:
                        data['game_movements'] = []
                    return data
            except Exception as e:
                print(f"Error loading line movements: {e}")
        
        return {
            'game_movements': [],  # For betting monitor movements
            'player_prop_movements': [],  # For NBA player prop movements
            'current_date': today,
            'last_updated': None,
            'total_movements': 0
        }
    
    def save_line_movements(self, movements_data: Dict):
        """Save line movements to file (consolidated with betting monitor)"""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            
            # Load existing data to preserve game_movements section
            existing_data = self.load_line_movements()
            # Update only the player_prop_movements section
            existing_data['player_prop_movements'] = movements_data.get('movements', [])
            existing_data['last_updated'] = movements_data.get('last_updated')
            existing_data['current_date'] = today  # Update date
            # Calculate total movements
            total_game_movements = len(existing_data.get('game_movements', []))
            total_prop_movements = len(existing_data['player_prop_movements'])
            existing_data['total_movements'] = total_game_movements + total_prop_movements
            # Preserve game_movements if it exists
            if 'game_movements' not in existing_data:
                existing_data['game_movements'] = []
            
            with open(LINE_MOVEMENTS_FILE, 'w') as f:
                json.dump(existing_data, f, indent=2)
        except Exception as e:
            print(f"Error saving line movements: {e}")
    
    def document_movement(self, prop: Dict, movement: Dict):
        """
        Document a significant movement in a separate line movements file
        Consolidates movements across multiple bookmakers
        
        Args:
            prop: Player prop dictionary (may contain 'bookmakers' list)
            movement: Movement dictionary with timestamp and values (may contain 'bookmakers' list)
        """
        prop_id = prop['prop_id']
        
        # Get bookmakers from movement or prop
        bookmakers = movement.get('bookmakers', prop.get('bookmakers', []))
        if not bookmakers:
            # Fallback: create from single bookmaker if old format
            bookmakers = [{
                'bookmaker': movement.get('bookmaker', prop.get('bookmaker', 'unknown')),
                'bookmaker_name': movement.get('bookmaker_name', prop.get('bookmaker_name', 'Unknown'))
            }]
        
        # Load existing movements
        movements_data = self.load_line_movements()
        prop_movements = movements_data.get('player_prop_movements', [])
        
        # Create movement entry with all details
        movement_entry = {
            'prop_id': prop_id,
            'game_id': prop['game_id'],
            'player_name': prop['player_name'],
            'game_matchup': prop['game_matchup'],
            'home_team': prop['home_team'],
            'away_team': prop['away_team'],
            'outcome_type': prop.get('outcome_type', 'over'),
            'bookmakers': bookmakers,  # List of all bookmakers
            'detected_at': movement['timestamp'],
            'detected_at_readable': movement['readable_timestamp'],
            'previous_line': movement['old_line'],
            'new_line': movement['new_line'],
            'change': movement['movement'],
            'absolute_change': movement['absolute_movement'],
            'direction': movement['direction']
        }
        
        # Add to movements list
        prop_movements.append(movement_entry)
        movements_data['player_prop_movements'] = prop_movements
        movements_data['last_updated'] = datetime.now().isoformat()
        # Calculate total (game movements + prop movements)
        total_game_movements = len(movements_data.get('game_movements', []))
        movements_data['total_movements'] = total_game_movements + len(prop_movements)
        
        # Save to consolidated file
        self.save_line_movements(movements_data)
        
        # Format bookmaker names for display (with odds if available)
        bookmaker_display = []
        for b in bookmakers:
            name = b['bookmaker_name']
            if 'american_odds' in b and b['american_odds'] is not None:
                odds_str = f"{b['american_odds']:+d}" if isinstance(b['american_odds'], (int, float)) else str(b['american_odds'])
                name = f"{name} ({odds_str})"
            bookmaker_display.append(name)
        bookmakers_str = ', '.join(bookmaker_display) if len(bookmaker_display) > 1 else bookmaker_display[0]
        
        print(f"✓ Documented line movement ({bookmakers_str}): {prop['player_name']} - {prop['game_matchup']}")
        print(f"  Previous: {movement_entry['previous_line']:.1f} → New: {movement_entry['new_line']:.1f}")
        print(f"  Change: {movement_entry['change']:+.1f} points ({movement_entry['direction']})")
        print(f"  Detected at: {movement_entry['detected_at_readable']}")
        print(f"  Saved to: {LINE_MOVEMENTS_FILE}")
    
    def send_prop_alert(self, prop: Dict, movement: Dict):
        """Send alert for player prop movement (consolidated across bookmakers)"""
        player_name = prop['player_name']
        game_matchup = prop['game_matchup']
        
        # Get bookmakers from movement or prop
        bookmakers = movement.get('bookmakers', prop.get('bookmakers', []))
        if not bookmakers:
            # Fallback: create from single bookmaker if old format
            bookmakers = [{
                'bookmaker': movement.get('bookmaker', prop.get('bookmaker', 'unknown')),
                'bookmaker_name': movement.get('bookmaker_name', prop.get('bookmaker_name', 'Unknown'))
            }]
        
        # Format bookmaker names with odds for display
        bookmaker_display = []
        for b in bookmakers:
            name = b['bookmaker_name']
            if 'american_odds' in b and b['american_odds'] is not None:
                odds_str = f"{b['american_odds']:+d}" if isinstance(b['american_odds'], (int, float)) else str(b['american_odds'])
                name = f"{name} ({odds_str})"
            bookmaker_display.append(name)
        bookmakers_str = ', '.join(bookmaker_display) if len(bookmaker_display) > 1 else bookmaker_display[0]
        
        direction = "↑" if movement['movement'] > 0 else "↓"
        
        timestamp = movement.get('readable_timestamp', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print(f"\n{'='*60}")
        print(f"📊 NBA PLAYER PROP ALERT [{timestamp}]")
        print(f"Player: {player_name}")
        print(f"Game: {game_matchup}")
        print(f"Bookmakers: {bookmakers_str}")
        print(f"Line Movement: {movement['old_line']:.1f} → {movement['new_line']:.1f}")
        print(f"Change: {movement['movement']:+.1f} points ({movement.get('direction', 'unknown')})")
        print(f"Movement detected at: {timestamp}")
        print(f"{'='*60}\n")
        
        if NOTIFICATIONS_AVAILABLE:
            try:
                message = f"{bookmakers_str}: {player_name} - {game_matchup}\nLine moved {direction} {abs(movement['movement']):.1f} points\n{movement['old_line']:.1f} → {movement['new_line']:.1f}"
                notification.notify(
                    title=f"NBA Player Prop Alert",
                    message=message,
                    timeout=10
                )
            except:
                pass
        
        # Send Discord webhook notification (with consolidated bookmakers)
        self.discord.send_prop_alert(prop, movement)
    
    def log_alert(self, prop: Dict, movement: Dict):
        """Log alert to file"""
        log_file = os.path.join(_data_dir, "nba_player_props_alerts.log")
        timestamp = datetime.now().isoformat()
        
        log_entry = {
            'timestamp': timestamp,
            'prop': {
                'prop_id': prop.get('prop_id'),
                'player_name': prop.get('player_name'),
                'game_matchup': prop.get('game_matchup')
            },
            'movement': movement
        }
        
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            print(f"Could not write to log file: {e}")
    
    def monitor(self):
        """
        Monitor NBA player point props for movements across all bookmakers
        """
        bookmakers_str = ', '.join([self.BOOKMAKER_NAMES.get(b, b) for b in self.bookmakers])
        
        interval_minutes = CHECK_INTERVAL / 60
        api_provider_name = "SportsGameOdds API" if self.api_provider == self.API_PROVIDER_SPORTSGAMEODDS else "The Odds API"
        print(f"\nStarting NBA Player Props monitoring...")
        print(f"API Provider: {api_provider_name}")
        print(f"Bookmakers: {bookmakers_str}")
        print(f"Checking every {interval_minutes} minutes ({CHECK_INTERVAL} seconds)")
        print(f"Movement threshold: {LINE_MOVEMENT_THRESHOLD} points")
        print(f"Press Ctrl+C to stop\n")
        
        try:
            while True:
                try:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking NBA player props...")
                    props = self.get_player_props()
                    
                    if props:
                        print(f"Found {len(props)} player props")
                        self.check_movements(props)
                    else:
                        print(f"No player props found")
                    
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Cycle complete. Next check in {CHECK_INTERVAL/60:.1f} minutes...\n")
                    time.sleep(CHECK_INTERVAL)
                    
                except KeyboardInterrupt:
                    raise  # Re-raise to exit outer loop
                except Exception as e:
                    print(f"\n⚠️  Error during player props check: {e}")
                    import traceback
                    traceback.print_exc()
                    print(f"Continuing monitoring in {CHECK_INTERVAL/60:.1f} minutes...\n")
                    time.sleep(CHECK_INTERVAL)  # Wait before retrying
                
        except KeyboardInterrupt:
            print("\n\nNBA Player Props monitoring stopped.")
        except Exception as e:
            print(f"\nFatal error in player props monitoring: {e}")
            import traceback
            traceback.print_exc()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Monitor NBA player point props from multiple sportsbooks (DraftKings, FanDuel, BetMGM, Bet365). '
                    'Uses SportsGameOdds API by default. '
                    'Alternative: The Odds API (may not support player props).'
    )
    parser.add_argument('--api-key', '-ak', help='API key (SportsGameOdds or The Odds API)')
    parser.add_argument('--odds-api-key', '-ok', help='The Odds API key (deprecated, use --api-key)')
    parser.add_argument('--sportsgameodds-api-key', '-sgok', help='SportsGameOdds API key (deprecated, use --api-key)')
    parser.add_argument('--api-provider', '-ap', 
                       choices=['sportsgameodds', 'odds_api'],
                       help='API provider to use (default: sportsgameodds)')
    parser.add_argument('--interval', '-i', type=int, default=1800,
                       help='Check interval in seconds (default: 1800 = 30 minutes)')
    parser.add_argument('--movement-threshold', '-m', type=float, default=2.0,
                       help='Line movement threshold in points (default: 2.0)')
    parser.add_argument('--bookmakers', nargs='+', 
                       choices=['draftkings', 'fanduel', 'betmgm', 'bet365'],
                       help='Specific bookmakers to monitor (default: all)')
    parser.add_argument('--discord-webhook', '-dw', 
                       help='Discord webhook URL for notifications')
    
    args = parser.parse_args()
    
    # Update global configuration
    global CHECK_INTERVAL, LINE_MOVEMENT_THRESHOLD
    CHECK_INTERVAL = args.interval
    LINE_MOVEMENT_THRESHOLD = args.movement_threshold
    
    # Determine API key and provider
    api_key = args.api_key or args.sportsgameodds_api_key or args.odds_api_key
    api_provider = args.api_provider
    
    # If using deprecated args, set provider accordingly
    if args.odds_api_key and not api_provider:
        api_provider = 'odds_api'
    elif args.sportsgameodds_api_key and not api_provider:
        api_provider = 'sportsgameodds'
    
    # Start monitoring
    monitor = NBAPlayerPropsMonitor(
        api_key=api_key, 
        bookmakers=args.bookmakers,
        discord_webhook=args.discord_webhook,
        api_provider=api_provider
    )
    monitor.monitor()


if __name__ == "__main__":
    main()

