# Installation Instructions

## Quick Start

1. **Generate Icons** (if not already created):
   - Open `generate-icons.html` in your browser
   - Click "Generate Icons"
   - Click "Download All Icons"
   - Save all 4 PNG files to the `icons/` folder

2. **Load Extension in Chrome/Edge**:
   - Open Chrome or Edge
   - Go to `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `xml-converter-extension` folder
   - The extension is now installed!

3. **Use the Extension**:
   - Click the extension icon in your browser toolbar
   - Click "Open XML Converter"
   - Start converting XML!

## File Structure

```
xml-converter-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── converter.html        # Main XML converter app
├── background.js         # Background service worker
├── generate-icons.html   # Icon generator tool
├── create-icons.js       # Icon creation script (SVG)
├── README.md             # Documentation
├── INSTALLATION.md       # This file
└── icons/                # Extension icons (PNG files)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Troubleshooting

### Icons Not Showing
- Make sure you've generated and saved the PNG icons to the `icons/` folder
- Icons must be PNG format, not SVG
- Use `generate-icons.html` to create proper PNG icons

### Extension Won't Load
- Make sure "Developer mode" is enabled
- Check that all required files are present
- Look for errors in the extensions page

### Converter Won't Open
- Check browser console for errors (F12)
- Ensure `converter.html` is in the extension folder
- Try reloading the extension

## Updating the Extension

After making changes:
1. Go to `chrome://extensions/`
2. Find "XML Order Status Converter"
3. Click the refresh/reload icon
4. Test your changes

