# 🎨 Excel Color Clearer Extension

A browser extension that clears cells with specific background colors in Excel Web (Office 365) and resets them to white.

## Features

- ✨ Clear cells by hex color code
- 📊 Process single sheet or all sheets in workbook
- 🎨 Live color preview
- ✅ Optional confirmation before clearing
- 📈 Detailed results showing cells cleared per sheet
- 🚀 Fast and efficient processing
- 💾 Remembers your last hex code and settings
- 🌐 Works across all Excel Online domains

## Installation

### Chrome/Edge Installation

1. **Generate Icons** (First Time Only)
   - Open `generate-icons.html` in your browser
   - Click "Download All Icons"
   - Save all icons to the `icons/` folder

2. **Load Extension**
   - Open Chrome/Edge
   - Go to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `excel-color-clearer-extension` folder

3. **Pin Extension**
   - Click the extensions puzzle icon in toolbar
   - Pin "Excel Color Clearer" for easy access

### Firefox Installation

1. **Generate Icons** (same as above)

2. **Load Extension**
   - Open Firefox
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `manifest.json` in the extension folder

> **Note:** Firefox temporary add-ons are removed when Firefox closes. For permanent installation, the extension needs to be signed or use Firefox Developer Edition.

## Usage

### Basic Usage

1. **Open Excel Online**
   - Go to [office.com](https://office.com)
   - Open any Excel workbook

2. **Open Extension**
   - Click the Excel Color Clearer icon in your browser toolbar
   - The extension popup will appear

3. **Enter Hex Color**
   - Type the hex color code you want to clear
   - Examples: `#FF0000`, `FF0000`, `#00FF00`
   - You'll see a live preview of the color

4. **Configure Options**
   - ✅ **Process all sheets**: Clear color from all sheets (checked by default)
   - ✅ **Confirm before clearing**: Show confirmation dialog (optional)

5. **Clear Cells**
   - Click the "Clear Cells" button
   - Wait for processing to complete
   - View results showing cells cleared per sheet

### Example Scenarios

**Scenario 1: Remove Red Highlights**
```
Hex Code: #FF0000 or FF0000
Result: All red cells → white
```

**Scenario 2: Clear Yellow Comments**
```
Hex Code: #FFFF00 or FFFF00
Result: All yellow cells → white
```

**Scenario 3: Remove Light Blue Backgrounds**
```
Hex Code: #ADD8E6 or ADD8E6
Result: All light blue cells → white
```

## Finding Hex Codes

### Method 1: Use Built-in Color Picker
1. In Excel Online, select a colored cell
2. Click "Home" → "Fill Color" dropdown
3. Click "More Colors"
4. Copy the hex code shown

### Method 2: Use Browser DevTools
1. Right-click the cell
2. Select "Inspect"
3. Look for background-color in styles
4. Copy the hex value

### Method 3: External Color Picker
- Use online tools like [HTML Color Codes](https://htmlcolorcodes.com/color-picker/)
- Take a screenshot and upload to get hex codes

## Supported Excel Platforms

✅ **Supported:**
- Excel Online (office.com)
- Excel Web App (onedrive.live.com)
- SharePoint Excel files (sharepoint.com)
- Excel Cloud (excel.cloud.microsoft)

❌ **Not Supported:**
- Desktop Excel (Windows/Mac)
- Excel mobile apps
- Google Sheets (different platform)

## Technical Details

### How It Works

1. **Excel JavaScript API**: Uses Office.js to interact with Excel workbooks
2. **Color Matching**: Compares cell background colors to target hex code
3. **Batch Processing**: Efficiently processes large spreadsheets
4. **Safe Operations**: Only modifies cell background colors (content preserved)

### Permissions Required

- `activeTab`: Access current Excel tab
- `scripting`: Inject content script into Excel pages
- `storage`: Save your last hex code and preferences
- `host_permissions`: Access Office 365 and Excel Cloud domains

### Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 88+     | ✅ Supported |
| Edge    | 88+     | ✅ Supported |
| Firefox | 89+     | ✅ Supported |
| Safari  | 14+     | ⚠️ Requires conversion |

## Troubleshooting

### "Excel API not available" Error

**Solution:** Make sure you're on Excel Online
- Open [office.com](https://office.com)
- Open an actual Excel file (.xlsx)
- Wait for file to fully load
- Try the extension again

### "No cells found" Message

**Causes:**
1. Hex code doesn't match exactly
2. Cells use different color shade
3. Cells have no background color

**Solutions:**
- Double-check the hex code
- Use color picker to get exact value
- Try similar color codes (e.g., #FF0000, #FF0001)

### Extension Not Working

**Steps:**
1. Refresh the Excel page
2. Reload the extension in Chrome
3. Check browser console for errors (F12)
4. Ensure extension is enabled

### Performance Issues

**For Large Spreadsheets:**
- Process one sheet at a time (uncheck "all sheets")
- Avoid very large ranges
- Close other browser tabs
- Clear browser cache

## Development

### Project Structure

```
excel-color-clearer-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── content.js            # Excel page interaction
├── generate-icons.html   # Icon generator tool
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

### Making Changes

1. Edit source files
2. Go to `chrome://extensions/`
3. Click reload icon on extension card
4. Test changes in Excel Online

### Adding Features

**Example: Add text color clearing**
1. Modify `content.js` to check font color
2. Add option in `popup.html`
3. Update `popup.js` logic
4. Test thoroughly

## Security & Privacy

- ✅ No data collected or transmitted
- ✅ Works entirely in your browser
- ✅ No external API calls
- ✅ Open source - review the code
- ✅ Only accesses active Excel tab when you click

## Limitations

1. **Performance**: Very large spreadsheets (100k+ cells) may be slow
2. **Exact Match**: Colors must match exactly (slight variations ignored)
3. **Online Only**: Doesn't work with desktop Excel
4. **Content Preserved**: Only clears background, not cell content
5. **Undo**: Use Excel's built-in undo (Ctrl+Z) if needed

## FAQ

**Q: Can I undo the changes?**
A: Yes, use Ctrl+Z (Cmd+Z on Mac) immediately after clearing.

**Q: Will this delete my data?**
A: No, it only changes background colors. Cell content is preserved.

**Q: Can I clear multiple colors at once?**
A: Not currently. Run the extension multiple times for different colors.

**Q: Does it work offline?**
A: No, Excel Online requires internet connection.

**Q: Can I use it for desktop Excel?**
A: No, this extension only works with Excel Web.

## Version History

### v1.0.0 (2026-01-14)
- Initial release
- Clear cells by hex color
- Process single or all sheets
- Color preview
- Confirmation dialog option

## Support

For issues or feature requests:
1. Check the Troubleshooting section
2. Review browser console for errors
3. Create an issue with details

## License

MIT License - Feel free to modify and distribute

---

**Made with ❤️ for Excel power users**

