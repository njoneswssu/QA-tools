# 🕵️ Wildlink Proxy Monitor

**A powerful network traffic monitoring tool that captures and analyzes traffic from Wildlink domains in real-time.**

Perfect for developers, analysts, and anyone who needs to monitor Wildlink network activity with a beautiful, easy-to-use web interface.

---

## 📋 Table of Contents
- [🎯 What This Does](#-what-this-does)
- [⚡ Quick Setup (5 Minutes)](#-quick-setup-5-minutes)
- [🌐 How to Monitor Traffic](#-how-to-monitor-traffic)
- [📊 Using the Dashboard](#-using-the-dashboard)
- [🔧 Advanced Configuration](#-advanced-configuration)
- [🐛 Troubleshooting](#-troubleshooting)

---

## 🎯 What This Does

This tool acts as a **proxy server** that sits between your browser/application and the internet, capturing all traffic to Wildlink domains:

- `wildlink.me` and all subdomains
- `wildlink.ai` and all subdomains  
- `wild.link` (link shortener)
- `wfi.re` (short domain)
- `storage.googleapis.com/wildlink` (Google Cloud Storage)

**What you get:**
- ✅ Real-time traffic monitoring dashboard
- ✅ Complete request/response data (headers, body, parameters)
- ✅ Advanced filtering and search capabilities
- ✅ Export data as JSON
- ✅ Privacy protection (hides sensitive billing info)

---

## ⚡ Quick Setup (5 Minutes)

### Step 1: Install Dependencies
```bash
# Navigate to the project folder
cd wildlink-proxy-monitor

# Install required packages
pip3 install -r requirements.txt
```

### Step 2: Start the Services
```bash
# Start both proxy and web interface
./start_all.sh
```

**That's it!** You should see:
```
🚀 Starting Wildlink Proxy Monitor - All Services
📡 Proxy Port: 8080
🌐 Web Interface: http://localhost:5001
```

### Step 3: Open the Dashboard
Open your browser and go to: **http://localhost:5001**

---

## 🌐 How to Monitor Traffic

The proxy is now running on `localhost:8080`, but you need to configure your browser or application to use it.

### Option A: Configure Your Browser (Recommended)

#### Chrome/Edge:
1. Go to **Settings** → **Advanced** → **System**
2. Click **"Open your computer's proxy settings"**
3. Set **HTTP Proxy** to: `localhost:8080`
4. Set **HTTPS Proxy** to: `localhost:8080`
5. Click **Save**

#### Firefox:
1. Go to **Settings** → **General** → **Network Settings**
2. Click **"Settings..."**
3. Select **"Manual proxy configuration"**
4. Set **HTTP Proxy** to: `localhost` **Port**: `8080`
5. Set **HTTPS Proxy** to: `localhost` **Port**: `8080`
6. Click **OK**

#### Safari (macOS):
1. **System Preferences** → **Network**
2. Select your network connection → **Advanced**
3. Go to **Proxies** tab
4. Check **Web Proxy (HTTP)** and **Secure Web Proxy (HTTPS)**
5. Set both to: `localhost:8080`

### Option B: Test with Command Line
```bash
# Test the proxy with curl
curl --proxy localhost:8080 https://wildlink.me
curl --proxy localhost:8080 https://wild.link
```

### Option C: Configure Specific Applications
Many applications allow proxy configuration in their settings. Set them to use `localhost:8080` for both HTTP and HTTPS.

---

## 📊 Using the Dashboard

Once traffic starts flowing, visit **http://localhost:5001** to see:

### 🏠 Main Dashboard
- **Real-time statistics** (total requests, completed, pending)
- **Domain breakdown** pie chart
- **HTTP methods** bar chart (GET, POST, etc.)
- **Status codes** analysis
- **Recent activity** feed

### 📋 Logs Viewer (`/logs`)
- **Advanced filtering** by domain, method, status code
- **Search** through URLs, headers, and body content
- **Sortable results** with pagination
- **Quick access** to detailed views

### 🔍 Individual Log Details (`/log/<id>`)
- **Complete request/response** information
- **Syntax-highlighted** JSON
- **Copy-to-clipboard** functionality
- **Raw data export**

### 🔄 Auto-Refresh
The dashboard updates automatically every 5 seconds. You can pause/resume this in the interface.

---

## 🔧 Advanced Configuration

### Custom Ports
```bash
# Use different ports if needed
PROXY_PORT=8081 WEB_PORT=5002 ./start_all.sh
```

### Start Services Separately
```bash
# Terminal 1: Start proxy only
./start_proxy.sh

# Terminal 2: Start web interface only
./start_web_interface.sh
```

### Environment Variables
- `PROXY_PORT`: Proxy service port (default: 8080)
- `WEB_PORT`: Web interface port (default: 5001)

### Data Storage
- All captured data is saved to `proxy-logs.json`
- Maximum 10,000 requests kept (oldest are automatically removed)
- File location can be changed in `proxy_service.py`

---

## 🐛 Troubleshooting

### "Address already in use" Error
**Problem**: Port 5000 is busy (usually macOS AirPlay)
**Solution**: 
```bash
WEB_PORT=5001 ./start_web_interface.sh
```

### "No such file or directory" Error
**Problem**: Script permissions
**Solution**:
```bash
chmod +x *.sh
```

### Proxy Not Capturing Traffic
**Problem**: Browser not configured or SSL issues
**Solutions**:
1. Double-check proxy settings in your browser
2. Try HTTP sites first: `http://wildlink.me`
3. Test with curl: `curl --proxy localhost:8080 -k https://wildlink.me`

### Web Interface Not Loading
**Problem**: Service not started or wrong port
**Solutions**:
1. Check if service is running: `netstat -an | grep 5001`
2. Try different port: `WEB_PORT=5002 python3 web_interface.py`
3. Check terminal for error messages

### Charts Not Loading
**Problem**: Empty data or JavaScript issues
**Solutions**:
1. Generate some traffic first
2. Refresh the page
3. Check browser console for errors

### SSL Certificate Warnings
**Problem**: HTTPS sites show certificate warnings
**Solutions**:
1. This is normal for proxy monitoring
2. Click "Advanced" → "Proceed" in browser
3. Or use curl with `-k` flag to ignore SSL errors

---

## 📝 Quick Reference

### Important URLs
- **Dashboard**: http://localhost:5001
- **Logs**: http://localhost:5001/logs
- **API Stats**: http://localhost:5001/api/stats

### Key Files
- `proxy-logs.json` - All captured traffic data
- `proxy_service.py` - Main proxy logic
- `web_interface.py` - Dashboard application

### Monitored Domains
- `wildlink.me` + subdomains
- `wildlink.ai` + subdomains
- `wild.link`
- `wfi.re`
- `storage.googleapis.com/wildlink`

---

## 🎉 You're All Set!

1. ✅ Services running
2. ✅ Browser configured to use proxy
3. ✅ Dashboard accessible at http://localhost:5001
4. ✅ Ready to monitor Wildlink traffic

**Need help?** Check the troubleshooting section above or look at the terminal output for error messages.
