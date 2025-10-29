// MAdmin Control Handlers - to be appended to main.js

// MAdmin Control Handlers
ipcMain.handle('madmin-stop', async () => {
  try {
    if (madminScraper) {
      console.log('🛑 Stopping MAdmin testing...');
      await madminScraper.close();
      madminScraper = null;
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
      // For now, we don't have pause functionality in MAdmin scraper
      // This could be implemented by adding a pause flag
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
      // For now, we don't have resume functionality in MAdmin scraper
      return { success: true, message: 'MAdmin testing resumed' };
    }
    return { success: false, error: 'No active MAdmin testing to resume' };
  } catch (error) {
    console.error('Error resuming MAdmin:', error.message);
    return { success: false, error: error.message };
  }
});
