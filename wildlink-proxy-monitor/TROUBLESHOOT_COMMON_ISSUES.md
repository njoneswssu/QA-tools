# 🔧 Troubleshoot Common Issues

**Quick fixes for the most common problems with the Wildlink Proxy Monitor**

---

## 🚨 Issue 1: Logs Not Displaying in Browser

### Symptoms:
- Dashboard shows traffic stats
- Logs page shows "Loading..." forever
- Empty logs page or no results

### Quick Fix:
1. **Open browser developer tools** (F12 or Cmd+Option+I)
2. **Go to Console tab**
3. **Visit the logs page**: http://localhost:5001/logs
4. **Look for error messages** in console

### Common Solutions:

#### A) JavaScript Errors
```bash
# Restart web interface
cd wildlink-proxy-monitor
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
WEB_PORT=5001 python3 web_interface.py &
```

#### B) API Connection Issues
```bash
# Test API directly
curl -s http://localhost:5001/api/logs?limit=5

# Should return JSON data, not HTML error
```

#### C) Browser Cache Issues
1. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear cache**: Browser Settings → Clear browsing data
3. **Try incognito/private mode**

---

## 🔒 Issue 2: Certificate Warnings in Browser

### Symptoms:
- "Your connection isn't private"
- "NET::ERR_CERT_AUTHORITY_INVALID"
- SSL certificate warnings on HTTPS sites

### Quick Fix:
```bash
# Run the certificate fix script
cd wildlink-proxy-monitor
./fix_certificate.sh
```

### Manual Fix Steps:

#### Step 1: Remove Old Certificate
```bash
security delete-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain 2>/dev/null || true
```

#### Step 2: Install Certificate Properly
```bash
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
```

#### Step 3: Restart Browser
1. **Completely close** your browser
2. **Clear browser cache** and cookies
3. **Restart browser**
4. **Try visiting**: https://wildlink.me

### Alternative Solutions:

#### A) Chrome with SSL Bypass
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --proxy-server="localhost:8080" --ignore-certificate-errors
```

#### B) Firefox Certificate Import
1. **Firefox Settings** → **Privacy & Security**
2. **Certificates** → **View Certificates**
3. **Authorities** → **Import**
4. Select: `~/.mitmproxy/mitmproxy-ca-cert.pem`
5. Check: **"Trust this CA to identify websites"**

#### C) Use HTTP Instead
- Try `http://wildlink.me` instead of `https://wildlink.me`
- No certificate needed for HTTP

---

## 🔄 Issue 3: Proxy Not Capturing Traffic

### Symptoms:
- Dashboard shows 0 requests
- No traffic in logs
- Browser can't connect through proxy

### Diagnostic Commands:
```bash
# Check if proxy is running
netstat -an | grep 8080

# Check if web interface is running
curl -s http://localhost:5001/api/stats

# Test proxy directly
curl --proxy localhost:8080 -k https://wildlink.me
```

### Solutions:

#### A) Restart Proxy Service
```bash
# Kill existing proxy
ps aux | grep mitmdump | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true

# Start proxy
/Users/neiljones/Library/Python/3.9/bin/mitmdump --listen-port 8080 --scripts proxy_service.py &
```

#### B) Check Browser Proxy Settings
- **Chrome**: Settings → Advanced → System → Proxy settings
- **Firefox**: Settings → Network Settings → Manual proxy
- **Set both HTTP and HTTPS to**: `localhost:8080`

#### C) Test with Different Domains
```bash
# Test with different Wildlink domains
curl --proxy localhost:8080 http://wildlink.me
curl --proxy localhost:8080 https://wild.link
curl --proxy localhost:8080 https://wildlink.ai
```

---

## 🌐 Issue 4: Web Interface Not Loading

### Symptoms:
- Can't access http://localhost:5001
- "Connection refused" error
- Port already in use

### Solutions:

#### A) Check What's Using Port 5001
```bash
lsof -i :5001
```

#### B) Use Different Port
```bash
WEB_PORT=5002 python3 web_interface.py &
# Then visit: http://localhost:5002
```

#### C) Kill Conflicting Processes
```bash
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
```

---

## 🧪 Complete System Test

Run this to test everything:

```bash
cd wildlink-proxy-monitor
./test_setup.sh
```

This will check:
- ✅ Proxy service running
- ✅ Web interface accessible
- ✅ HTTP proxy working
- ✅ HTTPS proxy working
- ✅ Certificate installation
- ✅ Traffic capture

---

## 📞 Getting Help

### Collect Debug Information:
```bash
# System status
echo "=== Proxy Status ==="
netstat -an | grep 8080

echo "=== Web Interface Status ==="
curl -s http://localhost:5001/api/stats | head -5

echo "=== Certificate Status ==="
security find-certificate -c "mitmproxy" ~/Library/Keychains/login.keychain

echo "=== Recent Logs ==="
curl -s "http://localhost:5001/api/logs?limit=3" | python3 -c "import sys, json; data=json.load(sys.stdin); [print(f'{log[\"method\"]} {log[\"hostname\"]} - {log[\"statusCode\"]}') for log in data]"
```

### Common Error Messages:

| Error | Solution |
|-------|----------|
| "Address already in use" | Use different port or kill existing process |
| "Connection refused" | Check if service is running |
| "Certificate invalid" | Run `./fix_certificate.sh` |
| "Prism is not defined" | Clear browser cache, restart web interface |
| "No logs found" | Generate traffic, check proxy settings |

---

## ✅ Success Checklist

- [ ] Proxy running on port 8080
- [ ] Web interface at http://localhost:5001
- [ ] Certificate installed and trusted
- [ ] Browser proxy configured
- [ ] Traffic appearing in dashboard
- [ ] Logs page showing results
- [ ] No JavaScript errors in console

**If all items are checked, everything is working correctly!** 🎉
