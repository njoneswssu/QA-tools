// Content script for CitiShop Browser Extension
// Minimal version - all testing functionality moved to extension popup

console.log('CitiShop Extension content script loaded on:', window.location.href);

// Listen for messages from popup and background scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  try {
    switch (message.action) {
      case 'getPageInfo':
        sendResponse({
          success: true,
          url: window.location.href,
          title: document.title
        });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep message channel open for async responses
});

// Note: All testing functionality has been moved to the extension popup
// No floating controls are injected into web pages

console.log('CitiShop Extension content script initialized (minimal version)');