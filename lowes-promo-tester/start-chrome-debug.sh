#!/bin/bash

# Start Chrome with remote debugging enabled
# This allows the automation to connect to your existing Chrome instance

# Close any existing Chrome instances
echo "Closing existing Chrome instances..."
pkill -f "Google Chrome" 2>/dev/null
sleep 2

# Start Chrome with remote debugging
echo "Starting Chrome with remote debugging on port 9222..."
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 &

echo "Chrome started with remote debugging!"
echo "You can verify it's working by visiting: http://localhost:9222/json"
echo ""
echo "Now you can run your automation - it will open tabs instead of new windows."
