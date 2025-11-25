# Installation Instructions

## Quick Install

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or go to Chrome menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select the `wildlink-monitor-extension` folder
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "Wildlink Traffic Monitor" in your extensions list
   - The extension icon should appear in your Chrome toolbar

## Using the Extension

### Popup View
- Click the extension icon in the toolbar
- View recent Wildlink traffic and statistics
- Quick access to dashboard

### Dashboard View
- Click "View Dashboard" in the popup
- Full-featured interface with:
  - All captured traffic
  - Search and filter capabilities
  - Detailed request information
  - Statistics by domain

## Icons

If you see missing icon errors:
1. The extension will still work without custom icons
2. You can create simple PNG icons (16x16, 32x32, 48x48, 128x128)
3. Place them in the `icons/` folder with names: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

## Permissions

The extension requires:
- **webRequest**: To monitor network traffic
- **storage**: To save captured logs locally
- **tabs**: To get tab information for context

All data is stored locally in your browser - nothing is sent to external servers.

## Troubleshooting

- **Extension not appearing**: Make sure Developer mode is enabled
- **No traffic captured**: Visit a page with Wildlink redirects (like wild.link URLs)
- **Dashboard not loading**: Check browser console for errors (F12)

