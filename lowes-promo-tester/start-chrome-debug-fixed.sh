#!/bin/bash

# Start Chrome with remote debugging enabled
# This script ensures Chrome is properly started with remote debugging

echo "🔄 Stopping any existing Chrome instances..."
pkill -9 -f "Google Chrome" 2>/dev/null
sleep 3

echo "🚀 Starting Chrome with remote debugging on port 9222..."
echo "   (This will open Chrome - keep this terminal window open)"

# Start Chrome in the foreground so we can see if there are errors
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug-profile" \
  --no-first-run \
  --no-default-browser-check

echo ""
echo "Chrome has closed. If you see this, Chrome was closed."
echo "To keep Chrome running, don't close the Chrome window."
