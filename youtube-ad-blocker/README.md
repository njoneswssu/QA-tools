# YouTube Ad Blocker Extension

A Chrome extension that blocks YouTube ads with floating controls and an ad counter.

## Features

- **Automatic Ad Blocking**: Automatically detects and blocks YouTube ads
- **Floating Controls**: Draggable floating UI with controls that can be toggled on/off
- **Manual Block Button**: Click to manually block ads during playback
- **Ad Counter**: Shows the total number of ads blocked
- **Persistent Storage**: Remembers your blocked ad count across sessions
- **Modern UI**: Beautiful gradient design with smooth animations

## Installation

1. **Download/Clone**: Download or clone this extension to your local machine

2. **Open Chrome Extensions**:
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load Extension**:
   - Click "Load unpacked"
   - Select the `youtube-ad-blocker` folder
   - The extension should now appear in your extensions list

4. **Pin Extension** (Optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Click the pin icon next to "YouTube Ad Blocker"

## Usage

### Automatic Operation
- Navigate to YouTube.com
- The extension automatically starts blocking ads
- Floating controls appear in the top-right corner

### Floating Controls
- **Drag**: Click and drag the header to move the controls
- **Toggle**: Click the `−` button to collapse/expand controls
- **Block Ad**: Click "Block Ad" to manually skip current ad
- **Reset Count**: Click "Reset Count" to reset the blocked ads counter

### Extension Popup
- Click the extension icon to open the popup
- View blocked ads statistics
- Quick access to YouTube
- Toggle floating controls visibility
- Reset counter

## Controls Breakdown

### Floating UI Elements:
- **Title Bar**: "Ad Blocker" with toggle button
- **Counter**: Shows number of blocked ads
- **Block Ad Button**: Manually triggers ad blocking
- **Reset Button**: Clears the counter

### How It Works:
1. **CSS Blocking**: Hides ad containers using CSS selectors
2. **Video Ad Skipping**: Automatically clicks skip buttons
3. **Time Manipulation**: Fast-forwards through unskippable ads
4. **DOM Monitoring**: Watches for new ads loaded dynamically

## Troubleshooting

### Extension Not Working:
1. Refresh the YouTube page
2. Check that the extension is enabled in `chrome://extensions/`
3. Look for the floating controls in the top-right corner

### Ads Still Showing:
1. Try clicking the "Block Ad" button manually
2. YouTube may have updated their ad system - this is ongoing cat-and-mouse
3. Some ads may bypass detection initially

### Controls Not Visible:
1. Try clicking the extension icon and select "Toggle Controls"
2. Check if controls were dragged off-screen
3. Refresh the page to reset position

## Privacy

This extension:
- ✅ Only runs on YouTube.com
- ✅ Stores data locally (blocked count)
- ✅ Does not collect personal information
- ✅ Does not send data to external servers
- ✅ Open source - you can review all code

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: Limited to YouTube and local storage only
- **Architecture**: Content script + background worker + popup
- **Storage**: Chrome local storage for persistence

## Files Structure

```
youtube-ad-blocker/
├── manifest.json       # Extension configuration
├── content.js          # Main ad blocking logic
├── background.js       # Extension background tasks
├── popup.html          # Extension popup interface
├── popup.js            # Popup functionality
├── styles.css          # Floating controls styling
└── README.md           # This file
```

## Updates

To update the extension:
1. Download the latest version
2. Go to `chrome://extensions/`
3. Click "Load unpacked" and select the new folder
4. Or click the refresh button on the existing extension

## Support

This is a local development extension. If you encounter issues:
1. Check the Chrome Developer Console for errors
2. Try disabling and re-enabling the extension
3. Restart Chrome browser

---

**Note**: This extension is for educational purposes. Ad blocking may affect content creators' revenue. Consider supporting your favorite YouTube creators through other means.
