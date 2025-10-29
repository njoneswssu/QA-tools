@echo off
echo 🚀 Starting API Merchant Tester
echo ================================

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Check if Playwright browsers are installed
if not exist "node_modules\@playwright\test" (
    echo 🎭 Installing Playwright browsers...
    npx playwright install
)

REM Check if database exists
if not exist "database\merchant_tests.db" (
    echo 🗄️  Setting up database...
    node setup-database.js
)

echo 🌐 Starting server on http://localhost:3001
echo 🧪 API Merchant Tester will be available at the URL above
echo ================================

npm start

pause
