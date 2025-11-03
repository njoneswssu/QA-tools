# 🔒 Fix SSL Certificate Issues

**Quick guide to resolve SSL certificate problems when using the proxy**

---

## 🎯 The Issue

When using HTTPS through a proxy, you'll see:
- ❌ "SSL certificate problem: unable to get local issuer certificate"
- ❌ "Extension process Network(69617) exited" (macOS)
- ❌ Browser security warnings

**This is normal for proxy monitoring!** Here's how to fix it:

---

## ✅ Solution 1: Install mitmproxy Certificate (Best for Browsers)

### Step 1: Install the Certificate

**On macOS:**
```bash
# Open the certificate file
open ~/.mitmproxy/mitmproxy-ca-cert.cer
```

This will open **Keychain Access**:
1. The certificate will appear in "login" keychain
2. Double-click the **mitmproxy** certificate
3. Expand **Trust** section
4. Set **"When using this certificate"** to **"Always Trust"**
5. Close the window (enter your password when prompted)

**On Windows:**
```bash
# Copy certificate to desktop
cp ~/.mitmproxy/mitmproxy-ca-cert.cer ~/Desktop/
```
1. Double-click the `.cer` file on desktop
2. Click **"Install Certificate..."**
3. Choose **"Current User"** → **Next**
4. Select **"Place all certificates in the following store"**
5. Click **Browse** → Select **"Trusted Root Certification Authorities"**
6. Click **Next** → **Finish**

### Step 2: Configure Browser Proxy
Now configure your browser normally:
- **HTTP Proxy**: `localhost:8080`
- **HTTPS Proxy**: `localhost:8080`

---

## ✅ Solution 2: Use HTTP Sites (Quick Test)

Skip HTTPS entirely for testing:
```bash
# Test with HTTP (no SSL issues)
curl --proxy localhost:8080 http://wildlink.me
```

**Browser**: Try visiting `http://wildlink.me` (not https://)

---

## ✅ Solution 3: Bypass SSL in curl

For command-line testing:
```bash
# Ignore SSL certificate errors
curl --proxy localhost:8080 -k https://wildlink.me
```

---

## ✅ Solution 4: Firefox Easy Mode

Firefox has built-in proxy SSL handling:

1. **Settings** → **Privacy & Security**
2. Scroll to **Certificates**
3. Click **View Certificates**
4. **Authorities** tab → **Import**
5. Select: `~/.mitmproxy/mitmproxy-ca-cert.cer`
6. Check **"Trust this CA to identify websites"**
7. Click **OK**

Now configure Firefox proxy normally.

---

## 🔧 Fix macOS "Network Extension" Error

The "Extension process Network(69617) exited" error happens because macOS blocks proxy changes for security.

### Option A: Use System Preferences
1. **System Preferences** → **Network**
2. Select your Wi-Fi/Ethernet connection
3. Click **Advanced** → **Proxies**
4. Check **Web Proxy (HTTP)** and **Secure Web Proxy (HTTPS)**
5. Set both to: `localhost:8080`
6. Click **OK** → **Apply**

### Option B: Use a Different Browser
Try Firefox or Chrome with manual proxy settings instead of system-wide settings.

### Option C: Temporary Workaround
```bash
# Start Chrome with proxy (bypasses system settings)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --proxy-server="localhost:8080" --ignore-certificate-errors
```

---

## 🧪 Test Your Setup

### 1. Test with curl:
```bash
# HTTP (should work immediately)
curl --proxy localhost:8080 http://wildlink.me

# HTTPS (after certificate install)
curl --proxy localhost:8080 https://wildlink.me

# HTTPS (bypass SSL)
curl --proxy localhost:8080 -k https://wildlink.me
```

### 2. Check Dashboard:
Visit: http://localhost:5001

You should see traffic appearing in the Recent Activity section.

### 3. Test in Browser:
1. Configure proxy: `localhost:8080`
2. Visit: `http://wildlink.me` or `https://wildlink.me`
3. Check dashboard for captured traffic

---

## 🎉 Success Indicators

✅ **curl commands work** (with or without `-k`)  
✅ **Dashboard shows traffic** at http://localhost:5001  
✅ **Browser can access Wildlink sites** through proxy  
✅ **No SSL certificate warnings** (after certificate install)  

---

## 🆘 Still Having Issues?

### Quick Diagnostics:
```bash
# Check if proxy is running
netstat -an | grep 8080

# Check if web interface is running  
curl -s http://localhost:5001/api/stats

# Test proxy directly
curl --proxy localhost:8080 -k -I https://wildlink.me
```

### Common Solutions:
1. **Restart browser** after proxy configuration
2. **Clear browser cache** and cookies
3. **Try incognito/private mode**
4. **Use HTTP sites first** to verify proxy works
5. **Check firewall settings** (allow port 8080)

---

## 📝 Quick Reference

- **Proxy Address**: `localhost:8080`
- **Dashboard**: http://localhost:5001
- **Certificate Location**: `~/.mitmproxy/mitmproxy-ca-cert.cer`
- **Test Command**: `curl --proxy localhost:8080 -k https://wildlink.me`

**Remember**: SSL warnings are normal for proxy monitoring. Installing the certificate fixes this for browsers!
