#!/bin/bash

# Fix Certificate Issues - Complete Solution
echo "🔒 Fixing SSL Certificate Issues for Browser"
echo "============================================="

# Step 1: Remove existing certificate
echo "1. Removing existing certificate..."
security delete-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain 2>/dev/null || true

# Step 2: Install certificate with proper trust
echo "2. Installing certificate with full trust..."
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem

# Step 3: Verify installation
echo "3. Verifying certificate installation..."
if security find-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain > /dev/null 2>&1; then
    echo "   ✅ Certificate installed successfully"
else
    echo "   ❌ Certificate installation failed"
    exit 1
fi

# Step 4: Test with curl
echo "4. Testing HTTPS connection..."
if curl --proxy localhost:8080 -s --max-time 5 https://wildlink.me > /dev/null 2>&1; then
    echo "   ✅ HTTPS proxy working with certificate"
else
    echo "   ⚠️  HTTPS might still have issues in browser"
fi

echo ""
echo "🎯 Next Steps for Browser:"
echo "=========================="
echo "1. 🔄 Restart your browser completely"
echo "2. 🧹 Clear browser cache and cookies"
echo "3. 🔒 Try visiting: https://wildlink.me"
echo "4. 📱 If still getting warnings, click 'Advanced' → 'Proceed'"
echo ""
echo "💡 Alternative: Use Chrome with bypass:"
echo "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --proxy-server=\"localhost:8080\" --ignore-certificate-errors"
echo ""
echo "✅ Certificate fix complete!"
