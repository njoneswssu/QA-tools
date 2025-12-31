# XML Proxy Server

This proxy server fetches XML content from URLs server-side, bypassing CORS restrictions that prevent direct client-side fetching.

## Setup

1. **Start the proxy server:**
   ```bash
   node xml-proxy-server.js
   ```

   The server will start on `http://localhost:3001`

2. **Open the XML Converter:**
   - Open `xml-converter.html` in your browser
   - Click on the "WSCO Search" tab
   - The converter will automatically fetch XML from the configured URL

## How It Works

- The proxy server acts as a middleman between your browser and the target URL
- When you request XML from a URL, the browser sends a request to the proxy server
- The proxy server fetches the content from the target URL and returns it to the browser
- This bypasses CORS restrictions since the server-to-server request doesn't have the same limitations

## Usage

The proxy server accepts GET requests with a `url` query parameter:

```
http://localhost:3001/?url=http://transfer.levsuite.com/search_wsco.php
```

## Features

- ✅ CORS bypass for XML fetching
- ✅ Handles HTTP and HTTPS URLs
- ✅ Follows redirects automatically
- ✅ Returns XML content with proper headers
- ✅ Error handling

## Troubleshooting

If you see "Error loading XML" or "Make sure the proxy server is running on port 3001":
1. Make sure the proxy server is running: `node xml-proxy-server.js`
2. Check that port 3001 is not already in use
3. Verify the target URL is accessible from your server

## Changing the Port

To change the proxy server port, edit `xml-proxy-server.js`:
```javascript
const PORT = 3001; // Change this to your desired port
```

Then update `xml-converter.html`:
```javascript
const PROXY_SERVER_URL = 'http://localhost:3001'; // Update to match
```

