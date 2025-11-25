#!/bin/bash

# Simple Terminal launcher for Wildlink Proxy Monitor
# This opens in Terminal for better visibility and control

echo "🚀 Wildlink Proxy Monitor Launcher"
echo "=================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_DIR="$SCRIPT_DIR/wildlink-proxy-monitor"

echo "📁 Script directory: $SCRIPT_DIR"
echo "📁 Proxy directory: $PROXY_DIR"

# Check if the proxy directory exists
if [ ! -d "$PROXY_DIR" ]; then
    echo "❌ Proxy monitor directory not found: $PROXY_DIR"
    echo ""
    echo "Please ensure the wildlink-proxy-monitor folder is in the same directory as this script."
    read -p "Press Enter to exit..."
    exit 1
fi

# Change to proxy directory
cd "$PROXY_DIR"

echo ""
echo "🔧 Starting services..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🔄 Stopping services..."
    pkill -f "mitmdump.*proxy_service.py" 2>/dev/null || true
    pkill -f "web_interface.py" 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

trap cleanup EXIT INT TERM

# Kill any existing instances
pkill -f "mitmdump.*proxy_service.py" 2>/dev/null || true
pkill -f "web_interface.py" 2>/dev/null || true
sleep 2

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    echo "Please install Python 3 from https://python.org"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Install dependencies if needed
echo "📦 Checking dependencies..."
if ! python3 -c "import mitmproxy" 2>/dev/null; then
    echo "📦 Installing mitmproxy..."
    python3 -m pip install --user mitmproxy flask
fi

# Find mitmdump
MITMDUMP_CMD=""
if command -v mitmdump &> /dev/null; then
    MITMDUMP_CMD="mitmdump"
elif [ -f "$HOME/Library/Python/3.9/bin/mitmdump" ]; then
    MITMDUMP_CMD="$HOME/Library/Python/3.9/bin/mitmdump"
elif [ -f "$HOME/Library/Python/3.11/bin/mitmdump" ]; then
    MITMDUMP_CMD="$HOME/Library/Python/3.11/bin/mitmdump"
elif [ -f "$HOME/Library/Python/3.12/bin/mitmdump" ]; then
    MITMDUMP_CMD="$HOME/Library/Python/3.12/bin/mitmdump"
else
    echo "❌ Could not find mitmdump"
    echo "Installing mitmproxy..."
    python3 -m pip install --user mitmproxy
    
    # Try to find it again
    if [ -f "$HOME/Library/Python/3.9/bin/mitmdump" ]; then
        MITMDUMP_CMD="$HOME/Library/Python/3.9/bin/mitmdump"
    else
        echo "❌ Installation failed"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

echo "✅ Using mitmdump: $MITMDUMP_CMD"

# Start proxy service
echo ""
echo "🔧 Starting proxy service on port 8080..."
$MITMDUMP_CMD --listen-port 8080 --scripts proxy_service.py &
PROXY_PID=$!

sleep 3

if ! kill -0 $PROXY_PID 2>/dev/null; then
    echo "❌ Failed to start proxy service"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Proxy service started"

# Start web interface
echo "🌐 Starting web interface on port 5001..."
WEB_PORT=5001 python3 web_interface.py &
WEB_PID=$!

sleep 3

if ! kill -0 $WEB_PID 2>/dev/null; then
    echo "❌ Failed to start web interface"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Web interface started"

# Open browser
echo ""
echo "🎉 Services started successfully!"
echo ""
echo "📊 Dashboard: http://localhost:5001"
echo "🔗 Proxy: localhost:8080"
echo ""
echo "Opening dashboard in browser..."
sleep 2
open "http://localhost:5001"

echo ""
echo "🔄 Services are running..."
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user to stop
wait
