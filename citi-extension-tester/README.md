# Citi Extension Tester

A browser extension that automatically tests the Citi extension popup on merchant websites, checking for exclusions, earning rates, and activation issues.

## Features

- **Automatic Testing**: Tests merchants from API endpoints (Google Storage and Wildlink API)
- **Popup Detection**: Detects Citi extension popup in iframes, shadow DOMs, or direct DOM
- **Flag Detection**: Automatically flags merchants with:
  - "ShareASale commission" in exclusions or earning rates
  - "Earn commissions" in exclusions or earning rates
  - "Online purchase" listed in exclusions
  - "Online purchase" listed twice in earning rates
- **Activation Testing**: Clicks "Activate Offer" button and verifies "Offer Activated" message
- **Screenshot Capture**: Takes screenshots of flagged popups
- **Results Management**:
  - View test results with pass/fail status
  - Click on results to see detailed information
  - Manually flag or pass merchants
  - Export results to CSV
- **Queue System**: Queue merchants to test first
- **Search**: Search merchants and results
- **Testing Controls**:
  - Start/Pause/Restart/Clear testing
  - Clear results
  - Export CSV

## Installation

1. Open Chrome/Edge/Safari browser
2. Navigate to extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Safari: Safari > Preferences > Extensions
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `citi-extension-tester` directory

## Usage

1. Navigate to a merchant website in your browser
2. Click the extension icon to open the popup
3. Merchants will be automatically loaded from the API endpoints
4. Click "Start Testing" to begin testing the current page
5. The extension will:
   - Detect the merchant from the current website URL
   - Wait for the Citi extension popup to appear on the page
   - Check exclusions and earning rates
   - Click "Activate Offer" button
   - Verify "Offer Activated" message
   - Capture screenshots if flagged
6. View results in the "Test Results" section
7. Click on any result to see detailed information
8. Export results to CSV using the "Export CSV" button

**Note**: The extension tests the current tab you're on. Make sure you're on a merchant website before clicking "Start Testing".

## API Endpoints

The extension loads merchants from:
- Google Storage: `https://storage.googleapis.com/wildlink/cloud-db/1/206/active-domain/2025-10-31T214203.model.json`
- Wildlink API: `https://api.wfi.re/v2/merchant/451/merchant_offer/search?q=*&sortBy=MerchantScore&pageSize=50&sortOrder=asc&pageNumber=1`

## CSV Export Format

The exported CSV includes:
- Date
- Merchant name
- Merchant ID
- Browser tested
- Errors (Yes/No)

## Permissions

The extension requires:
- `storage`: To save test results
- `activeTab`: To interact with tabs
- `scripting`: To inject content scripts
- `tabs`: To manage tabs
- `downloads`: To export CSV files
- `windows`: To open new browser windows
- `host_permissions`: To access merchant websites

## Notes

- The extension works with Chrome, Edge, and Safari (not Chromium)
- Screenshots are captured when merchants are flagged
- Test results persist across browser sessions
- The extension automatically detects the browser type
- The extension tests the current tab - navigate to a merchant website first
- If the merchant isn't in the API list, it will create a merchant entry from the current URL

