#!/usr/bin/env python3
"""Debug script to check pattern detection on a single stock"""

import os
os.environ['YF_USE_CURL_CFFI'] = '0'

import sys
sys.path.insert(0, '/Users/neil/playwrightautomation/stock-monitor')

from stock_pattern_monitor import StockPatternMonitor

def main():
    monitor = StockPatternMonitor()
    
    # Lower the min_confidence to see more potential patterns
    monitor.min_confidence = 0.5
    
    test_stocks = ['AAPL', 'NVDA', 'AMD', 'TSLA']
    
    for symbol in test_stocks:
        print(f"\n{'='*60}")
        print(f"Analyzing {symbol}")
        print('='*60)
        
        df = monitor.fetch_stock_data(symbol)
        if df is None:
            print(f"❌ Could not fetch data for {symbol}")
            continue
        
        print(f"✅ Fetched {len(df)} days of data")
        print(f"   Latest close: ${df['Close'].iloc[-1]:.2f}")
        print(f"   Date range: {df.index[0]} to {df.index[-1]}")
        
        # Run all pattern detectors
        detectors = {
            'Cup and Handle': monitor.detect_cup_and_handle,
            'Bull Flag': monitor.detect_bull_flag,
            'Head and Shoulders': monitor.detect_head_and_shoulders,
            'Inverse H&S': monitor.detect_inverse_head_and_shoulders,
            'Double Bottom': monitor.detect_double_bottom,
            'Double Top': monitor.detect_double_top,
            'Ascending Triangle': monitor.detect_ascending_triangle,
            'Falling Wedge': monitor.detect_falling_wedge,
        }
        
        found_any = False
        for pattern_name, detector in detectors.items():
            try:
                signal = detector(df, symbol)
                if signal:
                    found_any = True
                    print(f"\n  🎯 {pattern_name}: {signal.signal.upper()}")
                    print(f"     Confidence: {signal.confidence:.1%}")
                    print(f"     Entry: ${signal.entry_price:.2f}" if signal.entry_price else "")
                    print(f"     Target: ${signal.target_price:.2f}" if signal.target_price else "")
                    print(f"     Stop: ${signal.stop_loss:.2f}" if signal.stop_loss else "")
            except Exception as e:
                print(f"  ❌ Error detecting {pattern_name}: {e}")
        
        if not found_any:
            print("\n  ℹ️  No patterns detected above 50% confidence")

if __name__ == "__main__":
    main()
