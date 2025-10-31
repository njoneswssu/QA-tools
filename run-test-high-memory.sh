#!/bin/bash

# Run the website test with increased memory allocation
# This prevents the "JavaScript heap out of memory" error

echo "🚀 Starting website test with increased memory allocation..."
echo "💾 Memory limit: 8GB (instead of default ~4GB)"
echo "⚡ Garbage collection: Enabled for better memory management"
echo ""

# Run with increased memory and garbage collection enabled
node --max-old-space-size=8192 --expose-gc ./node_modules/.bin/playwright test e2e/website-quickcheck.spec.js --headed

echo ""
echo "✅ Test completed!"
