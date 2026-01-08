"""
Stock Pattern Monitor - Technical Analysis for Top Tech Stocks
Monitors chart patterns and sends Discord notifications for trading signals
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import time
import requests
from typing import Dict, List, Tuple, Optional
import logging
from dataclasses import dataclass, asdict
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle
import os
import base64
from io import BytesIO

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('stock_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class PatternSignal:
    """Data class for pattern signals"""
    symbol: str
    pattern: str
    signal: str  # 'bullish' or 'bearish'
    confidence: float
    price: float
    volume: int
    reasoning: str
    timestamp: str
    support_level: Optional[float] = None
    resistance_level: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    entry_price: Optional[float] = None


class StockPatternMonitor:
    """Monitor stocks for technical chart patterns"""
    
    def __init__(self, config_path: str = 'stock_monitor_config.json'):
        """Initialize the stock monitor"""
        self.config = self.load_config(config_path)
        self.discord_webhook = self.config.get('discord_webhook', '')
        self.check_interval = self.config.get('check_interval_minutes', 60)
        self.lookback_days = self.config.get('lookback_days', 90)
        self.chart_display_days = self.config.get('chart_display_days', min(90, self.lookback_days))
        self.min_confidence = self.config.get('min_confidence', 0.7)
        
        # Load top tech stocks
        self.tech_stocks = self.get_top_tech_stocks()
        logger.info(f"Monitoring {len(self.tech_stocks)} tech stocks")
        
        # Track previously sent signals to avoid duplicates
        self.sent_signals = set()
        
    def load_config(self, config_path: str) -> dict:
        """Load configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Config file not found, using defaults")
            return {
                'discord_webhook': '',
                'check_interval_minutes': 60,
                'lookback_days': 90,
                'min_confidence': 0.7
            }
    
    def get_top_tech_stocks(self) -> List[str]:
        """Get top 100 tech stocks by volume"""
        # Major tech stocks - you can expand this list
        tech_stocks = [
            # FAANG+
            'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA',
            # Semiconductors
            'AMD', 'INTC', 'QCOM', 'AVGO', 'TXN', 'MU', 'AMAT', 'LRCX', 'KLAC', 'MCHP',
            'ADI', 'NXPI', 'MRVL', 'ON', 'MPWR', 'SWKS', 'QRVO', 'WOLF', 'ASML',
            # Software/Cloud
            'CRM', 'ADBE', 'ORCL', 'NOW', 'INTU', 'PANW', 'CRWD', 'SNPS', 'CDNS',
            'WDAY', 'ZS', 'DDOG', 'NET', 'SNOW', 'MDB', 'TEAM', 'ZM', 'DOCU',
            'OKTA', 'TWLO', 'SPLK', 'VEEV', 'HUBS', 'RNG', 'ESTC', 'CFLT',
            # Hardware/Electronics
            'CSCO', 'IBM', 'HPQ', 'DELL', 'HPE', 'NTAP', 'STX', 'WDC',
            # Cybersecurity
            'FTNT', 'CHKP', 'CYBR', 'S', 'TENB', 'RPD',
            # Payments/Fintech
            'PYPL', 'SQ', 'V', 'MA', 'ADYEY', 'FISV', 'FIS',
            # Social Media/Entertainment
            'SNAP', 'PINS', 'SPOT', 'RBLX', 'U', 'MTCH',
            # E-commerce/Digital
            'SHOP', 'MELI', 'EBAY', 'BKNG', 'ABNB',
            # Other Tech
            'UBER', 'LYFT', 'DASH', 'COIN', 'ROKU', 'TTD', 'PLTR', 'AI'
        ]
        
        # If custom list provided in config
        if 'custom_stocks' in self.config and self.config['custom_stocks']:
            tech_stocks = self.config['custom_stocks']
        
        return tech_stocks[:100]  # Limit to 100
    
    def fetch_stock_data(self, symbol: str) -> Optional[pd.DataFrame]:
        """Fetch historical stock data"""
        try:
            ticker = yf.Ticker(symbol)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.lookback_days)
            
            df = ticker.history(start=start_date, end=end_date)
            
            if df.empty:
                logger.warning(f"No data for {symbol}")
                return None
            
            # Calculate technical indicators
            df = self.calculate_indicators(df)
            
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            return None
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators"""
        # Simple Moving Averages
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        df['SMA_50'] = df['Close'].rolling(window=50).mean()
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        
        # Exponential Moving Averages
        df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
        df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
        
        # MACD
        df['MACD'] = df['EMA_12'] - df['EMA_26']
        df['Signal_Line'] = df['MACD'].ewm(span=9, adjust=False).mean()
        
        # RSI
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['BB_Middle'] = df['Close'].rolling(window=20).mean()
        bb_std = df['Close'].rolling(window=20).std()
        df['BB_Upper'] = df['BB_Middle'] + (bb_std * 2)
        df['BB_Lower'] = df['BB_Middle'] - (bb_std * 2)
        
        # Volume indicators
        df['Volume_SMA'] = df['Volume'].rolling(window=20).mean()
        df['Volume_Ratio'] = df['Volume'] / df['Volume_SMA']
        
        # Average True Range (ATR)
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['ATR'] = true_range.rolling(14).mean()
        
        return df
    
    def generate_pattern_chart(self, df: pd.DataFrame, signal: PatternSignal) -> Optional[str]:
        """
        Generate a chart visualizing the detected pattern
        Returns: Base64 encoded image string or None
        """
        try:
            # Set style for better-looking charts
            plt.style.use('seaborn-v0_8-darkgrid')
            
            # Create figure with subplots
            fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), 
                                           gridspec_kw={'height_ratios': [3, 1]})
            
            # Get recent data (use configured chart_display_days or last portion of data)
            display_days = min(self.chart_display_days, len(df))
            recent_df = df.tail(display_days).copy()
            dates = recent_df.index
            
            # Plot 1: Price chart with pattern
            ax1.plot(dates, recent_df['Close'], linewidth=2, label='Price', color='#2E86AB')
            
            # Add moving averages
            if 'SMA_20' in recent_df.columns:
                ax1.plot(dates, recent_df['SMA_20'], linewidth=1, alpha=0.7, 
                        label='SMA 20', color='#A23B72', linestyle='--')
            if 'SMA_50' in recent_df.columns:
                ax1.plot(dates, recent_df['SMA_50'], linewidth=1, alpha=0.7,
                        label='SMA 50', color='#F18F01', linestyle='--')
            
            # Add Bollinger Bands
            if 'BB_Upper' in recent_df.columns and 'BB_Lower' in recent_df.columns:
                ax1.fill_between(dates, recent_df['BB_Upper'], recent_df['BB_Lower'],
                                alpha=0.1, color='gray', label='Bollinger Bands')
            
            # Highlight support and resistance levels
            if signal.support_level:
                ax1.axhline(y=signal.support_level, color='green', linestyle=':', 
                           linewidth=2, alpha=0.7, label=f'Support: ${signal.support_level:.2f}')
            if signal.resistance_level:
                ax1.axhline(y=signal.resistance_level, color='red', linestyle=':', 
                           linewidth=2, alpha=0.7, label=f'Resistance: ${signal.resistance_level:.2f}')
            
            # Highlight entry price
            if signal.entry_price:
                ax1.axhline(y=signal.entry_price, color='blue', linestyle='-', 
                           linewidth=2.5, alpha=0.9, label=f'Entry: ${signal.entry_price:.2f}')
            
            # Highlight target and stop loss
            if signal.target_price:
                ax1.axhline(y=signal.target_price, color='lime', linestyle='--',
                           linewidth=2, alpha=0.7, label=f'Target: ${signal.target_price:.2f}')
            if signal.stop_loss:
                ax1.axhline(y=signal.stop_loss, color='orangered', linestyle='--',
                           linewidth=2, alpha=0.7, label=f'Stop Loss: ${signal.stop_loss:.2f}')
            
            # Mark current price
            current_price = recent_df['Close'].iloc[-1]
            ax1.scatter(dates[-1], current_price, color='red', s=100, zorder=5,
                       label=f'Current: ${current_price:.2f}')
            
            # Add red outline box to highlight pattern area
            # Pattern typically forms in the last 30-60 days
            pattern_window = min(60, len(recent_df) // 2)  # Last 60 days or half the display
            pattern_start_idx = max(0, len(recent_df) - pattern_window)
            pattern_df = recent_df.iloc[pattern_start_idx:]
            
            if len(pattern_df) > 5:  # Only draw box if we have enough data
                # Get pattern boundaries
                pattern_start_date = pattern_df.index[0]
                pattern_end_date = pattern_df.index[-1]
                pattern_low = pattern_df['Close'].min() * 0.98  # Add 2% margin
                pattern_high = pattern_df['Close'].max() * 1.02  # Add 2% margin
                
                # Convert dates to matplotlib date numbers for the rectangle
                x_start = mdates.date2num(pattern_start_date)
                x_end = mdates.date2num(pattern_end_date)
                width = x_end - x_start
                height = pattern_high - pattern_low
                
                # Create red outline rectangle
                pattern_box = Rectangle(
                    (x_start, pattern_low), 
                    width, 
                    height,
                    linewidth=3,
                    edgecolor='red',
                    facecolor='none',
                    linestyle='-',
                    alpha=0.8,
                    zorder=3,
                    label='Pattern Area'
                )
                ax1.add_patch(pattern_box)
                
                # Add text annotation
                mid_date = mdates.date2num(pattern_start_date) + width / 2
                ax1.annotate('PATTERN DETECTED HERE', 
                           xy=(mid_date, pattern_high), 
                           xytext=(0, 10),
                           textcoords='offset points',
                           ha='center',
                           fontsize=10,
                           fontweight='bold',
                           color='red',
                           bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7, edgecolor='red'))
            
            # Set title and labels
            signal_emoji = '🟢' if signal.signal == 'bullish' else '🔴'
            ax1.set_title(f'{signal_emoji} {signal.pattern} - {signal.symbol} | Confidence: {signal.confidence:.1%}',
                         fontsize=16, fontweight='bold')
            ax1.set_ylabel('Price ($)', fontsize=12, fontweight='bold')
            ax1.legend(loc='best', fontsize=9)
            ax1.grid(True, alpha=0.3)
            
            # Format x-axis
            ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax1.xaxis.set_major_locator(mdates.DayLocator(interval=10))
            
            # Plot 2: Volume chart
            colors = ['green' if close >= open_price else 'red' 
                     for close, open_price in zip(recent_df['Close'], recent_df['Open'])]
            ax2.bar(dates, recent_df['Volume'], color=colors, alpha=0.6, width=0.8)
            
            # Add volume moving average
            if 'Volume_SMA' in recent_df.columns:
                ax2.plot(dates, recent_df['Volume_SMA'], color='blue', linewidth=2,
                        label='Vol SMA', alpha=0.7)
            
            ax2.set_ylabel('Volume', fontsize=12, fontweight='bold')
            ax2.set_xlabel('Date', fontsize=12, fontweight='bold')
            ax2.legend(loc='best', fontsize=9)
            ax2.grid(True, alpha=0.3)
            
            # Format x-axis
            ax2.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax2.xaxis.set_major_locator(mdates.DayLocator(interval=10))
            
            # Rotate date labels
            plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45)
            plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45)
            
            # Adjust layout
            plt.tight_layout()
            
            # Save to bytes buffer
            buf = BytesIO()
            plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
            buf.seek(0)
            
            # Convert to base64
            image_base64 = base64.b64encode(buf.read()).decode('utf-8')
            
            # Clean up
            plt.close(fig)
            buf.close()
            
            return image_base64
            
        except Exception as e:
            logger.error(f"Error generating chart for {signal.symbol}: {e}")
            return None
    
    def detect_cup_and_handle(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect cup and handle pattern (bullish)"""
        if len(df) < 50:
            return None
        
        try:
            # Look at last 50 days for the pattern
            recent = df.tail(50)
            prices = recent['Close'].values
            
            # Find the cup (U-shape)
            # Divide into left side, bottom, and right side
            third = len(prices) // 3
            left_side = prices[:third]
            middle = prices[third:2*third]
            right_side = prices[2*third:-10]  # Leave room for handle
            handle = prices[-10:]
            
            # Cup characteristics:
            # 1. Left rim and right rim should be at similar heights
            left_rim = np.max(left_side)
            right_rim = np.max(right_side)
            rim_diff = abs(left_rim - right_rim) / left_rim
            
            # 2. Bottom should be significantly lower (cup depth)
            bottom = np.min(middle)
            cup_depth = (left_rim - bottom) / left_rim
            
            # 3. Handle should have a small pullback
            handle_high = np.max(handle[:5])
            handle_low = np.min(handle[5:])
            handle_depth = (handle_high - handle_low) / handle_high
            
            # 4. Current price should be near breakout
            current_price = prices[-1]
            breakout_level = max(left_rim, right_rim)
            near_breakout = (breakout_level - current_price) / breakout_level
            
            # Check pattern validity
            if (rim_diff < 0.05 and  # Rims at similar height
                0.12 < cup_depth < 0.35 and  # Reasonable cup depth
                0.08 < handle_depth < 0.15 and  # Small handle pullback
                -0.02 < near_breakout < 0.03):  # Near breakout
                
                confidence = 1 - (rim_diff + abs(near_breakout))
                confidence = min(0.95, max(0.7, confidence))
                
                volume_recent = recent['Volume'].tail(10).mean()
                volume_avg = recent['Volume'].mean()
                volume_increase = volume_recent > volume_avg * 1.2
                
                if volume_increase:
                    confidence += 0.05
                
                target_price = breakout_level * 1.15  # 15% profit target
                stop_loss = handle_low * 0.98  # 2% below handle low
                # Entry price: Slightly above breakout for confirmation
                entry_price = breakout_level * 1.005  # 0.5% above breakout
                
                reasoning = (
                    f"Cup and Handle pattern detected:\n"
                    f"- Cup formed with {cup_depth:.1%} depth\n"
                    f"- Left and right rim aligned within {rim_diff:.1%}\n"
                    f"- Handle pullback of {handle_depth:.1%}\n"
                    f"- Current price ${current_price:.2f} near breakout at ${breakout_level:.2f}\n"
                    f"- {'Strong' if volume_increase else 'Moderate'} volume confirmation\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakout confirmation)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f} ({((stop_loss/entry_price)-1)*100:.1f}% from entry)"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Cup and Handle',
                    signal='bullish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=handle_low,
                    resistance_level=breakout_level,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Cup and handle detection error for {symbol}: {e}")
        
        return None
    
    def detect_bull_flag(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect bull flag pattern (continuation bullish)"""
        if len(df) < 30:
            return None
        
        try:
            recent = df.tail(30)
            prices = recent['Close'].values
            
            # Flag pole: sharp rise
            pole_start = prices[0]
            pole_end = prices[10]
            pole_rise = (pole_end - pole_start) / pole_start
            
            # Flag: consolidation with slight downward drift
            flag_prices = prices[10:]
            flag_high = np.max(flag_prices)
            flag_low = np.min(flag_prices)
            flag_range = (flag_high - flag_low) / flag_high
            
            # Check for downward sloping flag
            flag_slope = np.polyfit(range(len(flag_prices)), flag_prices, 1)[0]
            
            current_price = prices[-1]
            
            # Pattern validation
            if (pole_rise > 0.08 and  # Strong upward move (pole)
                flag_range < 0.10 and  # Tight consolidation
                flag_slope < 0 and  # Slight downward drift
                current_price > flag_low * 1.02):  # Not at the bottom
                
                confidence = min(0.9, 0.7 + pole_rise)
                
                # Volume should decrease in flag
                pole_volume = recent['Volume'].iloc[:10].mean()
                flag_volume = recent['Volume'].iloc[10:].mean()
                volume_decrease = flag_volume < pole_volume * 0.7
                
                if volume_decrease:
                    confidence += 0.05
                
                breakout_level = flag_high
                target_price = breakout_level + (pole_end - pole_start)  # Pole height projection
                stop_loss = flag_low * 0.98
                # Entry price: At breakout level with slight premium
                entry_price = breakout_level * 1.003  # 0.3% above breakout
                
                reasoning = (
                    f"Bull Flag pattern detected:\n"
                    f"- Strong pole with {pole_rise:.1%} rise\n"
                    f"- Tight flag consolidation ({flag_range:.1%} range)\n"
                    f"- {'Decreasing' if volume_decrease else 'Stable'} volume in flag\n"
                    f"- Current price ${current_price:.2f}\n"
                    f"- Breakout level: ${breakout_level:.2f}\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakout)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Bull Flag',
                    signal='bullish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=flag_low,
                    resistance_level=breakout_level,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Bull flag detection error for {symbol}: {e}")
        
        return None
    
    def detect_head_and_shoulders(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect head and shoulders pattern (bearish)"""
        if len(df) < 60:
            return None
        
        try:
            recent = df.tail(60)
            prices = recent['Close'].values
            
            # Find local maxima for shoulders and head
            from scipy.signal import find_peaks
            peaks, _ = find_peaks(prices, distance=10, prominence=prices.std() * 0.5)
            
            if len(peaks) < 3:
                return None
            
            # Take last 3 peaks
            peaks = peaks[-3:]
            
            left_shoulder_idx = peaks[0]
            head_idx = peaks[1]
            right_shoulder_idx = peaks[2]
            
            left_shoulder = prices[left_shoulder_idx]
            head = prices[head_idx]
            right_shoulder = prices[right_shoulder_idx]
            
            # Find neckline (support between shoulders)
            segment1 = prices[left_shoulder_idx:head_idx]
            segment2 = prices[head_idx:right_shoulder_idx]
            neckline_1 = np.min(segment1) if len(segment1) > 0 else left_shoulder
            neckline_2 = np.min(segment2) if len(segment2) > 0 else right_shoulder
            neckline = (neckline_1 + neckline_2) / 2
            
            current_price = prices[-1]
            
            # Pattern validation
            shoulder_symmetry = abs(left_shoulder - right_shoulder) / head
            head_prominence = (head - max(left_shoulder, right_shoulder)) / head
            
            if (shoulder_symmetry < 0.08 and  # Shoulders at similar height
                head_prominence > 0.05 and  # Head significantly higher
                current_price < neckline * 1.02):  # Near or below neckline
                
                confidence = 0.8 - (shoulder_symmetry * 2)
                
                # Volume should increase on breakdown
                recent_volume = recent['Volume'].tail(5).mean()
                avg_volume = recent['Volume'].mean()
                volume_increase = recent_volume > avg_volume * 1.2
                
                if volume_increase:
                    confidence += 0.1
                
                # Target is head-to-neckline distance projected down
                pattern_height = head - neckline
                target_price = neckline - pattern_height
                stop_loss = right_shoulder * 1.02
                # Entry price: Slightly below neckline for breakdown confirmation
                entry_price = neckline * 0.997  # 0.3% below neckline
                
                reasoning = (
                    f"Head and Shoulders pattern detected (BEARISH):\n"
                    f"- Left shoulder: ${left_shoulder:.2f}\n"
                    f"- Head: ${head:.2f}\n"
                    f"- Right shoulder: ${right_shoulder:.2f}\n"
                    f"- Neckline: ${neckline:.2f}\n"
                    f"- Shoulder symmetry: {shoulder_symmetry:.1%}\n"
                    f"- Current price ${current_price:.2f} {'below' if current_price < neckline else 'near'} neckline\n"
                    f"- {'Strong' if volume_increase else 'Weak'} volume on breakdown\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakdown confirmation)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Head and Shoulders',
                    signal='bearish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=target_price,
                    resistance_level=neckline,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Head and shoulders detection error for {symbol}: {e}")
        
        return None
    
    def detect_inverse_head_and_shoulders(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect inverse head and shoulders pattern (bullish)"""
        if len(df) < 60:
            return None
        
        try:
            recent = df.tail(60)
            prices = recent['Close'].values
            
            # Find local minima for shoulders and head
            from scipy.signal import find_peaks
            troughs, _ = find_peaks(-prices, distance=10, prominence=prices.std() * 0.5)
            
            if len(troughs) < 3:
                return None
            
            # Take last 3 troughs
            troughs = troughs[-3:]
            
            left_shoulder_idx = troughs[0]
            head_idx = troughs[1]
            right_shoulder_idx = troughs[2]
            
            left_shoulder = prices[left_shoulder_idx]
            head = prices[head_idx]
            right_shoulder = prices[right_shoulder_idx]
            
            # Find neckline (resistance between shoulders)
            segment1 = prices[left_shoulder_idx:head_idx]
            segment2 = prices[head_idx:right_shoulder_idx]
            neckline_1 = np.max(segment1) if len(segment1) > 0 else left_shoulder
            neckline_2 = np.max(segment2) if len(segment2) > 0 else right_shoulder
            neckline = (neckline_1 + neckline_2) / 2
            
            current_price = prices[-1]
            
            # Pattern validation
            shoulder_symmetry = abs(left_shoulder - right_shoulder) / head
            head_prominence = (min(left_shoulder, right_shoulder) - head) / head
            
            if (shoulder_symmetry < 0.08 and  # Shoulders at similar height
                head_prominence > 0.05 and  # Head significantly lower
                current_price > neckline * 0.98):  # Near or above neckline
                
                confidence = 0.8 - (shoulder_symmetry * 2)
                
                # Volume should increase on breakout
                recent_volume = recent['Volume'].tail(5).mean()
                avg_volume = recent['Volume'].mean()
                volume_increase = recent_volume > avg_volume * 1.2
                
                if volume_increase:
                    confidence += 0.1
                
                # Target is neckline-to-head distance projected up
                pattern_height = neckline - head
                target_price = neckline + pattern_height
                stop_loss = right_shoulder * 0.98
                # Entry price: Slightly above neckline for breakout confirmation
                entry_price = neckline * 1.003  # 0.3% above neckline
                
                reasoning = (
                    f"Inverse Head and Shoulders pattern detected (BULLISH):\n"
                    f"- Left shoulder: ${left_shoulder:.2f}\n"
                    f"- Head: ${head:.2f}\n"
                    f"- Right shoulder: ${right_shoulder:.2f}\n"
                    f"- Neckline: ${neckline:.2f}\n"
                    f"- Shoulder symmetry: {shoulder_symmetry:.1%}\n"
                    f"- Current price ${current_price:.2f} {'above' if current_price > neckline else 'near'} neckline\n"
                    f"- {'Strong' if volume_increase else 'Weak'} volume on breakout\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakout confirmation)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Inverse Head and Shoulders',
                    signal='bullish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=stop_loss,
                    resistance_level=neckline,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Inverse head and shoulders detection error for {symbol}: {e}")
        
        return None
    
    def detect_double_bottom(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect double bottom pattern (bullish)"""
        if len(df) < 40:
            return None
        
        try:
            recent = df.tail(40)
            prices = recent['Close'].values
            
            # Find local minima
            from scipy.signal import find_peaks
            troughs, _ = find_peaks(-prices, distance=8, prominence=prices.std() * 0.3)
            
            if len(troughs) < 2:
                return None
            
            # Take last 2 troughs
            first_bottom_idx = troughs[-2]
            second_bottom_idx = troughs[-1]
            
            first_bottom = prices[first_bottom_idx]
            second_bottom = prices[second_bottom_idx]
            
            # Find peak between bottoms
            between = prices[first_bottom_idx:second_bottom_idx]
            if len(between) == 0:
                return None
            
            peak_between = np.max(between)
            peak_idx = first_bottom_idx + np.argmax(between)
            
            current_price = prices[-1]
            
            # Pattern validation
            bottom_symmetry = abs(first_bottom - second_bottom) / first_bottom
            pattern_depth = (peak_between - first_bottom) / first_bottom
            
            if (bottom_symmetry < 0.03 and  # Bottoms at similar level
                pattern_depth > 0.04 and  # Significant depth
                current_price > first_bottom * 1.02):  # Above bottoms
                
                confidence = 0.85 - (bottom_symmetry * 5)
                
                # Check if price is breaking through resistance
                near_breakout = abs(current_price - peak_between) / peak_between < 0.02
                if near_breakout:
                    confidence += 0.05
                
                # Volume confirmation
                second_bottom_volume = recent['Volume'].iloc[second_bottom_idx]
                first_bottom_volume = recent['Volume'].iloc[first_bottom_idx]
                volume_decrease = second_bottom_volume < first_bottom_volume
                
                if volume_decrease:
                    confidence += 0.05
                
                pattern_height = peak_between - min(first_bottom, second_bottom)
                target_price = peak_between + pattern_height
                stop_loss = min(first_bottom, second_bottom) * 0.98
                # Entry price: Slightly above resistance for breakout confirmation
                entry_price = peak_between * 1.005  # 0.5% above resistance
                
                reasoning = (
                    f"Double Bottom pattern detected (BULLISH):\n"
                    f"- First bottom: ${first_bottom:.2f}\n"
                    f"- Second bottom: ${second_bottom:.2f}\n"
                    f"- Resistance level: ${peak_between:.2f}\n"
                    f"- Bottom symmetry: {bottom_symmetry:.1%}\n"
                    f"- Current price: ${current_price:.2f}\n"
                    f"- {'Decreasing' if volume_decrease else 'Increasing'} volume on second bottom (bullish)\n"
                    f"- {'Near breakout' if near_breakout else 'Forming'}\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakout)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Double Bottom',
                    signal='bullish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=min(first_bottom, second_bottom),
                    resistance_level=peak_between,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Double bottom detection error for {symbol}: {e}")
        
        return None
    
    def detect_double_top(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect double top pattern (bearish)"""
        if len(df) < 40:
            return None
        
        try:
            recent = df.tail(40)
            prices = recent['Close'].values
            
            # Find local maxima
            from scipy.signal import find_peaks
            peaks, _ = find_peaks(prices, distance=8, prominence=prices.std() * 0.3)
            
            if len(peaks) < 2:
                return None
            
            # Take last 2 peaks
            first_top_idx = peaks[-2]
            second_top_idx = peaks[-1]
            
            first_top = prices[first_top_idx]
            second_top = prices[second_top_idx]
            
            # Find trough between tops
            between = prices[first_top_idx:second_top_idx]
            if len(between) == 0:
                return None
            
            trough_between = np.min(between)
            trough_idx = first_top_idx + np.argmin(between)
            
            current_price = prices[-1]
            
            # Pattern validation
            top_symmetry = abs(first_top - second_top) / first_top
            pattern_depth = (first_top - trough_between) / first_top
            
            if (top_symmetry < 0.03 and  # Tops at similar level
                pattern_depth > 0.04 and  # Significant depth
                current_price < first_top * 0.98):  # Below tops
                
                confidence = 0.85 - (top_symmetry * 5)
                
                # Check if price is breaking through support
                near_breakdown = abs(current_price - trough_between) / trough_between < 0.02
                if near_breakdown:
                    confidence += 0.05
                
                # Volume confirmation
                second_top_volume = recent['Volume'].iloc[second_top_idx]
                first_top_volume = recent['Volume'].iloc[first_top_idx]
                volume_decrease = second_top_volume < first_top_volume
                
                if volume_decrease:
                    confidence += 0.05
                
                pattern_height = max(first_top, second_top) - trough_between
                target_price = trough_between - pattern_height
                stop_loss = max(first_top, second_top) * 1.02
                # Entry price: Slightly below support for breakdown confirmation
                entry_price = trough_between * 0.995  # 0.5% below support
                
                reasoning = (
                    f"Double Top pattern detected (BEARISH):\n"
                    f"- First top: ${first_top:.2f}\n"
                    f"- Second top: ${second_top:.2f}\n"
                    f"- Support level: ${trough_between:.2f}\n"
                    f"- Top symmetry: {top_symmetry:.1%}\n"
                    f"- Current price: ${current_price:.2f}\n"
                    f"- {'Decreasing' if volume_decrease else 'Increasing'} volume on second top (bearish)\n"
                    f"- {'Near breakdown' if near_breakdown else 'Forming'}\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakdown)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Double Top',
                    signal='bearish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=trough_between,
                    resistance_level=max(first_top, second_top),
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Double top detection error for {symbol}: {e}")
        
        return None
    
    def detect_ascending_triangle(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect ascending triangle pattern (bullish)"""
        if len(df) < 30:
            return None
        
        try:
            recent = df.tail(30)
            prices = recent['Close'].values
            highs = recent['High'].values
            lows = recent['Low'].values
            
            # Resistance should be flat (horizontal)
            resistance_prices = []
            from scipy.signal import find_peaks
            peaks, _ = find_peaks(highs, distance=5)
            
            if len(peaks) < 2:
                return None
            
            for peak in peaks:
                resistance_prices.append(highs[peak])
            
            resistance = np.mean(resistance_prices)
            resistance_flatness = np.std(resistance_prices) / resistance
            
            # Support should be rising
            troughs, _ = find_peaks(-lows, distance=5)
            if len(troughs) < 2:
                return None
            
            support_slope = np.polyfit(troughs, [lows[i] for i in troughs], 1)[0]
            
            current_price = prices[-1]
            
            if (resistance_flatness < 0.02 and  # Flat resistance
                support_slope > 0 and  # Rising support
                current_price > lows[-1] * 1.01):  # Above recent low
                
                confidence = 0.75
                
                # Check proximity to breakout
                near_resistance = (resistance - current_price) / resistance < 0.02
                if near_resistance:
                    confidence += 0.1
                
                # Volume should increase toward apex
                recent_vol = recent['Volume'].tail(10).mean()
                earlier_vol = recent['Volume'].head(10).mean()
                if recent_vol > earlier_vol:
                    confidence += 0.05
                
                pattern_height = resistance - np.min([lows[i] for i in troughs])
                target_price = resistance + pattern_height
                stop_loss = np.min([lows[i] for i in troughs[-2:]])
                # Entry price: Slightly above resistance for breakout confirmation
                entry_price = resistance * 1.004  # 0.4% above resistance
                
                reasoning = (
                    f"Ascending Triangle pattern detected (BULLISH):\n"
                    f"- Flat resistance at ${resistance:.2f}\n"
                    f"- Rising support line (slope: {support_slope:.4f})\n"
                    f"- Current price: ${current_price:.2f}\n"
                    f"- {'Near' if near_resistance else 'Approaching'} breakout\n"
                    f"- Suggested entry: ${entry_price:.2f} (on breakout)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Ascending Triangle',
                    signal='bullish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=stop_loss,
                    resistance_level=resistance,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Ascending triangle detection error for {symbol}: {e}")
        
        return None
    
    def detect_falling_wedge(self, df: pd.DataFrame, symbol: str) -> Optional[PatternSignal]:
        """Detect falling wedge pattern (bullish)"""
        if len(df) < 30:
            return None
        
        try:
            recent = df.tail(30)
            highs = recent['High'].values
            lows = recent['Low'].values
            prices = recent['Close'].values
            
            # Both support and resistance should be declining
            # But resistance declining faster (converging downward)
            
            from scipy.signal import find_peaks
            peaks, _ = find_peaks(highs, distance=5)
            troughs, _ = find_peaks(-lows, distance=5)
            
            if len(peaks) < 2 or len(troughs) < 2:
                return None
            
            # Fit lines to peaks and troughs
            resistance_slope = np.polyfit(peaks, [highs[i] for i in peaks], 1)[0]
            support_slope = np.polyfit(troughs, [lows[i] for i in troughs], 1)[0]
            
            current_price = prices[-1]
            
            # Both should be declining, resistance faster
            if (resistance_slope < 0 and
                support_slope < 0 and
                abs(resistance_slope) > abs(support_slope)):
                
                confidence = 0.75
                
                # Check if breaking upward
                recent_momentum = prices[-1] - prices[-5]
                if recent_momentum > 0:
                    confidence += 0.1
                
                # Volume should decrease then increase on breakout
                recent_vol = recent['Volume'].tail(5).mean()
                mid_vol = recent['Volume'].iloc[10:20].mean()
                if recent_vol > mid_vol * 1.2:
                    confidence += 0.05
                
                # Estimate breakout level
                resistance_line = resistance_slope * len(prices) + highs[peaks[0]]
                pattern_height = highs[peaks[0]] - lows[troughs[0]]
                target_price = current_price + pattern_height * 0.7
                stop_loss = np.min([lows[i] for i in troughs[-2:]])
                # Entry price: Near current resistance line for breakout
                entry_price = resistance_line * 1.003  # 0.3% above resistance line
                
                reasoning = (
                    f"Falling Wedge pattern detected (BULLISH):\n"
                    f"- Converging downward trend lines\n"
                    f"- Resistance slope: {resistance_slope:.4f}\n"
                    f"- Support slope: {support_slope:.4f}\n"
                    f"- Current price: ${current_price:.2f}\n"
                    f"- {'Positive' if recent_momentum > 0 else 'Neutral'} momentum\n"
                    f"- Suggested entry: ${entry_price:.2f} (on upward breakout)\n"
                    f"- Target: ${target_price:.2f} ({((target_price/entry_price)-1)*100:.1f}% from entry)\n"
                    f"- Stop Loss: ${stop_loss:.2f}"
                )
                
                return PatternSignal(
                    symbol=symbol,
                    pattern='Falling Wedge',
                    signal='bullish',
                    confidence=confidence,
                    price=current_price,
                    volume=int(recent['Volume'].iloc[-1]),
                    reasoning=reasoning,
                    timestamp=datetime.now().isoformat(),
                    support_level=stop_loss,
                    resistance_level=resistance_line,
                    target_price=target_price,
                    stop_loss=stop_loss,
                    entry_price=entry_price
                )
        
        except Exception as e:
            logger.debug(f"Falling wedge detection error for {symbol}: {e}")
        
        return None
    
    def analyze_stock(self, symbol: str) -> List[PatternSignal]:
        """Analyze a single stock for all patterns"""
        signals = []
        
        try:
            df = self.fetch_stock_data(symbol)
            if df is None or len(df) < 30:
                return signals
            
            # Run all pattern detectors
            detectors = [
                self.detect_cup_and_handle,
                self.detect_bull_flag,
                self.detect_head_and_shoulders,
                self.detect_inverse_head_and_shoulders,
                self.detect_double_bottom,
                self.detect_double_top,
                self.detect_ascending_triangle,
                self.detect_falling_wedge,
            ]
            
            for detector in detectors:
                signal = detector(df, symbol)
                if signal and signal.confidence >= self.min_confidence:
                    signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error analyzing {symbol}: {e}")
        
        return signals
    
    def send_discord_notification(self, signal: PatternSignal, df: pd.DataFrame = None):
        """Send pattern signal to Discord webhook with chart image"""
        if not self.discord_webhook:
            logger.warning("No Discord webhook configured")
            return
        
        # Create unique signal ID to avoid duplicates
        signal_id = f"{signal.symbol}_{signal.pattern}_{signal.timestamp[:10]}"
        if signal_id in self.sent_signals:
            return
        
        # Color based on signal type
        color = 0x00FF00 if signal.signal == 'bullish' else 0xFF0000
        
        # Format the embed
        embed = {
            "title": f"🚨 {signal.pattern} Pattern Detected: {signal.symbol}",
            "description": signal.reasoning,
            "color": color,
            "fields": [
                {
                    "name": "Signal Type",
                    "value": signal.signal.upper(),
                    "inline": True
                },
                {
                    "name": "Confidence",
                    "value": f"{signal.confidence:.1%}",
                    "inline": True
                },
                {
                    "name": "Current Price",
                    "value": f"${signal.price:.2f}",
                    "inline": True
                },
                {
                    "name": "Volume",
                    "value": f"{signal.volume:,}",
                    "inline": True
                }
            ],
            "timestamp": signal.timestamp,
            "footer": {
                "text": "Stock Pattern Monitor"
            }
        }
        
        # Add entry price if available
        if signal.entry_price:
            embed["fields"].append({
                "name": "💰 Suggested Entry",
                "value": f"${signal.entry_price:.2f}",
                "inline": True
            })
        
        # Add price levels if available
        if signal.target_price:
            embed["fields"].append({
                "name": "🎯 Target Price",
                "value": f"${signal.target_price:.2f}",
                "inline": True
            })
        
        if signal.stop_loss:
            embed["fields"].append({
                "name": "🛑 Stop Loss",
                "value": f"${signal.stop_loss:.2f}",
                "inline": True
            })
        
        # Calculate risk/reward ratio if all prices available
        if signal.entry_price and signal.target_price and signal.stop_loss:
            risk = abs(signal.entry_price - signal.stop_loss)
            reward = abs(signal.target_price - signal.entry_price)
            rr_ratio = reward / risk if risk > 0 else 0
            embed["fields"].append({
                "name": "📊 Risk/Reward",
                "value": f"1:{rr_ratio:.2f}",
                "inline": True
            })
        
        # Generate chart if dataframe provided
        chart_base64 = None
        if df is not None:
            chart_base64 = self.generate_pattern_chart(df, signal)
        
        # If chart generated successfully, add it to embed
        if chart_base64:
            embed["image"] = {
                "url": f"attachment://chart.png"
            }
        
        payload = {
            "embeds": [embed]
        }
        
        try:
            # Send with chart image if available
            if chart_base64:
                # Convert base64 to bytes
                import base64
                chart_bytes = base64.b64decode(chart_base64)
                
                # Create multipart form data
                files = {
                    'file': ('chart.png', chart_bytes, 'image/png')
                }
                data = {
                    'payload_json': json.dumps(payload)
                }
                
                response = requests.post(self.discord_webhook, data=data, files=files)
            else:
                # Send without image
                response = requests.post(self.discord_webhook, json=payload)
            
            if response.status_code == 204 or response.status_code == 200:
                logger.info(f"Sent Discord notification for {signal.symbol} - {signal.pattern}")
                self.sent_signals.add(signal_id)
            else:
                logger.error(f"Discord webhook failed: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Error sending Discord notification: {e}")
    
    def run_scan(self):
        """Run a single scan of all stocks"""
        logger.info(f"Starting scan of {len(self.tech_stocks)} stocks...")
        
        all_signals = []
        
        for i, symbol in enumerate(self.tech_stocks):
            logger.info(f"Analyzing {symbol} ({i+1}/{len(self.tech_stocks)})")
            
            # Fetch data for chart generation
            df = self.fetch_stock_data(symbol)
            if df is None:
                continue
            
            signals = self.analyze_stock(symbol)
            
            for signal in signals:
                logger.info(f"Found {signal.pattern} for {symbol} ({signal.signal}, {signal.confidence:.1%})")
                all_signals.append(signal)
                # Pass dataframe for chart generation
                self.send_discord_notification(signal, df)
            
            # Rate limiting to avoid API throttling
            time.sleep(0.5)
        
        logger.info(f"Scan complete. Found {len(all_signals)} signals")
        return all_signals
    
    def run_continuous(self):
        """Run continuous monitoring"""
        logger.info("Starting continuous stock pattern monitoring...")
        logger.info(f"Check interval: {self.check_interval} minutes")
        logger.info(f"Monitoring {len(self.tech_stocks)} stocks")
        
        while True:
            try:
                self.run_scan()
                logger.info(f"Waiting {self.check_interval} minutes until next scan...")
                time.sleep(self.check_interval * 60)
            except KeyboardInterrupt:
                logger.info("Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(60)
    
    def test_discord_webhook(self, stock_symbol: str = 'AAPL'):
        """Test Discord webhook with a sample notification"""
        if not self.discord_webhook:
            logger.error("❌ No Discord webhook configured in stock_monitor_config.json")
            print("\n❌ ERROR: No Discord webhook URL found!")
            print("Please add your webhook URL to stock_monitor_config.json")
            return False
        
        try:
            print(f"\n🔔 Testing Discord webhook notification...")
            print(f"📊 Fetching data for {stock_symbol}...")
            
            # Fetch data for the test stock
            df = self.fetch_stock_data(stock_symbol)
            if df is None:
                logger.error(f"Could not fetch data for {stock_symbol}")
                print(f"❌ Could not fetch data for {stock_symbol}")
                return False
            
            # Get current price and volume
            current_price = df['Close'].iloc[-1]
            current_volume = int(df['Volume'].iloc[-1])
            
            # Create a test signal
            test_signal = PatternSignal(
                symbol=stock_symbol,
                pattern='Test Pattern (Cup and Handle)',
                signal='bullish',
                confidence=0.85,
                price=current_price,
                volume=current_volume,
                reasoning=(
                    f"🧪 TEST NOTIFICATION - Discord Webhook Test\n\n"
                    f"This is a test notification from Stock Pattern Monitor.\n"
                    f"If you're seeing this, your Discord webhook is working correctly!\n\n"
                    f"Sample pattern details:\n"
                    f"- Current price: ${current_price:.2f}\n"
                    f"- Volume: {current_volume:,}\n"
                    f"- Chart shows last {self.chart_display_days} days of price action\n"
                    f"- Lookback period: {self.lookback_days} days\n\n"
                    f"✅ Configuration is correct. Ready for live monitoring!"
                ),
                timestamp=datetime.now().isoformat(),
                support_level=current_price * 0.95,
                resistance_level=current_price * 1.05,
                target_price=current_price * 1.15,
                stop_loss=current_price * 0.92,
                entry_price=current_price * 1.005
            )
            
            print(f"📊 Generating test chart...")
            
            # Send the test notification with chart
            self.send_discord_notification(test_signal, df)
            
            print(f"\n✅ SUCCESS! Test notification sent to Discord!")
            print(f"📱 Check your Discord channel for the test message.")
            print(f"📊 Chart display days: {self.chart_display_days}")
            print(f"📅 Lookback period: {self.lookback_days} days")
            
            return True
            
        except Exception as e:
            logger.error(f"Error testing Discord webhook: {e}")
            print(f"\n❌ ERROR: Failed to send test notification")
            print(f"Error details: {e}")
            return False


def main():
    """Main entry point"""
    import sys
    
    # Check for command line arguments
    mode = sys.argv[1] if len(sys.argv) > 1 else 'continuous'
    
    # Show help
    if mode in ['help', '--help', '-h']:
        print("""
Stock Pattern Monitor - Usage:

Commands:
  python stock_pattern_monitor.py                    - Run continuous monitoring (default)
  python stock_pattern_monitor.py scan               - Run single scan
  python stock_pattern_monitor.py test-webhook       - Test Discord webhook notification
  python stock_pattern_monitor.py test-webhook TSLA  - Test webhook with specific stock
  python stock_pattern_monitor.py help               - Show this help message

Configuration:
  Edit stock_monitor_config.json to configure:
  - discord_webhook: Your Discord webhook URL
  - lookback_days: Days of historical data to analyze (default: 90)
  - chart_display_days: Days to show in charts (default: 90)
  - check_interval_minutes: Minutes between scans (default: 60)
  - min_confidence: Minimum confidence threshold (default: 0.75)
  - custom_stocks: List of stock symbols to monitor

Examples:
  python stock_pattern_monitor.py scan
  python stock_pattern_monitor.py test-webhook
  python stock_pattern_monitor.py test-webhook NVDA
""")
        return
    
    monitor = StockPatternMonitor()
    
    if mode == 'scan':
        # Single scan
        signals = monitor.run_scan()
        print(f"\nFound {len(signals)} signals:")
        for signal in signals:
            print(f"- {signal.symbol}: {signal.pattern} ({signal.signal}) - {signal.confidence:.1%}")
    
    elif mode == 'test-webhook':
        # Test Discord webhook
        test_symbol = sys.argv[2] if len(sys.argv) > 2 else 'AAPL'
        monitor.test_discord_webhook(test_symbol)
    
    else:
        # Continuous monitoring
        monitor.run_continuous()


if __name__ == "__main__":
    main()

