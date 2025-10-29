# Installation Guide - Website Availability Tester

## Quick Start

1. **Download the DMG**: Choose the appropriate version for your Mac:
   - `Website Availability Tester-1.0.0.dmg` (Intel Macs)
   - `Website Availability Tester-1.0.0-arm64.dmg` (Apple Silicon Macs - M1/M2/M3)

2. **Install the App**:
   - Double-click the downloaded `.dmg` file
   - Drag the "Website Availability Tester" app to your Applications folder
   - Eject the DMG file

3. **First Launch**:
   - Open the app from Applications
   - If you see a security warning, go to System Preferences > Security & Privacy and click "Open Anyway"

## Using the App

### 1. Enter Merchants
Paste your merchant list in the text area. Supported formats:
```
Store Name, https://example.com
Store Name - https://example.com
https://example.com
example.com
{"name": "Store Name", "url": "https://example.com"}
```

### 2. Start Testing
- Click "▶️ Start Testing" to begin
- The app will automatically open a Chromium browser window
- Watch the real-time progress in the interface

### 3. Control Testing
- **⏸️ Pause**: Temporarily stop testing (can resume later)
- **▶️ Resume**: Continue from where you paused
- **⏹️ Stop**: Completely stop testing

### 4. View Results
- Switch between tabs: All / Available / Unavailable
- See detailed reasons for each result
- Export results for further analysis

### 5. Smart Features
- **Merchant Tracking**: Already tested merchants (within 24h) are automatically skipped
- **Clear History**: Force retest all merchants by clearing history
- **Real-time Stats**: Live updates of testing progress

## Troubleshooting

### App Won't Open
- **Security Warning**: Go to System Preferences > Security & Privacy > General, and click "Open Anyway"
- **Damaged App**: Re-download the DMG file and try again

### Browser Issues
- The app uses Playwright's Chromium browser
- If browser fails to start, restart the app
- Check that you have sufficient disk space

### Performance
- Testing many merchants simultaneously may use significant CPU/memory
- Use Pause/Resume to manage system resources
- Close other applications if needed

### Network Issues
- Ensure stable internet connection
- Some websites may block automated access
- Network errors are automatically detected and reported

## Features

✅ **User-Friendly Interface**: Clean, modern macOS-style design  
✅ **Bulk Testing**: Test hundreds of websites efficiently  
✅ **Smart Detection**: Multi-language unavailability pattern detection  
✅ **Merchant Tracking**: Avoid retesting recently checked sites  
✅ **Real-time Progress**: Live updates and statistics  
✅ **Pause/Resume**: Full control over testing process  
✅ **Export Results**: Save data for analysis  
✅ **Multiple Input Formats**: Flexible merchant input options  

## System Requirements

- macOS 10.12 or later
- 4GB RAM minimum (8GB recommended for large merchant lists)
- 2GB free disk space
- Internet connection

## Support

For issues or questions:
1. Check this installation guide
2. Review the README.md file
3. Check the app's built-in help tooltips

---

**Built with Electron + Playwright for reliable website testing**
