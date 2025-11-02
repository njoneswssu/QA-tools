#!/bin/bash

# Wildlink Proxy Monitor - Start All Services
# This script starts both the proxy service and web interface

echo "🚀 Starting Wildlink Proxy Monitor - All Services"
echo "=================================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Install dependencies if needed
if ! python3 -c "import mitmproxy, flask" &> /dev/null; then
    echo "⚠️  Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Create logs directory
mkdir -p logs

# Set ports
PROXY_PORT=${PROXY_PORT:-8080}
WEB_PORT=${WEB_PORT:-5000}
MITMWEB_PORT=${MITMWEB_PORT:-8081}

echo ""
echo "🔧 Service Configuration:"
echo "   📡 Proxy Port: $PROXY_PORT"
echo "   🌐 Web Interface: http://localhost:$WEB_PORT"
echo "   🔍 Mitmproxy Web: http://localhost:$MITMWEB_PORT"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    wait
    echo "👋 All services stopped."
    exit 0
}

# Set trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Start web interface in background
echo "🌐 Starting web interface on port $WEB_PORT..."
WEB_PORT=$WEB_PORT python3 web_interface.py &
WEB_PID=$!

# Give web interface time to start
sleep 2

# Start proxy service
echo "📡 Starting proxy service on port $PROXY_PORT..."
echo "ℹ️  Press Ctrl+C to stop all services"
echo ""

PROXY_PORT=$PROXY_PORT WEB_PORT=$MITMWEB_PORT ./start_proxy.sh

# If we reach here, proxy stopped, so cleanup
cleanup
