# Installation Guide

## Chrome/Edge Installation

1. Open Chrome or Edge browser
2. Navigate to the extensions page:
   - Chrome: Type `chrome://extensions/` in the address bar
   - Edge: Type `edge://extensions/` in the address bar
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked" button
5. Navigate to and select the `citi-extension-tester` folder
6. The extension should now appear in your extensions list

## Safari Installation

1. Open Safari
2. Go to Safari > Preferences > Extensions
3. Enable "Allow Unsigned Extensions" (if needed)
4. Click "Develop" menu > "Show Extension Builder"
5. Click "+" and select the `citi-extension-tester` folder
6. Click "Run" to enable the extension

## Verification

After installation:
1. Look for the extension icon in your browser toolbar
2. Click the icon to open the popup
3. You should see the Citi Extension Tester interface
4. Merchants should automatically load from the API endpoints

## Troubleshooting

- If merchants don't load: Check browser console for API errors
- If testing doesn't start: Ensure you have the Citi extension installed
- If screenshots don't work: Check that you've granted necessary permissions
- If popup doesn't detect: The Citi extension popup must be visible on the page

## Permissions

The extension requires these permissions:
- Storage (to save test results)
- Active Tab (to interact with pages)
- Scripting (to inject content scripts)
- Tabs (to manage tabs)
- Downloads (to export CSV)
- Windows (to open new windows)
- Host permissions (to access merchant websites)

All permissions are required for the extension to function properly.

