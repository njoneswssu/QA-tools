# Wildlink Traffic Monitor Chrome Extension

A Chrome extension that monitors and captures Wildlink network traffic directly in your browser.

## Features

- 🔍 **Automatic Monitoring**: Captures all Wildlink traffic automatically as you browse
- 📊 **Real-time Dashboard**: View captured traffic in a comprehensive dashboard
- 🎯 **Wildlink Domain Detection**: Monitors wild.link, wildlink.me, wildlink.ai, wfi.re, and more
- 📝 **Detailed Logging**: Captures request/response details, query parameters, and page context
- 🔗 **Parameter Extraction**: Extracts important parameters (c, d, tc, url, etc.) from wild.link redirects

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `wildlink-monitor-extension` folder
5. The extension is now installed and active!

## Usage

### Basic Monitoring

1. The extension automatically starts monitoring when installed
2. Browse normally - any Wildlink traffic will be captured automatically
3. Click the extension icon to view the popup with recent traffic

### View Dashboard

1. Click the extension icon
2. Click "View Dashboard" button
3. A new tab opens with the full dashboard showing all captured traffic

### Features

- **Popup**: Quick view of recent traffic and stats
- **Dashboard**: Full-featured interface with:
  - Statistics (total requests, by domain)
  - Search/filter functionality
  - Detailed log table with all request information
  - Export capabilities

## Monitored Domains

- `wild.link` (including redirect URLs like `/e?c=...`)
- `wildlink.me`
- `www.wildlink.me`
- `wildlink.ai`
- `wfi.re`
- `storage.googleapis.com` (Wildlink content)

## Captured Data

For each Wildlink request, the extension captures:

- Request method (GET, POST, etc.)
- Full URL with all parameters
- Query parameters (including important ones like `c`, `d`, `tc`, `url`)
- Response status code
- Response headers
- Timestamp
- Source page URL and title
- Tab information

## Example

When you visit a page with a wild.link redirect like:
```
https://wild.link/e?c=141645&d=35227470&tc=6875535bb877cfe7b383d6b6&url=https%3A%2F%2Faaprintsupplyco.com
```

The extension will:
1. Detect the wild.link request
2. Extract all parameters (c, d, tc, url)
3. Log the request and response
4. Display it in the dashboard with full details

## Icons

The extension includes placeholder icon files. You can replace them with custom icons:
- `icons/icon16.png` (16x16)
- `icons/icon32.png` (32x32)
- `icons/icon48.png` (48x48)
- `icons/icon128.png` (128x128)

## Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- You can clear logs at any time
- The extension only monitors Wildlink-related traffic

## Development

To modify the extension:

1. Edit the files in `wildlink-monitor-extension/`
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Changes will be applied immediately

## Troubleshooting

- **No traffic captured**: Make sure you're visiting pages that use Wildlink redirects
- **Extension not working**: Check that it's enabled in `chrome://extensions/`
- **Dashboard not loading**: Ensure all files are in the extension folder

## License

This extension is for monitoring and analysis purposes.

