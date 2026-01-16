# 🔧 Troubleshooting Guide - Excel Color Clearer

## "Excel API not available" Error

This is the most common issue. Here's how to fix it:

### Solution 1: Wait for Excel to Load (Most Common)

**Problem:** Office.js hasn't finished loading yet  
**Solution:**
1. Wait 5-10 seconds after opening the Excel file
2. Close the extension popup
3. Reopen the extension
4. Should now show "✓ Excel Online detected"

### Solution 2: Switch to Edit Mode

**Problem:** File is in "View Only" mode  
**Solution:**
1. Look for "Edit in Browser" or "Edit Workbook" button at the top
2. Click it to enable editing
3. Wait a few seconds for edit mode to load
4. Try the extension again

### Solution 3: Refresh the Page

**Problem:** Excel API didn't load properly  
**Solution:**
1. Refresh the page (Ctrl+R or Cmd+R)
2. Wait for Excel file to fully load (you'll see your data)
3. Wait an additional 5 seconds
4. Open the extension

### Solution 4: Check URL

**Problem:** Not on a supported Excel page  
**Solution:**

Make sure your URL includes:
- ✅ `excel` in the URL
- ✅ AND one of these domains:
  - `office.com`
  - `live.com`
  - `sharepoint.com`
  - `excel.cloud.microsoft`

❌ **Won't work on:**
- Desktop Excel (file:// URLs)
- Google Sheets
- Other spreadsheet apps

### Solution 5: Clear Browser Cache

**Problem:** Cached scripts are outdated  
**Solution:**
1. Press Ctrl+Shift+Delete (or Cmd+Shift+Delete)
2. Clear cached images and files
3. Reload the Excel page
4. Try again

### Solution 6: Reload Extension

**Problem:** Extension needs to be reloaded  
**Solution:**
1. Go to `chrome://extensions/`
2. Find "Excel Color Clearer"
3. Click the reload button (🔄)
4. Refresh your Excel page
5. Try again

## Other Common Issues

### No Cells Found

**Problem:** Extension runs but finds 0 cells

**Possible Causes:**
1. **Hex code doesn't match exactly**
   - Use Excel's color picker to get exact hex
   - Try both with and without # symbol
   
2. **Cells have different shade**
   - #FF0000 vs #FF0001 are different colors
   - Check if cells have gradients or patterns
   
3. **No colored cells in selection**
   - Verify cells actually have background colors
   - Check you're on the right sheet

**Solutions:**
- Use Excel's "More Colors" to get exact hex code
- Select a colored cell → Home → Fill Color → More Colors
- Copy the hex code exactly as shown

### Extension Won't Load

**Problem:** Extension doesn't appear in toolbar

**Solutions:**
1. Check if "Developer mode" is enabled
2. Verify extension folder has all files
3. Look for errors in `chrome://extensions/`
4. Try removing and reinstalling

### Slow Performance

**Problem:** Extension takes forever to process

**Possible Causes:**
- Very large spreadsheet (10,000+ cells)
- Many sheets selected
- Browser is low on memory

**Solutions:**
1. Uncheck "Process all sheets" (do one at a time)
2. Close other browser tabs
3. Process smaller ranges at a time
4. Wait patiently - large files take time

### Color Doesn't Match

**Problem:** You're sure the hex is right but cells aren't clearing

**Possible Causes:**
1. **Conditional formatting** - Color is dynamic, not static
2. **Cell styles** - Excel may apply theme colors
3. **Gradients** - Not solid colors
4. **Font color** - Extension only clears background

**Solutions:**
1. Remove conditional formatting first
2. Apply actual fill color (not theme colors)
3. Use solid colors only
4. Check you're targeting background, not text color

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] I'm on an Excel Online page (office.com, SharePoint, etc.)
- [ ] URL contains "excel" and a supported domain
- [ ] File is fully loaded (I can see my data)
- [ ] File is in "Edit" mode (not view-only)
- [ ] I waited at least 10 seconds after opening file
- [ ] Extension shows "✓ Excel Online detected" status
- [ ] Hex code is exact (copied from Excel's color picker)
- [ ] Extension is up to date (v1.2.0+)
- [ ] Browser cache is cleared
- [ ] I've tried refreshing the page

## Still Not Working?

### Check Browser Console

1. Open the Excel page
2. Press F12 to open DevTools
3. Click "Console" tab
4. Look for error messages
5. Share errors for troubleshooting

### Check Extension Console

1. Go to `chrome://extensions/`
2. Find "Excel Color Clearer"
3. Click "Details"
4. Click "Inspect views: popup.html"
5. Check Console for errors

## Step-by-Step: First Time Setup

If you've never gotten it to work, try this:

1. **Install Extension**
   ```
   chrome://extensions/ → Developer mode ON → Load unpacked
   ```

2. **Open Test File**
   ```
   Go to office.com → Open any Excel file
   ```

3. **Wait for Load**
   ```
   Wait until you can see all your data (not just "Loading...")
   ```

4. **Enter Edit Mode**
   ```
   Click "Edit in Browser" button at top
   ```

5. **Wait More**
   ```
   Wait 10 full seconds after edit mode loads
   ```

6. **Add Test Color**
   ```
   Select cell A1 → Home → Fill Color → Red
   ```

7. **Get Hex Code**
   ```
   With cell selected → Fill Color → More Colors → Copy hex (#FF0000)
   ```

8. **Open Extension**
   ```
   Click extension icon in toolbar
   ```

9. **Check Status**
   ```
   Should say "✓ Excel Online detected"
   If error, wait longer or refresh page
   ```

10. **Test Clear**
    ```
    Enter #FF0000 → Click "Clear Cells"
    ```

## Common SharePoint Issues

### Corporate SharePoint

**Problem:** SharePoint has strict security

**Solutions:**
1. Check with IT if browser extensions are allowed
2. Verify you have edit permissions on the file
3. Try opening file in new tab
4. Use "Open in SharePoint" → "Edit in Browser"

### Permission Errors

**Problem:** "Access Denied" or similar

**Solutions:**
1. Verify you can manually edit cells
2. Check file isn't locked by another user
3. Ensure file isn't read-only
4. Ask owner for edit permissions

## Browser-Specific Issues

### Chrome
- Usually works best
- Make sure Chrome is updated to version 88+

### Edge
- Works well with SharePoint
- Clear Edge cache if issues persist

### Firefox
- May need temporary add-on reload
- Check `about:debugging` for errors

## Emergency Reset

If nothing works, try a complete reset:

1. **Remove Extension**
   ```
   chrome://extensions/ → Remove Excel Color Clearer
   ```

2. **Clear Everything**
   ```
   Clear browser cache, cookies, and site data for office.com
   ```

3. **Restart Browser**
   ```
   Completely quit and reopen browser
   ```

4. **Reinstall Extension**
   ```
   Load unpacked extension again
   ```

5. **Test Fresh**
   ```
   Open new Excel file and test
   ```

## Getting Help

If you're still stuck:

1. Note the exact error message
2. Check browser console (F12)
3. Verify browser version
4. Note which domain you're using
5. Check if file is in edit mode

## Tips for Success

✅ **Always wait** - Excel API takes time to load  
✅ **Edit mode** - Make sure file is editable  
✅ **Exact hex codes** - Use Excel's color picker  
✅ **One sheet at a time** - For large files  
✅ **Keep extension updated** - Check for new versions  
✅ **Refresh when in doubt** - Often fixes issues  

---

**Still having issues?** The problem is usually one of:
1. Excel API not loaded yet (wait longer)
2. File in view-only mode (enable edit mode)
3. Not on correct URL (check domain)

99% of issues are solved by refreshing and waiting! 🎉

