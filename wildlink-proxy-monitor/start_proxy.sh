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
MITMDUMP_PATH="/Users/neiljones/Library/Python/3.9/bin/mitmdump"
MITMPROXY_PATH="/Users/neiljones/Library/Python/3.9/bin/mitmproxy"
if ! command -v mitmdump &> /dev/null && [ ! -f "$MITMDUMP_PATH" ]; then
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

# Run mitmdump (non-interactive) for better background operation
# Use full path if mitmdump is not in PATH
if command -v mitmdump &> /dev/null; then
    MITMDUMP_CMD="mitmdump"
else
    MITMDUMP_CMD="$MITMDUMP_PATH"
fi

echo "🔧 Starting mitmdump with Wildlink monitor addon..."
$MITMDUMP_CMD \
    --listen-port $PROXY_PORT \
    --set confdir=~/.mitmproxy \
    --scripts proxy_service.py

echo ""
echo "👋 Wildlink Proxy Monitor stopped."
