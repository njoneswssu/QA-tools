// Content script to detect and interact with Citi extension popup
// Wrap in IIFE to prevent duplicate declarations when script runs in multiple frames
(function() {
  'use strict';
  
  // Check if already initialized
  if (window.__citiExtensionTesterInitialized) {
    return;
  }
  window.__citiExtensionTesterInitialized = true;

// Flag keywords
const EXCLUSION_FLAGS = [
  'ShareASale commission',
  'Earn commissions',
  'Online purchase'
];

// Detect Citi extension popup
function findCitiExtensionPopup() {
  // Look for common Citi extension popup indicators
  // The popup might be in an iframe, shadow DOM, or directly in the page
  
  let popup = null;
  
  // Strategy 1: Check all iframes (including extension iframes)
  // Prioritize chrome-extension:// iframes as they're most likely to be the Citi extension
  const iframes = document.querySelectorAll('iframe');
  const extensionIframes = [];
  const regularIframes = [];
  
  // Separate extension iframes from regular iframes
  for (const iframe of iframes) {
    const src = iframe.src || iframe.getAttribute('src') || '';
    if (src.includes('chrome-extension://') || src.includes('extension://') || src.includes('moz-extension://')) {
      extensionIframes.push(iframe);
    } else {
      regularIframes.push(iframe);
    }
  }
  
  // First, check extension iframes (most likely to be Citi extension)
  // Look for iframes matching the Citi extension popup characteristics:
  // - position: absolute
  // - height: 100%, width: 100%
  // - left: 0px, top: 0px
  // - z-index: 2147483647 (very high)
  for (const iframe of extensionIframes) {
    try {
      const style = window.getComputedStyle(iframe);
      const rect = iframe.getBoundingClientRect();
      
      // Check for Citi extension popup characteristics
      const isFullScreenOverlay = (
        style.position === 'absolute' &&
        (style.height === '100%' || rect.height > window.innerHeight * 0.9) &&
        (style.width === '100%' || rect.width > window.innerWidth * 0.9) &&
        (parseInt(style.left) === 0 || rect.left < 10) &&
        (parseInt(style.top) === 0 || rect.top < 10)
      );
      
      // Also check for the inner popup container (position: fixed, z-index: 2147483647)
      // Try to access iframe content
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const text = iframeDoc.body?.textContent || '';
        const html = iframeDoc.body?.innerHTML || '';
        
        // Look for the popup container with specific styling
        const popupContainer = iframeDoc.querySelector('[style*="z-index: 2147483647"], [style*="z-index:2147483647"]');
        const hasCitiContent = (
          text.includes('Earning rate') || 
          text.includes('exclusions') || 
          text.includes('Activate Offer') ||
          text.includes('Earning Rate') ||
          text.includes('Exclusions') ||
          text.includes('Terms Apply') ||
          html.includes('earning-rate') ||
          html.includes('activate-offer') ||
          html.includes('terms-apply') ||
          popupContainer !== null
        );
        
        if (hasCitiContent || isFullScreenOverlay) {
          popup = {
            type: 'extension-iframe',
            element: iframe,
            document: iframeDoc
          };
          return popup; // Return immediately if found
        }
      }
    } catch (e) {
      // Cross-origin iframe - can't access directly
      // But we can still identify it by its styling
      const style = window.getComputedStyle(iframe);
      const rect = iframe.getBoundingClientRect();
      
      // Check for Citi extension popup overlay characteristics
      const isFullScreenOverlay = (
        style.position === 'absolute' &&
        (style.height === '100%' || rect.height > window.innerHeight * 0.9) &&
        (style.width === '100%' || rect.width > window.innerWidth * 0.9) &&
        (parseInt(style.left) === 0 || rect.left < 10) &&
        (parseInt(style.top) === 0 || rect.top < 10)
      );
      
      const src = iframe.src || '';
      if ((src.includes('chrome-extension://') || src.includes('extension://')) && isFullScreenOverlay) {
        popup = {
          type: 'extension-iframe',
          element: iframe,
          document: null,
          src: src
        };
        // Continue checking but this is likely it
      }
    }
  }
  
  // If no extension iframe found, check regular iframes
  if (!popup) {
    for (const iframe of regularIframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const text = iframeDoc.body?.textContent || '';
          const html = iframeDoc.body?.innerHTML || '';
          
          // Look for Citi extension indicators
          if (text.includes('Earning rate') || 
              text.includes('exclusions') || 
              text.includes('Activate Offer') ||
              text.includes('Earning Rate') ||
              text.includes('Exclusions') ||
              html.includes('earning-rate') ||
              html.includes('activate-offer')) {
            popup = {
              type: 'iframe',
              element: iframe,
              document: iframeDoc
            };
            break;
          }
        }
      } catch (e) {
        // Cross-origin iframe, skip
      }
    }
  }
  
  // If we found an extension iframe but couldn't access it, return it anyway
  // We'll try to interact with it using postMessage or other methods
  if (popup && popup.type === 'extension-iframe' && !popup.document) {
    return popup; // Return the extension iframe even if we can't access it directly
  }
  
  // Strategy 2: Check shadow DOMs
  if (!popup) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        const shadowText = node.shadowRoot.textContent || '';
        const shadowHTML = node.shadowRoot.innerHTML || '';
        
        if (shadowText.includes('Earning rate') || 
            shadowText.includes('exclusions') || 
            shadowText.includes('Activate Offer') ||
            shadowHTML.includes('earning-rate') ||
            shadowHTML.includes('activate-offer')) {
          popup = {
            type: 'shadow',
            element: node,
            document: node.shadowRoot
          };
          break;
        }
      }
    }
  }
  
  // Strategy 3: Check direct DOM for Citi extension popup container
  // Look for elements with the specific Citi extension popup styling
  if (!popup) {
    // Look for the popup container with z-index: 2147483647
    const popupContainers = document.querySelectorAll('[style*="z-index: 2147483647"], [style*="z-index:2147483647"]');
    for (const container of popupContainers) {
      const style = window.getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      
      // Check if it matches Citi extension popup characteristics
      const isCitiPopup = (
        style.position === 'fixed' &&
        (style.zIndex === '2147483647' || parseInt(style.zIndex) === 2147483647) &&
        rect.width > 300 && // Popup is 400px wide
        rect.height > 200 &&
        style.borderRadius === '10px' &&
        style.backgroundColor === 'rgb(255, 255, 255)'
      );
      
      if (isCitiPopup) {
        const text = container.textContent || '';
        if (text.includes('Earning rate') || text.includes('exclusions') || text.includes('Activate Offer')) {
          popup = {
            type: 'direct',
            element: container,
            document: document
          };
          break;
        }
      }
    }
    
    // Fallback: Check body text for Citi extension content
    if (!popup) {
      const bodyText = document.body?.textContent || '';
      const bodyHTML = document.body?.innerHTML || '';
      
      // Look for specific Citi extension patterns
      if (bodyText.includes('Earning rate') || 
          bodyText.includes('exclusions') || 
          bodyText.includes('Activate Offer') ||
          bodyHTML.includes('earning-rate') ||
          bodyHTML.includes('activate-offer') ||
          bodyHTML.includes('citi-extension') ||
          bodyHTML.includes('citiExtension')) {
        popup = {
          type: 'direct',
          element: document.body,
          document: document
        };
      }
    }
  }
  
  // Strategy 4: Look for elements with specific IDs or classes that might indicate Citi extension
  if (!popup) {
    const citiSelectors = [
      '[id*="citi"]',
      '[class*="citi"]',
      '[id*="Citi"]',
      '[class*="Citi"]',
      '[data-extension*="citi"]',
      '[data-extension*="Citi"]'
    ];
    
    for (const selector of citiSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent || '';
          if (text.includes('Earning rate') || text.includes('exclusions') || text.includes('Activate Offer')) {
            popup = {
              type: 'element',
              element: el,
              document: document
            };
            break;
          }
        }
        if (popup) break;
      } catch (e) {
        // Invalid selector, continue
      }
    }
  }
  
  return popup;
}

// Extract text from popup
function extractPopupText(popup) {
  let text = '';
  
  if (!popup) return text;
  
  // If it's a cross-origin extension iframe, we can't access the content directly
  if (popup.type === 'extension-iframe' && !popup.document) {
    // Try to get text from iframe title or other accessible attributes
    if (popup.element) {
      text = popup.element.title || popup.element.getAttribute('aria-label') || '';
    }
    return text;
  }
  
  if (popup.document) {
    text = popup.document.body?.textContent || popup.document.textContent || '';
  } else if (popup.element) {
    if (popup.element.contentDocument) {
      text = popup.element.contentDocument.body?.textContent || '';
    } else if (popup.element.textContent) {
      text = popup.element.textContent;
    } else if (popup.element.body) {
      text = popup.element.body.textContent || '';
    }
  } else if (popup.contentDocument) {
    text = popup.contentDocument.body?.textContent || '';
  } else if (popup.textContent) {
    text = popup.textContent;
  } else if (popup.body) {
    text = popup.body.textContent || '';
  }
  
  return text;
}

// Get exclusions text
function getExclusionsText(text) {
  const exclusionsMatch = text.match(/exclusions?[:\s]+(.*?)(?=Earning rate|Activate Offer|$)/i);
  return exclusionsMatch ? exclusionsMatch[1].trim() : '';
}

// Get earning rates text
function getEarningRatesText(text) {
  const earningMatch = text.match(/Earning rate[s]?[:\s]+(.*?)(?=exclusions|Activate Offer|$)/i);
  return earningMatch ? earningMatch[1].trim() : '';
}

// Check for flags in exclusions
function checkExclusionsFlags(exclusionsText) {
  const flags = [];
  EXCLUSION_FLAGS.forEach(flag => {
    if (exclusionsText.toLowerCase().includes(flag.toLowerCase())) {
      flags.push(flag);
    }
  });
  return flags;
}

// Check for duplicate "Online purchase" in earning rates
function checkDuplicateOnlinePurchase(earningRatesText) {
  const matches = earningRatesText.match(/online purchase/gi);
  return matches && matches.length > 1;
}

// Add visual indicator that popup is being tested
function addTestingIndicator(popup) {
  try {
    let targetElement = null;
    
    if (popup && popup.element) {
      targetElement = popup.element;
    } else if (popup && popup.document && popup.document.body) {
      targetElement = popup.document.body;
    } else {
      return;
    }
    
    // Remove existing indicator if any
    const existing = document.getElementById('citi-tester-indicator');
    if (existing) existing.remove();
    
    // Create indicator overlay
    const indicator = document.createElement('div');
    indicator.id = 'citi-tester-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #007bff;
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,123,255,0.4);
      animation: pulse 2s infinite;
    `;
    indicator.textContent = '🔄 Testing Citi Extension...';
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(indicator);
    
    // Also highlight the popup element if possible
    if (targetElement && targetElement.style) {
      const originalBorder = targetElement.style.border;
      const originalBoxShadow = targetElement.style.boxShadow;
      targetElement.style.border = '3px solid #007bff';
      targetElement.style.boxShadow = '0 0 20px rgba(0,123,255,0.6)';
      
      // Remove highlight after 5 seconds
      setTimeout(() => {
        if (targetElement && targetElement.style) {
          targetElement.style.border = originalBorder;
          targetElement.style.boxShadow = originalBoxShadow;
        }
      }, 5000);
    }
    
    return indicator;
  } catch (e) {
    console.error('Error adding testing indicator:', e);
  }
}

// Remove testing indicator
function removeTestingIndicator() {
  const indicator = document.getElementById('citi-tester-indicator');
  if (indicator) indicator.remove();
}

// Find and click button by text (handles cross-origin iframes)
async function findAndClickButton(doc, buttonText, partialMatch = true, popup = null) {
  // If we have a cross-origin extension iframe, try postMessage approach
  if (popup && popup.type === 'extension-iframe' && !doc && popup.element) {
    // Try to send a message to the iframe (if it supports it)
    try {
      popup.element.contentWindow.postMessage({
        type: 'CLICK_BUTTON',
        buttonText: buttonText
      }, '*');
      // Wait a bit to see if it worked
      await new Promise(resolve => setTimeout(resolve, 500));
      return true; // Assume it worked
    } catch (e) {
      console.log('PostMessage approach failed:', e);
    }
    
    // Fallback: Try to click the iframe itself or use coordinates
    // This is a last resort and may not work for cross-origin
    try {
      const rect = popup.element.getBoundingClientRect();
      // Try clicking in the center of the iframe
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      });
      popup.element.dispatchEvent(clickEvent);
      return true;
    } catch (e) {
      console.log('Coordinate click failed:', e);
    }
  }
  
  if (!doc) return false;
  
  const selectors = [
    'button',
    'a',
    '[role="button"]',
    '[onclick]',
    '.button',
    '[class*="button"]',
    'div[class*="btn"]',
    'span[class*="btn"]'
  ];
  
  for (const selector of selectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      for (const el of elements) {
        const btnText = (el.textContent || el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
        const searchText = buttonText.toLowerCase();
        
        let matches = false;
        if (partialMatch) {
          matches = btnText.includes(searchText);
        } else {
          matches = btnText === searchText || btnText.trim() === searchText;
        }
        
        if (matches) {
          try {
            // Scroll into view
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Wait a bit for scroll
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Try multiple click methods
            if (el.click) {
              el.click();
            } else if (el.dispatchEvent) {
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
            
            return true;
          } catch (e) {
            console.error('Error clicking button:', e);
          }
        }
      }
    } catch (e) {
      // Invalid selector or cross-origin issue
    }
  }
  
  return false;
}

// Find and click "Activate Offer" button
async function clickActivateOffer(popup) {
  let doc = null;
  
  // Get the document to search in
  if (popup && popup.document) {
    doc = popup.document;
  } else if (popup && popup.element) {
    if (popup.element.contentDocument) {
      doc = popup.element.contentDocument;
    } else if (popup.element.shadowRoot) {
      doc = popup.element.shadowRoot;
    } else {
      doc = document;
    }
  } else if (popup && popup.contentDocument) {
    doc = popup.contentDocument;
  } else if (popup && popup.querySelector) {
    doc = popup;
  } else {
    doc = document;
  }
  
  return findAndClickButton(doc, 'activate offer', true, popup);
}

// Find and click "Terms Apply" or similar button
async function clickTermsApply(popup) {
  let doc = null;
  
  // Get the document to search in
  if (popup && popup.document) {
    doc = popup.document;
  } else if (popup && popup.element) {
    if (popup.element.contentDocument) {
      doc = popup.element.contentDocument;
    } else if (popup.element.shadowRoot) {
      doc = popup.element.shadowRoot;
    } else {
      doc = document;
    }
  } else if (popup && popup.contentDocument) {
    doc = popup.contentDocument;
  } else if (popup && popup.querySelector) {
    doc = popup;
  } else {
    doc = document;
  }
  
  // Try various terms-related button texts
  const termsTexts = ['terms apply', 'apply', 'accept', 'agree', 'terms', 'continue'];
  
  for (const text of termsTexts) {
    if (await findAndClickButton(doc, text, true, popup)) {
      return true;
    }
  }
  
  return false;
}

// Wait for "Offer Activated" message
async function waitForOfferActivated(popup, timeout = 10000) {
  const startTime = Date.now();
  const initialUrl = window.location.href;
  
  while (Date.now() - startTime < timeout) {
    // Check if page redirected
    const currentUrl = window.location.href;
    if (currentUrl !== initialUrl) {
      return false; // Page redirected
    }
    
    // Check popup text
    const text = extractPopupText(popup);
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('offer activated') || 
        lowerText.includes('activated') ||
        lowerText.includes('successfully activated')) {
      return true;
    }
    
    // Re-detect popup in case it changed
    const newPopup = findCitiExtensionPopup();
    if (newPopup) {
      const newText = extractPopupText(newPopup);
      const lowerNewText = newText.toLowerCase();
      if (lowerNewText.includes('offer activated') || 
          lowerNewText.includes('activated') ||
          lowerNewText.includes('successfully activated')) {
        return true;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

// Take screenshot of popup
async function takeScreenshot(popup) {
  try {
    // Use chrome.tabs.captureVisibleTab if available
    // Otherwise, we'll need to use a different method
    return null; // Placeholder - will be handled by background script
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return null;
  }
}

// Main function to test Citi extension popup
async function testCitiExtensionPopup() {
  const popup = findCitiExtensionPopup();
  
  if (!popup) {
    return {
      success: false,
      error: 'Citi extension popup not found'
    };
  }
  
  // Add visual indicator that testing is happening
  const indicator = addTestingIndicator(popup);
  
  try {
    const text = extractPopupText(popup);
    const exclusionsText = getExclusionsText(text);
    const earningRatesText = getEarningRatesText(text);
    
    const initialUrl = window.location.href;
    
    const result = {
      timestamp: new Date().toISOString(),
      url: initialUrl,
      exclusions: exclusionsText,
      earningRates: earningRatesText,
      flags: [],
      errors: [],
      activated: false,
      redirected: false,
      termsApplied: false
    };
    
    // Check exclusions for flags
    const exclusionFlags = checkExclusionsFlags(exclusionsText);
    if (exclusionFlags.length > 0) {
      result.flags.push(...exclusionFlags.map(f => `Exclusions contain: ${f}`));
      result.errors.push(`Exclusions contain flagged keywords: ${exclusionFlags.join(', ')}`);
    }
    
    // Check for "Online purchase" in exclusions
    if (exclusionsText.toLowerCase().includes('online purchase')) {
      result.flags.push('Online purchase listed in exclusions');
      result.errors.push('Online purchase is listed in exclusions');
    }
    
    // Check for duplicate "Online purchase" in earning rates
    if (checkDuplicateOnlinePurchase(earningRatesText)) {
      result.flags.push('Online purchase listed twice in earning rates');
      result.errors.push('Online purchase is listed twice in earning rates');
    }
    
    // Check for "ShareASale commission" or "Earn commissions" in earning rates
    if (earningRatesText.toLowerCase().includes('shareasale commission')) {
      result.flags.push('ShareASale commission in earning rates');
      result.errors.push('ShareASale commission found in earning rates');
    }
    
    if (earningRatesText.toLowerCase().includes('earn commissions')) {
      result.flags.push('Earn commissions in earning rates');
      result.errors.push('Earn commissions found in earning rates');
    }
    
    // Update indicator
    if (indicator) {
      indicator.textContent = '🔄 Clicking "Activate Offer"...';
    }
    
    // Try to click "Activate Offer" button
    const buttonClicked = await clickActivateOffer(popup);
    
    if (buttonClicked) {
      // Wait a bit for any immediate redirect or popup change
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if page redirected immediately
      const currentUrl = window.location.href;
      if (currentUrl !== initialUrl) {
        result.redirected = true;
        result.errors.push('Page redirected instead of showing "Offer Activated"');
        removeTestingIndicator();
        return result;
      }
      
      // Update indicator
      if (indicator) {
        indicator.textContent = '🔄 Waiting for activation...';
      }
      
      // Wait for activation message
      const activated = await waitForOfferActivated(popup);
      
      if (activated) {
        result.activated = true;
        
        // Update indicator
        if (indicator) {
          indicator.textContent = '✅ Offer Activated! Clicking "Terms Apply"...';
          indicator.style.background = '#28a745';
        }
        
        // Wait a bit for UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to click "Terms Apply" button
        const termsClicked = await clickTermsApply(popup);
        
        if (termsClicked) {
          result.termsApplied = true;
          
          // Update indicator
          if (indicator) {
            indicator.textContent = '✅ Testing Complete!';
            indicator.style.background = '#28a745';
          }
          
          // Wait a bit before removing indicator
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          result.errors.push('"Terms Apply" button not found after activation');
        }
      } else {
        // Check if page redirected during wait
        const finalUrl = window.location.href;
        if (finalUrl !== initialUrl) {
          result.redirected = true;
          result.errors.push('Page redirected instead of showing "Offer Activated"');
        } else {
          result.errors.push('"Activate Offer" clicked but "Offer Activated" message not shown');
        }
      }
    } else {
      result.errors.push('Could not find "Activate Offer" button');
    }
    
    return result;
  } finally {
    // Remove indicator after a delay
    setTimeout(() => {
      removeTestingIndicator();
    }, 3000);
  }
}

// Click-to-test functionality
let clickToTestEnabled = false;

// Make popup clickable for testing
function enableClickToTestOnPopup(popup) {
  if (!popup || !popup.element) return;
  
  const element = popup.element;
  
  // Add visual indicator that it's clickable
  if (element.style) {
    const originalCursor = element.style.cursor;
    const originalOutline = element.style.outline;
    
    element.style.cursor = 'pointer';
    element.style.outline = '3px dashed #007bff';
    element.style.outlineOffset = '2px';
    
    // Add click handler
    const clickHandler = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Remove visual indicator
      element.style.cursor = originalCursor;
      element.style.outline = originalOutline;
      element.removeEventListener('click', clickHandler);
      
      // Start testing
      const result = await testCitiExtensionPopup();
      
      // Extract merchant info from current URL
      try {
        const url = new URL(window.location.href);
        const hostname = url.hostname.replace(/^www\./, '');
        
        result.merchantId = `url-${hostname}-${Date.now()}`;
        result.merchantName = hostname;
        result.browser = navigator.userAgent.includes('Edg') ? 'Edge' : 
                        (navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                        (navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'));
        result.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Take screenshot
        try {
          const screenshot = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
              resolve(response?.screenshot || null);
            });
          });
          if (screenshot) {
            result.screenshot = screenshot;
          }
        } catch (screenshotError) {
          console.error('Error taking screenshot:', screenshotError);
        }
      } catch (error) {
        console.error('Error extracting merchant info:', error);
      }
      
      // Send result to background
      chrome.runtime.sendMessage({
        action: 'testResult',
        result: result
      }).catch(() => {});
    };
    
    element.addEventListener('click', clickHandler, true);
    
    // Store handler for cleanup
    element._citiTesterClickHandler = clickHandler;
  }
}

// Disable click-to-test
function disableClickToTestOnPopup(popup) {
  if (!popup || !popup.element) return;
  
  const element = popup.element;
  if (element._citiTesterClickHandler) {
    element.removeEventListener('click', element._citiTesterClickHandler, true);
    delete element._citiTesterClickHandler;
    
    if (element.style) {
      element.style.cursor = '';
      element.style.outline = '';
    }
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'testCitiPopup') {
    testCitiExtensionPopup().then(result => {
      sendResponse({ success: true, result });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'findCitiPopup') {
    const popup = findCitiExtensionPopup();
    sendResponse({ success: !!popup, found: !!popup });
    return true;
  }
  
  if (message.action === 'highlightPopup') {
    const popup = findCitiExtensionPopup();
    if (popup) {
      addTestingIndicator(popup);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Popup not found' });
    }
    return true;
  }
  
  if (message.action === 'setClickToTest') {
    clickToTestEnabled = message.enabled || false;
    
    if (clickToTestEnabled) {
      // Find popup and enable click-to-test
      const popup = findCitiExtensionPopup();
      if (popup) {
        enableClickToTestOnPopup(popup);
        sendResponse({ success: true, message: 'Click-to-test enabled on popup' });
      } else {
        sendResponse({ success: false, message: 'Popup not found. It will be enabled when popup appears.' });
      }
    } else {
      // Disable click-to-test on all popups
      const popup = findCitiExtensionPopup();
      if (popup) {
        disableClickToTestOnPopup(popup);
      }
      sendResponse({ success: true, message: 'Click-to-test disabled' });
    }
    return true;
  }
  
  return false;
});

// Monitor for Citi extension popup appearance using MutationObserver
let popupObserver = null;
let popupCheckInterval = null;

function startMonitoring() {
  if (popupObserver) return;
  
  // Use MutationObserver to watch for iframes being added
  popupObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'IFRAME' || (node.querySelector && node.querySelector('iframe'))) {
          // New iframe added, check if it's the Citi extension
          const popup = findCitiExtensionPopup();
          if (popup) {
            chrome.runtime.sendMessage({
              action: 'citiPopupDetected',
              url: window.location.href
            }).catch(() => {});
            
            // If click-to-test is enabled, enable it on the new popup
            if (clickToTestEnabled) {
              enableClickToTestOnPopup(popup);
            }
          }
        }
      });
    });
  });
  
  // Start observing
  popupObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also use interval as fallback
  if (!popupCheckInterval) {
    popupCheckInterval = setInterval(() => {
      const popup = findCitiExtensionPopup();
      if (popup) {
        chrome.runtime.sendMessage({
          action: 'citiPopupDetected',
          url: window.location.href
        }).catch(() => {});
        
        // If click-to-test is enabled, enable it on the popup
        if (clickToTestEnabled) {
          enableClickToTestOnPopup(popup);
        }
      }
    }, 2000);
  }
}

function stopMonitoring() {
  if (popupObserver) {
    popupObserver.disconnect();
    popupObserver = null;
  }
  if (popupCheckInterval) {
    clearInterval(popupCheckInterval);
    popupCheckInterval = null;
  }
}

// Start monitoring when script loads
if (document.body) {
  startMonitoring();
} else {
  document.addEventListener('DOMContentLoaded', startMonitoring);
}

// Stop monitoring when page unloads
window.addEventListener('beforeunload', stopMonitoring);

})(); // End IIFE

