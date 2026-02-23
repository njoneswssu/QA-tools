#!/usr/bin/env python3
import os
os.environ['YF_USE_CURL_CFFI'] = '0'

import yfinance as yf
import pandas as pd
from datetime import datetime

print(f"Today's date: {datetime.now()}")
print()

df = yf.download('AAPL', period='5d', progress=False)

if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.droplevel(1)

print(f"Data shape: {df.shape}")
print(f"\nFirst 3 rows:")
print(df.head(3))
print(f"\nLast 3 rows:")
print(df.tail(3))
print(f"\nDate index:")
print(df.index[-5:])
