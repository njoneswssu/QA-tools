# CitiShop Browser Extension

A cross-browser extension for dynamic merchant testing with CitiShop automation. Input merchants through a beautiful interface, validate against your database, and generate test code or inject floating controls.

## ✨ Features

🎯 **Dynamic Merchant Input**: Enter merchants through a beautiful popup interface  
🔍 **Real-time Validation**: Validate against 7,752+ merchants from your CitiList database  
📄 **Auto Code Generation**: Generate Playwright test code automatically  
📌 **Floating Controls**: Inject testing controls directly into web pages  
📊 **Session Statistics**: Track your testing progress  
🌐 **Cross-Browser Support**: Works on Chrome, Edge, and Safari  

## 🚀 Installation

### For Google Chrome

1. **Open Chrome Extensions page**:
   - Go to `chrome://extensions/`
   - Or click Menu → More Tools → Extensions

2. **Enable Developer Mode**:
   - Toggle "Developer mode" in the top right

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `citishop-browser-extension` folder
   - Click "Select Folder"

4. **Pin the Extension** (optional):
   - Click the puzzle piece icon in the toolbar
   - Pin "CitiShop Merchant Tester" for easy access

### For Microsoft Edge

1. **Open Edge Extensions page**:
   - Go to `edge://extensions/`
   - Or click Menu → Extensions

2. **Enable Developer Mode**:
   - Toggle "Developer mode" in the left sidebar

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `citishop-browser-extension` folder
   - Click "Select Folder"

### For Safari

1. **Enable Safari Developer Features**:
   - Safari → Preferences → Advanced
   - Check "Show Develop menu in menu bar"

2. **Convert to Safari Extension**:
   - Use `xcrun safari-web-extension-converter` to convert the extension
   - Or use the Manifest V2 version (contact for details)

## 📖 How to Use

### 1. Input Merchants

1. **Click the extension icon** in your browser toolbar
2. **Enter merchant names** in the text area (comma-separated)
   - Example: `Ulta, Best Buy, Macy's, Sephora`
3. **Click "Validate"** or press `Ctrl+Enter`

### 2. Review Results

- ✅ **Found merchants** are displayed with their URLs
- ❌ **Not found merchants** are listed separately
- Only found merchants can be used for testing

### 3. Generate Test Code

1. **Click "Generate Test Code"** after validation
2. **Copy the generated code** to your clipboard
3. **Replace the websites array** in your `quick-citishop-test.spec.js` file
4. **Run your Playwright test** as usual

### 4. Use Floating Controls

1. **Click "Add Floating Controls"** after validation
2. **Navigate between merchants** using Previous/Next buttons
3. **Test current merchant** by clicking "Test Current"
4. **Flag issues** if you encounter problems

## 🛠️ Features in Detail

### Merchant Validation

The extension validates merchants against a database of **7,752 merchants** loaded from your `citiList.txt` file:

- ✅ Case-insensitive matching
- 🔗 URL validation and normalization
- 📊 Real-time statistics tracking
- 💾 Persistent session data

### Code Generation

Automatically generates properly formatted JavaScript code:

```javascript
const websites = [
  { name: 'Ulta', url: 'https://www.ulta.com/' },
  { name: 'Best Buy', url: 'https://www.bestbuy.com/' },
  { name: 'Macy\'s', url: 'https://www.macys.com/' }
];
```

### Floating Controls

Injected controls include:

- 📊 **Current merchant info** with progress indicator
- ⏭️ **Navigation buttons** (Previous/Next)
- 🧪 **Test current merchant** button
- 🚩 **Flag issues** functionality
- ⚙️ **Settings and help** options
- 📌 **Draggable interface** for positioning

### Session Statistics

Track your testing progress:

- 📈 **Total merchants validated**
- 📄 **Test code generations**
- 📊 **Success rate percentage**
- 💾 **Persistent across browser sessions**

## 🔧 Configuration

### Database Update

The extension automatically loads merchant data from your `citiList.txt` file. To update:

1. **Regenerate the database**:
   ```bash
   cd citishop-browser-extension
   node merchant-data-loader.js
   ```

2. **Reload the extension** in your browser

### Settings

Access settings through:
- Extension popup → Settings button
- Floating controls → Settings button

Available options:
- Auto-close popup after injection
- Show/hide notifications
- Debug mode for development

## 🎯 Integration with Playwright

### Original Test File

Your `quick-citishop-test.spec.js` currently has hardcoded merchants:

```javascript
const websites = [
  { name: 'Trusador', url: 'https://www.trusador.com/' },
  { name: 'Guzzle H2O', url: 'https://guzzleh2o.com' },
  // ... more merchants
];
```

### With the Extension

1. **Use the extension** to validate and generate code
2. **Replace the websites array** with generated code
3. **Run tests normally** with dynamic merchant selection

### Example Workflow

1. Open the extension popup
2. Enter: `Ulta, Best Buy, Sephora, PetSmart`
3. Click "Validate" → See 4 found, 0 not found
4. Click "Generate Test Code"
5. Copy the generated code
6. Replace in your test file
7. Run: `npx playwright test quick-citishop-test.spec.js`

## 🎨 Keyboard Shortcuts

- `Ctrl+Enter`: Validate merchants in popup
- Standard copy/paste shortcuts work everywhere
- `Escape`: Close floating controls help/settings

## 🔍 Troubleshooting

### Extension Not Loading

1. **Check Developer Mode** is enabled
2. **Verify folder path** contains `manifest.json`
3. **Check browser console** for error messages
4. **Try refreshing** the extensions page

### Merchants Not Found

1. **Check spelling** and exact capitalization
2. **Verify citiList.txt** is up to date
3. **Regenerate database** with `node merchant-data-loader.js`
4. **Reload extension** after database update

### Floating Controls Not Appearing

1. **Check page permissions** (some sites block content scripts)
2. **Try refreshing** the page after injection
3. **Disable other extensions** that might conflict
4. **Check browser console** for JavaScript errors

### Generated Code Issues

1. **Ensure quotes are properly escaped** in merchant names
2. **Verify URLs are valid** (https:// preferred)
3. **Check for special characters** in merchant names
4. **Test with smaller merchant sets** first

## 📁 File Structure

```
citishop-browser-extension/
├── manifest.json              # Extension configuration
├── popup.html                 # Main popup interface
├── popup.css                  # Popup styling
├── popup.js                   # Popup functionality
├── background.js              # Background service worker
├── content.js                 # Content script for web pages
├── content.css                # Content script styles
├── merchant-data-loader.js    # Database generator
├── merchant-list.json         # Generated merchant database
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

## 🔒 Privacy & Security

The extension:
- ✅ **Only accesses data you provide**
- ✅ **Stores data locally** in your browser
- ✅ **No external servers** or data transmission
- ✅ **Open source** and auditable
- ✅ **Minimal permissions** required

[[memory:5286018]] Sensitive information handling:
- No billing or card information is processed
- Merchant URLs and names are treated as public data
- Session statistics are anonymized

## 🆘 Support

### Common Issues

**"Failed to load merchant database"**
- Run `node merchant-data-loader.js` to regenerate
- Check that `citiList.txt` exists and is readable

**"Extension popup is blank"**
- Check browser console for JavaScript errors
- Try disabling other extensions temporarily
- Reload the extension

**"Floating controls don't work on some sites"**
- Some sites have strict Content Security Policies
- Try navigating to the merchant site manually
- Use the generated code method instead

### Getting Help

1. **Check this README** for common solutions
2. **Check browser console** for error messages
3. **Try with a smaller test set** of merchants
4. **Verify file permissions** and paths

## 🔄 Updates

To update the extension:

1. **Pull latest changes** to the extension folder
2. **Regenerate merchant database** if needed
3. **Reload extension** in browser
4. **Clear extension storage** if experiencing issues

## 🎉 Quick Start

1. **Install the extension** (see Installation section)
2. **Click the extension icon** in your toolbar
3. **Enter some merchants**: `Ulta, Best Buy, Sephora`
4. **Click "Validate"** to check them
5. **Click "Generate Test Code"** to create JavaScript
6. **Copy and use** in your Playwright tests!

That's it! You're now ready to use dynamic merchant testing with CitiShop. 🚀
