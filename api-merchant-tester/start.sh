#!/bin/bash

echo "🚀 Starting API Merchant Tester"
echo "================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Playwright browsers are installed
if [ ! -d "node_modules/@playwright/test" ]; then
    echo "🎭 Installing Playwright browsers..."
    npx playwright install
fi

# Check if database exists
if [ ! -f "database/merchant_tests.db" ]; then
    echo "🗄️  Setting up database..."
    node setup-database.js
fi

echo "🌐 Starting server on http://localhost:3001"
echo "🧪 API Merchant Tester will be available at the URL above"
echo "================================"

npm start
