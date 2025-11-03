# 🌐 Browser Proxy Setup Guide

**Quick guide to configure your browser to use the Wildlink Proxy Monitor**

---

## 🚀 Before You Start

1. Make sure the proxy is running: `./start_all.sh`
2. Verify the proxy is on port **8080**
3. Web dashboard should be at **http://localhost:5001**

---

## Chrome / Edge / Chromium

### Method 1: System Settings (Recommended)
1. Open **Chrome Settings** (chrome://settings/)
2. Click **Advanced** → **System**
3. Click **"Open your computer's proxy settings"**
4. This opens your system proxy settings:

**Windows:**
- Set **HTTP proxy**: `localhost:8080`
- Set **HTTPS proxy**: `localhost:8080`

**macOS:**
- Check **Web Proxy (HTTP)** → Server: `localhost` Port: `8080`
- Check **Secure Web Proxy (HTTPS)** → Server: `localhost` Port: `8080`

**Linux:**
- Set **HTTP proxy**: `localhost:8080`
- Set **HTTPS proxy**: `localhost:8080`

### Method 2: Command Line
```bash
# Start Chrome with proxy
google-chrome --proxy-server="localhost:8080"

# Or on macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --proxy-server="localhost:8080"
```

---

## Firefox

1. Open **Firefox Settings** (about:preferences)
2. Scroll to **Network Settings**
3. Click **Settings...**
4. Select **"Manual proxy configuration"**
5. Set:
   - **HTTP Proxy**: `localhost` **Port**: `8080`
   - **HTTPS Proxy**: `localhost` **Port**: `8080`
6. Check **"Use this proxy server for all protocols"**
7. Click **OK**

---

## Safari (macOS)

1. **System Preferences** → **Network**
2. Select your active network connection
3. Click **Advanced...**
4. Go to **Proxies** tab
5. Check these boxes:
   - ☑️ **Web Proxy (HTTP)**
   - ☑️ **Secure Web Proxy (HTTPS)**
6. For both, set:
   - **Web Proxy Server**: `localhost:8080`
   - **Secure Web Proxy Server**: `localhost:8080`
7. Click **OK** → **Apply**

---

## Testing Your Setup

### Quick Test
1. Visit any Wildlink domain: `https://wildlink.me`
2. Check the dashboard: `http://localhost:5001`
3. You should see traffic appear in the Recent Activity

### Command Line Test
```bash
# Test with curl
curl --proxy localhost:8080 https://wildlink.me
curl --proxy localhost:8080 https://wild.link
```

---

## 🔧 Troubleshooting

### "This site can't be reached"
- ✅ Check proxy is running: `netstat -an | grep 8080`
- ✅ Verify proxy settings in browser
- ✅ Try HTTP first: `http://wildlink.me`

### SSL Certificate Warnings
- ✅ This is normal for HTTPS proxy monitoring
- ✅ Click **Advanced** → **Proceed to site**
- ✅ Or test with HTTP sites first

### No Traffic Showing in Dashboard
- ✅ Visit Wildlink domains (not random sites)
- ✅ Check browser proxy settings
- ✅ Refresh dashboard page
- ✅ Look for errors in terminal

---

## 🔄 Switching Back to Normal Browsing

### Chrome/Edge/Safari:
1. Go back to proxy settings
2. Uncheck or disable proxy settings
3. Or set to **"No proxy"**

### Firefox:
1. Settings → Network Settings → Settings
2. Select **"No proxy"**
3. Click **OK**

### Command Line:
Just close the browser window that was started with `--proxy-server`

---

## 📱 Mobile Testing

### iOS (iPhone/iPad):
1. **Settings** → **Wi-Fi**
2. Tap the **ⓘ** next to your network
3. Scroll to **HTTP Proxy**
4. Select **Manual**
5. Server: `[YOUR_COMPUTER_IP]` Port: `8080`

### Android:
1. **Settings** → **Wi-Fi**
2. Long press your network → **Modify network**
3. **Advanced options** → **Proxy** → **Manual**
4. Hostname: `[YOUR_COMPUTER_IP]` Port: `8080`

**Note**: Replace `[YOUR_COMPUTER_IP]` with your computer's local IP address (e.g., 192.168.1.100)

---

## ✅ Success Checklist

- [ ] Proxy running on port 8080
- [ ] Browser configured to use localhost:8080
- [ ] Dashboard accessible at http://localhost:5001
- [ ] Test traffic appears in dashboard
- [ ] Can visit Wildlink domains through proxy

**Happy monitoring!** 🕵️‍♂️
