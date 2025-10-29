# Troubleshooting Guide

## Common Issues and Solutions

### ❌ Error: "ENOTDIR: not a directory, mkdir '/Volumes/...'"

**Problem**: This error occurs when the app tries to create data directories in the DMG mount path instead of the proper app data location.

**Solution**: ✅ **FIXED** - The app now uses the proper macOS app data directory (`~/Library/Application Support/website-availability-tester/data/`) instead of trying to write to the DMG mount.

**What was changed**:
- Data directory now uses `app.getPath('userData')` 
- Merchant history is stored in the user's Application Support folder
- No more attempts to write to read-only DMG locations

### 🌐 Wildlink Integration Issues

#### Login Required
**Problem**: The app shows "Login required - please log in manually in the browser window..."

**Solution**: 
1. The app will open a browser window automatically
2. Log in to your Wildlink account in that browser window
3. The app will detect when login is complete and continue automatically
4. Your login session is saved for future use

#### Getting Application Names Instead of Merchants
**Problem**: The merchant list shows application names (Acorns, Citi, etc.) instead of actual merchant names.

**Solution**: ✅ **FIXED** - The scraper now:
- Properly navigates through the application selection process
- Waits for merchant lists to load completely
- Filters out application names and UI elements
- Extracts actual merchant/retailer names

#### No Merchants Found
**Problem**: The scraper returns 0 merchants for an application.

**Solutions**:
1. **Make sure you're logged in** - Some applications require authentication
2. **Try different browsers** - Some merchants only appear for specific browser types
3. **Wait longer** - Large merchant lists take time to load
4. **Check the browser window** - The scraper shows what it's doing in real-time

### 🔧 Other Common Issues

#### App Won't Start
1. **Right-click** the app and select "Open" (bypasses Gatekeeper)
2. Go to **System Preferences > Security & Privacy** and click "Open Anyway"
3. Make sure you're using the correct DMG for your Mac:
   - Intel Macs: `Website Availability Tester-1.0.0.dmg`
   - Apple Silicon (M1/M2/M3): `Website Availability Tester-1.0.0-arm64.dmg`

#### Browser Fails to Launch
1. **Restart the app** - Playwright sometimes needs a fresh start
2. **Check available memory** - Close other applications if needed
3. **Verify internet connection** - Required for downloading browser components

#### Testing Stops Unexpectedly
1. **Check the error message** in the app interface
2. **Network issues** - Verify stable internet connection
3. **Memory issues** - Reduce the number of merchants being tested simultaneously

#### No Results Showing
1. **Check input format** - Ensure merchants are in supported format
2. **Verify URLs** - Make sure URLs are accessible
3. **Wait for completion** - Some websites take longer to load

### 📁 Data Storage Locations

The app now stores data in the proper macOS locations:

- **Merchant History**: `~/Library/Application Support/website-availability-tester/data/tested-merchants.json`
- **Wildlink Login Data**: `~/.wildlink-scraper-data/` (maintains login sessions)
- **App Logs**: Check Console.app for "Website Availability Tester" entries
- **Exported Results**: Saved to your chosen location via the Export button

### 🔄 Reset App Data

To completely reset the app and clear all history:

1. Quit the app completely
2. Delete the folder: `~/Library/Application Support/website-availability-tester/`
3. Restart the app

### 📞 Getting Help

If you encounter other issues:

1. **Check this troubleshooting guide first**
2. **Look at the app's status messages** - they often contain helpful information
3. **Try the basic solutions**: restart app, check internet, verify input format
4. **Check macOS Console** for detailed error messages

### 🛠️ Technical Details

- **Built with**: Electron 27.3.11 + Playwright
- **Browser**: Chromium (automatically downloaded)
- **Data Format**: JSON files for merchant tracking
- **Network**: Requires internet for browser downloads and website testing

---

**The app is now fixed and should work properly from the DMG installation!**
