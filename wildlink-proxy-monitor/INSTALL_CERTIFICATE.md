# 🔒 Install mitmproxy Certificate - Easy Guide

**Fix SSL certificate errors when using the proxy with browsers**

---

## 🎯 The Problem

When using HTTPS through the proxy, you see:
- ❌ "SSL certificate problem"
- ❌ "Unable to import mitmproxy" (Error -25294)
- ❌ Browser security warnings

---

## ✅ Solution: Install Certificate (Choose One Method)

### Method 1: Command Line (Recommended - Always Works)

```bash
# Install certificate directly via command line
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
```

**Verify it worked:**
```bash
# Test HTTPS without SSL bypass
curl --proxy localhost:8080 https://wildlink.me
```

If this works without errors, you're done! ✅

### Method 2: Manual Keychain Installation

If Method 1 didn't work, try this:

1. **Copy certificate to Desktop:**
```bash
cp ~/.mitmproxy/mitmproxy-ca-cert.pem ~/Desktop/mitmproxy-cert.pem
```

2. **Open Keychain Access:**
   - Press `Cmd + Space` → type "Keychain Access"
   - Or go to Applications → Utilities → Keychain Access

3. **Import Certificate:**
   - File → Import Items
   - Select `mitmproxy-cert.pem` from Desktop
   - Choose "login" keychain
   - Click "Add"

4. **Trust the Certificate:**
   - Find "mitmproxy" in the certificate list
   - Double-click it
   - Expand "Trust" section
   - Set "When using this certificate" to **"Always Trust"**
   - Close window (enter password when prompted)

### Method 3: Firefox Only (No System Certificate Needed)

Firefox has its own certificate store:

1. **Firefox Settings** → **Privacy & Security**
2. Scroll to **Certificates** → **View Certificates**
3. **Authorities** tab → **Import**
4. Select: `~/.mitmproxy/mitmproxy-ca-cert.pem`
5. Check **"Trust this CA to identify websites"**
6. Click **OK**

### Method 4: Chrome with Bypass (Quick Test)

Skip certificate installation entirely:

```bash
# Start Chrome with SSL errors ignored
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --proxy-server="localhost:8080" --ignore-certificate-errors
```

---

## 🧪 Test Your Installation

### 1. Command Line Test:
```bash
# This should work without -k flag after certificate install
curl --proxy localhost:8080 https://wildlink.me

# Compare with HTTP (should both work)
curl --proxy localhost:8080 http://wildlink.me
```

### 2. Browser Test:
1. Configure browser proxy: `localhost:8080`
2. Visit: `https://wildlink.me`
3. Should load without SSL warnings

### 3. Dashboard Check:
Visit: http://localhost:5001
- Should show captured HTTPS traffic
- No SSL-related errors in logs

---

## 🔧 Troubleshooting

### Still Getting SSL Errors?

**Try this diagnostic:**
```bash
# Check if certificate is installed
security find-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain

# Test with explicit SSL bypass
curl --proxy localhost:8080 -k https://wildlink.me
```

### Certificate Import Failed?

**Alternative certificate formats:**
```bash
# Try the .cer format instead
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.cer
```

### Browser Still Shows Warnings?

1. **Restart browser** after certificate installation
2. **Clear browser cache** and cookies
3. **Try incognito/private mode**
4. **Check browser certificate settings**

### macOS Won't Let You Install?

**System Integrity Protection might be blocking:**
```bash
# Add to system keychain instead (requires admin password)
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
```

---

## 🎉 Success Indicators

✅ **curl works without -k**: `curl --proxy localhost:8080 https://wildlink.me`  
✅ **Browser loads HTTPS sites** without warnings  
✅ **Dashboard shows HTTPS traffic** at http://localhost:5001  
✅ **Certificate appears in Keychain** as trusted  

---

## 🆘 Still Having Issues?

### Quick Workarounds:

1. **Use HTTP sites**: `http://wildlink.me` (no SSL needed)
2. **Use curl with -k**: `curl --proxy localhost:8080 -k https://wildlink.me`
3. **Chrome with bypass**: Use Method 4 above
4. **Firefox only**: Use Method 3 above

### Get Help:
```bash
# Check proxy status
netstat -an | grep 8080

# Check certificate installation
security find-certificate -c "mitmproxy"

# Test basic proxy functionality
curl --proxy localhost:8080 http://wildlink.me
```

---

## 📝 Quick Commands Reference

```bash
# Install certificate (main method)
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem

# Test HTTPS
curl --proxy localhost:8080 https://wildlink.me

# Test HTTP  
curl --proxy localhost:8080 http://wildlink.me

# Check dashboard
open http://localhost:5001
```

**Remember**: The proxy is working even if you see SSL warnings. Installing the certificate just makes it cleaner for browser use!
