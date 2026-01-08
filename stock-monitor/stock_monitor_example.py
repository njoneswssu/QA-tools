"""
Example usage of Stock Pattern Monitor
This demonstrates how to use the monitor programmatically
"""

from stock_pattern_monitor import StockPatternMonitor, PatternSignal
import json

def example_single_stock_analysis():
    """Analyze a single stock for patterns"""
    print("=" * 60)
    print("Example 1: Single Stock Analysis")
    print("=" * 60)
    
    monitor = StockPatternMonitor()
    
    # Analyze Apple
    symbol = "AAPL"
    print(f"\nAnalyzing {symbol}...")
    
    signals = monitor.analyze_stock(symbol)
    
    if signals:
        print(f"\n✅ Found {len(signals)} pattern(s) for {symbol}:\n")
        for signal in signals:
            print(f"Pattern: {signal.pattern}")
            print(f"Signal: {signal.signal.upper()}")
            print(f"Confidence: {signal.confidence:.1%}")
            print(f"Price: ${signal.price:.2f}")
            if signal.target_price:
                print(f"Target: ${signal.target_price:.2f}")
            if signal.stop_loss:
                print(f"Stop Loss: ${signal.stop_loss:.2f}")
            print(f"\nReasoning:\n{signal.reasoning}")
            print("-" * 60)
    else:
        print(f"❌ No patterns detected for {symbol}")


def example_multiple_stocks():
    """Analyze multiple specific stocks"""
    print("\n" + "=" * 60)
    print("Example 2: Multiple Stock Analysis")
    print("=" * 60)
    
    monitor = StockPatternMonitor()
    
    # Analyze FAANG stocks
    stocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
    
    all_signals = []
    
    for symbol in stocks:
        print(f"\n📊 Analyzing {symbol}...")
        signals = monitor.analyze_stock(symbol)
        
        if signals:
            print(f"   ✅ Found {len(signals)} pattern(s)")
            all_signals.extend(signals)
        else:
            print(f"   ➖ No patterns found")
    
    print("\n" + "=" * 60)
    print(f"SUMMARY: Found {len(all_signals)} total signals")
    print("=" * 60)
    
    # Group by signal type
    bullish = [s for s in all_signals if s.signal == 'bullish']
    bearish = [s for s in all_signals if s.signal == 'bearish']
    
    if bullish:
        print(f"\n🟢 Bullish Signals ({len(bullish)}):")
        for signal in sorted(bullish, key=lambda x: x.confidence, reverse=True):
            print(f"   - {signal.symbol}: {signal.pattern} ({signal.confidence:.1%})")
    
    if bearish:
        print(f"\n🔴 Bearish Signals ({len(bearish)}):")
        for signal in sorted(bearish, key=lambda x: x.confidence, reverse=True):
            print(f"   - {signal.symbol}: {signal.pattern} ({signal.confidence:.1%})")


def example_custom_config():
    """Example with custom configuration"""
    print("\n" + "=" * 60)
    print("Example 3: Custom Configuration")
    print("=" * 60)
    
    # Create custom config
    custom_config = {
        "discord_webhook": "",
        "check_interval_minutes": 30,
        "lookback_days": 60,
        "min_confidence": 0.65,  # Lower threshold
        "custom_stocks": ["NVDA", "AMD", "INTC", "QCOM"]  # Semiconductor stocks
    }
    
    # Save custom config temporarily
    with open('temp_config.json', 'w') as f:
        json.dump(custom_config, f, indent=2)
    
    # Create monitor with custom config
    monitor = StockPatternMonitor('temp_config.json')
    
    print(f"\nMonitoring {len(monitor.tech_stocks)} semiconductor stocks:")
    print(f"Stocks: {', '.join(monitor.tech_stocks)}")
    print(f"Min Confidence: {monitor.min_confidence:.1%}")
    print(f"Lookback Days: {monitor.lookback_days}")
    
    # Run analysis
    import os
    print("\nRunning scan...")
    signals = monitor.run_scan()
    
    print(f"\n✅ Scan complete! Found {len(signals)} signals")
    
    # Cleanup
    if os.path.exists('temp_config.json'):
        os.remove('temp_config.json')


def example_pattern_filtering():
    """Example of filtering signals by specific criteria"""
    print("\n" + "=" * 60)
    print("Example 4: Pattern Filtering")
    print("=" * 60)
    
    monitor = StockPatternMonitor()
    
    # Scan some stocks
    stocks = ["AAPL", "MSFT", "NVDA", "AMD", "GOOGL"]
    all_signals = []
    
    for symbol in stocks:
        signals = monitor.analyze_stock(symbol)
        all_signals.extend(signals)
    
    if not all_signals:
        print("No signals found to filter")
        return
    
    print(f"\nTotal signals found: {len(all_signals)}")
    
    # Filter high confidence bullish signals
    high_confidence_bullish = [
        s for s in all_signals 
        if s.signal == 'bullish' and s.confidence >= 0.80
    ]
    
    print(f"\n🎯 High Confidence Bullish Signals (≥80%):")
    if high_confidence_bullish:
        for signal in sorted(high_confidence_bullish, key=lambda x: x.confidence, reverse=True):
            upside = ((signal.target_price / signal.price) - 1) * 100 if signal.target_price else 0
            print(f"   - {signal.symbol}: {signal.pattern}")
            print(f"     Confidence: {signal.confidence:.1%}")
            print(f"     Upside: {upside:.1f}%")
            print()
    else:
        print("   None found")
    
    # Filter patterns with >10% potential move
    large_movers = [
        s for s in all_signals 
        if s.target_price and abs((s.target_price / s.price) - 1) > 0.10
    ]
    
    print(f"\n📈 Signals with >10% Potential Move:")
    if large_movers:
        for signal in sorted(large_movers, key=lambda x: abs((x.target_price/x.price)-1), reverse=True):
            move = ((signal.target_price / signal.price) - 1) * 100
            direction = "🟢" if signal.signal == 'bullish' else "🔴"
            print(f"   {direction} {signal.symbol}: {signal.pattern}")
            print(f"     Current: ${signal.price:.2f} → Target: ${signal.target_price:.2f} ({move:+.1f}%)")
    else:
        print("   None found")


def example_risk_analysis():
    """Example of analyzing risk/reward ratios"""
    print("\n" + "=" * 60)
    print("Example 5: Risk/Reward Analysis")
    print("=" * 60)
    
    monitor = StockPatternMonitor()
    
    stocks = ["AAPL", "MSFT", "GOOGL", "NVDA"]
    all_signals = []
    
    for symbol in stocks:
        signals = monitor.analyze_stock(symbol)
        all_signals.extend(signals)
    
    if not all_signals:
        print("No signals found to analyze")
        return
    
    print(f"\n📊 Risk/Reward Analysis for {len(all_signals)} signals:\n")
    
    for signal in all_signals:
        if signal.target_price and signal.stop_loss:
            reward = signal.target_price - signal.price
            risk = signal.price - signal.stop_loss
            
            if risk > 0:
                rr_ratio = reward / risk
                
                reward_pct = (reward / signal.price) * 100
                risk_pct = (risk / signal.price) * 100
                
                print(f"{signal.symbol} - {signal.pattern} ({signal.signal.upper()})")
                print(f"  Price: ${signal.price:.2f}")
                print(f"  Target: ${signal.target_price:.2f} (+{reward_pct:.1f}%)")
                print(f"  Stop: ${signal.stop_loss:.2f} (-{risk_pct:.1f}%)")
                print(f"  Risk/Reward Ratio: 1:{rr_ratio:.2f}")
                
                if rr_ratio >= 2:
                    print(f"  ✅ Favorable R/R (≥2:1)")
                elif rr_ratio >= 1.5:
                    print(f"  ⚠️  Acceptable R/R (1.5-2:1)")
                else:
                    print(f"  ❌ Poor R/R (<1.5:1)")
                
                print()


def main():
    """Run all examples"""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "STOCK PATTERN MONITOR EXAMPLES" + " " * 17 + "║")
    print("╚" + "=" * 58 + "╝")
    
    try:
        # Run examples
        example_single_stock_analysis()
        input("\nPress Enter to continue to next example...")
        
        example_multiple_stocks()
        input("\nPress Enter to continue to next example...")
        
        example_pattern_filtering()
        input("\nPress Enter to continue to next example...")
        
        example_risk_analysis()
        input("\nPress Enter to continue to next example...")
        
        # Ask about custom config (slower)
        print("\n" + "=" * 60)
        response = input("\nRun custom config example? (This will scan 4 stocks) [y/N]: ")
        if response.lower() == 'y':
            example_custom_config()
        
        print("\n" + "=" * 60)
        print("Examples completed!")
        print("=" * 60)
        print("\nTo run the full monitor:")
        print("  python stock_pattern_monitor.py scan      # Single scan")
        print("  python stock_pattern_monitor.py           # Continuous monitoring")
        print("\nOr use the startup scripts:")
        print("  ./start_stock_monitor.sh    (Mac/Linux)")
        print("  start_stock_monitor.bat     (Windows)")
        print()
        
    except KeyboardInterrupt:
        print("\n\nExamples interrupted by user")
    except Exception as e:
        print(f"\n❌ Error running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

