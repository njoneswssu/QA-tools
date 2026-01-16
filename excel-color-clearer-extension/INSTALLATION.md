# 📦 Installation Guide - Excel Color Clearer Extension

Complete step-by-step guide to install and use the Excel Color Clearer extension.

## Quick Start (5 minutes)

### For Chrome/Edge Users

1. **Navigate to Extension Folder**
   ```bash
   cd /Users/neil/playwrightautomation/excel-color-clearer-extension
   ```

2. **Load Extension in Browser**
   - Open Chrome or Edge
   - Type `chrome://extensions/` in address bar (or `edge://extensions/`)
   - Enable "Developer mode" (toggle switch in top-right corner)
   - Click "Load unpacked" button
   - Select the `excel-color-clearer-extension` folder
   - Extension will appear in your toolbar!

3. **Done!** The SVG icons should work. If you see icon issues, see "Generate PNG Icons" section below.

### For Firefox Users

1. **Navigate to Extension Folder**
   ```bash
   cd /Users/neil/playwrightautomation/excel-color-clearer-extension
   ```

2. **Load Extension in Browser**
   - Open Firefox
   - Type `about:debugging#/runtime/this-firefox` in address bar
   - Click "Load Temporary Add-on..."
   - Navigate to the extension folder
   - Select `manifest.json`
   - Extension loads temporarily!

3. **Note:** Firefox removes temporary add-ons when you close the browser. For permanent installation, use Firefox Developer Edition.

## Optional: Generate PNG Icons

If your browser doesn't display SVG icons properly, generate PNG versions:

### Method 1: Use the HTML Generator (Easiest)

1. Open `generate-icons.html` in any browser
2. Icons appear automatically
3. Click "Download All Icons"
4. Save each icon to the `icons/` folder
5. Update `manifest.json` to use `.png` instead of `.svg`
6. Reload extension in browser

### Method 2: Online Converter

1. Go to https://svgtopng.com/
2. Upload each SVG from `icons/` folder
3. Download as PNG
4. Save to `icons/` folder with same names
5. Update `manifest.json` to use `.png` instead of `.svg`
6. Reload extension

### Method 3: Command Line (If you have ImageMagick)

```bash
cd /Users/neil/playwrightautomation/excel-color-clearer-extension/icons
for size in 16 32 48 128; do
  convert icon${size}.svg icon${size}.png
done
```

## First-Time Usage

### Step 1: Open Excel Online

1. Go to one of these:
   - [office.com](https://office.com)
   - [excel.cloud.microsoft](https://excel.cloud.microsoft)
   - Your SharePoint site with Excel files
2. Sign in with your Microsoft account
3. Open any Excel workbook
4. Wait for workbook to fully load

### Step 2: Identify Color to Clear

**Find the hex code of cells you want to clear:**

**Option A: Use Excel's Color Picker**
1. Select a colored cell
2. Click "Home" tab
3. Click "Fill Color" dropdown arrow
4. Click "More Colors..."
5. Note the hex code (e.g., #FF0000)

**Option B: Use Browser DevTools**
1. Right-click on colored cell
2. Select "Inspect" or "Inspect Element"
3. Look for `background-color` in styles panel
4. Copy the hex value

**Option C: Use External Tool**
- Take a screenshot of the cell
- Upload to [imagecolorpicker.com](https://imagecolorpicker.com/)
- Get the hex code

### Step 3: Use the Extension

1. Click the Excel Color Clearer icon in your browser toolbar
2. Enter the hex code in the input field
   - Examples: `#FF0000` or `FF0000`
   - You'll see a live color preview
3. Choose options:
   - ✅ **Process all sheets** - Clear color from entire workbook
   - ✅ **Confirm before clearing** - Show confirmation dialog
4. Click "Clear Cells" button
5. Wait for processing
6. View results showing cells cleared

### Step 4: Review Changes

- Check your spreadsheet - colored cells should now be white
- If you made a mistake, press `Ctrl+Z` (or `Cmd+Z` on Mac) to undo
- Try again with different hex codes if needed

## Common Examples

### Example 1: Remove Red Highlights

**Scenario:** You highlighted cells in red (#FF0000) for review. Now you want to clear them.

1. Open Excel Online
2. Click extension icon
3. Enter: `#FF0000` or `FF0000`
4. Check "Process all sheets"
5. Click "Clear Cells"
6. ✓ All red cells → white

### Example 2: Clear Yellow Comments

**Scenario:** Your colleague added yellow backgrounds (#FFFF00) for comments.

1. Open Excel Online
2. Click extension icon
3. Enter: `#FFFF00`
4. Uncheck "Process all sheets" (current sheet only)
5. Click "Clear Cells"
6. ✓ Yellow cells → white in active sheet

### Example 3: Remove Light Blue Data Highlights

**Scenario:** Data validation cells have light blue (#ADD8E6) backgrounds.

1. Open Excel Online
2. Click extension icon
3. Enter: `#ADD8E6`
4. Check "Confirm before clearing"
5. Click "Clear Cells"
6. Confirm in dialog
7. ✓ Light blue cells → white

## Verification Checklist

After installation, verify everything works:

- [ ] Extension appears in browser toolbar
- [ ] Icon displays correctly (colorful grid with eraser)
- [ ] Popup opens when clicked
- [ ] Color preview updates as you type hex codes
- [ ] Extension works on Excel Online pages
- [ ] Cells clear to white successfully
- [ ] Results show correct count

## Troubleshooting Installation

### Extension Not Showing Up

**Problem:** Extension doesn't appear in toolbar after loading

**Solutions:**
1. Refresh the extensions page (`chrome://extensions/`)
2. Check "Developer mode" is enabled
3. Look for error messages on extension card
4. Click "Details" to see if it loaded correctly
5. Pin the extension from the puzzle icon menu

### "Manifest file is missing or unreadable"

**Problem:** Error when loading unpacked extension

**Solutions:**
1. Make sure you selected the correct folder
2. Verify `manifest.json` exists in folder
3. Check file permissions (should be readable)
4. Try loading again

### Icons Not Displaying

**Problem:** Extension has blank/broken icons

**Solutions:**
1. Check if `icons/` folder exists
2. Verify SVG files are in `icons/` folder
3. Generate PNG icons using method above
4. Update `manifest.json` to use `.png` files
5. Reload extension

### "Excel API not available" Error

**Problem:** Extension says Excel API not found

**Solutions:**
1. Make sure you're on Excel Online (office.com)
2. Open an actual Excel file, not just office.com homepage
3. Wait for file to fully load before using extension
4. Refresh the Excel page
5. Try a different Excel file

### Extension Not Working in Firefox

**Problem:** Extension doesn't load or work in Firefox

**Solutions:**
1. Use `about:debugging` page (not regular extensions)
2. Click "Load Temporary Add-on"
3. Select `manifest.json` file directly
4. Note: Extension persists only until Firefox closes
5. Consider using Firefox Developer Edition

## Uninstallation

### Chrome/Edge

1. Go to `chrome://extensions/` or `edge://extensions/`
2. Find "Excel Color Clearer"
3. Click "Remove"
4. Confirm removal

### Firefox

1. Go to `about:addons`
2. Find "Excel Color Clearer"
3. Click "Remove" or just close Firefox (temporary add-ons auto-remove)

## Updating the Extension

When you make changes to the code:

1. Go to `chrome://extensions/`
2. Find "Excel Color Clearer"
3. Click the reload icon (circular arrow)
4. Extension reloads with latest changes
5. Test in Excel Online

## Support

If you encounter issues:

1. Check browser console (F12) for error messages
2. Verify you're using Excel Online (not desktop Excel)
3. Make sure Excel file is fully loaded
4. Try reloading the extension
5. Try reloading the Excel page

## Next Steps

- ✅ Extension installed and working
- 📖 Read the [README.md](README.md) for full documentation
- 🎨 Try clearing different colors in your spreadsheets
- 🚀 Explore options like "process all sheets"

---

**Happy color clearing! 🎉**

