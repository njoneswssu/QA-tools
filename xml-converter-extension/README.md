# XML Order Status Converter - Browser Extension

A Chrome/Edge browser extension for converting XML order status formats and searching WSCO numbers with a Chrome-like XML viewer.

## Features

- **Order Numbers Mode**: Generate XML from order numbers
- **XML Input Mode**: Convert existing XML between formats
- **WSCO Search Mode**: Search for WSCO numbers with embedded browser and XML tree viewer
- **Chrome-style XML Display**: View XML as a collapsible document tree
- **Editable XML Viewer**: Edit XML directly in the tree view

## Installation

### Chrome/Edge

1. Open Chrome or Edge browser
2. Navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `xml-converter-extension` folder
6. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon in your browser toolbar
2. Click "Open XML Converter" in the popup
3. The converter will open in a new tab

### Modes

- **Order Numbers**: Paste order numbers (one per line) to generate XML
- **XML Input**: Paste existing XML to convert between formats
- **WSCO Search**: Search for WSCO numbers - XML results are automatically displayed as a tree

## Icon Generation

If icons are missing, open `generate-icons.html` in your browser and generate/download the icon files.

Alternatively, create PNG icons manually:
- `icons/icon16.png` (16x16)
- `icons/icon32.png` (32x32)
- `icons/icon48.png` (48x48)
- `icons/icon128.png` (128x128)

## Files

- `manifest.json` - Extension manifest
- `popup.html` / `popup.js` - Extension popup interface
- `converter.html` - Main XML converter application
- `background.js` - Background service worker
- `generate-icons.html` - Icon generator tool

## Permissions

- `storage` - Store user preferences
- `activeTab` - Access current tab
- `tabs` - Create new tabs
- `http://*/*` and `https://*/*` - Access WSCO search URLs

## Development

To modify the extension:

1. Make changes to the files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Troubleshooting

- **Icons not showing**: Generate icons using `generate-icons.html` or create them manually
- **WSCO search not working**: Ensure the URL is accessible and not blocked by CORS
- **XML not displaying**: Check browser console for errors

