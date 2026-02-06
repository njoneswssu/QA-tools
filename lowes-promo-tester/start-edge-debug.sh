#!/bin/bash

# Start Microsoft Edge with remote debugging enabled
# This allows the automation to connect to your existing Edge instance

# Close any existing Edge instances
echo "Closing existing Edge instances..."
pkill -f "Microsoft Edge" 2>/dev/null
sleep 2

# Start Edge with remote debugging
echo "Starting Microsoft Edge with remote debugging on port 9222..."
"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --remote-debugging-port=9222 &

echo "Edge started with remote debugging!"
echo "You can verify it's working by visiting: http://localhost:9222/json"
echo ""
echo "Now you can run your automation - it will open tabs instead of new windows."

