#!/bin/bash

# Wildlink Proxy Monitor Web Interface Startup Script
# This script starts the Flask web interface for viewing captured traffic

echo "🌐 Starting Wildlink Proxy Monitor Web Interface..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if Flask is installed
if ! python3 -c "import flask" &> /dev/null; then
    echo "⚠️  Flask not found. Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Set default port if not specified
WEB_PORT=${WEB_PORT:-5000}

echo "📊 Web interface will be available at: http://localhost:$WEB_PORT"
echo "📋 Logs viewer at: http://localhost:$WEB_PORT/logs"
echo "🔍 Individual log details at: http://localhost:$WEB_PORT/log/<log_id>"
echo ""
echo "ℹ️  Press Ctrl+C to stop the web interface"
echo ""

# Start Flask web interface
python3 web_interface.py

echo ""
echo "👋 Web interface stopped."
