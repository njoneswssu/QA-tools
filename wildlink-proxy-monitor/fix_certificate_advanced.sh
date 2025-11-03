#!/bin/bash

echo "🔒 Advanced Certificate Fix for Persistent SSL Issues"
echo "===================================================="

# Step 1: Remove all existing certificates
echo "1. Removing all existing mitmproxy certificates..."
security delete-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain 2>/dev/null || true
sudo security delete-certificate -c "mitmproxy" /Library/Keychains/System.keychain 2>/dev/null || true

# Step 2: Check if mitmproxy certificate exists
if [ ! -f ~/.mitmproxy/mitmproxy-ca-cert.pem ]; then
    echo "❌ Certificate file not found. Generating new one..."
    # Start mitmproxy briefly to generate certificate
    timeout 5 /Users/neiljones/Library/Python/3.9/bin/mitmdump --listen-port 8081 2>/dev/null || true
fi

# Step 3: Install in login keychain with explicit trust
echo "2. Installing certificate in login keychain..."
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem

# Step 4: Try to install in system keychain (requires sudo)
echo "3. Attempting to install in system keychain..."
echo "   (This may prompt for your password)"
if sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem 2>/dev/null; then
    echo "   ✅ Successfully installed in system keychain"
else
    echo "   ⚠️  Could not install in system keychain (password required)"
fi

# Step 5: Set explicit trust settings
echo "4. Setting explicit trust settings..."
security add-trusted-cert -d -r trustRoot -p ssl -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem 2>/dev/null || true

# Step 6: Verify installation
echo "5. Verifying certificate installation..."
if security find-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain > /dev/null 2>&1; then
    echo "   ✅ Certificate found in login keychain"
else
    echo "   ❌ Certificate NOT found in login keychain"
fi

# Step 7: Test HTTPS connection
echo "6. Testing HTTPS connection..."
if curl --proxy localhost:8080 -s --max-time 5 https://mail.google.com > /dev/null 2>&1; then
    echo "   ✅ HTTPS proxy working"
else
    echo "   ⚠️  HTTPS proxy test failed"
fi

echo ""
echo "🌐 Browser-Specific Solutions:"
echo "============================="

echo ""
echo "📋 Option 1: Chrome with Certificate Bypass"
echo "--------------------------------------------"
echo "Run Chrome with these flags to bypass certificate errors:"
echo ""
echo "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\"
echo "  --proxy-server=\"localhost:8080\" \\"
echo "  --ignore-certificate-errors \\"
echo "  --ignore-ssl-errors \\"
echo "  --allow-running-insecure-content \\"
echo "  --disable-web-security"
echo ""

echo "📋 Option 2: Firefox Manual Certificate Import"
echo "----------------------------------------------"
echo "1. Open Firefox"
echo "2. Go to: about:preferences#privacy"
echo "3. Scroll to 'Certificates' → Click 'View Certificates'"
echo "4. Go to 'Authorities' tab → Click 'Import'"
echo "5. Select: ~/.mitmproxy/mitmproxy-ca-cert.pem"
echo "6. Check: 'Trust this CA to identify websites'"
echo "7. Restart Firefox"
echo ""

echo "📋 Option 3: Use HTTP Instead of HTTPS"
echo "--------------------------------------"
echo "Try these HTTP URLs instead:"
echo "• http://wildlink.me"
echo "• http://admin.wildlink.me"
echo "• http://api.wildlink.me"
echo ""

echo "📋 Option 4: Bypass Certificate Warnings"
echo "-----------------------------------------"
echo "When you see the certificate warning:"
echo "1. Click 'Advanced'"
echo "2. Click 'Proceed to [domain] (unsafe)'"
echo "3. The site will load and traffic will be captured"
echo ""

echo "✅ Advanced certificate fix complete!"
echo ""
echo "🔄 Next Steps:"
echo "1. Completely quit and restart your browser"
echo "2. Try one of the solutions above"
echo "3. Check the proxy dashboard: http://localhost:5001"
