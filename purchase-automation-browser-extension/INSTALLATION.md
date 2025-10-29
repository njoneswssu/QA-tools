# Installation Guide - Purchase Automation Browser Extension

This guide will walk you through installing the Purchase Automation Browser Extension in Chrome or Edge.

## Prerequisites

- Google Chrome (version 88+) or Microsoft Edge (version 88+)
- Basic computer skills (downloading files, navigating folders)

## Step-by-Step Installation

### Step 1: Download the Extension Files

1. **Download the extension folder** to your computer
2. **Extract/unzip** if it's in a compressed format
3. **Remember the location** where you saved the `purchase-automation-browser-extension` folder

### Step 2: Open Browser Extensions Page

#### For Google Chrome:
1. Open Google Chrome
2. Type `chrome://extensions/` in the address bar and press Enter
3. Or click the three dots menu → More tools → Extensions

#### For Microsoft Edge:
1. Open Microsoft Edge
2. Type `edge://extensions/` in the address bar and press Enter
3. Or click the three dots menu → Extensions

### Step 3: Enable Developer Mode

1. Look for a toggle switch labeled **"Developer mode"** in the top right corner
2. **Click the toggle** to turn on Developer mode
3. You should see additional buttons appear (Load unpacked, Pack extension, Update)

### Step 4: Load the Extension

1. Click the **"Load unpacked"** button
2. **Navigate to** the folder where you saved the extension
3. **Select** the `purchase-automation-browser-extension` folder (not a file inside it)
4. Click **"Select Folder"** or **"Open"**

### Step 5: Verify Installation

1. The extension should now appear in your extensions list
2. You should see:
   - **Name**: Purchase Automation Extension
   - **Version**: 1.0.0
   - **Status**: Enabled (blue toggle switch)

### Step 6: Pin the Extension (Recommended)

1. Click the **puzzle piece icon** (🧩) in your browser toolbar
2. Find **"Purchase Automation Extension"** in the dropdown
3. Click the **pin icon** (📌) next to it
4. The extension icon should now appear in your toolbar

## Verification Test

### Test the Installation:

1. **Click the extension icon** in your toolbar (🛒)
2. You should see a popup with:
   - Status section
   - Quick Actions buttons
   - Settings options
   - Session statistics

3. **Navigate to any e-commerce website** (like Amazon.com)
4. **Click "📌 Inject Crouton"** in the extension popup
5. You should see a **floating control panel** appear on the website

If you see the floating panel, congratulations! The extension is installed correctly.

## Troubleshooting Installation

### Problem: "Load unpacked" button is not visible
**Solution**: Make sure Developer mode is enabled (toggle in top right)

### Problem: Extension doesn't appear after loading
**Solution**: 
- Refresh the extensions page (F5)
- Check that you selected the correct folder
- Make sure the folder contains `manifest.json`

### Problem: Extension shows errors
**Solution**:
- Check that all files are present in the folder
- Try disabling and re-enabling the extension
- Remove and re-add the extension

### Problem: Crouton doesn't inject on websites
**Solution**:
- Make sure the website URL starts with `http://` or `https://`
- Try refreshing the webpage
- Check that the extension is enabled and has permissions

### Problem: Extension icon not visible in toolbar
**Solution**:
- Click the puzzle piece icon (🧩) in the toolbar
- Find the extension and click the pin icon (📌)
- The icon should now appear permanently

## Permissions Explanation

When you install the extension, it will request these permissions:

- **📁 Storage**: Save your settings and results locally
- **🌐 Active Tab**: Access the current webpage to inject the crouton
- **⚙️ Scripting**: Run automation scripts on websites
- **📑 Tabs**: Manage browser tabs for automation
- **💾 Downloads**: Export your results as files
- **🌍 All Websites**: Work on any e-commerce website

**Note**: All data stays on your computer - nothing is sent to external servers.

## Uninstalling the Extension

If you need to remove the extension:

1. Go to `chrome://extensions/` or `edge://extensions/`
2. Find "Purchase Automation Extension"
3. Click **"Remove"**
4. Confirm the removal

## Updating the Extension

To update to a newer version:

1. Download the new extension files
2. Go to `chrome://extensions/` or `edge://extensions/`
3. Click the **refresh icon** (🔄) on the extension card
4. Or remove the old version and install the new one

## Getting Help

If you encounter issues during installation:

1. **Check this troubleshooting section** first
2. **Restart your browser** and try again
3. **Disable other extensions** temporarily to check for conflicts
4. **Clear browser cache** and try reinstalling

## Next Steps

Once installed successfully:

1. **Read the main README.md** for usage instructions
2. **Try the extension** on a test e-commerce website
3. **Configure settings** in the extension popup
4. **Set up default price ranges** for your testing needs

## Browser Compatibility

### Supported Browsers:
- ✅ Google Chrome (88+)
- ✅ Microsoft Edge (88+)
- ✅ Brave Browser
- ✅ Other Chromium-based browsers

### Not Supported:
- ❌ Firefox (uses different extension format)
- ❌ Safari (uses different extension format)
- ❌ Internet Explorer (outdated)

---

**Congratulations!** You've successfully installed the Purchase Automation Browser Extension. You're now ready to automate test purchases and extract order details from e-commerce websites.
