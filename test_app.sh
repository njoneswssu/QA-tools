#!/bin/bash

echo "🧪 Testing Wildlink Proxy Monitor App..."

APP_PATH="/Users/neiljones/Documents/playwrightautomation/Wildlink Proxy Monitor.app"
LAUNCHER="$APP_PATH/Contents/MacOS/WildlinkProxyMonitor"

# Test 1: Check app structure
echo "📁 Checking app structure..."
if [ ! -d "$APP_PATH" ]; then
    echo "❌ App bundle not found"
    exit 1
fi

if [ ! -f "$LAUNCHER" ]; then
    echo "❌ Launcher script not found"
    exit 1
fi

if [ ! -x "$LAUNCHER" ]; then
    echo "❌ Launcher script not executable"
    exit 1
fi

echo "✅ App structure OK"

# Test 2: Check Python files
echo "📁 Checking Python files..."
PROXY_SERVICE="$APP_PATH/Contents/Resources/proxy-service/proxy_service.py"
WEB_INTERFACE="$APP_PATH/Contents/Resources/proxy-service/web_interface.py"

if [ ! -f "$PROXY_SERVICE" ]; then
    echo "❌ proxy_service.py not found"
    exit 1
fi

if [ ! -f "$WEB_INTERFACE" ]; then
    echo "❌ web_interface.py not found"
    exit 1
fi

echo "✅ Python files OK"

# Test 3: Check Python syntax
echo "🐍 Checking Python syntax..."
cd "$APP_PATH/Contents/Resources/proxy-service"

if ! python3 -m py_compile proxy_service.py; then
    echo "❌ proxy_service.py has syntax errors"
    exit 1
fi

if ! python3 -m py_compile web_interface.py; then
    echo "❌ web_interface.py has syntax errors"
    exit 1
fi

echo "✅ Python syntax OK"

# Test 4: Check dependencies
echo "📦 Checking dependencies..."
if ! python3 -c "import mitmproxy" 2>/dev/null; then
    echo "⚠️  mitmproxy not installed - app will install it"
else
    echo "✅ mitmproxy available"
fi

if ! python3 -c "import flask" 2>/dev/null; then
    echo "⚠️  flask not installed - app will install it"
else
    echo "✅ flask available"
fi

echo ""
echo "🎉 App testing complete!"
echo "📦 Ready for distribution"
echo ""
echo "To test the app manually:"
echo "  open '$APP_PATH'"
echo ""
echo "To install from DMG:"
echo "  open 'Wildlink-Proxy-Monitor-v1.0.0.dmg'"
