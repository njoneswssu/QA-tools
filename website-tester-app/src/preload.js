const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Testing controls
  startTesting: (merchants, options) => ipcRenderer.invoke('start-testing', merchants, options),
  stopTesting: () => ipcRenderer.invoke('stop-testing'),
  pauseTesting: () => ipcRenderer.invoke('pause-testing'),
  resumeTesting: () => ipcRenderer.invoke('resume-testing'),
  getTestingStatus: () => ipcRenderer.invoke('get-testing-status'),
  
  // Data management
  loadMerchantHistory: () => ipcRenderer.invoke('load-merchant-history'),
  clearMerchantHistory: () => ipcRenderer.invoke('clear-merchant-history'),
  
  // MAdmin testing
  madminTestMerchants: (merchants, options) => ipcRenderer.invoke('madmin-test-merchants', merchants, options),
  madminStop: () => ipcRenderer.invoke('madmin-stop'),
  madminPause: () => ipcRenderer.invoke('madmin-pause'),
  madminResume: () => ipcRenderer.invoke('madmin-resume'),
  madminSyncMerchants: () => ipcRenderer.invoke('madmin-sync-merchants'),
  
  // File dialogs
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  exportToExcel: (data) => ipcRenderer.invoke('export-to-excel', data),
  
  // Event listeners for testing progress
  onTestingProgress: (callback) => {
    ipcRenderer.on('testing-progress', (event, data) => callback(data));
  },
  onTestingComplete: (callback) => {
    ipcRenderer.on('testing-complete', (event, results) => callback(results));
  },
  onTestingError: (callback) => {
    ipcRenderer.on('testing-error', (event, error) => callback(error));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Wildlink scraper functions
  wildlinkGetApplications: (browserType) => ipcRenderer.invoke('wildlink-get-applications', browserType),
  wildlinkGetMerchants: (applicationName, browsers) => ipcRenderer.invoke('wildlink-get-merchants', applicationName, browsers),
  wildlinkClose: () => ipcRenderer.invoke('wildlink-close'),
  
  // Wildlink event listeners
  onWildlinkProgress: (callback) => {
    ipcRenderer.on('wildlink-progress', (event, data) => callback(data));
  },
  onWildlinkError: (callback) => {
    ipcRenderer.on('wildlink-error', (event, error) => callback(error));
  },
  
  // MAdmin event listeners
  onMAdminProgress: (callback) => {
    ipcRenderer.on('madmin-progress', (event, data) => callback(data));
  }
});
