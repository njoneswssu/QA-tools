#!/usr/bin/env python3
"""Quick test script to check if yfinance is fetching data correctly"""

import os
os.environ['YF_USE_CURL_CFFI'] = '0'

import yfinance as yf
from datetime import datetime, timedelta

def test_ticker(symbol):
    print(f"\n{'='*50}")
    print(f"Testing {symbol}")
    print('='*50)
    
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        # Use download method for better reliability
        df = yf.download(
            symbol,
            start=start_date,
            end=end_date,
            progress=False,
            timeout=10
        )
        
        if df.empty:
            print(f"❌ No data returned for {symbol}")
            return False
        
        print(f"✅ Successfully fetched {len(df)} days of data")
        print(f"   Date range: {df.index[0]} to {df.index[-1]}")
        
        # Handle multi-index columns from yf.download
        close_val = df['Close'].iloc[-1]
        vol_val = df['Volume'].iloc[-1]
        
        # If it's a Series (multiple tickers), get the first value
        if hasattr(close_val, 'values'):
            close_val = close_val.values[0] if len(close_val.values) > 0 else close_val
        if hasattr(vol_val, 'values'):
            vol_val = vol_val.values[0] if len(vol_val.values) > 0 else vol_val
            
        print(f"   Latest close: ${float(close_val):.2f}")
        print(f"   Latest volume: {int(vol_val):,}")
        
        # Check if we have the necessary columns
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            print(f"❌ Missing columns: {missing}")
            return False
        
        print(f"✅ All required columns present")
        return True
        
    except Exception as e:
        print(f"❌ Error fetching {symbol}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Test a few stocks
    test_stocks = ['AAPL', 'MSFT', 'AMD', 'TSLA', 'NVDA']
    
    results = {}
    for symbol in test_stocks:
        results[symbol] = test_ticker(symbol)
    
    print(f"\n{'='*50}")
    print("SUMMARY")
    print('='*50)
    for symbol, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{symbol}: {status}")
    
    success_count = sum(results.values())
    print(f"\nTotal: {success_count}/{len(results)} successful")
