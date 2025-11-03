#!/bin/bash

echo "🚀 Launching Chrome with Proxy and Certificate Bypass"
echo "====================================================="

# Check if Chrome is running and close it
if pgrep -f "Google Chrome" > /dev/null; then
    echo "⚠️  Chrome is currently running. Please close it first."
    echo "   Attempting to close Chrome..."
    osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
    sleep 2
fi

# Check if proxy is running
if ! netstat -an | grep -q "8080.*LISTEN"; then
    echo "❌ Proxy is not running on port 8080"
    echo "   Starting proxy..."
    /Users/neiljones/Library/Python/3.9/bin/mitmdump --listen-port 8080 --scripts proxy_service.py &
    sleep 3
fi

echo "🌐 Starting Chrome with:"
echo "   • Proxy: localhost:8080"
echo "   • Certificate errors bypassed"
echo "   • SSL errors ignored"
echo ""

# Launch Chrome with proxy and certificate bypass
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --proxy-server="localhost:8080" \
  --ignore-certificate-errors \
  --ignore-ssl-errors \
  --allow-running-insecure-content \
  --disable-web-security \
  --user-data-dir="/tmp/chrome-proxy-session" \
  --new-window \
  "https://wildlink.me" \
  "http://localhost:5001" &

echo "✅ Chrome launched with proxy configuration!"
echo ""
echo "🎯 What to expect:"
echo "• Chrome will open with 2 tabs:"
echo "  1. https://wildlink.me (test site)"
echo "  2. http://localhost:5001 (proxy dashboard)"
echo "• No certificate warnings should appear"
echo "• All traffic will be captured in the dashboard"
echo ""
echo "📊 Monitor traffic at: http://localhost:5001"
echo "📋 View logs at: http://localhost:5001/logs"
