# Update Summary - Version 1.1.0

## 🎉 What's New

Your Excel Color Clearer extension has been updated with important fixes and improvements!

## ✅ Fixed Issues

### 1. ❌ Fixed: Hex Code Disappearing

**Problem:** When you closed and reopened the extension, the hex code you entered would disappear.

**Solution:** Added persistent storage using `chrome.storage.local`

**What This Means:**
- ✅ Your last entered hex code is now saved
- ✅ Reopening the extension shows your previous hex code
- ✅ Your checkbox preferences are also saved
- ✅ No need to re-enter codes when working with multiple files

### 2. ❌ Fixed: Missing Excel Cloud Domain

**Problem:** Extension didn't work with `excel.cloud.microsoft` URLs (SharePoint often uses this)

**Solution:** Added support for `excel.cloud.microsoft` domain

**What This Means:**
- ✅ Now works with SharePoint Excel files
- ✅ Works with `excel.cloud.microsoft` direct links
- ✅ All Excel Online domains are now supported

## 🔄 Changes Made

### Files Updated

1. **manifest.json**
   - Added `"storage"` permission for saving preferences
   - Added `"https://excel.cloud.microsoft/*"` to host_permissions
   - Added `excel.cloud.microsoft` to content_scripts matches
   - Updated version to 1.1.0

2. **popup.js**
   - Added `saveHexCode()` function to save hex input
   - Added `loadHexCode()` function to restore hex input
   - Added `saveOptions()` function to save checkbox states
   - Added `loadOptions()` function to restore checkbox states
   - Updated `checkExcelPage()` to include excel.cloud.microsoft
   - Auto-saves as you type
   - Auto-loads saved values on popup open

3. **README.md**
   - Added Excel Cloud to supported platforms
   - Added "Remembers your last hex code" to features
   - Updated permissions documentation

4. **INSTALLATION.md**
   - Updated supported platforms list
   - Added excel.cloud.microsoft to examples

5. **CHANGELOG.md** (New File)
   - Documents all version changes
   - Tracks features, fixes, and improvements

## 📦 What Gets Saved

The extension now remembers:

- ✅ **Last hex code entered** - So you don't have to retype it
- ✅ **"Process all sheets" checkbox** - Your preference is saved
- ✅ **"Confirm before clearing" checkbox** - Your preference is saved

All data is stored locally in your browser. Nothing is sent to external servers.

## 🌐 Supported Domains (All Working Now)

✅ `https://*.office.com/*` - Excel Online  
✅ `https://*.live.com/*` - OneDrive Excel  
✅ `https://*.sharepoint.com/*` - SharePoint Excel  
✅ `https://excel.cloud.microsoft/*` - **NEW!** SharePoint/Excel Cloud  

## 🚀 How to Update

### If Extension is Already Installed:

1. Open `chrome://extensions/`
2. Find "Excel Color Clearer"
3. Click the reload icon (circular arrow)
4. Done! Extension updated to v1.1.0

### If Installing Fresh:

Follow the normal installation steps in [INSTALLATION.md](INSTALLATION.md)

## 🧪 Test the Updates

### Test 1: Persistent Hex Code

1. Open extension popup
2. Enter hex code: `#FF0000`
3. Close popup (don't clear cells yet)
4. Reopen extension popup
5. ✅ **Expected:** Hex code `#FF0000` should still be there!

### Test 2: Persistent Settings

1. Open extension popup
2. Uncheck "Process all sheets"
3. Check "Confirm before clearing"
4. Close popup
5. Reopen extension popup
6. ✅ **Expected:** Your checkbox changes are preserved!

### Test 3: Excel Cloud Domain

1. Go to `https://excel.cloud.microsoft/...` (any SharePoint Excel file)
2. Open extension popup
3. ✅ **Expected:** No error message, extension detects Excel properly
4. Enter hex code and clear cells
5. ✅ **Expected:** Works correctly!

## 📊 Version Comparison

| Feature | v1.0.0 | v1.1.0 |
|---------|--------|--------|
| Clear by hex code | ✅ | ✅ |
| Process all sheets | ✅ | ✅ |
| Color preview | ✅ | ✅ |
| office.com support | ✅ | ✅ |
| live.com support | ✅ | ✅ |
| sharepoint.com support | ✅ | ✅ |
| **excel.cloud.microsoft** | ❌ | ✅ |
| **Remember hex code** | ❌ | ✅ |
| **Save preferences** | ❌ | ✅ |
| **Auto-restore state** | ❌ | ✅ |

## 🔒 Privacy

**New Storage Permission:**
- Data saved: Hex code, checkbox preferences
- Storage location: Local browser only
- External servers: None
- Data collection: None
- Your privacy: Fully protected ✅

## 💡 Usage Tips with New Features

### Tip 1: Quick Workflow
```
1. Set your preferences once (checkboxes)
2. They'll stay that way for future uses
3. No need to reconfigure each time!
```

### Tip 2: Multiple Colors
```
1. Clear red cells (#FF0000)
2. Close popup
3. Reopen - last code still there
4. Change to yellow (#FFFF00)
5. Clear yellow cells
6. Much faster workflow!
```

### Tip 3: SharePoint Users
```
Now works perfectly with SharePoint Excel files
that use excel.cloud.microsoft URLs!
```

## 🐛 Known Issues

None at this time! Both reported issues have been fixed.

## 📝 Feedback

If you encounter any issues or have suggestions:
1. Check browser console (F12) for errors
2. Verify you're on a supported Excel URL
3. Try reloading the extension
4. Check [README.md](README.md) for troubleshooting

## 🎯 Next Steps

- ✅ Reload the extension to get updates
- ✅ Test on your Excel files
- ✅ Enjoy the improved workflow!

---

**Updated:** January 14, 2026  
**Version:** 1.1.0  
**Status:** All Issues Fixed ✓

