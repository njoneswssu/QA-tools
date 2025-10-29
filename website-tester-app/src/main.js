const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const WebsiteTester = require('./website-tester');
const WildlinkScraper = require('./wildlink-scraper');
const MAdminScraper = require('./madmin-scraper');

let mainWindow;
let websiteTester;
let wildlinkScraper;
let madminScraper;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    resizable: true,
    movable: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (websiteTester) {
      websiteTester.stop();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for communication with renderer
ipcMain.handle('start-testing', async (event, merchants, options = {}) => {
  try {
    if (websiteTester) {
      websiteTester.stop();
    }
    
    // Create website tester with browser options and wildlink scraper
    const testerOptions = {
      browserType: options.browserType || 'chrome',
      reuseWildlinkBrowser: options.reuseWildlinkBrowser || false,
      wildlinkScraper: wildlinkScraper
    };
    
    websiteTester = new WebsiteTester(testerOptions);
    
    // Set up progress callbacks
    websiteTester.on('progress', (data) => {
      mainWindow.webContents.send('testing-progress', data);
    });
    
    websiteTester.on('complete', (results) => {
      mainWindow.webContents.send('testing-complete', results);
    });
    
    websiteTester.on('error', (error) => {
      mainWindow.webContents.send('testing-error', error);
    });
    
    await websiteTester.start(merchants);
    return { success: true };
  } catch (error) {
    console.error('Error starting test:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-testing', async () => {
  try {
    if (websiteTester) {
      await websiteTester.stop();
      websiteTester = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pause-testing', async () => {
  try {
    if (websiteTester) {
      await websiteTester.pause();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resume-testing', async () => {
  try {
    if (websiteTester) {
      await websiteTester.resume();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-testing-status', async () => {
  if (websiteTester) {
    return websiteTester.getStatus();
  }
  return { running: false, paused: false };
});


ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Test Results',
    defaultPath: 'test-results.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('export-to-excel', async (event, data) => {
  try {
    // Show save dialog for Excel file
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Test Results to Excel',
      defaultPath: `test-results-${new Date().toISOString().split('T')[0]}.csv`,
      filters: [
        { name: 'CSV Files (Excel Compatible)', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, error: 'Export cancelled' };
    }

    // Create CSV content with Name, MAdmin Link, and Reason columns
    let csvContent = 'Name,MAdmin Link,Reason\n';
    
    // Add data rows
    data.data.forEach(row => {
      // Escape quotes and commas in the data
      const name = `"${(row.Name || '').toString().replace(/"/g, '""')}"`;
      const madminLink = `"${(row['MAdmin Link'] || '').toString().replace(/"/g, '""')}"`;
      const reason = `"${(row.Reason || '').toString().replace(/"/g, '""')}"`;
      csvContent += `${name},${madminLink},${reason}\n`;
    });

    // Add summary at the bottom
    csvContent += '\n';
    csvContent += 'Summary,,\n';
    csvContent += `Total Tested,${data.summary.totalTested},\n`;
    csvContent += `Available,${data.summary.available},\n`;
    csvContent += `Unavailable,${data.summary.unavailable},\n`;
    csvContent += `No Test Link,${data.summary.noTestLink},\n`;
    csvContent += `Export Date,${new Date(data.exportDate).toLocaleString()},\n`;

    // Write the CSV file
    await fs.promises.writeFile(result.filePath, csvContent, 'utf8');

    console.log(`✅ Results exported to: ${result.filePath}`);
    console.log(`📊 Exported ${data.data.length} results`);

    return { 
      success: true, 
      filePath: result.filePath,
      recordCount: data.data.length
    };

  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Merchant List',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  return result;
});

// Wildlink scraper IPC handlers
ipcMain.handle('wildlink-get-applications', async (event, browserType = 'chrome') => {
  try {
    // Check if scraper exists and browser type matches
    if (!wildlinkScraper || wildlinkScraper.browserType !== browserType) {
      // Create new scraper
      wildlinkScraper = new WildlinkScraper(browserType);
      
      wildlinkScraper.on('progress', (data) => {
        mainWindow.webContents.send('wildlink-progress', data);
      });
      
      wildlinkScraper.on('error', (error) => {
        mainWindow.webContents.send('wildlink-error', error);
      });
    }
    
    const applications = await wildlinkScraper.getApplications();
    return { success: true, applications };
  } catch (error) {
    console.error('Error getting Wildlink applications:', error);
    
    // If error contains "closed" or "disconnected", try to reinitialize
    if (error.message.includes('closed') || error.message.includes('disconnected') || error.message.includes('Target')) {
      try {
        console.log('🔄 Browser was closed, creating new scraper...');
        wildlinkScraper = new WildlinkScraper(browserType);
        
        wildlinkScraper.on('progress', (data) => {
          mainWindow.webContents.send('wildlink-progress', data);
        });
        
        wildlinkScraper.on('error', (error) => {
          mainWindow.webContents.send('wildlink-error', error);
        });
        
        const applications = await wildlinkScraper.getApplications();
        return { success: true, applications };
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        return { success: false, error: `Browser was closed. Please try again. (${retryError.message})` };
      }
    }
    
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wildlink-get-merchants', async (event, applicationName, browsers) => {
  try {
    if (!wildlinkScraper) {
      throw new Error('Wildlink scraper not initialized. Please load applications first.');
    }
    
    const merchants = await wildlinkScraper.getAllMerchants(applicationName, browsers);
    return { success: true, merchants };
  } catch (error) {
    console.error('Error getting Wildlink merchants:', error);
    
    // If error contains "closed" or "disconnected", suggest reloading applications
    if (error.message.includes('closed') || error.message.includes('disconnected') || error.message.includes('Target')) {
      return { 
        success: false, 
        error: 'Browser was closed. Please click "Load from Wildlink" again to reinitialize the browser.' 
      };
    }
    
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wildlink-close', async () => {
  try {
    if (wildlinkScraper) {
      await wildlinkScraper.close();
      wildlinkScraper = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Merchant history handlers
ipcMain.handle('load-merchant-history', async () => {
  try {
    const dataDir = path.join(app.getPath('userData'), 'data');
    const historyFile = path.join(dataDir, 'tested-merchants.json');
    
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      const history = JSON.parse(data);
      return { success: true, history };
    }
    
    return { success: true, history: [] };
  } catch (error) {
    console.error('Error loading merchant history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-merchant-history', async () => {
  try {
    const dataDir = path.join(app.getPath('userData'), 'data');
    const historyFile = path.join(dataDir, 'tested-merchants.json');
    
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error clearing merchant history:', error);
    return { success: false, error: error.message };
  }
});

// MAdmin scraper IPC handler
ipcMain.handle('madmin-test-merchants', async (event, merchants, options = {}) => {
  try {
    const testingMode = options.testingMode || 'awin';
    console.log(`🔧 Starting MAdmin testing for ${merchants.length} merchants in ${testingMode} mode...`);
    
    // Check if MAdmin scraper already exists and is still connected
    if (madminScraper && madminScraper.browser) {
      try {
        // Test if the existing browser is still alive
        const pages = madminScraper.browser.pages();
        if (pages && pages.length >= 0) {
          console.log(`🔄 Reusing existing MAdmin browser instance with ${testingMode} testing mode`);
          
          // Update testing mode for existing scraper
          madminScraper.testingMode = testingMode;
          
          // Make sure we have a page to work with
          if (!madminScraper.page || madminScraper.page.isClosed()) {
            madminScraper.page = pages.length > 0 ? pages[0] : await madminScraper.browser.newPage();
          }
          
          // Navigate to MAdmin and test merchants using existing browser
          await madminScraper.navigateToMAdmin();
          const results = await madminScraper.testMerchants(merchants);
          
          console.log(`✅ MAdmin testing completed: ${results.tested} tested, ${results.inactive} inactive`);
          
          return { 
            success: true, 
            tested: results.tested,
            inactive: results.inactive,
            inactiveLinks: results.inactiveLinks
          };
        }
      } catch (browserTestError) {
        console.log(`⚠️ Existing MAdmin browser is no longer available: ${browserTestError.message}`);
        madminScraper = null;
      }
    }
    
    // Create new MAdmin scraper only if no existing one or if it's not working
    console.log(`🔧 Creating new MAdmin browser instance with ${testingMode} testing mode`);
    madminScraper = new MAdminScraper({ testingMode });
    
    madminScraper.on('progress', (data) => {
      mainWindow.webContents.send('madmin-progress', data);
    });
    
    // Initialize and navigate to MAdmin with error handling
    try {
      await madminScraper.initialize();
      await madminScraper.navigateToMAdmin();
    } catch (initError) {
      console.error('❌ MAdmin initialization failed:', initError.message);
      throw new Error(`Failed to initialize MAdmin: ${initError.message}`);
    }
    
    // Test merchants
    const results = await madminScraper.testMerchants(merchants);
    
    console.log(`✅ MAdmin testing completed: ${results.tested} tested, ${results.inactive} inactive`);
    
    // Don't close the scraper - keep browser open for user interaction
    console.log('🔒 Keeping MAdmin browser open for continued use');
    
    return { 
      success: true, 
      tested: results.tested,
      inactive: results.inactive,
      inactiveLinks: results.inactiveLinks
    };
  } catch (error) {
    console.error('Error in MAdmin testing:', error);
    
    // Clean up failed scraper
    if (madminScraper) {
      try {
        await madminScraper.close();
      } catch (closeError) {
        console.error('Error closing failed MAdmin scraper:', closeError.message);
      }
      madminScraper = null;
    }
    
    return { success: false, error: error.message };
  }
});

// MAdmin Control Handlers
ipcMain.handle('madmin-stop', async () => {
  try {
    if (madminScraper) {
      console.log('🛑 Stopping MAdmin testing...');
      madminScraper.stop();
      return { success: true };
    }
    return { success: false, error: 'No active MAdmin testing to stop' };
  } catch (error) {
    console.error('Error stopping MAdmin:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('madmin-pause', async () => {
  try {
    if (madminScraper) {
      console.log('⏸️ Pausing MAdmin testing...');
      madminScraper.pause();
      return { success: true, message: 'MAdmin testing paused' };
    }
    return { success: false, error: 'No active MAdmin testing to pause' };
  } catch (error) {
    console.error('Error pausing MAdmin:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('madmin-resume', async () => {
  try {
    if (madminScraper) {
      console.log('▶️ Resuming MAdmin testing...');
      madminScraper.resume();
      return { success: true, message: 'MAdmin testing resumed' };
    }
    return { success: false, error: 'No active MAdmin testing to resume' };
  } catch (error) {
    console.error('Error resuming MAdmin:', error.message);
    return { success: false, error: error.message };
  }
});

// MAdmin Merchant Sync Handler
ipcMain.handle('madmin-sync-merchants', async () => {
  try {
    console.log('🔄 Starting merchant sync from Wildlink Admin...');
    
    // Create MAdmin scraper if it doesn't exist
    if (!madminScraper) {
      madminScraper = new MAdminScraper();
      
      madminScraper.on('progress', (data) => {
        mainWindow.webContents.send('madmin-progress', data);
      });
      
      // Initialize the scraper
      await madminScraper.initialize();
      await madminScraper.navigateToMAdmin();
    }
    
    // Perform the merchant sync
    const result = await madminScraper.syncMerchantsFromAdmin();
    
    console.log(`✅ Merchant sync completed: ${result.count} merchants synced`);
    
    return { 
      success: true, 
      merchants: result.merchants,
      count: result.count,
      message: `Successfully synced ${result.count} merchants from Wildlink Admin`
    };
    
  } catch (error) {
    console.error('Error syncing merchants from Wildlink Admin:', error);
    return { 
      success: false, 
      error: error.message,
      message: `Sync failed: ${error.message}`
    };
  }
});
