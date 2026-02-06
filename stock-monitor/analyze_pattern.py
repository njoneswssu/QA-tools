#!/usr/bin/env python3
"""Check what's preventing pattern detection"""

import os
os.environ['YF_USE_CURL_CFFI'] = '0'

import sys
sys.path.insert(0, '/Users/neil/playwrightautomation/stock-monitor')

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Fetch AMD data (which showed patterns on Jan 7)
symbol = 'AMD'
end_date = datetime.now()
start_date = end_date - timedelta(days=90)  # Use 90 days like before

df = yf.download(symbol, start=start_date, end=end_date, progress=False)

if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.droplevel(1)

print(f"Symbol: {symbol}")
print(f"Data points: {len(df)}")
print(f"Date range: {df.index[0]} to {df.index[-1]}")
print(f"Current price: ${df['Close'].iloc[-1]:.2f}")
print()

# Test double bottom detection
from scipy.signal import find_peaks

recent = df.tail(40)
prices = recent['Close'].values

print(f"Testing Double Bottom pattern:")
print(f"Last 40 days price range: ${prices.min():.2f} to ${prices.max():.2f}")

troughs, properties = find_peaks(-prices, distance=8, prominence=prices.std() * 0.3)
print(f"Found {len(troughs)} troughs")

if len(troughs) >= 2:
    first_bottom_idx = troughs[-2]
    second_bottom_idx = troughs[-1]
    first_bottom = prices[first_bottom_idx]
    second_bottom = prices[second_bottom_idx]
    
    bottom_symmetry = abs(first_bottom - second_bottom) / first_bottom
    
    print(f"First bottom: ${first_bottom:.2f} at index {first_bottom_idx}")
    print(f"Second bottom: ${second_bottom:.2f} at index {second_bottom_idx}")
    print(f"Bottom symmetry: {bottom_symmetry:.3f} (needs < 0.03)")
    
    between = prices[first_bottom_idx:second_bottom_idx]
    if len(between) > 0:
        peak_between = np.max(between)
        pattern_depth = (peak_between - first_bottom) / first_bottom
        print(f"Peak between: ${peak_between:.2f}")
        print(f"Pattern depth: {pattern_depth:.3f} (needs > 0.04)")
        
        current_price = prices[-1]
        print(f"Current price: ${current_price:.2f}")
        print(f"Above first bottom: {current_price > first_bottom * 1.02}")
        
        if bottom_symmetry < 0.03 and pattern_depth > 0.04 and current_price > first_bottom * 1.02:
            print("\n✅ Double Bottom pattern WOULD be detected!")
        else:
            print("\n❌ Double Bottom criteria not met")
else:
    print("Not enough troughs found")

print("\n" + "="*60)

# Test double top
print(f"\nTesting Double Top pattern:")
peaks_idx, _ = find_peaks(prices, distance=8, prominence=prices.std() * 0.3)
print(f"Found {len(peaks_idx)} peaks")

if len(peaks_idx) >= 2:
    first_top_idx = peaks_idx[-2]
    second_top_idx = peaks_idx[-1]
    first_top = prices[first_top_idx]
    second_top = prices[second_top_idx]
    
    top_symmetry = abs(first_top - second_top) / first_top
    
    print(f"First top: ${first_top:.2f} at index {first_top_idx}")
    print(f"Second top: ${second_top:.2f} at index {second_top_idx}")
    print(f"Top symmetry: {top_symmetry:.3f} (needs < 0.03)")
    
    between = prices[first_top_idx:second_top_idx]
    if len(between) > 0:
        trough_between = np.min(between)
        pattern_depth = (first_top - trough_between) / first_top
        print(f"Trough between: ${trough_between:.2f}")
        print(f"Pattern depth: {pattern_depth:.3f} (needs > 0.04)")
        
        current_price = prices[-1]
        print(f"Current price: ${current_price:.2f}")
        print(f"Below first top: {current_price < first_top * 0.98}")
        
        if top_symmetry < 0.03 and pattern_depth > 0.04 and current_price < first_top * 0.98:
            print("\n✅ Double Top pattern WOULD be detected!")
        else:
            print("\n❌ Double Top criteria not met")
else:
    print("Not enough peaks found")
