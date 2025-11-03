#!/bin/bash

# Wildlink Proxy Monitor - Test Setup Script
# This script tests if everything is working correctly

echo "🧪 Testing Wildlink Proxy Monitor Setup"
echo "========================================"
echo ""

# Test 1: Check if proxy is running
echo "1. 🔍 Checking if proxy is running on port 8080..."
if netstat -an | grep -q "8080.*LISTEN"; then
    echo "   ✅ Proxy is running on port 8080"
elif curl --proxy localhost:8080 -s --max-time 3 http://httpbin.org/get > /dev/null 2>&1; then
    echo "   ✅ Proxy is running on port 8080 (verified by connection test)"
else
    echo "   ❌ Proxy is NOT running on port 8080"
    echo "   💡 Try: ./start_proxy.sh"
    exit 1
fi

# Test 2: Check if web interface is running
echo ""
echo "2. 🌐 Checking if web interface is running..."
if curl -s http://localhost:5001/api/stats > /dev/null 2>&1; then
    echo "   ✅ Web interface is running on port 5001"
else
    echo "   ❌ Web interface is NOT running"
    echo "   💡 Try: WEB_PORT=5001 python3 web_interface.py &"
    exit 1
fi

# Test 3: Test HTTP proxy
echo ""
echo "3. 📡 Testing HTTP proxy connection..."
if curl --proxy localhost:8080 -s http://wildlink.me > /dev/null 2>&1; then
    echo "   ✅ HTTP proxy is working"
else
    echo "   ❌ HTTP proxy is NOT working"
    exit 1
fi

# Test 4: Test HTTPS proxy
echo ""
echo "4. 🔒 Testing HTTPS proxy connection..."
if curl --proxy localhost:8080 -s https://wildlink.me > /dev/null 2>&1; then
    echo "   ✅ HTTPS proxy is working (certificate installed)"
    HTTPS_STATUS="✅ Certificate installed correctly"
elif curl --proxy localhost:8080 -k -s https://wildlink.me > /dev/null 2>&1; then
    echo "   ⚠️  HTTPS proxy works with SSL bypass"
    HTTPS_STATUS="⚠️  Certificate not installed (use -k flag or install cert)"
else
    echo "   ❌ HTTPS proxy is NOT working"
    exit 1
fi

# Test 5: Check traffic capture
echo ""
echo "5. 📊 Checking traffic capture..."
STATS=$(curl -s http://localhost:5001/api/stats)
TOTAL_REQUESTS=$(echo "$STATS" | python3 -c "import sys, json; print(json.load(sys.stdin)['total_requests'])" 2>/dev/null || echo "0")

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
    echo "   ✅ Traffic capture is working ($TOTAL_REQUESTS requests captured)"
else
    echo "   ⚠️  No traffic captured yet (this is normal for new setup)"
fi

# Test 6: Certificate status
echo ""
echo "6. 🔐 Checking certificate installation..."
if security find-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain > /dev/null 2>&1; then
    echo "   ✅ mitmproxy certificate is installed in keychain"
else
    echo "   ⚠️  mitmproxy certificate is NOT installed"
    echo "   💡 Run: security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem"
fi

# Summary
echo ""
echo "🎉 Setup Test Summary"
echo "===================="
echo "✅ Proxy Service: Running on port 8080"
echo "✅ Web Interface: http://localhost:5001"
echo "$HTTPS_STATUS"
echo "📊 Captured Requests: $TOTAL_REQUESTS"
echo ""

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
    echo "🎯 Everything is working perfectly!"
    echo ""
    echo "📱 Next steps:"
    echo "1. Configure your browser proxy to: localhost:8080"
    echo "2. Visit Wildlink domains: wildlink.me, wild.link, etc."
    echo "3. Watch traffic at: http://localhost:5001"
else
    echo "🎯 Setup is complete and ready!"
    echo ""
    echo "📱 To start capturing traffic:"
    echo "1. Configure your browser proxy to: localhost:8080"
    echo "2. Visit: curl --proxy localhost:8080 https://wildlink.me"
    echo "3. Check dashboard: http://localhost:5001"
fi

echo ""
echo "📖 For detailed browser setup: see BROWSER_SETUP.md"
echo "🔒 For SSL certificate help: see INSTALL_CERTIFICATE.md"
