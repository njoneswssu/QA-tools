#!/bin/bash

echo "🚀 Starting AI Betting Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if Playwright browsers are installed
echo "🌐 Checking Playwright browsers..."
npx playwright install chromium --with-deps 2>/dev/null || echo "⚠️  Playwright browsers may need manual installation"

echo ""
echo "✅ Starting server..."
echo "📊 Dashboard will be available at: http://localhost:3000"
echo ""

npm start

