#!/bin/bash

# Wildlink Proxy Monitor Startup Script
# This script starts the mitmproxy service with the Wildlink monitor addon

echo "🚀 Starting Wildlink Proxy Monitor..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if mitmproxy is installed
if ! command -v mitmproxy &> /dev/null; then
    echo "⚠️  mitmproxy not found. Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Set default port if not specified
PROXY_PORT=${PROXY_PORT:-8080}
WEB_PORT=${WEB_PORT:-8081}

echo "📡 Proxy will listen on port: $PROXY_PORT"
echo "🌐 Web interface will be on port: $WEB_PORT"
echo "🎯 Monitoring Wildlink domains:"
echo "   - storage.googleapis.com/wildlink"
echo "   - wildlink.me (and subdomains)"
echo "   - wildlink.ai (and subdomains)" 
echo "   - wild.link"
echo "   - wfi.re"
echo ""

# Start mitmproxy with the addon
echo "🔧 Starting mitmproxy with Wildlink monitor addon..."
echo "ℹ️  Press Ctrl+C to stop the proxy"
echo ""

# Run mitmproxy in transparent mode with web interface
mitmproxy \
    --listen-port $PROXY_PORT \
    --web-port $WEB_PORT \
    --set confdir=~/.mitmproxy \
    --set web_open_browser=false \
    --scripts proxy_service.py \
    --set console_eventlog_verbosity=info \
    --set termlog_verbosity=info

echo ""
echo "👋 Wildlink Proxy Monitor stopped."
