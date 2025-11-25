const { test, chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

test.describe('Wildlink Traffic Monitor', () => {
  test('Monitor network traffic and capture Wildlink requests', async () => {
    test.setTimeout(0); // No timeout - run until stopped
    
    // Path to wildlink-proxy-monitor directory
    const monitorDir = path.join(__dirname, '..', 'wildlink-proxy-monitor');
    let actualMonitorDir = monitorDir;
    if (!fs.existsSync(monitorDir)) {
      actualMonitorDir = path.join(__dirname, '..', 'Wildlink-Proxy-Monitor-Complete');
      if (!fs.existsSync(actualMonitorDir)) {
        throw new Error(`Monitor directory not found. Expected: ${monitorDir} or ${actualMonitorDir}`);
      }
    }
    
    if (!fs.existsSync(actualMonitorDir)) {
      fs.mkdirSync(actualMonitorDir, { recursive: true });
    }
    
    const actualWebInterfaceScript = path.join(actualMonitorDir, 'web_interface.py');
    if (!fs.existsSync(actualWebInterfaceScript)) {
      throw new Error(`Web interface script not found: ${actualWebInterfaceScript}`);
    }
    
    const actualLogFile = path.join(actualMonitorDir, 'proxy-logs.json');
    
    // Load existing logs
    let existingLogs = [];
    if (fs.existsSync(actualLogFile)) {
      try {
        const data = fs.readFileSync(actualLogFile, 'utf8');
        existingLogs = JSON.parse(data);
        if (!Array.isArray(existingLogs)) {
          existingLogs = [];
        }
      } catch (error) {
        console.log('⚠️  Could not load existing logs, starting fresh');
        existingLogs = [];
      }
    }
    
    // Wildlink domains to monitor (including wild.link redirects)
    const wildlinkDomains = [
      'wild.link',
      'www.wildlink.me',
      'wildlink.me',
      'wildlink.ai',
      'wfi.re',
      'storage.googleapis.com'
    ];
    
    // Example URL to verify: https://wild.link/e?c=141645&d=35227470&tc=6875535bb877cfe7b383d6b6&url=https%3A%2F%2Faaprintsupplyco.com&d=35227470
    
    let webInterfaceProcess = null;
    let browser = null;
    let context = null;
    let page = null;
    
    // Function to save logs to dashboard
    const saveLogs = (newLog) => {
      try {
        const existingIds = existingLogs.map(log => log.id);
        if (!existingIds.includes(newLog.id)) {
          existingLogs.push(newLog);
          
          if (existingLogs.length > 10000) {
            existingLogs = existingLogs.slice(-10000);
          }
          
          fs.writeFileSync(actualLogFile, JSON.stringify(existingLogs, null, 2), 'utf8');
          return true;
        }
        return false;
      } catch (error) {
        console.error('⚠️  Error saving logs:', error.message);
        return false;
      }
    };
    
    // Function to create log entry in dashboard format
    const createLogEntry = (request, response = null) => {
      const url = new URL(request.url);
      const timestamp = new Date().toISOString();
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Parse query parameters
      const queryParams = {};
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      
      // Filter important parameters (including wild.link parameters like c, d, tc, url)
      const importantParams = {};
      const importantKeys = ['d', 's', 'io', 'c', 'tc', 'st', 'nm', 'sender', 'device', 'auth', 'token', 'id', 'uid', 'url'];
      importantKeys.forEach(key => {
        if (queryParams[key]) {
          importantParams[key] = queryParams[key];
        }
      });
      
      // Get response data if available
      let responseBody = '';
      let responseHeaders = {};
      let statusCode = null;
      let completed = false;
      let completedTimestamp = null;
      
      if (response) {
        statusCode = response.status();
        responseHeaders = response.headers();
        completed = true;
        completedTimestamp = timestamp;
      }
      
      return {
        id: requestId,
        timestamp: timestamp,
        type: 'request',
        method: request.method(),
        url: request.url(),
        hostname: url.hostname,
        path: url.pathname,
        queryParams: queryParams,
        importantParams: importantParams,
        headers: request.headers() || {},
        requestBody: request.postData() || '',
        clientIp: 'browser',
        source: 'playwright_monitor',
        statusCode: statusCode,
        responseHeaders: responseHeaders,
        responseBody: responseBody,
        completed: completed,
        completedTimestamp: completedTimestamp
      };
    };
    
    // Cleanup function
    const cleanup = () => {
      console.log('\n🔄 Shutting down services...');
      if (browser) {
        browser.close().catch(() => {});
      }
      if (webInterfaceProcess) {
        webInterfaceProcess.kill('SIGTERM');
      }
      console.log('✅ Services stopped');
    };
    
    // Setup cleanup handlers
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    try {
      console.log('\n' + '='.repeat(70));
      console.log('📡 WILDLINK TRAFFIC MONITOR');
      console.log('='.repeat(70));
      
      // Start web interface server
      console.log('🌐 Starting dashboard server...');
      const webPort = process.env.WEB_PORT || 5000;
      
      webInterfaceProcess = spawn('python3', [actualWebInterfaceScript], {
        cwd: actualMonitorDir,
        env: { ...process.env, WEB_PORT: webPort.toString() },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      webInterfaceProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Running on') || output.includes('Starting')) {
          console.log(`   ${output.trim()}`);
        }
      });
      
      webInterfaceProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (!output.includes('WARNING') && !output.includes('Debugger')) {
          console.error(`   ${output.trim()}`);
        }
      });
      
      // Wait for web interface to start
      await new Promise((resolve) => {
        const checkServer = () => {
          const req = http.get(`http://localhost:${webPort}/api/stats`, (res) => {
            if (res.statusCode === 200) {
              console.log(`✅ Dashboard started: http://localhost:${webPort}`);
              resolve();
            } else {
              setTimeout(checkServer, 500);
            }
          });
          req.on('error', () => {
            setTimeout(checkServer, 500);
          });
          req.setTimeout(1000);
        };
        setTimeout(checkServer, 1000);
      });
      
      // Launch browser with network monitoring
      console.log('\n🌐 Launching browser with network monitoring...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome' // Use Chrome if available
      });
      
      context = await browser.newContext();
      page = await context.newPage();
      
      // Set up network monitoring
      page.on('request', async (request) => {
        const url = request.url();
        const isWildlink = wildlinkDomains.some(domain => url.includes(domain));
        
        if (isWildlink) {
          const pageUrl = page.url();
          console.log(`🎯 WILDLINK REQUEST: ${request.method()} ${url}`);
          if (pageUrl && pageUrl !== url) {
            console.log(`   From page: ${pageUrl}`);
          }
          
          const logEntry = createLogEntry(request);
          logEntry.pageUrl = pageUrl;
          try {
            const title = await page.title().catch(() => '');
            logEntry.pageTitle = title || '';
          } catch (error) {
            logEntry.pageTitle = '';
          }
          
          saveLogs(logEntry);
        }
      });
      
      page.on('response', async (response) => {
        const url = response.url();
        const isWildlink = wildlinkDomains.some(domain => url.includes(domain));
        
        if (isWildlink) {
          try {
            const status = response.status();
            const pageUrl = page.url();
            console.log(`✅ WILDLINK RESPONSE: ${status} ${url}`);
            
            // Try to get response body
            let responseBody = '';
            try {
              const body = await response.body();
              if (body && body.length > 0) {
                responseBody = body.toString('utf8');
                if (responseBody.length > 10000) {
                  responseBody = responseBody.substring(0, 10000) + '... [truncated]';
                }
              }
            } catch (error) {
              // Ignore errors reading body
            }
            
            const request = response.request();
            const logEntry = createLogEntry(request, response);
            logEntry.responseBody = responseBody;
            logEntry.pageUrl = pageUrl;
            
            // Update existing log or create new one
            const existingIndex = existingLogs.findIndex(log => 
              log.url === request.url() && 
              Math.abs(new Date(log.timestamp) - new Date(logEntry.timestamp)) < 5000
            );
            
            if (existingIndex !== -1) {
              existingLogs[existingIndex] = logEntry;
            } else {
              existingLogs.push(logEntry);
            }
            
            // Save logs
            fs.writeFileSync(actualLogFile, JSON.stringify(existingLogs, null, 2), 'utf8');
          } catch (error) {
            console.error('⚠️  Error processing response:', error.message);
          }
        }
      });
      
      // Track page navigation
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          const newUrl = frame.url();
          if (newUrl && newUrl !== 'about:blank') {
            console.log(`🌐 Page navigated to: ${newUrl}`);
          }
        }
      });
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ MONITORING ACTIVE');
      console.log('='.repeat(70));
      console.log(`🌐 Dashboard: http://localhost:${webPort}`);
      console.log(`📋 Logs viewer: http://localhost:${webPort}/logs`);
      console.log('\n🎯 Monitoring Wildlink domains:');
      wildlinkDomains.forEach(domain => {
        console.log(`   • ${domain}`);
      });
      console.log('\n💡 Browser is open - navigate to any website');
      console.log('   All Wildlink traffic (including wild.link redirects) will be captured');
      console.log('   Example: https://wild.link/e?c=141645&d=35227470&tc=6875535bb877cfe7b383d6b6&url=https%3A%2F%2Faaprintsupplyco.com');
      console.log('\n🔄 Press Ctrl+C to stop monitoring');
      console.log('='.repeat(70) + '\n');
      
      // Navigate to a test page to verify monitoring works
      console.log('📄 Opening browser...');
      await page.goto('about:blank');
      
      // Monitor log file for updates
      let lastLogCount = existingLogs.length;
      const checkLogs = () => {
        try {
          if (fs.existsSync(actualLogFile)) {
            const data = fs.readFileSync(actualLogFile, 'utf8');
            const logs = JSON.parse(data);
            if (Array.isArray(logs) && logs.length !== lastLogCount) {
              const newLogs = logs.length - lastLogCount;
              if (newLogs > 0) {
                console.log(`📊 Captured ${logs.length} total Wildlink requests (${newLogs} new)`);
                lastLogCount = logs.length;
              }
            }
          }
        } catch (error) {
          // Ignore read errors
        }
      };
      
      // Check logs every 5 seconds
      const logCheckInterval = setInterval(checkLogs, 5000);
      
      // Keep the test running until stopped
      await new Promise((resolve) => {
        process.on('SIGINT', () => {
          clearInterval(logCheckInterval);
          resolve();
        });
        process.on('SIGTERM', () => {
          clearInterval(logCheckInterval);
          resolve();
        });
      });
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      cleanup();
      throw error;
    } finally {
      cleanup();
    }
  });
});
