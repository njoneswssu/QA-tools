# Fix for excel.cloud.microsoft Domain

## Issue
Extension shows "Excel API not ready after 10 seconds" on `excel.cloud.microsoft` domain even though Excel is clearly loaded and working.

## Root Cause
The `excel.cloud.microsoft` domain loads Office.js more slowly than other Excel Online domains. The 10-second timeout wasn't long enough.

## Solution (v1.2.1)

### Changes Made
1. ⏰ **Increased timeout** from 10 seconds to 20 seconds
2. 📝 **Better logging** to see what's happening in console
3. 🔄 **More patient retry logic** for slower-loading domains

### How to Apply the Fix

1. **Reload Extension**
   ```
   chrome://extensions/ → Find "Excel Color Clearer" → Click reload (🔄)
   ```

2. **Refresh Your Excel Page**
   ```
   Press Ctrl+R (or Cmd+R) on your Excel page
   ```

3. **Wait Longer**
   ```
   After page loads, wait 15-20 seconds before opening extension
   ```

4. **Open Extension**
   ```
   Click extension icon
   Should now detect Excel properly!
   ```

### Testing the Fix

**Step-by-Step Test:**

1. ✅ Reload extension in `chrome://extensions/`
2. ✅ Go back to your Excel page (`excel.cloud.microsoft`)
3. ✅ Refresh the page (Ctrl+R)
4. ✅ Wait 20 full seconds (count to 20!)
5. ✅ Press F12 to open browser console
6. ✅ Look for "Excel API is ready!" message in console
7. ✅ Click extension icon
8. ✅ Should now say "✓ Excel Online detected"

### Debug Information

**Check Browser Console (F12):**

You should see these messages:
```
Excel Color Clearer extension loaded
Waiting for Excel API to load...
Excel and Office objects found (attempt X)
✓ Excel API is ready!
```

If you see:
```
Excel API not ready after 20 seconds
```

Then Office.js isn't loading at all (different issue).

### What If It Still Doesn't Work?

If you've waited 20 seconds and it still doesn't work, try:

1. **Hard Refresh**
   ```
   Ctrl+Shift+R (or Cmd+Shift+R)
   Clears cache and reloads
   ```

2. **Check Console for Errors**
   ```
   F12 → Console tab
   Look for red error messages
   Share them if you see any
   ```

3. **Try Different Browser**
   ```
   If on Chrome, try Edge
   If on Edge, try Chrome
   ```

4. **Check Edit Permissions**
   ```
   Make sure you can actually edit cells
   Try typing in a cell to verify
   ```

### Why excel.cloud.microsoft is Different

- Uses different Excel Online infrastructure
- Loads Office.js library more slowly
- May have additional security checks
- Often used by corporate SharePoint

### Recommended Workflow for excel.cloud.microsoft

```
1. Open Excel file
2. Wait for cells to be visible
3. Click "Edit" if prompted
4. Count to 20 (seriously, just wait!)
5. THEN open extension
6. Should work now ✓
```

### Technical Details

**Old behavior:**
- Waited 10 seconds (20 attempts × 500ms)
- Gave up too early for excel.cloud.microsoft

**New behavior:**
- Waits 20 seconds (40 attempts × 500ms)  
- Logs progress to console
- Better error messages

### Version History

- **v1.2.0**: Added retry logic (10 seconds)
- **v1.2.1**: Increased to 20 seconds for excel.cloud.microsoft

---

**TL;DR:** Reload extension, refresh Excel page, wait 20 seconds, try again!

