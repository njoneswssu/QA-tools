# Troubleshooting Chrome Remote Debugging

## Issue: Port 9222 Not Accessible

If Chrome is running with `--remote-debugging-port=9222` but you can't connect:

### Solution 1: Restart Chrome Properly

1. **Completely quit Chrome**:
   ```bash
   pkill -9 -f "Google Chrome"
   ```

2. **Wait 3-5 seconds** for Chrome to fully close

3. **Start Chrome with remote debugging**:
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
   ```

4. **Verify it's working**:
   ```bash
   curl http://localhost:9222/json/version
   ```
   
   You should see JSON output. If you see "Connection refused", Chrome didn't start correctly.

### Solution 2: Use a Separate User Profile

Sometimes Chrome's default profile conflicts. Use a separate profile:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug-profile"
```

### Solution 3: Check macOS Firewall

1. Open **System Settings** → **Network** → **Firewall**
2. Make sure Chrome is allowed to accept incoming connections
3. If Chrome isn't listed, add it manually

### Solution 4: Try a Different Port

If port 9222 is blocked, try a different port:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9223
```

Then update the automation code to use port 9223.

## Common Issues

### "Connection refused" Error

- **Cause**: Chrome wasn't started with remote debugging, or it was started incorrectly
- **Fix**: Completely quit Chrome and restart it with the flag from a terminal

### "Port already in use"

- **Cause**: Another Chrome instance is using the port
- **Fix**: Quit all Chrome instances: `pkill -9 -f "Google Chrome"`

### Automation Still Opens New Window

- **Cause**: Can't connect to Chrome on port 9222
- **Fix**: Verify Chrome is accessible: `curl http://localhost:9222/json/version`
- **Check**: Look at server logs - it should say "Connected to existing Chrome instance"

## Verification Steps

1. **Check if Chrome is running with the flag**:
   ```bash
   ps aux | grep "remote-debugging-port=9222" | grep -v grep
   ```

2. **Check if port is listening**:
   ```bash
   lsof -i :9222
   ```
   OR
   ```bash
   netstat -an | grep 9222
   ```

3. **Test the connection**:
   ```bash
   curl http://localhost:9222/json/version
   ```
   
   Should return JSON like:
   ```json
   {"Browser":"Chrome/142.0.7444.60","Protocol-Version":"1.3",...}
   ```

4. **Check server logs**: When you click "Start Automation", look for:
   - `✓ Connected to existing Chrome instance` (success)
   - `⚠️ Could not connect to Chrome on port 9222` (failure)

## Still Not Working?

If none of the above works, the automation will fall back to opening a new Chrome window. This is normal behavior when remote debugging isn't available.
