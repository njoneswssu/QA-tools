# Stealth Mode Improvements for Lowe's Promo Tester

## Overview
Enhanced the Lowe's promo tester with comprehensive anti-detection techniques to bypass automation detection and access denied errors.

## Key Improvements

### 1. **Enhanced Anti-Detection Scripts**
   - Removed `navigator.webdriver` property
   - Overrode browser plugins to appear as real Chrome plugins
   - Enhanced `navigator.chrome` object with realistic properties
   - Added battery API override
   - Overrode platform, hardwareConcurrency, and deviceMemory
   - Enhanced network connection properties
   - Added WebGL fingerprinting protection

### 2. **Chrome User Profile Integration**
   - Automatically detects and uses your real Chrome user profile
   - Uses persistent context to maintain cookies and session data
   - Falls back to temporary profile if Chrome profile not found
   - Cross-platform support (macOS, Windows, Linux)

### 3. **Enhanced Browser Launch Arguments**
   Added comprehensive stealth flags:
   - `--disable-blink-features=AutomationControlled`
   - `--no-default-browser-check`
   - `--disable-infobars`
   - `--disable-extensions`
   - `--disable-background-networking`
   - `--disable-background-timer-throttling`
   - `--disable-backgrounding-occluded-windows`
   - `--disable-renderer-backgrounding`
   - `--disable-features=TranslateUI,BlinkGenPropertyTrees`
   - `--enable-features=NetworkService,NetworkServiceInProcess`
   - `--force-color-profile=srgb`
   - `--metrics-recording-only`
   - `--use-mock-keychain`
   - `--disable-component-extensions-with-background-pages`

### 4. **Realistic HTTP Headers**
   Enhanced headers to mimic real browser requests:
   - Proper `Sec-Fetch-*` headers
   - Realistic `Referer` header (Google search)
   - `DNT` (Do Not Track) header
   - Proper `Cache-Control` headers

### 5. **Browser Fingerprinting Protection**
   - Realistic user agent strings
   - Proper locale and timezone settings
   - Geolocation spoofing
   - Color scheme matching

## Files Modified

1. **`scrapers/lowes-tester.js`**
   - Added `getChromeUserDataDir()` helper function
   - Enhanced `testProduct()` function with stealth mode
   - Enhanced `testProducts()` function with stealth mode
   - Updated browser launch logic to use Chrome user profile

2. **`server.js`**
   - Added `getChromeUserDataDir()` helper function
   - Updated `testAllProductsSequentially()` function with stealth mode
   - Enhanced anti-detection scripts

3. **`package.json`**
   - No additional dependencies needed (using native Playwright features)

## How It Works

1. **Profile Detection**: The code automatically detects your Chrome user profile directory based on your operating system.

2. **Persistent Context**: Uses Playwright's `launchPersistentContext()` to create a browser instance that maintains cookies and session data.

3. **Stealth Scripts**: Injects comprehensive anti-detection scripts into every page before it loads, making the browser appear as a real user's browser.

4. **Realistic Behavior**: The browser mimics real user behavior with proper headers, timing, and navigation patterns.

## Usage

The improvements are automatically applied when you run the tester. No configuration needed!

```bash
npm start
```

## Troubleshooting

### If Access Denied Still Occurs

1. **Make sure Chrome is closed** before running the tester (to avoid profile lock)
2. **Visit lowes.com manually** in Chrome first to establish cookies
3. **Wait for manual navigation** if prompted - the browser will stay open for 30 seconds
4. **Check your IP reputation** - consider using a VPN if your IP is flagged

### Chrome Profile Location

- **macOS**: `~/Library/Application Support/Google/Chrome`
- **Windows**: `%LOCALAPPDATA%\Google\Chrome\User Data`
- **Linux**: `~/.config/google-chrome`

## Additional Notes

- The tester will automatically use your Chrome profile if available
- If Chrome profile is not found, it falls back to a temporary profile
- All stealth techniques are applied automatically
- The browser remains visible (headless: false) for better stealth

## Future Enhancements

Potential improvements for even better stealth:
- Residential proxy support
- User agent rotation
- Cookie management
- CAPTCHA solving integration
- Behavioral pattern randomization

