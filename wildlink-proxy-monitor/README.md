# Wildlink Proxy Monitor

A comprehensive network traffic monitoring service specifically designed to capture and analyze traffic from Wildlink domains. Built with mitmproxy and Flask, it provides real-time traffic capture with a beautiful web interface for analysis.

## 🎯 Features

### Traffic Capture
- **Real-time monitoring** of network requests and responses
- **Domain filtering** for Wildlink-specific traffic:
  - `storage.googleapis.com/wildlink` - Google Cloud Storage bucket
  - `wildlink.me` - Main domain and all subdomains
  - `wildlink.ai` - AI domain and all subdomains  
  - `wild.link` - Link shortener
  - `wfi.re` - Short domain

### Data Collection
- **Complete request data**: Method, URL, headers, body, query parameters
- **Complete response data**: Status code, headers, body, timing
- **Important parameter extraction**: Filters for key parameters (d, s, io, c, tc, st, nm, sender, device, auth, token, id, uid)
- **Privacy protection**: Automatically hides sensitive billing/card information

### Storage & Management
- **JSON-based storage** with automatic rotation (max 10,000 requests)
- **Auto-save** after every request/response
- **Unique request IDs** with timestamp + URL hash
- **Complete request lifecycle tracking**

### Web Interface
- **Real-time dashboard** with auto-refresh
- **Advanced filtering** by domain, method, status code, search terms
- **Detailed log viewer** with syntax highlighting
- **Interactive charts** showing traffic breakdown
- **Copy-to-clipboard** functionality for easy data sharing

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### Installation

1. **Clone or download** the wildlink-proxy-monitor directory
2. **Install dependencies**:
   ```bash
   pip3 install -r requirements.txt
   ```

### Running the Service

#### Option 1: Start Everything (Recommended)
```bash
./start_all.sh
```
This starts both the proxy service and web interface together.

#### Option 2: Start Services Separately

**Start Proxy Service:**
```bash
./start_proxy.sh
```

**Start Web Interface (in another terminal):**
```bash
./start_web_interface.sh
```

### Default Ports
- **Proxy Service**: 8080
- **Web Interface**: 5000  
- **Mitmproxy Web UI**: 8081

## 🌐 Web Interface

### Dashboard (`http://localhost:5000`)
- Real-time statistics and charts
- Domain breakdown visualization
- HTTP method distribution
- Status code analysis
- Recent activity feed
- Auto-refresh every 5 seconds

### Logs Viewer (`http://localhost:5000/logs`)
- Advanced filtering options
- Search across URLs, headers, and body content
- Sortable and paginated results
- Quick access to detailed views

### Log Details (`http://localhost:5000/log/<id>`)
- Complete request/response information
- Syntax-highlighted JSON
- Copy-to-clipboard functionality
- Raw data export

## 📊 Data Structure

Each captured request contains:

```json
{
  "id": "1730387562000-12345",
  "timestamp": "2024-10-31T12:34:56.789Z",
  "type": "request",
  "method": "GET",
  "url": "https://wild.link/api/track?d=device123&s=sender456",
  "hostname": "wild.link",
  "path": "/api/track",
  "queryParams": {
    "d": "device123",
    "s": "sender456",
    "other": "value"
  },
  "importantParams": {
    "d": "device123",
    "s": "sender456"
  },
  "headers": {
    "Authorization": "Bearer token123",
    "User-Agent": "Chrome/...",
    "Cookie": "session=abc"
  },
  "requestBody": "{\"data\":\"payload\"}",
  "clientIp": "127.0.0.1",
  "source": "mitmproxy",
  "statusCode": 200,
  "responseHeaders": {
    "Content-Type": "application/json"
  },
  "responseBody": "{\"success\":true}",
  "completed": true,
  "completedTimestamp": "2024-10-31T12:34:57.123Z"
}
```

## 🔧 Configuration

### Environment Variables
- `PROXY_PORT`: Proxy service port (default: 8080)
- `WEB_PORT`: Web interface port (default: 5000)
- `MITMWEB_PORT`: Mitmproxy web UI port (default: 8081)

### Customization
- **Log file location**: Edit `log_file` parameter in `proxy_service.py`
- **Max requests**: Modify `max_requests` parameter (default: 10,000)
- **Target domains**: Update `target_domains` set in `proxy_service.py`
- **Important parameters**: Modify `important_params` set for custom filtering

## 🛠️ Usage Examples

### Basic Monitoring
1. Start the service: `./start_all.sh`
2. Configure your browser/application to use proxy: `localhost:8080`
3. Visit Wildlink domains to generate traffic
4. View results at: `http://localhost:5000`

### Advanced Filtering
- Filter by domain: Select specific Wildlink domains
- Search content: Find requests containing specific text
- Status codes: Filter by HTTP response codes
- Methods: Show only GET, POST, etc.

### Data Export
- Use the web interface copy buttons
- Access raw JSON at `/api/logs` endpoint
- Direct file access: `proxy-logs.json`

## 📁 File Structure

```
wildlink-proxy-monitor/
├── proxy_service.py          # Main proxy monitoring service
├── web_interface.py          # Flask web application
├── requirements.txt          # Python dependencies
├── start_proxy.sh           # Start proxy service only
├── start_web_interface.sh   # Start web interface only
├── start_all.sh            # Start all services
├── templates/              # HTML templates
│   ├── index.html         # Dashboard
│   ├── logs.html          # Logs viewer
│   └── log_detail.html    # Individual log details
├── proxy-logs.json        # Traffic data (auto-created)
└── README.md             # This file
```

## 🔒 Security & Privacy

- **Sensitive data protection**: Billing and card information automatically hidden
- **Local storage**: All data stored locally, no external transmission
- **HTTPS support**: Full SSL/TLS traffic capture capability
- **IP logging**: Client IP addresses captured for analysis

## 🐛 Troubleshooting

### Common Issues

**"mitmproxy not found"**
- Run: `pip3 install -r requirements.txt`

**"Permission denied" on scripts**
- Run: `chmod +x *.sh`

**Web interface not loading**
- Check if port 5000 is available
- Try: `WEB_PORT=5001 ./start_web_interface.sh`

**No traffic captured**
- Verify proxy configuration in browser/application
- Check target domains are correct
- Ensure HTTPS certificate is trusted

### Logs and Debugging
- Proxy logs: Console output from `start_proxy.sh`
- Web interface logs: Console output from `start_web_interface.sh`
- Traffic data: `proxy-logs.json` file

## 📈 Performance

- **Memory usage**: ~50-100MB for typical usage
- **Storage**: ~1KB per request (varies with content size)
- **Throughput**: Handles hundreds of requests per second
- **Auto-cleanup**: Maintains max 10,000 requests automatically

## 🤝 Contributing

This is a specialized tool for Wildlink traffic monitoring. For modifications:

1. **Proxy logic**: Edit `proxy_service.py`
2. **Web interface**: Modify templates and `web_interface.py`
3. **Startup scripts**: Update `.sh` files as needed

## 📄 License

This tool is provided as-is for network traffic analysis and monitoring purposes.
