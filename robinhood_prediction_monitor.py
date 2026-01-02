#!/usr/bin/env python3
"""
Robinhood Prediction Market Monitor
Monitors prediction market contracts and notifies when price exceeds 80%
"""

import time
import json
import os
from datetime import datetime
from typing import List, Dict, Optional
import sys

try:
    import robin_stocks.robinhood as rh
except ImportError:
    print("Error: robin_stocks library not found.")
    print("Please install it with: pip install robin-stocks")
    sys.exit(1)

# Try to import notification libraries (optional)
try:
    from plyer import notification
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    print("Note: Desktop notifications not available. Install 'plyer' for desktop notifications: pip install plyer")

# Configuration
CHECK_INTERVAL = 30  # Check every 30 seconds
PRICE_THRESHOLD = 0.80  # 80% threshold
ALERTED_CONTRACTS = set()  # Track contracts we've already alerted about
DOCUMENTED_CONTRACTS_FILE = "documented_contracts.json"


class PredictionMarketMonitor:
    def __init__(self, username: str = None, password: str = None, mfa_code: str = None):
        """
        Initialize the monitor with Robinhood credentials
        
        Args:
            username: Robinhood username (or set ROBINHOOD_USERNAME env var)
            password: Robinhood password (or set ROBINHOOD_PASSWORD env var)
            mfa_code: MFA code if required (or set ROBINHOOD_MFA env var)
        """
        self.username = username or os.getenv('ROBINHOOD_USERNAME')
        self.password = password or os.getenv('ROBINHOOD_PASSWORD')
        self.mfa_code = mfa_code or os.getenv('ROBINHOOD_MFA')
        self.authenticated = False
        self.contracts_cache = []
        self.documented_contracts = self.load_documented_contracts()
        
    def login(self) -> bool:
        """Authenticate with Robinhood"""
        if not self.username or not self.password:
            print("Error: Robinhood credentials not provided.")
            print("Set ROBINHOOD_USERNAME and ROBINHOOD_PASSWORD environment variables,")
            print("or pass them as arguments to the script.")
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
    
    def load_documented_contracts(self) -> Dict:
        """Load previously documented contracts"""
        if os.path.exists(DOCUMENTED_CONTRACTS_FILE):
            try:
                with open(DOCUMENTED_CONTRACTS_FILE, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading documented contracts: {e}")
        return {'contracts': [], 'last_updated': None}
    
    def document_contract(self, contract: Dict):
        """Document a contract when found"""
        contract_id = contract.get('symbol') or contract.get('id', 'unknown')
        
        # Check if already documented
        existing_ids = [c.get('id') for c in self.documented_contracts.get('contracts', [])]
        
        if contract_id not in existing_ids:
            contract_entry = {
                'id': contract_id,
                'name': contract.get('name', 'Unknown'),
                'symbol': contract.get('symbol', 'N/A'),
                'discovered_at': datetime.now().isoformat(),
                'data': contract
            }
            
            if 'contracts' not in self.documented_contracts:
                self.documented_contracts['contracts'] = []
            
            self.documented_contracts['contracts'].append(contract_entry)
            self.documented_contracts['last_updated'] = datetime.now().isoformat()
            
            try:
                with open(DOCUMENTED_CONTRACTS_FILE, 'w') as f:
                    json.dump(self.documented_contracts, f, indent=2)
                print(f"✓ Documented new contract: {contract_entry['name']}")
            except Exception as e:
                print(f"Error saving documented contracts: {e}")
    
    def get_prediction_market_contracts(self) -> List[Dict]:
        """
        Fetch all prediction market contracts from Robinhood
        
        Returns:
            List of contract dictionaries
        """
        contracts = []
        
        # Method 1: Try to get prediction market contracts directly
        try:
            # Check if robin_stocks has a prediction markets method
            if hasattr(rh, 'get_prediction_markets'):
                contracts = rh.get_prediction_markets()
                if contracts:
                    print(f"Found {len(contracts)} contracts via get_prediction_markets()")
                    return contracts
        except Exception as e:
            print(f"Method 1 failed: {e}")
        
        # Method 2: Try to get all instruments and filter
        try:
            instruments = rh.get_all_instruments()
            if instruments:
                for instrument in instruments:
                    if self._is_prediction_contract(instrument):
                        contracts.append(instrument)
                if contracts:
                    print(f"Found {len(contracts)} contracts via get_all_instruments()")
                    return contracts
        except Exception as e:
            print(f"Method 2 failed: {e}")
        
        # Method 3: Try alternative endpoints
        try:
            # Try various potential endpoints
            endpoints_to_try = [
                ('get_markets', []),
                ('get_instruments', ['prediction']),
            ]
            
            for method_name, args in endpoints_to_try:
                if hasattr(rh, method_name):
                    try:
                        result = getattr(rh, method_name)(*args)
                        if result:
                            for item in result if isinstance(result, list) else [result]:
                                if self._is_prediction_contract(item):
                                    contracts.append(item)
                    except:
                        continue
        except Exception as e:
            print(f"Method 3 failed: {e}")
        
        # Method 4: Load from config file if automatic discovery fails
        if not contracts:
            contracts = self._load_contracts_from_config()
        
        # Document all found contracts
        for contract in contracts:
            self.document_contract(contract)
        
        return contracts
    
    def _load_contracts_from_config(self) -> List[Dict]:
        """Load contracts from a config file if automatic discovery fails"""
        config_file = "robinhood_contracts.json"
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    contracts = json.load(f)
                    print(f"Loaded {len(contracts)} contracts from {config_file}")
                    return contracts
            except Exception as e:
                print(f"Error loading contracts from config: {e}")
        else:
            print(f"\n⚠️  No contracts found automatically.")
            print(f"   Create {config_file} with contract symbols to monitor.")
            print(f"   Example format:")
            print(f'   [{{"symbol": "CONTRACT-SYMBOL", "name": "Contract Name"}}]')
        
        return []
    
    def _is_prediction_contract(self, instrument: Dict) -> bool:
        """
        Determine if an instrument is a prediction market contract
        
        Args:
            instrument: Instrument dictionary from API
            
        Returns:
            True if it's a prediction contract
        """
        # Check various fields that might indicate prediction markets
        name = str(instrument.get('name', '')).lower()
        symbol = str(instrument.get('symbol', '')).lower()
        type_field = str(instrument.get('type', '')).lower()
        
        # Look for prediction market indicators
        prediction_keywords = ['prediction', 'yes', 'no', 'contract', 'market']
        
        return any(keyword in name or keyword in symbol or keyword in type_field 
                  for keyword in prediction_keywords)
    
    def get_contract_price(self, contract: Dict) -> Optional[float]:
        """
        Get the current price of a contract
        
        Args:
            contract: Contract dictionary
            
        Returns:
            Current price as float (0.0-1.0) or None if unavailable
        """
        try:
            symbol = contract.get('symbol') or contract.get('id') or contract.get('tradable_symbol')
            if not symbol:
                return None
            
            # Method 1: Try get_latest_price
            try:
                price_data = rh.get_latest_price(symbol)
                if price_data and len(price_data) > 0:
                    price = float(price_data[0])
                    # If price seems to be in dollars, convert to percentage (assuming max $1.00 = 100%)
                    if price > 1.0:
                        price = price / 100.0
                    return price
            except:
                pass
            
            # Method 2: Try get_quote
            try:
                quote = rh.get_quote(symbol)
                if quote:
                    # Try various price fields
                    for price_field in ['last_trade_price', 'ask_price', 'bid_price', 'mark_price', 'price']:
                        if price_field in quote and quote[price_field]:
                            price = float(quote[price_field])
                            # Convert if needed
                            if price > 1.0:
                                price = price / 100.0
                            return price
            except:
                pass
            
            # Method 3: Try get_option_marketdata (if it's an option-like contract)
            try:
                if hasattr(rh, 'get_option_marketdata'):
                    market_data = rh.get_option_marketdata(symbol)
                    if market_data and 'mark_price' in market_data:
                        price = float(market_data['mark_price'])
                        if price > 1.0:
                            price = price / 100.0
                        return price
            except:
                pass
            
            return None
            
        except Exception as e:
            # Only print error if it's not a common "not found" type error
            if 'not found' not in str(e).lower() and 'does not exist' not in str(e).lower():
                print(f"Error getting price for contract {contract.get('symbol', 'unknown')}: {e}")
            return None
    
    def send_notification(self, contract: Dict, price: float):
        """
        Send notification when contract exceeds threshold
        
        Args:
            contract: Contract dictionary
            price: Current price
        """
        contract_name = contract.get('name', contract.get('symbol', 'Unknown Contract'))
        contract_symbol = contract.get('symbol', 'N/A')
        price_percent = price * 100
        
        message = f"{contract_name} ({contract_symbol}) is at {price_percent:.2f}%"
        
        # Console notification
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{'='*60}")
        print(f"🚨 ALERT [{timestamp}]")
        print(f"Contract: {contract_name}")
        print(f"Symbol: {contract_symbol}")
        print(f"Price: {price_percent:.2f}% (exceeds {PRICE_THRESHOLD*100}% threshold)")
        print(f"{'='*60}\n")
        
        # Desktop notification (if available)
        if NOTIFICATIONS_AVAILABLE:
            try:
                notification.notify(
                    title="Robinhood Prediction Market Alert",
                    message=message,
                    timeout=10
                )
            except Exception as e:
                print(f"Could not send desktop notification: {e}")
        
        # Log to file
        self.log_alert(contract, price)
    
    def log_alert(self, contract: Dict, price: float):
        """Log alert to file"""
        log_file = "robinhood_alerts.log"
        timestamp = datetime.now().isoformat()
        contract_name = contract.get('name', contract.get('symbol', 'Unknown'))
        contract_symbol = contract.get('symbol', 'N/A')
        
        log_entry = {
            'timestamp': timestamp,
            'contract_name': contract_name,
            'contract_symbol': contract_symbol,
            'price': price,
            'price_percent': price * 100
        }
        
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            print(f"Could not write to log file: {e}")
    
    def monitor_contracts(self):
        """Main monitoring loop"""
        if not self.authenticated:
            print("Not authenticated. Please login first.")
            return
        
        print(f"\nStarting monitoring...")
        print(f"Checking every {CHECK_INTERVAL} seconds")
        print(f"Alert threshold: {PRICE_THRESHOLD*100}%")
        print(f"Press Ctrl+C to stop\n")
        
        try:
            while True:
                # Get contracts (refresh periodically)
                if not self.contracts_cache or len(self.contracts_cache) == 0:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching contracts...")
                    self.contracts_cache = self.get_prediction_market_contracts()
                    print(f"Found {len(self.contracts_cache)} contracts to monitor")
                
                # Check each contract
                checked_count = 0
                for contract in self.contracts_cache:
                    price = self.get_contract_price(contract)
                    
                    if price is None:
                        continue
                    
                    checked_count += 1
                    contract_id = contract.get('symbol') or contract.get('id', 'unknown')
                    
                    # Display current price (optional, can be removed for less verbose output)
                    contract_name = contract.get('name', contract_id)
                    if len(contract_name) > 40:
                        contract_name = contract_name[:37] + "..."
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] {contract_name}: {price*100:.2f}%", end='\r')
                    
                    # Check if price exceeds threshold
                    if price >= PRICE_THRESHOLD:
                        # Only alert if we haven't already alerted for this contract
                        if contract_id not in ALERTED_CONTRACTS:
                            print()  # New line before alert
                            self.send_notification(contract, price)
                            ALERTED_CONTRACTS.add(contract_id)
                    else:
                        # Remove from alerted set if price drops below threshold
                        # This allows re-alerting if price goes back up
                        if contract_id in ALERTED_CONTRACTS:
                            ALERTED_CONTRACTS.discard(contract_id)
                    
                    # Small delay between contract checks to avoid rate limiting
                    time.sleep(0.5)
                
                if checked_count > 0:
                    print()  # New line after checking all contracts
                
                # Refresh contract list periodically (every 10 cycles)
                if len(self.contracts_cache) == 0:
                    self.contracts_cache = self.get_prediction_market_contracts()
                
                # Wait before next check cycle
                time.sleep(CHECK_INTERVAL)
                
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped by user.")
        except Exception as e:
            print(f"\nError in monitoring loop: {e}")
            import traceback
            traceback.print_exc()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Monitor Robinhood prediction market contracts for price alerts'
    )
    parser.add_argument('--username', '-u', help='Robinhood username')
    parser.add_argument('--password', '-p', help='Robinhood password')
    parser.add_argument('--mfa', '-m', help='MFA code if required')
    parser.add_argument('--interval', '-i', type=int, default=30,
                       help='Check interval in seconds (default: 30)')
    parser.add_argument('--threshold', '-t', type=float, default=0.80,
                       help='Price threshold (0.0-1.0, default: 0.80 for 80%%)')
    
    args = parser.parse_args()
    
    # Update global configuration
    global CHECK_INTERVAL, PRICE_THRESHOLD
    CHECK_INTERVAL = args.interval
    PRICE_THRESHOLD = args.threshold
    
    # Create monitor instance
    monitor = PredictionMarketMonitor(
        username=args.username,
        password=args.password,
        mfa_code=args.mfa
    )
    
    # Authenticate
    if not monitor.login():
        sys.exit(1)
    
    # Start monitoring
    monitor.monitor_contracts()


if __name__ == "__main__":
    main()

