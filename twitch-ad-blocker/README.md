# Twitch Ad Blocker Extension

A powerful Chrome extension designed to block ads that randomly appear during Twitch livestreams, including preroll, midroll, and display ads. Specialized for Twitch's dynamic ad delivery system.

## ✨ Features

- **Real-time Ad Detection**: Detects and blocks ads that appear randomly during Twitch livestreams
- **Multiple Ad Types**: Blocks preroll, midroll, and display ads
- **Smart Detection**: Uses advanced selectors and patterns specific to Twitch's ad system
- **Chat Protection**: Doesn't interfere with chat interactions or Twitch UI elements
- **Manual Override**: Force block ads with a single click
- **Statistics Tracking**: Keep track of how many ads have been blocked
- **Lightweight**: Minimal performance impact on streaming experience
- **Auto-skip**: Automatically skips video ads when possible

## 🚀 Installation Instructions

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. **Download or Clone the Extension**
   - Download all files to a folder named `twitch-ad-blocker`
   - Or clone from repository: `git clone [repository-url]`

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or go to Chrome menu → More tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `twitch-ad-blocker` folder
   - The extension should now appear in your extensions list

5. **Verify Installation**
   - Look for the Twitch Ad Blocker icon in your browser toolbar
   - Navigate to [twitch.tv](https://twitch.tv) to test functionality

### Method 2: Create ZIP Package for Distribution

1. **Package the Extension**
   ```bash
   # Navigate to the extension directory
   cd twitch-ad-blocker
   
   # Create a ZIP file with all extension files
   zip -r twitch-ad-blocker-v1.0.zip . -x "*.DS_Store" "*.git*" "README.md"
   ```

2. **Install from ZIP**
   - Follow steps 1-3 from Method 1
   - Drag and drop the ZIP file onto the extensions page
   - Or use "Load unpacked" and select the extracted folder

## 🎮 How to Use

### Basic Usage

1. **Navigate to Twitch**
   - Open [twitch.tv](https://twitch.tv) in Chrome
   - The extension will automatically start working

2. **View Statistics**
   - Click the extension icon in the toolbar
   - See how many ads have been blocked
   - Check if the extension is active

3. **Manual Ad Blocking**
   - Click the extension popup
   - Press "Block Ads Now" to force immediate ad blocking
   - Useful if an ad slips through

### Settings and Controls

- **Extension Enabled**: Toggle the entire extension on/off
- **Block Twitch Ads**: Specifically enable/disable Twitch ad blocking
- **Aggressive Mode**: More intensive blocking (may affect performance)
- **Reset Counter**: Clear the blocked ads statistics

### Troubleshooting

If ads are still appearing:

1. **Try Manual Blocking**
   - Click the extension icon
   - Press "Block Ads Now"

2. **Enable Aggressive Mode**
   - Open extension popup
   - Toggle "Aggressive Mode" on
   - Refresh the Twitch page

3. **Check Extension Status**
   - Ensure the extension is enabled
   - Verify you're on a Twitch page
   - Look for the green "Active" status

## 🔧 Technical Details

### Files Structure
```
twitch-ad-blocker/
├── manifest.json          # Extension configuration
├── content.js            # Main ad blocking logic
├── background.js         # Background service worker
├── popup.html           # Extension popup interface
├── popup.js             # Popup functionality
├── popup.css            # Popup styling
├── styles.css           # Content script styles
├── icon16.png           # 16x16 icon
├── icon48.png           # 48x48 icon
├── icon128.png          # 128x128 icon
└── README.md            # This file
```

### How It Works

1. **Content Script Injection**: Runs on all Twitch pages
2. **Mutation Observer**: Watches for dynamically added ad elements
3. **Video Monitoring**: Specifically monitors video elements for ad patterns
4. **Smart Selectors**: Uses Twitch-specific selectors and data attributes
5. **URL Pattern Blocking**: Blocks requests to known ad networks
6. **Text Content Analysis**: Identifies ads by content keywords

### Twitch-Specific Features

- **Random Ad Detection**: Handles Twitch's unpredictable ad timing
- **Stream Continuity**: Ensures video playback isn't interrupted
- **Chat Protection**: Never interferes with chat functionality
- **Multiple Ad Types**: Handles preroll, midroll, overlay, and banner ads
- **SPA Navigation**: Works with Twitch's single-page application

## 🛡️ Privacy & Security

- **No Data Collection**: Extension doesn't collect or transmit personal data
- **Local Storage Only**: Statistics stored locally in browser
- **No External Requests**: All blocking happens locally
- **Open Source**: Code is transparent and auditable
- **Minimal Permissions**: Only requests necessary permissions

## ⚠️ Important Notes

### Compliance
- This extension is for educational and personal use
- Respect Twitch's Terms of Service
- Consider supporting streamers through other means
- Use responsibly and at your own discretion

### Limitations
- May not block 100% of all ads due to Twitch's evolving systems
- Some ads may briefly appear before being blocked
- Performance impact may vary based on system resources
- Effectiveness depends on Twitch's current ad implementation

### Browser Compatibility
- **Supported**: Chrome 88+, Edge 88+, Brave, Opera
- **Manifest Version**: V3 (latest Chrome extension standard)
- **Not Supported**: Firefox (uses different extension API)

## 🐛 Troubleshooting

### Common Issues

**Extension not working:**
- Refresh the Twitch page
- Check if extension is enabled
- Try manual blocking

**Ads still appearing:**
- Enable Aggressive Mode
- Check for extension updates
- Clear browser cache

**Performance issues:**
- Disable Aggressive Mode
- Close other browser tabs
- Restart browser

**Chat not working:**
- Extension protects chat functionality
- If issues persist, temporarily disable extension
- Report the issue

### Debug Information

To help with troubleshooting:
1. Open browser console (F12)
2. Look for Twitch Ad Blocker messages
3. Note any error messages
4. Check extension popup for status

## 📝 Changelog

### Version 1.0
- Initial release
- Basic Twitch ad blocking
- Random ad detection
- Chat protection
- Manual blocking feature
- Statistics tracking
- Aggressive mode option

### Version 1.1 (Bug Fixes)
- **CRITICAL FIX**: Enhanced video player protection to prevent main video from being hidden
- Added emergency video restoration function that runs every 5 seconds
- Improved ad detection to be more conservative and safer
- Created custom Twitch-themed icons (purple shield design)
- Enhanced CSS protection for video elements
- Added extensive logging for debugging video blocking issues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on Twitch
5. Submit a pull request

### Development Setup
```bash
# Clone repository
git clone [repository-url]
cd twitch-ad-blocker

# Load in Chrome for testing
# Follow installation instructions above
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚡ Quick Start

1. Download the extension files
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `twitch-ad-blocker` folder
6. Navigate to Twitch and enjoy ad-free streaming!

---

**Note**: This extension is designed to work specifically with Twitch.tv and may not block ads on other video platforms. For YouTube ad blocking, consider using a dedicated YouTube ad blocker.
