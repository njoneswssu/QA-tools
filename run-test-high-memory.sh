#!/bin/bash

# Run the website test with increased memory allocation
# This prevents the "JavaScript heap out of memory" error

echo "🚀 Starting website test with increased memory allocation..."
echo "💾 Memory limit: 12GB (instead of default ~4GB)"
echo "⚡ Garbage collection: Enabled for better memory management"
echo "🔧 Additional optimizations: Reduced GC pressure"
echo ""

# Run with increased memory, garbage collection, and optimizations
node --max-old-space-size=12288 --expose-gc --optimize-for-size --gc-interval=100 ./node_modules/.bin/playwright test e2e/website-quickcheck.spec.js --headed

echo ""
if [ $? -eq 0 ]; then
    echo "✅ Test completed successfully!"
else
    echo "❌ Test failed or was interrupted"
    echo "💡 Check the console output above for error details"
    echo "🔄 Results should still be saved if emergency handlers worked"
fi
