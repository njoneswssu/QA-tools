# How to Start Chrome with Remote Debugging

This guide shows you how to start Google Chrome with remote debugging enabled, which allows the automation to connect to your existing Chrome instance and open tabs instead of new windows.

## macOS Instructions

### Method 1: Terminal Command (Recommended)

1. **Close all Chrome windows** (if Chrome is already running)

2. **Open Terminal** and run:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

3. Chrome will start with remote debugging enabled on port 9222.

### Method 2: Create an Alias (Easier for Future Use)

1. **Open your shell configuration file** (usually `~/.zshrc` for zsh or `~/.bash_profile` for bash):
   ```bash
   nano ~/.zshrc
   ```

2. **Add this alias**:
   ```bash
   alias chrome-debug='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222'
   ```

3. **Save and reload**:
   ```bash
   source ~/.zshrc
   ```

4. **Now you can simply run**:
   ```bash
   chrome-debug
   ```

### Method 3: Create a Script File

1. **Create a script file**:
   ```bash
   nano ~/start-chrome-debug.sh
   ```

2. **Add this content**:
   ```bash
   #!/bin/bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

3. **Make it executable**:
   ```bash
   chmod +x ~/start-chrome-debug.sh
   ```

4. **Run it**:
   ```bash
   ~/start-chrome-debug.sh
   ```

## Windows Instructions

1. **Close all Chrome windows**

2. **Open Command Prompt or PowerShell** and run:
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```

   Or if Chrome is in a different location:
   ```cmd
   "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```

## Linux Instructions

1. **Close all Chrome windows**

2. **Open Terminal** and run:
   ```bash
   google-chrome --remote-debugging-port=9222
   ```

   Or if using Chromium:
   ```bash
   chromium --remote-debugging-port=9222
   ```

## Verify It's Working

After starting Chrome with remote debugging, you can verify it's working by:

1. **Check if the port is listening**:
   ```bash
   lsof -i :9222
   ```

2. **Or visit this URL in any browser**:
   ```
   http://localhost:9222/json
   ```
   
   You should see a JSON response with information about open tabs.

## Important Notes

- **Close all Chrome windows first**: If Chrome is already running, you need to quit it completely before starting with remote debugging
- **Security**: Remote debugging allows external connections to Chrome. Only use this on trusted networks
- **Port 9222**: This is the default port. If it's already in use, you can use a different port (e.g., `--remote-debugging-port=9223`)

## Troubleshooting

### "Port 9222 is already in use"
- Another Chrome instance might be running with debugging enabled
- Close all Chrome windows and try again
- Or use a different port: `--remote-debugging-port=9223`

### "Chrome won't start"
- Make sure you've closed all existing Chrome windows
- Check if Chrome is in the expected location
- Try the full path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

### Automation still opens new windows
- Make sure Chrome was started with `--remote-debugging-port=9222`
- Verify the port is listening: `lsof -i :9222`
- Check the server logs - it should say "Connected to existing Chrome instance"
