#!/bin/bash

# Stock Pattern Monitor Startup Script

echo "==================================="
echo "Stock Pattern Monitor"
echo "==================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if dependencies are installed
if ! python3 -c "import yfinance" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements_stock.txt
    echo ""
fi

# Check if config exists
if [ ! -f "stock_monitor_config.json" ]; then
    echo "Error: stock_monitor_config.json not found"
    echo "Please create the config file with your Discord webhook"
    exit 1
fi

# Check if Discord webhook is configured
if grep -q '""' stock_monitor_config.json; then
    echo "Warning: Discord webhook not configured in stock_monitor_config.json"
    echo "Notifications will not be sent until you add your webhook URL"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Starting Stock Pattern Monitor..."
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run the monitor
python3 stock_pattern_monitor.py

echo ""
echo "Monitor stopped"

