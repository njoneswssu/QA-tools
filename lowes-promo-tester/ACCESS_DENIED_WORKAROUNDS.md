# Access Denied Workarounds for Lowe's Website

Lowe's uses sophisticated bot detection (likely Akamai) that can block automated access. Here are several workarounds:

## Why Access is Denied

Lowe's detects automation through:
1. **Browser Fingerprinting** - Detects automation tools
2. **Behavioral Analysis** - Unusual navigation patterns
3. **IP Reputation** - Known automation IPs
4. **Cookie/Session Issues** - Missing or invalid session data
5. **Request Headers** - Missing or incorrect headers

## Workarounds Implemented

### 1. **Chrome User Profile** ✅ (Currently Active)
- Uses your existing Chrome profile with real cookies and session
- Most effective workaround - makes automation look like real user
- Location: `--user-data-dir` points to your Chrome profile

### 2. **Manual Navigation Fallback** ✅ (Currently Active)
- If access denied, browser stays open
- Waits 20-30 seconds for you to manually navigate
- Automation continues after manual navigation

### 3. **Category Navigation** ✅ (Currently Active)
- Navigates through `/c/Blinds-window-treatments` instead of direct URLs
- More natural browsing pattern

### 4. **Realistic Delays** ✅ (Currently Active)
- Random delays between actions (3-6 seconds)
- Human-like scrolling and mouse movements

## Additional Workarounds You Can Try

### Option 1: Use Your Real Chrome Profile (Recommended)
The code now uses your Chrome profile. Make sure you:
1. Have visited lowes.com manually in Chrome before
2. Are logged in (if required)
3. Have accepted cookies/consent

### Option 2: Manual Intervention
When access denied appears:
1. Browser window stays open
2. Manually navigate to lowes.com
3. Solve any CAPTCHA if present
4. Automation will continue after 20-30 seconds

### Option 3: Residential Proxies
If access denied persists, consider using residential proxies:
- Services like Bright Data, Smartproxy, or Oxylabs
- Routes traffic through real residential IPs
- More expensive but very effective

### Option 4: Reduce Testing Frequency
- Test fewer products at a time (1-3 instead of all)
- Add longer delays between test runs
- Test during off-peak hours

### Option 5: Use API (If Available)
- Check if Lowe's has a public API
- Some retailers offer APIs for product data
- Most reliable but may have rate limits

## Current Implementation

The code now:
1. ✅ Uses your Chrome user profile (with existing cookies)
2. ✅ Waits for manual navigation if access denied
3. ✅ Tries category navigation as fallback
4. ✅ Keeps browser open for manual intervention
5. ✅ Uses realistic delays and human-like behavior

## If Access Denied Persists

1. **Manual Testing**: Use the browser window that opens to manually test products
2. **Screenshot Manual Pages**: Take screenshots manually and add them to the database
3. **Contact Lowe's**: Ask if they have an API or allow automated testing
4. **Use Different Approach**: Consider manual testing for critical products only

## Testing the Workarounds

1. Make sure you've visited lowes.com in Chrome before (to establish cookies)
2. Start the server
3. If access denied appears, manually navigate in the browser window
4. Automation will continue after the wait period
