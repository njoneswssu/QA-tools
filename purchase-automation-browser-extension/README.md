# Purchase Automation Browser Extension

A Chrome/Edge browser extension that automates test purchases on e-commerce websites and extracts order details including product URL, order price, tax, fees, and total.

## Features

- **🛒 Smart Purchase Automation**: Automatically navigates categories, filters by price, and selects cheapest products
- **📌 Website Crouton**: Floating control panel that appears on any e-commerce website
- **💰 Price Range Filtering**: Set minimum and maximum price limits for product selection
- **🎯 Category-Based Shopping**: Automatically finds and navigates to specified product categories
- **📊 Order Details Extraction**: Captures product URL, order price, tax, fees, and total
- **📈 Session Statistics**: Tracks automation attempts, success rate, and average prices
- **💾 Data Export**: Save results as JSON files for analysis
- **⚙️ Customizable Settings**: Auto-inject crouton, notifications, and default price ranges

## Installation

### Method 1: Load Unpacked Extension (Recommended for Development)

1. **Download the Extension**
   - Clone or download this repository
   - Navigate to the `purchase-automation-browser-extension` folder

2. **Open Chrome/Edge Extensions Page**
   - Chrome: Go to `chrome://extensions/`
   - Edge: Go to `edge://extensions/`

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `purchase-automation-browser-extension` folder
   - The extension should now appear in your extensions list

5. **Pin the Extension**
   - Click the puzzle piece icon in the toolbar
   - Find "Purchase Automation Extension" and click the pin icon

### Method 2: Chrome Web Store (Future)
*This extension will be available on the Chrome Web Store in the future.*

## How to Use

### 1. Basic Setup
1. Click the extension icon in your browser toolbar
2. The popup will show the current status and settings
3. Navigate to any e-commerce website (Amazon, eBay, etc.)

### 2. Inject the Crouton
1. On the website, click "📌 Inject Crouton" in the extension popup
2. A floating control panel will appear on the website
3. You can drag this panel around the page

### 3. Configure Purchase Parameters
In the floating crouton on the website:
- **Category**: Enter the product category (e.g., "electronics", "clothing", "books")
- **Min Price**: Set the minimum price range ($)
- **Max Price**: Set the maximum price range ($)

### 4. Start Automation
1. Click "🚀 Start Automation" in the crouton
2. The extension will:
   - Search for the specified category
   - Apply price filters and sort by price (low to high)
   - Select the cheapest product in your price range
   - Add to cart and proceed to checkout
   - Extract order details from the checkout page

### 5. View Results
- Results appear in real-time in the extension popup
- View session statistics (attempts, success rate, average price)
- Export results as JSON files for further analysis
- View all results in a detailed table

## Supported Websites

The extension uses intelligent selectors and should work with most e-commerce websites including:
- Amazon
- eBay
- Walmart
- Target
- Best Buy
- And many more...

The extension automatically adapts to different site structures by trying multiple selector strategies.

## Settings

### Auto-Inject Crouton
- Automatically injects the crouton when you visit e-commerce websites
- Can be disabled in the extension popup

### Notifications
- Shows browser notifications for automation completion and errors
- Can be toggled in settings

### Default Price Range
- Set default min/max prices that will pre-populate in the crouton
- Saves time when testing multiple websites

## Privacy & Security

[[memory:5286018]] The extension is designed with privacy in mind - sensitive billing and card information is hidden in code and logs, similar to how username and password information is protected.

- **No Data Collection**: The extension does not collect or transmit any personal data
- **Local Storage Only**: All results and settings are stored locally in your browser
- **No External Servers**: All processing happens locally in your browser
- **Secure Permissions**: Only requests necessary permissions for functionality

## Troubleshooting

### Common Issues

**Crouton not appearing:**
- Ensure you clicked "Inject Crouton" in the extension popup
- Some websites may block script injection - try refreshing the page
- Check that the website URL starts with `http://` or `https://`

**Category not found:**
- Try different category names (e.g., "electronics" vs "tech")
- Some websites may have unique category structures
- The extension will attempt to use search if category navigation fails

**Price filtering not working:**
- Not all websites support automated price filtering
- The extension will still find the cheapest available product
- Try adjusting your price range

**Automation stops unexpectedly:**
- Complex checkout flows may require manual intervention
- Check the status messages for detailed error information
- Some websites have anti-automation measures

### Debug Mode
- Use the browser's Developer Tools (F12) to see console messages
- Check the extension popup for detailed status information
- Look for error messages in the crouton status display

## File Structure

```
purchase-automation-browser-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for background tasks
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content.js             # Content script for page interaction
├── content.css            # Content script styles
├── crouton-injector.js    # Floating crouton implementation
├── crouton-styles.css     # Crouton styling
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Development

### Making Changes
1. Edit the relevant files in the extension directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging
- Use `console.log()` statements in your code
- Check the browser's Developer Tools console
- Use the extension's popup for status information
- Background script logs appear in the extension's service worker console

## Permissions Explained

- **storage**: Save settings and results locally
- **activeTab**: Access the current tab for crouton injection
- **scripting**: Inject the crouton script into websites
- **tabs**: Manage tab information and communication
- **downloads**: Export results as downloadable files
- **host_permissions**: Access all websites for automation

## Version History

### v1.0.0
- Initial release
- Basic purchase automation functionality
- Crouton interface for website interaction
- Session statistics and result export
- Support for major e-commerce websites

## Support

If you encounter issues or have suggestions:
1. Check the troubleshooting section above
2. Look for error messages in the browser console
3. Try disabling and re-enabling the extension
4. Clear the extension's data and restart

## License

MIT License - See the source code for details.
