# Quick Start Guide - Using Edge Remote Debugging

The Lowe's promo tester now **requires** you to use your existing Edge instance with remote debugging. This ensures you have all your cookies, session data, and login state, and opens new tabs instead of new windows.

## Step 1: Start Edge with Remote Debugging

**IMPORTANT**: You must start Edge with remote debugging enabled before running the tester.

### macOS

1. **Close all Edge windows** (Edge menu → Quit Microsoft Edge, or Cmd+Q)

2. **Open Terminal** and run:
   ```bash
   "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --remote-debugging-port=9222
   ```

   Or use the provided script:
   ```bash
   cd lowes-promo-tester
   ./start-edge-debug.sh
   ```

### Windows

1. **Close all Edge windows**

2. **Open Command Prompt** (Run as Administrator) and run:
   ```cmd
   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
   ```

   Or if Edge is in a different location:
   ```cmd
   "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
   ```

### Linux

1. **Close all Edge windows**

2. **Open Terminal** and run:
   ```bash
   microsoft-edge --remote-debugging-port=9222
   ```

## Step 2: Verify Edge is Running with Remote Debugging

Visit this URL in any browser:
```
http://localhost:9222/json
```

You should see a JSON response with information about your open tabs. If you see "Connection refused" or an error, Edge didn't start correctly.

## Step 3: Start the Tester

Start the tester:
```bash
cd lowes-promo-tester
npm start
```

The tester will:
- ✅ Connect to your existing Edge instance
- ✅ Open a **new tab** (not a new window)
- ✅ Use your existing cookies and session data
- ✅ Test products in the new tab

## Benefits of Using Existing Edge

1. **Your cookies and login state** are preserved
2. **Less likely to be blocked** - looks like a real user browsing
3. **No new windows** - everything happens in tabs
4. **Faster** - no need to log in or accept cookies again

## Troubleshooting

### "Could not connect to Edge on port 9222"

**Solution**: Make sure Edge was started with the `--remote-debugging-port=9222` flag.

1. Check if Edge is running with the flag:
   ```bash
   ps aux | grep "remote-debugging-port=9222" | grep -v grep
   ```

2. If nothing shows up, Edge wasn't started correctly. Close Edge completely and restart it with the flag.

### "Port 9222 is already in use"

**Solution**: Another Edge instance might be using the port.

1. Close all Edge windows
2. Wait 3-5 seconds
3. Start Edge again with the remote debugging flag

### Edge Opens but Tester Still Can't Connect

**Solution**: Check if the port is actually listening:

```bash
lsof -i :9222
```

If nothing shows up, Edge didn't start with remote debugging. Make sure you:
1. Closed Edge completely first
2. Started it from the terminal with the exact command
3. Didn't open Edge normally after starting it with the flag

## Tips

- **Keep Edge running**: Once you start Edge with remote debugging, keep it running. Don't close it and open it normally - that will disable remote debugging.

- **Use a separate Edge profile** (optional): If you want to keep your regular Edge separate:
  ```bash
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --remote-debugging-port=9222 --user-data-dir="$HOME/.edge-debug-profile"
  ```

- **Create an alias** (optional): Add this to your `~/.zshrc` or `~/.bashrc`:
  ```bash
  alias edge-debug='"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --remote-debugging-port=9222'
  ```
  
  Then just run `edge-debug` to start Edge with debugging.

## What Changed?

Previously, the tester would:
- Launch a new Edge window with your profile
- Use persistent context

Now, the tester:
- **Always** connects to existing Edge via remote debugging
- Opens new tabs instead of new windows
- Uses your existing session and cookies
- Provides clear error messages if Edge isn't running with remote debugging

This makes testing more reliable and less likely to be blocked by Lowe's anti-automation systems.

