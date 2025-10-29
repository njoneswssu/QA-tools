const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Function to save Citi account cookies
async function saveCitiCookies(context) {
  try {
    const cookies = await context.cookies();
    const citiCookies = cookies.filter(cookie => 
      cookie.domain.includes('citi') || 
      cookie.domain.includes('citibank') ||
      cookie.name.toLowerCase().includes('citi') ||
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('session') ||
      cookie.name.toLowerCase().includes('login')
    );
    
    if (citiCookies.length > 0) {
      console.log(`💾 Saved ${citiCookies.length} Citi authentication cookies`);
      return citiCookies;
    }
    return [];
  } catch (error) {
    console.log(`⚠️ Error saving Citi cookies: ${error.message}`);
    return [];
  }
}

// Function to restore Citi account cookies
async function restoreCitiCookies(context, citiCookies) {
  try {
    if (citiCookies && citiCookies.length > 0) {
      await context.addCookies(citiCookies);
      console.log(`🔄 Restored ${citiCookies.length} Citi authentication cookies`);
      return true;
    }
    return false;
  } catch (error) {
    console.log(`⚠️ Error restoring Citi cookies: ${error.message}`);
    return false;
  }
}

// Function to clear non-Citi cookies while preserving Citi session
async function refreshCookiesKeepCiti(context, citiCookies) {
  try {
    console.log(`🧹 Aggressively clearing all non-Citi cookies and cache...`);
    
    // Get all current cookies
    const allCookies = await context.cookies();
    console.log(`📊 Found ${allCookies.length} total cookies to analyze`);
    
    // Identify non-Citi cookies to clear selectively
    const nonCitiCookies = allCookies.filter(cookie => 
      !cookie.domain.includes('citi') && 
      !cookie.domain.includes('citibank') &&
      !cookie.name.toLowerCase().includes('citi') &&
      !cookie.name.toLowerCase().includes('auth') &&
      !cookie.name.toLowerCase().includes('session') &&
      !cookie.name.toLowerCase().includes('login')
    );
    
    console.log(`🎯 Clearing ${nonCitiCookies.length} non-Citi cookies while preserving ${allCookies.length - nonCitiCookies.length} Citi cookies`);
    
    // Clear only non-Citi cookies
    for (const cookie of nonCitiCookies) {
      try {
        await context.clearCookies({
          domain: cookie.domain,
          name: cookie.name
        });
      } catch (e) {
        // Some cookies might not be clearable, that's OK
      }
    }
    
    // Clear browser cache and data more aggressively
    const pages = context.pages();
    for (const page of pages) {
      try {
        // Clear all browser storage and cache for each page
        await page.evaluate(() => {
          // Clear storage while preserving citishop controls state
          if (typeof localStorage !== 'undefined') {
            // Preserve citishop control settings
            const citishopCroutonCollapsed = localStorage.getItem('citishop-crouton-collapsed');
            const citishopFlaggedMerchants = localStorage.getItem('citishop-flagged-merchants');
            
            localStorage.clear();
            
            // Restore citishop control settings
            if (citishopCroutonCollapsed !== null) {
              localStorage.setItem('citishop-crouton-collapsed', citishopCroutonCollapsed);
            }
            if (citishopFlaggedMerchants !== null) {
              localStorage.setItem('citishop-flagged-merchants', citishopFlaggedMerchants);
            }
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
          }
          
          // Clear cache if available
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => {
                caches.delete(name);
              });
            });
          }
          
          // Clear IndexedDB
          if (typeof indexedDB !== 'undefined') {
            try {
              indexedDB.databases().then(databases => {
                databases.forEach(db => {
                  if (db.name) {
                    indexedDB.deleteDatabase(db.name);
                  }
                });
              });
            } catch (e) {
              // Ignore IndexedDB errors
            }
          }
        });
        
        // Use CDP (Chrome DevTools Protocol) to clear cache but preserve cookies
        const cdpSession = await context.newCDPSession(page);
        try {
          await cdpSession.send('Network.clearBrowserCache');
          // DON'T clear browser cookies here - we'll do it selectively below
          await cdpSession.send('Storage.clearDataForOrigin', {
            origin: '*',
            storageTypes: 'local_storage,session_storage,indexeddb,websql,cache_storage'
          });
          console.log(`🗑️ CDP cache clearing completed (preserving cookies)`);
        } catch (cdpError) {
          console.log(`⚠️ CDP cache clearing not available: ${cdpError.message}`);
        } finally {
          await cdpSession.detach();
        }
        
      } catch (e) {
        console.log(`⚠️ Some storage clearing failed for page: ${e.message}`);
      }
    }
    
    console.log(`🧽 Browser cache and storage cleared`);
    
    // Wait a moment for clearing to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Citi cookies were preserved throughout the process - no need to restore
    const remainingCitiCookies = await context.cookies();
    const citiCookieCount = remainingCitiCookies.filter(cookie => 
      cookie.domain.includes('citi') || 
      cookie.domain.includes('citibank') ||
      cookie.name.toLowerCase().includes('citi') ||
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('session') ||
      cookie.name.toLowerCase().includes('login')
    ).length;
    
    console.log(`✅ Preserved ${citiCookieCount} Citi authentication cookies`);
    console.log(`🔄 Fresh session ready - merchant cookies cleared, Citi session intact`);
    
    return true;
  } catch (error) {
    console.log(`⚠️ Error refreshing cookies and cache: ${error.message}`);
    return false;
  }
}

// Function to detect if URL change is minor (not a real refresh)
function isMinorUrlChange(oldUrl, newUrl) {
  try {
    const oldUrlObj = new URL(oldUrl);
    const newUrlObj = new URL(newUrl);
    
    // Same origin and pathname means minor change
    if (oldUrlObj.origin === newUrlObj.origin && oldUrlObj.pathname === newUrlObj.pathname) {
      // Check if only hash or search params changed
      const onlyHashChange = oldUrlObj.origin + oldUrlObj.pathname + oldUrlObj.search === newUrlObj.origin + newUrlObj.pathname + newUrlObj.search;
      const onlySearchChange = oldUrlObj.origin + oldUrlObj.pathname + oldUrlObj.hash === newUrlObj.origin + newUrlObj.pathname + newUrlObj.hash;
      
      if (onlyHashChange || onlySearchChange) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    return false; // If we can't parse, assume it's significant
  }
}

// Function to detect and handle CitiShop login redirects
async function handleCitiShopLoginRedirect(page) {
  try {
    const currentUrl = page.url();
    
    // Check if we're being redirected to CitiShop login
    if (currentUrl.includes('citi.com') && 
        (currentUrl.includes('login') || 
         currentUrl.includes('signin') || 
         currentUrl.includes('citishop/login') ||
         currentUrl.includes('citi-partner'))) {
      
      console.log(`🔐 CitiShop login page detected: ${currentUrl}`);
      console.log(`🔄 Attempting to bypass login page...`);
      
      // Try to go back to the previous page
      try {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
        console.log(`✅ Successfully navigated back from login page`);
        return true;
      } catch (e) {
        console.log(`⚠️ Could not navigate back from login page: ${e.message}`);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.log(`⚠️ Error checking for CitiShop login redirect: ${error.message}`);
    return false;
  }
}

// Cloudflare detection removed for faster page loading



// Function to check for error messages on the page
async function checkForErrorMessages(page) {
  const errorMessages = [
    'this link is currently not active',
    'sorry but this merchant is not currently eligible for earning',
    'this link is inactive',
    'this link you clicked is malformed',
    'the link you clicked is expired',
    'sorry this link is not valid',
    'the link is not currently active',
    'link is malformed',
    'link is inactive',
    'link is expired',
    'link is not valid',
    'merchant is not currently eligible',
    'not currently eligible for earning',
    'link you clicked is malformed',
    'link you clicked is expired',
    'this merchant is not currently eligible',
    'sorry, this link is not valid',
    'sorry, this merchant is not currently eligible'
  ];
  
  try {
    // Get page content from multiple sources with timeout protection
    const bodyContent = await Promise.race([
      page.textContent('body'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Body content timeout')), 3000))
    ]).catch(() => '');
    
    // Also check specific selectors that might contain error messages
    let alertContent = '';
    let modalContent = '';
    let errorDivContent = '';
    
    try {
      // Check for common alert/error selectors
      const alertSelectors = [
        '.alert', '.error', '.warning', '.notice', '.message',
        '[role="alert"]', '.alert-danger', '.alert-warning',
        '.error-message', '.warning-message', '.notice-message'
      ];
      
      for (const selector of alertSelectors) {
        try {
        const elements = await page.$$(selector);
        for (const element of elements) {
            try {
          const text = await element.textContent();
          if (text) alertContent += ' ' + text;
            } catch (elementError) {
              // Skip individual element errors
            }
          }
        } catch (selectorError) {
          // Skip problematic selectors
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
    
    const combinedContent = (bodyContent + ' ' + alertContent + ' ' + modalContent + ' ' + errorDivContent).toLowerCase();
    
    for (const errorMessage of errorMessages) {
      if (combinedContent.includes(errorMessage.toLowerCase())) {
        return {
          hasError: true,
          message: errorMessage
        };
      }
    }
    
    return { hasError: false };
  } catch (error) {
    console.log(`⚠️ Error checking page content: ${error.message}`);
    return { hasError: false };
  }
}


// Function to inject floating navigation controls as a collapsible crouton (optimized for speed)
async function injectFloatingControls(page, websiteName, currentIndex, totalWebsites, websites, flaggedWebsites) {
  // Clean flagged websites data to avoid serialization issues
  const cleanFlaggedSites = flaggedWebsites.map(site => ({
    name: site.name,
    url: site.url,
    flaggedBy: site.flaggedBy,
    timestamp: site.timestamp
  }));
  try {
    // Enhanced page validity checking
    if (!page || page.isClosed()) {
      console.log(`⚠️ Page invalid or closed for ${websiteName} - skipping controls injection`);
      return; // Silently exit if page is closed
    }
    
    // Additional safety check - verify page context is responsive
    try {
      await page.url(); // Test if page context is valid
    } catch (contextError) {
      console.log(`⚠️ Page context invalid for ${websiteName} - skipping controls injection`);
      return; // Skip injection if page context is invalid
    }
    
    // Inject with minimal timeout for faster loading - wrapped with timeout protection
    await Promise.race([
      page.evaluate(({ name, index, total, sites, flaggedSites }) => {
      // Remove existing controls if any
      const existingControls = document.getElementById('citishop-floating-controls');
      if (existingControls) {
        existingControls.remove();
      }

      // Check if crouton should be collapsed (persistent across refreshes)
      let isCollapsed = false;
      try {
        isCollapsed = localStorage.getItem('citishop-crouton-collapsed') === 'true';
      } catch (storageError) {
        // localStorage blocked, default to expanded
        console.log('localStorage blocked, using default controls state');
      }

      // Create floating control container (crouton style)
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'citishop-floating-controls';
      controlsContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 20px;
        transform: translateY(-50%);
        z-index: 2147483647;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: white;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        transition: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
        overflow: hidden;
        width: ${isCollapsed ? '60px' : '320px'};
        height: ${isCollapsed ? '60px' : 'auto'};
        cursor: ${isCollapsed ? 'pointer' : 'default'};
      `;

      // Create toggle button (always visible)
      const toggleBtn = document.createElement('div');
      toggleBtn.style.cssText = `
        position: absolute;
        top: ${isCollapsed ? '50%' : '12px'};
        left: ${isCollapsed ? '50%' : 'auto'};
        right: ${isCollapsed ? 'auto' : '12px'};
        transform: ${isCollapsed ? 'translate(-50%, -50%)' : 'none'};
        width: ${isCollapsed ? '40px' : '24px'};
        height: ${isCollapsed ? '40px' : '24px'};
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: ${isCollapsed ? '18px' : '14px'};
        transition: background 0.2s;
        z-index: 10;
      `;
      toggleBtn.innerHTML = isCollapsed ? '📂' : '✕';
      toggleBtn.title = isCollapsed ? 'Open CitiShop Controls' : 'Close CitiShop Controls';
      
      toggleBtn.onmouseover = () => {
        if (!localStorage.getItem('citishop-crouton-collapsed') || localStorage.getItem('citishop-crouton-collapsed') === 'false') {
          // Only allow hover effects when expanded (not collapsed)
          toggleBtn.style.background = 'rgba(255,255,255,0.3)';
          toggleBtn.style.transform = 'scale(1.1)';
        } else {
          // When collapsed, only change background, no transform/movement
          toggleBtn.style.background = 'rgba(255,255,255,0.3)';
        }
      };
      toggleBtn.onmouseout = () => {
        toggleBtn.style.background = 'rgba(255,255,255,0.2)';
        if (!localStorage.getItem('citishop-crouton-collapsed') || localStorage.getItem('citishop-crouton-collapsed') === 'false') {
          // Only reset transform when expanded
          toggleBtn.style.transform = 'scale(1)';
        }
      };

      // Create main content container
      const contentContainer = document.createElement('div');
      contentContainer.style.cssText = `
        opacity: ${isCollapsed ? '0' : '1'};
        transform: ${isCollapsed ? 'scale(0.8)' : 'scale(1)'};
        transition: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
        padding: ${isCollapsed ? '0' : '15px'};
        padding-top: ${isCollapsed ? '0' : '45px'};
        pointer-events: ${isCollapsed ? 'none' : 'auto'};
      `;



      // NEIL QA Logo in top left
      const logo = document.createElement('div');
      logo.style.cssText = `
        position: absolute;
        top: 8px;
        left: 8px;
        font-size: 14px;
        font-weight: 700;
        opacity: 0.7;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        color: transparent;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        z-index: 2147483647;
      `;
      logo.innerHTML = 'NEIL QA';

      // Website info header with running counter
      const header = document.createElement('div');
      header.style.cssText = `
        text-align: center;
        margin-bottom: 12px;
        margin-top: 8px;
        font-size: 13px;
        font-weight: 600;
        opacity: 0.95;
      `;
      header.innerHTML = `
        <div style="font-size: 15px; margin-bottom: 4px;">🌐 ${name}</div>
        <div style="font-size: 11px; opacity: 0.8;">Site ${index + 1} of ${total}</div>
      `;

      // Navigation controls (optimized)
      const navContainer = document.createElement('div');
      navContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      `;

      // Previous button (optimized)
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '← Prev';
      prevBtn.disabled = index === 0;
      prevBtn.style.cssText = `
        background: ${index === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)'};
        border: none;
        color: white;
        padding: 6px 10px;
        border-radius: 5px;
        cursor: ${index === 0 ? 'not-allowed' : 'pointer'};
        font-size: 11px;
        font-weight: 500;
        transition: background 0.15s;
        opacity: ${index === 0 ? '0.5' : '1'};
        flex: 1;
      `;
      if (index > 0) {
        prevBtn.onmouseover = () => {
          prevBtn.style.background = 'rgba(255,255,255,0.35)';
          prevBtn.style.transform = 'translateY(-1px) scale(1.02)';
          prevBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        };
        prevBtn.onmouseout = () => {
          prevBtn.style.background = 'rgba(255,255,255,0.25)';
          prevBtn.style.transform = 'translateY(0) scale(1)';
          prevBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        };
        prevBtn.onmousedown = () => {
          prevBtn.style.transform = 'translateY(1px) scale(0.98)';
          prevBtn.style.background = 'rgba(255,255,255,0.45)';
        };
        prevBtn.onmouseup = () => {
          prevBtn.style.transform = 'translateY(-1px) scale(1.02)';
          prevBtn.style.background = 'rgba(255,255,255,0.35)';
        };
        prevBtn.onclick = () => {
          console.log('🔄 Previous button clicked!');
          window.citishopNavigation = { action: 'previous', targetIndex: index - 1 };
          console.log('🔄 Navigation command set:', window.citishopNavigation);
        };
      }

      // Next button (optimized)
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = 'Next →';
      nextBtn.disabled = index === total - 1;
      nextBtn.style.cssText = `
        background: ${index === total - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)'};
        border: none;
        color: white;
        padding: 6px 10px;
        border-radius: 5px;
        cursor: ${index === total - 1 ? 'not-allowed' : 'pointer'};
        font-size: 11px;
        font-weight: 500;
        transition: background 0.15s;
        opacity: ${index === total - 1 ? '0.5' : '1'};
        flex: 1;
      `;
      if (index < total - 1) {
        nextBtn.onmouseover = () => {
          nextBtn.style.background = 'rgba(255,255,255,0.35)';
          nextBtn.style.transform = 'translateY(-1px) scale(1.02)';
          nextBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        };
        nextBtn.onmouseout = () => {
          nextBtn.style.background = 'rgba(255,255,255,0.25)';
          nextBtn.style.transform = 'translateY(0) scale(1)';
          nextBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        };
        nextBtn.onmousedown = () => {
          nextBtn.style.transform = 'translateY(1px) scale(0.98)';
          nextBtn.style.background = 'rgba(255,255,255,0.45)';
        };
        nextBtn.onmouseup = () => {
          nextBtn.style.transform = 'translateY(-1px) scale(1.02)';
          nextBtn.style.background = 'rgba(255,255,255,0.35)';
        };
        nextBtn.onclick = () => {
          console.log('➡️ Next button clicked!');
          window.citishopNavigation = { action: 'next', targetIndex: index + 1 };
          console.log('➡️ Navigation command set:', window.citishopNavigation);
        };
      }

      navContainer.appendChild(prevBtn);
      navContainer.appendChild(nextBtn);

      // Flag button (optimized)
      const flagBtn = document.createElement('button');
      flagBtn.innerHTML = '🚩 Flag';
      flagBtn.style.cssText = `
        background: linear-gradient(135deg, #ff6b6b, #ee5a24);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        width: 100%;
        transition: all 0.15s;
        box-shadow: 0 3px 12px rgba(255,107,107,0.25);
      `;
      flagBtn.onmouseover = () => {
        flagBtn.style.transform = 'translateY(-2px) scale(1.02)';
        flagBtn.style.boxShadow = '0 6px 20px rgba(255,107,107,0.4)';
        flagBtn.style.background = 'linear-gradient(135deg, #ff5252, #e53935)';
      };
      flagBtn.onmouseout = () => {
        flagBtn.style.transform = 'translateY(0) scale(1)';
        flagBtn.style.boxShadow = '0 3px 12px rgba(255,107,107,0.25)';
        flagBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
      };
      flagBtn.onmousedown = () => {
        flagBtn.style.transform = 'translateY(1px) scale(0.98)';
        flagBtn.style.boxShadow = '0 2px 8px rgba(255,107,107,0.3)';
      };
      flagBtn.onmouseup = () => {
        flagBtn.style.transform = 'translateY(-2px) scale(1.02)';
        flagBtn.style.boxShadow = '0 6px 20px rgba(255,107,107,0.4)';
      };
      flagBtn.onclick = () => {
        console.log('🚩 Flag button clicked!');
        
        // Check if website is already flagged using localStorage for immediate detection
        let flaggedMerchants = [];
        let alreadyFlagged = false;
        
        try {
          flaggedMerchants = JSON.parse(localStorage.getItem('citishop-flagged-merchants') || '[]');
          alreadyFlagged = flaggedMerchants.includes(name);
        } catch (e) {
          // localStorage blocked, can't check previous flags
          console.log('Cannot check flag status - localStorage blocked');
        }
        
        if (alreadyFlagged) {
          console.log('⚠️ This website has already been flagged!');
          flagBtn.innerHTML = '⚠️ Already Flagged';
          flagBtn.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
          setTimeout(() => {
            flagBtn.innerHTML = '🚩 Flag';
            flagBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
          }, 2000);
          return;
        }
        
        // Store in localStorage immediately for next click detection
        try {
          flaggedMerchants.push(name);
          localStorage.setItem('citishop-flagged-merchants', JSON.stringify(flaggedMerchants));
        } catch (e) {
          // localStorage blocked, continue without saving
          console.log('Cannot save flag status - localStorage blocked');
        }
        
        window.citishopNavigation = { action: 'flag', websiteName: name };
        console.log('🚩 Navigation command set:', window.citishopNavigation);
        flagBtn.innerHTML = '✅ Flagged!';
        flagBtn.style.background = 'linear-gradient(135deg, #2ed573, #1e90ff)';
        flagBtn.style.transition = 'all 0.3s ease';
        setTimeout(() => {
          flagBtn.style.transition = 'all 0.5s ease';
          flagBtn.innerHTML = '🚩 Flag';
          flagBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
        }, 3000);
      };

      // Close button to stop testing
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '❌ Stop Testing';
      closeBtn.style.cssText = `
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        width: 100%;
        transition: all 0.15s;
        box-shadow: 0 3px 12px rgba(231,76,60,0.25);
        margin-top: 8px;
        margin-bottom: 6px;
      `;
      closeBtn.onmouseover = () => {
        closeBtn.style.transform = 'translateY(-2px) scale(1.02)';
        closeBtn.style.boxShadow = '0 6px 20px rgba(231,76,60,0.4)';
        closeBtn.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
      };
      closeBtn.onmouseout = () => {
        closeBtn.style.transform = 'translateY(0) scale(1)';
        closeBtn.style.boxShadow = '0 3px 12px rgba(231,76,60,0.25)';
        closeBtn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
      };
      closeBtn.onmousedown = () => {
        closeBtn.style.transform = 'translateY(1px) scale(0.98)';
        closeBtn.style.boxShadow = '0 2px 8px rgba(231,76,60,0.3)';
      };
      closeBtn.onmouseup = () => {
        closeBtn.style.transform = 'translateY(-2px) scale(1.02)';
        closeBtn.style.boxShadow = '0 6px 20px rgba(231,76,60,0.4)';
      };
      closeBtn.onclick = () => {
        console.log('❌ Close button clicked!');
        window.citishopNavigation = { action: 'stop_testing' };
        console.log('❌ Stop testing command set:', window.citishopNavigation);
        
        // Smooth transition directly to stopped state
        closeBtn.style.transition = 'all 0.8s ease-in-out';
        closeBtn.innerHTML = '✅ Stopped';
        closeBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
        closeBtn.style.cursor = 'not-allowed';
        closeBtn.onclick = null; // Disable further clicks
        
        // Create a global function to update stop button status
        window.updateStopButtonStatus = (status) => {
          if (status === 'stopped') {
            // Already in stopped state, just ensure it stays
            closeBtn.style.transition = 'all 0.8s ease-in-out';
            closeBtn.innerHTML = '✅ Stopped';
            closeBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            closeBtn.style.cursor = 'not-allowed';
            closeBtn.onclick = null;
          }
        };
        
        // Stay in stopped state for 4 seconds, then revert back to original
        setTimeout(() => {
          closeBtn.style.transition = 'all 0.8s ease-in-out';
          closeBtn.innerHTML = '❌ Stop Testing';
          closeBtn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
          closeBtn.style.cursor = 'pointer';
          // Re-enable the button with the same functionality
          closeBtn.onclick = arguments.callee; // Reattach the same click handler
        }, 4000);
      };

      // Copy button for successful merchants only
      const copySuccessfulBtn = document.createElement('button');
      copySuccessfulBtn.innerHTML = '📋 Copy Successful Merchants';
      copySuccessfulBtn.style.cssText = `
        background: linear-gradient(135deg, #4834d4, #686de0);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        width: 100%;
        transition: all 0.15s;
        box-shadow: 0 3px 12px rgba(72,52,212,0.25);
        margin-bottom: 6px;
      `;
      copySuccessfulBtn.onmouseover = () => {
        copySuccessfulBtn.style.transform = 'translateY(-2px) scale(1.02)';
        copySuccessfulBtn.style.boxShadow = '0 6px 20px rgba(72,52,212,0.4)';
        copySuccessfulBtn.style.background = 'linear-gradient(135deg, #3742fa, #5f27cd)';
      };
      copySuccessfulBtn.onmouseout = () => {
        copySuccessfulBtn.style.transform = 'translateY(0) scale(1)';
        copySuccessfulBtn.style.boxShadow = '0 3px 12px rgba(72,52,212,0.25)';
        copySuccessfulBtn.style.background = 'linear-gradient(135deg, #4834d4, #686de0)';
      };
      copySuccessfulBtn.onmousedown = () => {
        copySuccessfulBtn.style.transform = 'translateY(1px) scale(0.98)';
        copySuccessfulBtn.style.boxShadow = '0 2px 8px rgba(72,52,212,0.3)';
      };
      copySuccessfulBtn.onmouseup = () => {
        copySuccessfulBtn.style.transform = 'translateY(-2px) scale(1.02)';
        copySuccessfulBtn.style.boxShadow = '0 6px 20px rgba(72,52,212,0.4)';
      };
      copySuccessfulBtn.onclick = () => {
        console.log('📋 Copy successful merchants button clicked!');
        window.citishopNavigation = { action: 'copy_successful_merchants' };
        console.log('📋 Copy successful merchants command set:', window.citishopNavigation);
        copySuccessfulBtn.innerHTML = '✅ Copied!';
        copySuccessfulBtn.style.background = 'linear-gradient(135deg, #2ed573, #1e90ff)';
        setTimeout(() => {
          copySuccessfulBtn.innerHTML = '📋 Copy Successful Merchants';
          copySuccessfulBtn.style.background = 'linear-gradient(135deg, #4834d4, #686de0)';
        }, 2000);
      };

      // Copy button for flagged merchants
      const copyFlaggedBtn = document.createElement('button');
      copyFlaggedBtn.innerHTML = '🚩 Copy Flagged Merchants';
      copyFlaggedBtn.style.cssText = `
        background: linear-gradient(135deg, #e67e22, #d35400);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        width: 100%;
        transition: all 0.15s;
        box-shadow: 0 3px 12px rgba(230,126,34,0.25);
        margin-bottom: 6px;
      `;
      copyFlaggedBtn.onmouseover = () => {
        copyFlaggedBtn.style.transform = 'translateY(-2px) scale(1.02)';
        copyFlaggedBtn.style.boxShadow = '0 6px 20px rgba(230,126,34,0.4)';
        copyFlaggedBtn.style.background = 'linear-gradient(135deg, #f39c12, #d68910)';
      };
      copyFlaggedBtn.onmouseout = () => {
        copyFlaggedBtn.style.transform = 'translateY(0) scale(1)';
        copyFlaggedBtn.style.boxShadow = '0 3px 12px rgba(230,126,34,0.25)';
        copyFlaggedBtn.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
      };
      copyFlaggedBtn.onmousedown = () => {
        copyFlaggedBtn.style.transform = 'translateY(1px) scale(0.98)';
        copyFlaggedBtn.style.boxShadow = '0 2px 8px rgba(230,126,34,0.3)';
      };
      copyFlaggedBtn.onmouseup = () => {
        copyFlaggedBtn.style.transform = 'translateY(-2px) scale(1.02)';
        copyFlaggedBtn.style.boxShadow = '0 6px 20px rgba(230,126,34,0.4)';
      };
      copyFlaggedBtn.onclick = () => {
        console.log('🚩 Copy flagged merchants button clicked!');
        window.citishopNavigation = { action: 'copy_flagged_merchants' };
        console.log('🚩 Copy flagged merchants command set:', window.citishopNavigation);
        copyFlaggedBtn.innerHTML = '✅ Copied!';
        copyFlaggedBtn.style.background = 'linear-gradient(135deg, #2ed573, #1e90ff)';
        setTimeout(() => {
          copyFlaggedBtn.innerHTML = '🚩 Copy Flagged Merchants';
          copyFlaggedBtn.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
        }, 2000);
      };

      // Progress bar (optimized)
      const progressContainer = document.createElement('div');
      progressContainer.style.cssText = `
        background: rgba(255,255,255,0.15);
        border-radius: 8px;
        height: 4px;
        margin-top: 12px;
        overflow: hidden;
      `;
      
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        background: linear-gradient(90deg, #2ed573, #1e90ff);
        height: 100%;
        width: ${((index + 1) / total) * 100}%;
        transition: width 0.25s ease;
        border-radius: 8px;
      `;
      
      progressContainer.appendChild(progressBar);

      // Instructions (simplified)
      const instructions = document.createElement('div');
      instructions.style.cssText = `
        font-size: 9px;
        opacity: 0.6;
        text-align: center;
        margin-top: 8px;
        line-height: 1.2;
      `;
      instructions.innerHTML = `Navigate • Flag • Progress: ${((index + 1) / total * 100).toFixed(0)}%`;

      // Assemble the content container
      contentContainer.appendChild(logo);
      contentContainer.appendChild(header);
      contentContainer.appendChild(navContainer);
      contentContainer.appendChild(flagBtn);
      contentContainer.appendChild(closeBtn);
      contentContainer.appendChild(copySuccessfulBtn);
      contentContainer.appendChild(copyFlaggedBtn);
      contentContainer.appendChild(progressContainer);
      contentContainer.appendChild(instructions);

      // Add toggle functionality with localStorage error handling
      const toggleCrouton = () => {
        let currentlyCollapsed = false;
        try {
          currentlyCollapsed = localStorage.getItem('citishop-crouton-collapsed') === 'true';
        } catch (e) {
          // localStorage blocked, use current state from DOM
          currentlyCollapsed = controlsContainer.style.width === '60px';
        }
        
        const newCollapsed = !currentlyCollapsed;
        
        try {
          localStorage.setItem('citishop-crouton-collapsed', newCollapsed.toString());
        } catch (e) {
          // localStorage blocked, continue without saving
          console.log('Cannot save controls state - localStorage blocked');
        }
        
        // Update container styles
        controlsContainer.style.width = newCollapsed ? '60px' : '320px';
        controlsContainer.style.height = newCollapsed ? '60px' : 'auto';
        controlsContainer.style.cursor = newCollapsed ? 'pointer' : 'default';
        
        // Update content visibility
        contentContainer.style.opacity = newCollapsed ? '0' : '1';
        contentContainer.style.transform = newCollapsed ? 'scale(0.8)' : 'scale(1)';
        contentContainer.style.pointerEvents = newCollapsed ? 'none' : 'auto';
        contentContainer.style.padding = newCollapsed ? '0' : '15px';
        contentContainer.style.paddingTop = newCollapsed ? '0' : '45px';
        
        // Update toggle button immediately - no animation
        toggleBtn.innerHTML = newCollapsed ? '📂' : '✕';
        toggleBtn.title = newCollapsed ? 'Open CitiShop Controls' : 'Close CitiShop Controls';
        toggleBtn.style.display = 'flex'; // Ensure button stays visible
        toggleBtn.style.width = newCollapsed ? '40px' : '24px';
        toggleBtn.style.height = newCollapsed ? '40px' : '24px';
        toggleBtn.style.fontSize = newCollapsed ? '18px' : '14px';
        toggleBtn.style.top = newCollapsed ? '50%' : '12px';
        toggleBtn.style.left = newCollapsed ? '50%' : 'auto';
        toggleBtn.style.right = newCollapsed ? 'auto' : '12px';
        toggleBtn.style.transform = newCollapsed ? 'translate(-50%, -50%)' : 'none';
        
        // Update container click handler
        updateContainerClickHandler(newCollapsed);
        

      };

      // Add click handlers
      toggleBtn.onclick = toggleCrouton;
      
      // Allow clicking the whole container when collapsed to expand
      const updateContainerClickHandler = (collapsed) => {
        // Remove existing click handler
        controlsContainer.onclick = null;
        
        if (collapsed) {
          controlsContainer.onclick = (e) => {
            if (e.target === controlsContainer || e.target.className === 'collapsed-indicator') {
              toggleCrouton();
            }
          };
        }
      };
      
      // Set initial click handler
      updateContainerClickHandler(isCollapsed);

      // Assemble the main container
      controlsContainer.appendChild(toggleBtn);
      controlsContainer.appendChild(contentContainer);

      // Add to page
      document.body.appendChild(controlsContainer);

      // Initialize navigation state
      window.citishopNavigation = window.citishopNavigation || { action: null };
      
    }, { name: websiteName, index: currentIndex, total: totalWebsites, sites: websites, flaggedSites: cleanFlaggedSites }),
      // Reasonable timeout after 2 seconds for reliable injection
      new Promise((_, reject) => setTimeout(() => reject(new Error('Injection timeout')), 2000))
    ]);
    
    // Verify the controls were actually added to the DOM
    try {
      const controlsExists = await Promise.race([
        page.$('#citishop-floating-controls'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Verification timeout')), 500))
      ]);
      // Silently verify injection success - no console spam
          } catch (e) {
      // Silent verification - only log actual problems
    }
  } catch (error) {
    // Handle context destruction errors silently
    if (error.message.includes('Execution context was destroyed') || 
        error.message.includes('Cannot read properties of null') ||
        error.message.includes('Target closed') ||
        error.message.includes('Injection timeout')) {
      // Silently ignore context destruction errors during navigation
      console.log(`⚠️ Context destruction detected for ${websiteName} - skipping controls`);
      return;
    }
    
    // Try force injection for blocked page scenarios and security errors
    if (error.message.includes('blocked') || 
        error.message.includes('restricted') || 
        error.message.includes('denied') ||
        error.message.includes('Content Security Policy') ||
        error.message.includes('SecurityError') ||
        error.message.includes('localStorage') ||
        error.message.includes('Access is denied') ||
        error.message.includes('Permission denied') ||
        error.name === 'SecurityError') {
      console.log(`🚨 CSP/SECURITY RESTRICTION DETECTED on ${websiteName}`);
      console.log(`📋 Error Details: ${error.message}`);
      console.log(`🔒 Site has Content Security Policy or other security restrictions blocking script injection`);
      console.log(`🔄 Attempting force injection for blocked/restricted page...`);
      console.log(`⌨️ KEYBOARD SHORTCUTS AVAILABLE: Left Arrow (←) = Previous, Right Arrow (→) = Next, F = Flag, Q = Stop Testing`);
      console.log(`💡 TIP: If visual controls don't work, use keyboard shortcuts to navigate!`);
    
    try {
      // Force injection with full-sized controls for blocked pages
      await page.addStyleTag({
        content: `
          #citishop-force-controls {
            position: fixed !important;
            top: 50% !important;
            left: 20px !important;
            transform: translateY(-50%) !important;
            z-index: 2147483647 !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            color: white !important;
            backdrop-filter: blur(10px) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
            transition: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1) !important;
            overflow: hidden !important;
            width: 320px !important;
            height: auto !important;
            padding: 15px !important;
            padding-top: 45px !important;
          }
          #citishop-force-controls .nav-buttons {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          #citishop-force-controls .nav-buttons button {
            background: rgba(255,255,255,0.25) !important;
            border: none !important;
            color: white !important;
            padding: 6px 10px !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            font-size: 11px !important;
            font-weight: 500 !important;
            transition: all 0.15s !important;
            flex: 1 !important;
          }
          #citishop-force-controls .nav-buttons button:hover {
            background: rgba(255,255,255,0.35) !important;
            transform: translateY(-1px) scale(1.02) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
          }
          #citishop-force-controls .nav-buttons button:active {
            transform: translateY(1px) scale(0.98) !important;
            background: rgba(255,255,255,0.45) !important;
          }
          #citishop-force-controls .nav-buttons button:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
          }
          #citishop-force-controls .action-button {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24) !important;
            border: none !important;
            color: white !important;
            padding: 8px 12px !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            width: 100% !important;
            transition: all 0.15s !important;
            box-shadow: 0 3px 12px rgba(255,107,107,0.25) !important;
            margin-bottom: 6px !important;
          }
          #citishop-force-controls .action-button:hover {
            transform: translateY(-2px) scale(1.02) !important;
            box-shadow: 0 6px 20px rgba(255,107,107,0.4) !important;
            background: linear-gradient(135deg, #ff5252, #e53935) !important;
          }
          #citishop-force-controls .action-button:active {
            transform: translateY(1px) scale(0.98) !important;
            box-shadow: 0 2px 8px rgba(255,107,107,0.3) !important;
          }
          #citishop-force-controls .action-button.stop {
            background: linear-gradient(135deg, #e74c3c, #c0392b) !important;
            box-shadow: 0 3px 12px rgba(231,76,60,0.25) !important;
            margin-top: 8px !important;
          }
          #citishop-force-controls .action-button.stop:hover {
            background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
            box-shadow: 0 6px 20px rgba(231,76,60,0.4) !important;
          }
          #citishop-force-controls .action-button.copy-success {
            background: linear-gradient(135deg, #4834d4, #686de0) !important;
            box-shadow: 0 3px 12px rgba(72,52,212,0.25) !important;
          }
          #citishop-force-controls .action-button.copy-success:hover {
            background: linear-gradient(135deg, #3742fa, #5f27cd) !important;
            box-shadow: 0 6px 20px rgba(72,52,212,0.4) !important;
          }
          #citishop-force-controls .action-button.copy-flagged {
            background: linear-gradient(135deg, #e67e22, #d35400) !important;
            box-shadow: 0 3px 12px rgba(230,126,34,0.25) !important;
          }
          #citishop-force-controls .action-button.copy-flagged:hover {
            background: linear-gradient(135deg, #f39c12, #d68910) !important;
            box-shadow: 0 6px 20px rgba(230,126,34,0.4) !important;
          }
        `
      });
      
      await page.evaluate(({ name, index, total }) => {
        try {
          const forceControls = document.createElement('div');
          forceControls.id = 'citishop-force-controls';
          forceControls.innerHTML = `
            <div style="position: absolute; top: 8px; left: 8px; font-size: 14px; font-weight: 700; opacity: 0.7; letter-spacing: 1.5px; text-transform: uppercase; background: linear-gradient(45deg, #ff6b6b, #4ecdc4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: transparent; z-index: 2147483647;">NEIL QA</div>
            
            <div style="text-align: center; margin-bottom: 12px; margin-top: 8px; font-size: 13px; font-weight: 600; opacity: 0.95;">
              <div style="font-size: 15px; margin-bottom: 4px;">🔒 ${name}</div>
              <div style="font-size: 11px; opacity: 0.8;">Site ${index + 1} of ${total} (SECURE/BLOCKED)</div>
            </div>
            
            <div class="nav-buttons">
              <button onclick="try{window.citishopNavigation = {action: 'previous', targetIndex: ${index - 1}}}catch(e){console.log('Nav error')}" 
                      ${index === 0 ? 'disabled' : ''}>← Prev</button>
              <button onclick="try{window.citishopNavigation = {action: 'next', targetIndex: ${index + 1}}}catch(e){console.log('Nav error')}" 
                      ${index === total - 1 ? 'disabled' : ''}>Next →</button>
            </div>
            
            <button class="action-button" onclick="try{window.citishopNavigation = {action: 'flag', websiteName: '${name}'}}catch(e){console.log('Flag error')}">🚩 Flag</button>
            <button class="action-button stop" onclick="try{window.citishopNavigation = {action: 'stop_testing'}}catch(e){console.log('Stop error')}">❌ Stop Testing</button>
            <button class="action-button copy-success" onclick="try{window.citishopNavigation = {action: 'copy_successful_merchants'}}catch(e){console.log('Copy error')}">📋 Copy Successful</button>
            <button class="action-button copy-flagged" onclick="try{window.citishopNavigation = {action: 'copy_flagged_merchants'}}catch(e){console.log('Copy error')}">🚩 Copy Flagged</button>
            
            <div style="background: rgba(255,255,255,0.15); border-radius: 8px; height: 4px; margin-top: 12px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #2ed573, #1e90ff); height: 100%; width: ${((index + 1) / total) * 100}%; transition: width 0.25s ease; border-radius: 8px;"></div>
            </div>
            
            <div style="font-size: 9px; opacity: 0.6; text-align: center; margin-top: 8px; line-height: 1.2;">Secure Page • Progress: ${((index + 1) / total * 100).toFixed(0)}%</div>
          `;
          
          // Remove any existing controls first
          const existing = document.getElementById('citishop-floating-controls') || document.getElementById('citishop-force-controls');
          if (existing) existing.remove();
          
          document.body.appendChild(forceControls);
          
          // Initialize navigation without localStorage dependency
          try {
            window.citishopNavigation = window.citishopNavigation || { action: null };
          } catch (navError) {
            // Even window access might be restricted
            console.log('Cannot set navigation object');
          }
          
          console.log('✅ Force injection successful for blocked/secure page');
          console.log('⌨️ If buttons don\'t work due to security restrictions, use keyboard shortcuts!');
        } catch (forceInjectionError) {
          console.log('❌ Force injection failed:', forceInjectionError.message);
          
          // Last resort - try minimal injection
          try {
            const minimalDiv = document.createElement('div');
            minimalDiv.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;z-index:2147483647!important;background:#ff4444!important;color:white!important;padding:10px!important;border-radius:5px!important;font-family:Arial!important;cursor:pointer!important;';
            minimalDiv.innerHTML = '❌ STOP TEST';
            minimalDiv.onclick = () => { try { window.citishopNavigation = {action: 'stop_testing'}; } catch(e) {} };
            document.body.appendChild(minimalDiv);
            console.log('✅ Minimal emergency controls injected');
          } catch (minimalError) {
            console.log('❌ Even minimal injection failed');
          }
        }
      }, { name: websiteName, index: currentIndex, total: totalWebsites });
      
      // Always try to setup keyboard navigation as backup for blocked sites
      await setupKeyboardNavigation(page, websiteName, currentIndex, totalWebsites);
      
    } catch (forceError) {
      console.log(`❌ Force injection also failed for ${websiteName}: ${forceError.message}`);
      
      // Even if visual injection fails, try keyboard navigation
      await setupKeyboardNavigation(page, websiteName, currentIndex, totalWebsites);
    }
    } else {
      // For other errors, just log and continue
      console.log(`⚠️ Controls injection error for ${websiteName}: ${error.message}`);
    }
  }
}

// Function to setup keyboard navigation fallback for CSP-blocked sites
async function setupKeyboardNavigation(page, websiteName, currentIndex, totalWebsites) {
  try {
    console.log(`⌨️ Setting up keyboard navigation fallback for ${websiteName}...`);
    
    // Add keyboard event listeners directly to the page
    await page.evaluate(({ name, index, total }) => {
      // Remove existing keyboard listeners to avoid duplicates
      if (window.citishopKeyboardHandler) {
        document.removeEventListener('keydown', window.citishopKeyboardHandler);
      }
      
      // Create new keyboard handler
      window.citishopKeyboardHandler = (event) => {
        // Only process if no input fields are focused
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.isContentEditable
        );
        
        if (isInputFocused) return;
        
        try {
          // Initialize navigation object if it doesn't exist
          window.citishopNavigation = window.citishopNavigation || { action: null };
          
          switch(event.key) {
            case 'ArrowLeft':
              if (index > 0) {
                event.preventDefault();
                window.citishopNavigation = { action: 'previous', targetIndex: index - 1 };
                console.log(`⌨️ Keyboard: Previous button pressed (${index} → ${index - 1})`);
              }
              break;
            case 'ArrowRight':
              if (index < total - 1) {
                event.preventDefault();
                window.citishopNavigation = { action: 'next', targetIndex: index + 1 };
                console.log(`⌨️ Keyboard: Next button pressed (${index} → ${index + 1})`);
              }
              break;
            case 'f':
            case 'F':
              event.preventDefault();
              window.citishopNavigation = { action: 'flag', websiteName: name };
              console.log(`⌨️ Keyboard: Flag button pressed for ${name}`);
              break;
            case 'q':
            case 'Q':
              event.preventDefault();
              window.citishopNavigation = { action: 'stop_testing' };
              console.log(`⌨️ Keyboard: Stop testing button pressed`);
              break;
            case 's':
            case 'S':
              event.preventDefault();
              window.citishopNavigation = { action: 'copy_successful_merchants' };
              console.log(`⌨️ Keyboard: Copy successful merchants pressed`);
              break;
            case 'g':
            case 'G':
              event.preventDefault();
              window.citishopNavigation = { action: 'copy_flagged_merchants' };
              console.log(`⌨️ Keyboard: Copy flagged merchants pressed`);
              break;
            case 'c':
            case 'C':
              event.preventDefault();
              window.citishopNavigation = { action: 'mark_current_successful', websiteName: name };
              console.log(`⌨️ Keyboard: Mark current as successful pressed for ${name}`);
              break;
          }
        } catch (keyboardError) {
          console.log('Keyboard navigation error:', keyboardError.message);
        }
      };
      
      // Add the event listener
      document.addEventListener('keydown', window.citishopKeyboardHandler);
      
      console.log(`⌨️ Keyboard navigation active for ${name}:`);
      console.log(`   ← (Left Arrow) = Previous | → (Right Arrow) = Next`);
      console.log(`   F = Flag | Q = Stop Testing | S = Copy Successful | G = Copy Flagged | C = Mark Successful`);
      
    }, { name: websiteName, index: currentIndex, total: totalWebsites });
    
    return true;
  } catch (error) {
    console.log(`⚠️ Could not setup keyboard navigation: ${error.message}`);
    return false;
  }
}

// Function to check for navigation commands
async function checkNavigationCommands(page) {
  try {
    // Add timeout protection and better error handling
    const navCommand = await Promise.race([
      page.evaluate(() => {
        try {
          const command = window.citishopNavigation;
          if (command && command.action) {
            console.log('🎮 Navigation command detected:', command);
            // Clear the command after reading it
            try {
              window.citishopNavigation = { action: null };
            } catch (clearError) {
              // Cannot clear, but continue
            }
            return command;
          }
          return null;
        } catch (windowError) {
          // Window access might be restricted
          return null;
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation check timeout')), 1000))
    ]);
    return navCommand;
  } catch (error) {
    // Silently handle all navigation command errors
    return null;
  }
}

// Function to wait for page load and check for errors - WAIT INDEFINITELY for refresh
async function waitForPageAndCheckErrors(page, websiteName, originalUrl, currentIndex, totalWebsites, websites, flaggedWebsites, successfulMerchants, openMerchantTabs) {
  console.log(`⏳ INDEFINITE monitoring of ${websiteName} - waiting for refresh or error...`);
  
  // Immediate check if page is already closed before starting monitoring
  try {
    if (!page || page.isClosed()) {
      console.log(`🚪 Page is already closed before monitoring started - stopping test`);
      return { hasError: false, pageClosed: true, userNavigation: { action: 'page_closed' } };
    }
  } catch (error) {
    console.log(`🚪 Page check failed - likely closed: ${error.message}`);
    return { hasError: false, pageClosed: true, userNavigation: { action: 'page_closed' } };
  }
  
  try {
    // CLEAR ANY EXISTING INTERVALS AND LISTENERS TO PREVENT CONFLICTS
    console.log(`🧹 Clearing any existing controls for previous merchants...`);
    
    // Clear any existing intervals that might be running from previous merchants
    if (page._controlsInterval) {
      clearInterval(page._controlsInterval);
      page._controlsInterval = null;
    }
    
    // Clear any additional intervals that might be hanging around
    if (page._backupControlsInterval) {
      clearInterval(page._backupControlsInterval);
      page._backupControlsInterval = null;
    }
    
    // Clear cleanup timeouts
    if (page._controlsCleanupTimeout) {
      clearTimeout(page._controlsCleanupTimeout);
      page._controlsCleanupTimeout = null;
    }
    
    // Remove any existing event listeners more thoroughly
    page.removeAllListeners('load');
    page.removeAllListeners('domcontentloaded');
    page.removeAllListeners('framenavigated');
    page.removeAllListeners('response');
    page.removeAllListeners('requestfinished');
    
    // Set up persistent controls that survive page changes
    console.log(`🚀 Setting up floating controls for ${websiteName}...`);
    
    // Set up page event listeners to re-inject controls on any page change
    const setupPersistentControls = async () => {
      try {
        
        // Add listeners to re-inject controls on any page event (silent operation)
        page.on('load', async () => {
          try {
            await injectFloatingControls(page, websiteName, currentIndex, totalWebsites, websites, flaggedWebsites);
          } catch (e) { /* Silent - avoid log clogging */ }
        });
        
        page.on('domcontentloaded', async () => {
          try {
            await injectFloatingControls(page, websiteName, currentIndex, totalWebsites, websites, flaggedWebsites);
          } catch (e) { /* Silent - avoid log clogging */ }
        });
        
        page.on('framenavigated', async () => {
          try {
            await injectFloatingControls(page, websiteName, currentIndex, totalWebsites, websites, flaggedWebsites);
          } catch (e) { /* Silent - avoid log clogging */ }
        });
        
        // Initial injection
        await injectFloatingControls(page, websiteName, currentIndex, totalWebsites, websites, flaggedWebsites);
        
        // Always setup keyboard navigation as backup
        await setupKeyboardNavigation(page, websiteName, currentIndex, totalWebsites);
        
        console.log(`✅ Persistent controls setup complete for ${websiteName}`);
        
      } catch (error) {
        console.log(`❌ Failed to setup persistent controls for ${websiteName}: ${error.message}`);
      }
    };
    
    await setupPersistentControls();
    
    // Enhanced backup injection system with multiple fallbacks
    let controlsAttempts = 0;
    const maxControlsAttempts = 30; // Maximum attempts (5 minutes at 10-second intervals)
    
    page._controlsInterval = setInterval(async () => {
      try {
        controlsAttempts++;
        
        if (!page.isClosed()) {
          // Check if page is still navigable before injection
          try {
            await page.url(); // Test if page context is valid
            
            // Check if controls already exist and are functional
            const controlsExist = await page.evaluate(() => {
              try {
                const controls = document.getElementById('citishop-floating-controls') || 
                                document.getElementById('citishop-force-controls');
                return controls !== null;
              } catch (e) {
                // Even DOM access might be restricted
                return false;
              }
            }).catch(() => false);
            
            // Only inject if controls don't exist or attempts are low
            if (!controlsExist || controlsAttempts <= 3) {
              await injectFloatingControls(page, websiteName, currentIndex, totalWebsites, websites, flaggedWebsites);
              // Also refresh keyboard navigation periodically
              await setupKeyboardNavigation(page, websiteName, currentIndex, totalWebsites);
            }
            
          } catch (contextError) {
            // Page context invalid, skip this injection attempt
            // Don't spam with emergency controls
          }
        } else {
          clearInterval(page._controlsInterval);
          page._controlsInterval = null;
        }
        
        // Stop trying after max attempts
        if (controlsAttempts >= maxControlsAttempts) {
          console.log(`⚠️ Controls injection stopped after ${maxControlsAttempts} attempts for ${websiteName}`);
          clearInterval(page._controlsInterval);
          page._controlsInterval = null;
        }
        
      } catch (e) {
        clearInterval(page._controlsInterval);
        page._controlsInterval = null;
      }
    }, 10000);
    
    // Enhanced cleanup with more aggressive timeout
    const cleanupTimeout = setTimeout(() => {
      if (page._controlsInterval) {
        clearInterval(page._controlsInterval);
        page._controlsInterval = null;
      }
    }, 300000); // 5 minutes
    
    // Store cleanup reference for later cleanup
    page._controlsCleanupTimeout = cleanupTimeout;
    
    // Wait for the page to stabilize after injection (reduced timeout)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 1500 });
    } catch (e) {
      console.log(`⏳ Page load taking longer than expected, continuing anyway...`);
    }
    
    // Minimal wait for any dynamic content (reduced from 500ms to 200ms)
    await page.waitForTimeout(200);
    
    // Immediate check for error messages
    console.log(`🔍 Performing immediate scan of ${websiteName}...`);
    let errorResult = await checkForErrorMessages(page);
    
          if (errorResult.hasError) {
      console.log(`❌ Error detected on ${websiteName}: "${errorResult.message}"`);
      console.log(`⏳ Waiting 5 seconds before navigating back to allow review...`);
              await page.waitForTimeout(5000);
              
        console.log(`🔙 Navigating back to original website: ${originalUrl}`);
        
        try {
              await page.goto(originalUrl, { waitUntil: 'domcontentloaded' });
              await page.waitForTimeout(3000);
              console.log(`✅ Successfully navigated back to ${websiteName}`);
            } catch (navError) {
              console.log(`⚠️ Error navigating back to ${websiteName}: ${navError.message}`);
            }
            
            return { hasError: true, message: errorResult.message, navigatedBack: true };
    }
    
    // MANUAL NAVIGATION MODE ONLY - Wait for user commands
    console.log(`🎮 MANUAL NAVIGATION MODE for ${websiteName}`);
    console.log(`⏸️ Use the floating controls to navigate or flag this website`);
    console.log(`⌨️ KEYBOARD SHORTCUTS: ← Previous, → Next, F Flag, Q Stop, S Copy Successful, G Copy Flagged, C Mark Successful`);
    console.log(`🔍 Script will wait here indefinitely for your manual navigation commands...`);
    
    // Simple user command monitoring loop - NO automatic progression
    while (true) {
      await page.waitForTimeout(500); // Check every 500ms for commands
      
      try {
        // Check if page was closed
        if (page.isClosed()) {
          console.log(`🚪 Testing page was closed - user needs to navigate manually`);
          return { hasError: false, pageClosed: true, userNavigation: { action: 'page_closed' } };
        }
        
        // Check for navigation commands from floating controls
        const navCommand = await checkNavigationCommands(page);
        if (navCommand) {
          console.log(`🎮 Navigation command received: ${navCommand.action}`);
          
          if (navCommand.action === 'previous' || navCommand.action === 'next') {
            console.log(`🔄 User requested navigation to website ${navCommand.targetIndex + 1}`);
            return { hasError: false, userNavigation: navCommand };
          } else if (navCommand.action === 'flag') {
            console.log(`🚩 User flagged ${navCommand.websiteName} for manual review`);
            if (flaggedWebsites) {
              // Check if this merchant is already flagged to avoid duplicates
              const isAlreadyFlagged = flaggedWebsites.some(flagged => flagged.name === navCommand.websiteName);
              
              if (!isAlreadyFlagged) {
                flaggedWebsites.push({
                  name: navCommand.websiteName,
                  url: originalUrl,
                  flaggedBy: 'manual',
                  timestamp: new Date().toISOString(),
                  page: page
                });
                console.log(`✅ ${navCommand.websiteName} added to flagged websites list`);
                
                // Store flagged state in browser localStorage for immediate UI feedback
                try {
                  await page.evaluate((merchantName) => {
                    const flaggedMerchants = JSON.parse(localStorage.getItem('citishop-flagged-merchants') || '[]');
                    if (!flaggedMerchants.includes(merchantName)) {
                      flaggedMerchants.push(merchantName);
                      localStorage.setItem('citishop-flagged-merchants', JSON.stringify(flaggedMerchants));
                    }
                  }, navCommand.websiteName);
                } catch (e) {
                  console.log(`⚠️ Could not update browser storage for flag state: ${e.message}`);
                }
              } else {
                console.log(`♻️ ${navCommand.websiteName} already flagged - not adding duplicate`);
              }
            }
            // Continue waiting - flagging doesn't move to next site
          } else if (navCommand.action === 'stop_testing') {
            console.log(`🛑 User requested to stop testing via close button`);
            return { hasError: false, userNavigation: { action: 'stop_testing' } };
          } else if (navCommand.action === 'copy_successful_merchants') {
            console.log(`📋 User requested to copy successful merchants only`);
            console.log(`📊 Current stats: ${successfulMerchants.length} successful, ${flaggedWebsites.length} flagged`);
            // Copy only successful merchants to clipboard
            const successfulNames = successfulMerchants.filter(merchant => 
              !flaggedWebsites.some(flagged => flagged.name === merchant.name)
            ).map(merchant => merchant.name).join('\n');
            
            if (successfulNames.trim().length === 0) {
              console.log(`⚠️ No successful merchants to copy yet`);
            } else {
              try {
                await page.evaluate((names) => {
                  return navigator.clipboard.writeText(names);
                }, successfulNames);
                console.log(`✅ Successfully copied ${successfulNames.split('\n').length} successful merchant names to clipboard`);
                console.log(`📋 Copied merchants:\n${successfulNames}`);
              } catch (e) {
                // Fallback: try alternative copy method
                try {
                  await page.evaluate((names) => {
                    const textArea = document.createElement('textarea');
                    textArea.value = names;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                  }, successfulNames);
                  console.log(`✅ Successfully copied ${successfulNames.split('\n').length} successful merchant names using fallback method`);
                  console.log(`📋 Copied merchants:\n${successfulNames}`);
                } catch (fallbackError) {
                  console.log(`❌ Failed to copy successful merchants: ${e.message}`);
                  console.log(`❌ Fallback copy also failed: ${fallbackError.message}`);
                }
              }
            }
            // Continue waiting - copying doesn't move to next site
          } else if (navCommand.action === 'copy_flagged_merchants') {
            console.log(`🚩 User requested to copy flagged merchants only`);
            console.log(`📊 Current stats: ${successfulMerchants.length} successful, ${flaggedWebsites.length} flagged`);
            // Copy only flagged merchants to clipboard
            const flaggedNames = flaggedWebsites.map(merchant => merchant.name).join('\n');
            
            if (flaggedNames.trim().length === 0) {
              console.log(`⚠️ No flagged merchants to copy yet`);
            } else {
              try {
                await page.evaluate((names) => {
                  return navigator.clipboard.writeText(names);
                }, flaggedNames);
                console.log(`✅ Successfully copied ${flaggedNames.split('\n').length} flagged merchant names to clipboard`);
                console.log(`📋 Copied flagged merchants:\n${flaggedNames}`);
              } catch (e) {
                // Fallback: try alternative copy method
                try {
                  await page.evaluate((names) => {
                    const textArea = document.createElement('textarea');
                    textArea.value = names;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                  }, flaggedNames);
                  console.log(`✅ Successfully copied ${flaggedNames.split('\n').length} flagged merchant names using fallback method`);
                  console.log(`📋 Copied flagged merchants:\n${flaggedNames}`);
                } catch (fallbackError) {
                  console.log(`❌ Failed to copy flagged merchants: ${e.message}`);
                  console.log(`❌ Fallback copy also failed: ${fallbackError.message}`);
                }
              }
            }
            // Continue waiting - copying doesn't move to next site
          } else if (navCommand.action === 'mark_current_successful') {
            console.log(`✅ User manually marked ${navCommand.websiteName} as successful`);
            
            // Check if already marked successful to avoid duplicates
            const isAlreadySuccessful = successfulMerchants.some(merchant => merchant.name === navCommand.websiteName);
            const isAlreadyFlagged = flaggedWebsites.some(flagged => flagged.name === navCommand.websiteName);
            
            if (!isAlreadySuccessful && !isAlreadyFlagged) {
              successfulMerchants.push({
                name: navCommand.websiteName,
                url: originalUrl,
                refreshDetected: false,
                pageClosed: false,
                manuallyMarked: true
              });
              console.log(`✅ ${navCommand.websiteName} marked as successful manually`);
            } else {
              console.log(`⚠️ ${navCommand.websiteName} already has a status - cannot mark as successful`);
            }
            // Continue waiting - marking doesn't move to next site
          }
        }
        
        // Check if user requested to stop
        if (shouldStopTest) {
          console.log(`🛑 Stop requested while waiting for user navigation`);
          return { hasError: false, userNavigation: { action: 'stop_requested' } };
        }
        
      } catch (error) {
        // Check if this is a page closed error
        if (error.message.includes('Target closed') || 
            error.message.includes('Protocol error') || 
            error.message.includes('Session closed') ||
            error.message.includes('Connection closed') ||
            error.message.includes('Page closed')) {
          console.log(`🚪 Page closed error detected: ${error.message}`);
          return { hasError: false, pageClosed: true, userNavigation: { action: 'page_closed' } };
        }
        // Continue waiting on other errors - silenced to avoid log clogging
      }
    }
    
  } catch (error) {
    console.log(`❌ Error in waitForPageAndCheckErrors: ${error.message}`);
    return { hasError: false };
  }

}

test.describe('CitiShop Multi-Website Test', () => {
  test('Test CitiShop extension on all websites', async () => {
    // Extended timeout for indefinite monitoring
    test.setTimeout(0); // No timeout - indefinite monitoring
    
    // Launch browser with CitiShop extension
    const pathToExtension = path.join('/Users/neiljones/Documents/CitiBuild 1.14');
    const userDataDir = path.join(__dirname, '..', 'browser-data', 'citishop-profile');
    
    console.log(`🔧 Extension path: ${pathToExtension}`);
    console.log(`🔧 User data dir: ${userDataDir}`);
    
    // Check if extension path exists
    if (!fs.existsSync(pathToExtension)) {
      console.log('❌ Extension path does not exist!');
      throw new Error(`Extension path not found: ${pathToExtension}`);
    }
    
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-popup-blocking',
        '--disable-notifications',
        '--enable-extensions',
        '--disable-extensions-file-access-check',
        '--allow-running-insecure-content',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-accelerated-2d-canvas',
        '--no-zygote',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        '--enable-features=NetworkService,NetworkServiceLogging',
        '--force-color-profile=srgb',
        '--disable-features=VizDisplayCompositor'
      ],
      viewport: { width: 1366, height: 768 }, // More common resolution
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    // All websites for comprehensive testing
    const websites = [
      { name: 'American Family Safety', url: 'https://www.americanfamilysafety.com' },
      { name: 'AmericanFlags.com', url: 'https://americanflags.com' },
      { name: 'anygolds', url: 'https://anygolds.com/' },
      { name: 'Artemest', url: 'https://artemest.com/' },
      { name: 'Aviya Mattress', url: 'https://www.aviyamattress.com' },
      { name: 'Big Poppa Smokers', url: 'https://www.bigpoppasmokers.com' },
      { name: 'BrightLocal', url: 'https://www.brightlocal.com' },
      { name: 'Cargo Works', url: 'https://www.cargo-works.com' },
      { name: 'Cate & Chloe', url: 'https://www.cateandchloe.com' },
      { name: 'Chelsea Charles Jewelry', url: 'https://www.chelseacharles.com' },
      { name: 'ClickInks.com', url: 'https://www.clickinks.com' },
      { name: 'Contour Living', url: 'https://www.contourliving.com' },
      { name: 'Covers And All', url: 'https://www.coversandall.com/' },
      { name: 'DialMyCalls.com', url: 'https://www.dialmycalls.com' },
      { name: 'Elite Jewels Inc.', url: 'https://www.elitejewels.com' },
      { name: 'FLEXIMOUNTS', url: 'https://www.fleximounts.com/' },
      { name: 'Food Huggers Inc', url: 'https://foodhuggers.com' },
      { name: 'FrostNYC', url: 'https://frostnyc.com/' },
      { name: 'Gaia', url: 'https://www.gaia.com' },
      { name: 'GardeniaJewel', url: 'https://www.gardeniajewel.com' },
      { name: 'Giant Bomb', url: 'https://www.giantbomb.com' },
      { name: 'GlobeIn', url: 'https://globein.com' },
      { name: 'Gracious Style', url: 'https://www.graciousstyle.com' },
      { name: 'Green Bean Buddy', url: 'https://www.greenbeanbuddy.com' },
      { name: 'Groupmail Ltd.', url: 'https://www.group-mail.com' },
      { name: 'Half Price Drapes', url: 'https://www.halfpricedrapes.com/' },
      { name: 'Hidden24 VPN', url: 'https://www.hidden24.com' },
      { name: 'Home Air Check/Prism Analytical Technologies', url: 'https://www.homeaircheck.com' },
      { name: 'HughesNet', url: 'https://www.hughesnet.com/cj-program' },
      { name: 'Ink4Less', url: 'https://ink4less.com' },
      { name: 'InkPlusToner.com', url: 'https://www.InkPlusToner.com' },
      { name: 'Sok It', url: 'https://sok-it.com/' },
      { name: 'KitchenAid', url: 'https://www.kitchenaid.com/' },
      { name: 'Kitchen Universe', url: 'https://www.Kitchen-Universe.com' },
      { name: 'Lavender Fields', url: 'https://www.lavenderfieldsonline.com' },
      { name: 'LED Equipped', url: 'https://www.ledequipped.com/' },
      { name: 'LEDMALL.COM', url: 'https://www.ledmall.com' },
      { name: 'Zone - Mason Zone', url: 'https://www.MasonZone.com' },
      { name: 'Modern Artisans', url: 'https://www.modernartisans.com' },
      { name: 'Next Big Idea Club', url: 'https://www.nextbigideaclub.com' },
      { name: 'NOMATIC.com', url: 'https://www.nomatic.com' },
      { name: 'olive + piper', url: 'https://www.oliveandpiper.com' },
      { name: 'PalmBeach Jewelry', url: 'https://www.PalmBeachJewelry.com' },
      { name: 'Pride Shack', url: 'https://www.PrideShack.com' },
      { name: 'Public Goods', url: 'https://publicgoods.com' },
      { name: 'Puffy Mattress', url: 'https://puffy.com' },
      { name: 'Rockford Collection', url: 'https://www.rockfordcollection.com' },
      { name: 'Rubber Chicken Cards', url: 'https://www.rubberchickencards.com' },
      { name: 'SaloonBox', url: 'https://saloonbox.com' },
      { name: 'SANSI LED LIGHTING INC.', url: 'https://www.sansiled.com' },
      { name: 'Self-Counsel Press', url: 'https://www.self-counsel.com' },
      { name: 'Seller Savings Direct', url: 'https://sellersavingsdirect.com' },
      { name: 'Shirtframe / Shart.com', url: 'https://www.shart.com' },
      { name: 'Gessato', url: 'https://shop.gessato.com' },
      { name: 'The Solist', url: 'https://www.thesolist.com' },
      { name: 'Sizzlefish', url: 'https://www.sizzlefish.com' },
      { name: 'Starlight Lighting', url: 'https://starlightlighting.ca/' },
      { name: 'StoneTileDepot', url: 'https://www.stonetiledepot.com' },
      { name: 'Storq Inc', url: 'https://storq.com' },
      { name: 'Tulsa Body Jewelry', url: 'https://www.tulsabodyjewelry.com' },
      { name: 'US Jewelry Factory', url: 'https://www.usjewelryfactory.com' },
      { name: 'V4ink', url: 'https://www.v4ink.com/' },
          ];
    
    // Fisher-Yates shuffle algorithm to randomize website order
    function shuffleArray(array) {
      const shuffled = [...array]; // Create a copy to avoid mutating original
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    
    // Randomize the website order for this test run
    const randomizedWebsites = shuffleArray(websites);
    
         console.log(`🚀 CitiShop multi-website test - ${randomizedWebsites.length} websites (randomized order)\n`);
         console.log(`🔀 Today's random order:`);
         randomizedWebsites.forEach((site, index) => {
           console.log(`   ${index + 1}. ${site.name}`);
         });
         

         
         console.log('');
         console.log(`⏹️  Press CTRL+C to stop the test early (or close terminal)\n`);
    
    // Variable to track if user wants to stop the test
    let shouldStopTest = false;
    let completedWebsites = 0;
    let openMerchantTabs = []; // Track merchants that have errors and stay open
    let successfulMerchants = []; // Track merchants that loaded successfully
    let flaggedWebsites = []; // Track manually flagged websites
    let citiCookies = []; // Store Citi authentication cookies
    
    // Function to show final summary regardless of how test ends
    const showFinalSummary = () => {
      console.log(`\n${'='.repeat(70)}`);
      if (shouldStopTest) {
        console.log(`🛑 CITISHOP TEST STOPPED EARLY`);
        console.log(`📊 Websites tested before stopping: ${completedWebsites}/${randomizedWebsites.length}`);
      } else {
        console.log(`🎉 CITISHOP MULTI-WEBSITE TEST COMPLETED!`);
        console.log(`📊 All ${randomizedWebsites.length} websites tested successfully!`);
      }
      
      console.log(`\n📊 FINAL RESULTS SUMMARY:`);
      console.log(`✅ Successful merchants: ${successfulMerchants.length}`);
      console.log(`❌ Merchants with errors (tabs kept open): ${openMerchantTabs.length}`);
      console.log(`🚩 Manually flagged merchants (tabs kept open): ${flaggedWebsites.length}`);
      console.log(`📋 Total processed: ${completedWebsites}/${randomizedWebsites.length}`);
      console.log(`🔐 Citi session: ${citiCookies.length > 0 ? 'Preserved throughout testing' : 'Not detected'}`);
      
      if (successfulMerchants.length > 0) {
        console.log(`\n✅ SUCCESSFUL MERCHANTS (${successfulMerchants.length}):`);
        successfulMerchants.forEach((merchant, index) => {
          const status = merchant.refreshDetected ? ' 🔄' : 
                        merchant.pageClosed ? ' 🚪' : 
                        merchant.manualNavigation ? ' 🎮' : 
                        merchant.finalWebsite ? ' 🏁' : 
                        merchant.manuallyMarked ? ' 👆' : ' ✨';
          console.log(`   ${index + 1}. ${merchant.name}${status}`);
        });
      }
      
      if (openMerchantTabs.length > 0) {
        console.log(`\n❌ MERCHANTS WITH ERRORS - TABS LEFT OPEN (${openMerchantTabs.length}):`);
        openMerchantTabs.forEach((merchant, index) => {
          console.log(`   ${index + 1}. ${merchant.name} - "${merchant.error}"`);
        });
      }
      
      
      if (flaggedWebsites.length > 0) {
        console.log(`\n🚩 MANUALLY FLAGGED MERCHANTS - TABS LEFT OPEN (${flaggedWebsites.length}):`);
        flaggedWebsites.forEach((merchant, index) => {
          console.log(`   ${index + 1}. ${merchant.name} - flagged by user`);
        });
      }
      
      console.log(`${'='.repeat(70)}\n`);
      console.log(`✅ CitiShop test summary displayed - browser remains open for review`);
    };
    
    // Add global process listener for CTRL+C with graceful handling
    const stopHandler = () => {
      if (shouldStopTest) {
        // If already stopping, show summary and force exit
        console.log(`\n🚨 Force exit requested...`);
        console.log(`📊 Current progress when stopped: ${completedWebsites}/${randomizedWebsites.length} completed`);
        showFinalSummary();
        process.exit(0);
      } else {
        // First CTRL+C - set graceful stop
        console.log(`\n🛑 CTRL+C detected - will stop gracefully after current website...`);
        console.log(`📊 Current progress: ${completedWebsites}/${randomizedWebsites.length} completed | ✅ ${successfulMerchants.length} successful | ❌ ${openMerchantTabs.length} errors | 🚩 ${flaggedWebsites.length} flagged`);
        console.log(`⏳ Press CTRL+C again to force immediate exit with summary`);
        shouldStopTest = true;
      }
    };
    
    // Handle multiple exit scenarios with immediate handlers
    process.on('SIGINT', stopHandler);
    
    // Add immediate exit handlers that bypass normal flow
    const forceExit = (signal, reason) => {
      console.log(`\n💥 ${signal} - Force displaying final summary...`);
      if (reason) console.log(`Reason: ${reason}`);
      console.log(`📊 Current progress when force-stopped: ${completedWebsites}/${randomizedWebsites.length} completed`);
      console.log(`💪 Showing complete details of all processed merchants...`);
      try {
        showFinalSummary();
      } catch (e) {
        console.log(`Error displaying summary: ${e.message}`);
        // Show basic stats even if full summary fails
        console.log(`📊 Basic Stats: ✅ ${successfulMerchants.length} successful | ❌ ${openMerchantTabs.length} errors | 🚩 ${flaggedWebsites.length} flagged`);
      }
      process.exit(signal === 'SIGTERM' ? 0 : 1);
    };
    
    process.on('SIGTERM', () => forceExit('SIGTERM'));
    process.on('uncaughtException', (error) => forceExit('UNCAUGHT_EXCEPTION', error.message));
    process.on('unhandledRejection', (reason) => forceExit('UNHANDLED_REJECTION', reason));
    
    // Also handle browser/page crashes
    process.on('exit', (code) => {
      if (code !== 0) {
        console.log(`\n🚨 Process exiting with code ${code}`);
        // Can't call async functions in exit handler, but log the issue
      }
    });
    
    // Save initial Citi cookies (assuming user is already logged into CitiShop)
    console.log(`🔐 Saving Citi authentication cookies for session preservation...`);
    citiCookies = await saveCitiCookies(context);
    if (citiCookies.length > 0) {
      console.log(`✅ Citi session cookies saved - will preserve login between tests`);
    } else {
      console.log(`⚠️ No Citi cookies found - make sure you're logged into CitiShop first`);
    }
    console.log('');
    
    // Start with a single reusable tab
    console.log(`🆕 Creating initial tab for testing...`);
    let reusablePage = await context.newPage();
    
    // Visit each website in the same reusable tab
    for (let i = 0; i < randomizedWebsites.length; i++) {
      
      // Check if user requested to stop
      if (shouldStopTest) {
        console.log(`\n🛑 Test stopped by user request`);
        console.log(`📊 Completed ${i}/${randomizedWebsites.length} websites before stopping`);
        break;
      }
      const website = randomizedWebsites[i];
      const currentSite = i + 1;
      
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🌐 WEBSITE ${currentSite}/${randomizedWebsites.length}: ${website.name}`);
      console.log(`🔗 ${website.url}`);
      

      
      console.log(`${'='.repeat(50)}\n`);
      
      // Refresh cookies before EVERY test while preserving Citi session
      console.log(`🔄 Refreshing cookies for fresh test while preserving Citi login...`);
      await refreshCookiesKeepCiti(context, citiCookies);
      await new Promise(resolve => setTimeout(resolve, 300)); // Ultra-reduced delay
      
      // Reuse the existing tab instead of creating new ones
      const page = reusablePage;
      console.log(`♻️ Reusing existing tab for ${website.name}...`);
      
      // Additional cookie clearing and stealth setup for this specific page
      console.log(`🧹 Clearing any residual cookies for this tab...`);
      try {
        await page.evaluate(() => {
          // Clear all browser storage for this page while preserving citishop controls state
          if (typeof localStorage !== 'undefined') {
            // Preserve citishop control settings
            const citishopCroutonCollapsed = localStorage.getItem('citishop-crouton-collapsed');
            const citishopFlaggedMerchants = localStorage.getItem('citishop-flagged-merchants');
            
            localStorage.clear();
            
            // Restore citishop control settings
            if (citishopCroutonCollapsed !== null) {
              localStorage.setItem('citishop-crouton-collapsed', citishopCroutonCollapsed);
            }
            if (citishopFlaggedMerchants !== null) {
              localStorage.setItem('citishop-flagged-merchants', citishopFlaggedMerchants);
            }
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
          }
          // Clear any IndexedDB if accessible
          if (typeof indexedDB !== 'undefined') {
            try {
              indexedDB.databases().then(databases => {
                databases.forEach(db => {
                  if (db.name) {
                    indexedDB.deleteDatabase(db.name);
                  }
                });
              });
            } catch (e) {
              // Ignore IndexedDB errors
            }
          }
          
          // Anti-detection measures
          try {
            // Remove webdriver property
            delete navigator.__proto__.webdriver;
            
            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
              get: () => [1, 2, 3, 4, 5],
            });
            
            // Override languages
            Object.defineProperty(navigator, 'languages', {
              get: () => ['en-US', 'en'],
            });
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
          } catch (e) {
            // Ignore stealth errors
          }
        });
      } catch (e) {
        console.log(`⚠️ Note: Could not clear all storage types for ${website.name}`);
      }
      
      // Handle uncaught exceptions for this page
      page.on('pageerror', (error) => {
        // Suppress common browser security warnings and third-party errors that don't affect functionality
        if (error.message.includes('interest-cohort') || 
            error.message.includes('Permissions Policy') ||
            error.message.includes('browsingTopics') ||
            error.message.includes('EquallyAi is not a constructor') ||
            error.message.includes('accessibility') ||
            error.message.includes('a11y') ||
            error.message.includes('widget') ||
            error.message.includes('third-party') ||
            error.message.includes('analytics') ||
            error.message.includes('gtag') ||
            error.message.includes('google') ||
            error.message.includes('facebook') ||
            error.message.includes('twitter') ||
            error.message.includes('_satellite') ||
            error.message.includes('Adobe') ||
            error.message.includes('jQuery') ||
            error.message.toLowerCase().includes('script error')) {
          // Silently ignore these common third-party and accessibility widget errors
          return;
        }
        console.log('Page error:', error.message);
        // Don't fail the test on page errors
      });
      
      // No need for individual page keyboard listeners - using CTRL+C instead
      
      try {
        // Navigate to website
        console.log(`🚀 Navigating to ${website.name}...`);
        try {
          await page.goto(website.url, { waitUntil: 'domcontentloaded' });
        } catch (gotoError) {
          console.log(`⚠️ Navigation issue for ${website.name}: ${gotoError.message}`);
          console.log(`🔄 Continuing with monitoring anyway...`);
        }
        
        // Wait for initial page load
        console.log(`⏳ Waiting for ${website.name} initial load...`);
        try {
          await page.waitForLoadState('domcontentloaded');
        } catch (loadError) {
          console.log(`⚠️ Load state timeout for ${website.name}, continuing anyway...`);
        }
        await page.waitForTimeout(500); // Wait much less for redirects/updates
        
        console.log(`✅ ${website.name} initial load completed!`);
        console.log(`📋 Website ${currentSite}/${randomizedWebsites.length}: ${website.name}`);
        
        // Check for and handle CitiShop login redirects
        const loginRedirectHandled = await handleCitiShopLoginRedirect(page);
        if (loginRedirectHandled) {
          console.log(`🔄 Login redirect was handled, continuing with ${website.name}...`);
        }
        
        // Skip Cloudflare detection for faster loading
        console.log(`⚡ Skipping Cloudflare detection for faster page loading...`);
        

        // Check for error messages automatically
        console.log(`🔍 Checking for error messages on ${website.name}...`);
        
        const errorCheck = await waitForPageAndCheckErrors(page, website.name, website.url, i, randomizedWebsites.length, randomizedWebsites, flaggedWebsites, successfulMerchants, openMerchantTabs);
        
        // Handle user navigation commands or page closure
        if (errorCheck.userNavigation) {
          const nav = errorCheck.userNavigation;
          
          if (nav.action === 'page_closed' || nav.action === 'error_in_monitor') {
            console.log(`🚪 Page for ${website.name} was closed - stopping test completely`);
            console.log(`🛑 User closed the tab - ending test session...`);
            shouldStopTest = true;
            break; // Exit the main loop
          } else if (nav.action === 'stop_testing') {
            console.log(`🛑 User requested to stop testing via close button`);
            console.log(`🔚 Ending test session...`);
            
            // Update the stop button to show it's actually stopped
            try {
              await page.evaluate(() => {
                if (window.updateStopButtonStatus) {
                  window.updateStopButtonStatus('stopped');
                }
              });
            } catch (e) {
              // Silently ignore if page context is unavailable
            }
            
            shouldStopTest = true;
            break; // Exit the main loop
          } else if (nav.action === 'previous' || nav.action === 'next') {
            console.log(`🎮 User navigation: ${nav.action} to website ${nav.targetIndex + 1}`);
            
            // Before navigating away, mark current website as successful (if not already flagged/errored)
            const isAlreadyFlagged = flaggedWebsites.some(flagged => flagged.name === website.name);
            const hasError = openMerchantTabs.some(error => error.name === website.name);
            
            console.log(`🔍 Navigation Debug: ${website.name} - flagged: ${isAlreadyFlagged}, error: ${hasError}`);
            
            if (!isAlreadyFlagged && !hasError) {
              // Check if this merchant is already in the successful list to avoid duplicates
              const isAlreadySuccessful = successfulMerchants.some(merchant => merchant.name === website.name);
              
              if (!isAlreadySuccessful) {
                console.log(`✅ Marking ${website.name} as successful (navigated manually without issues)`);
                successfulMerchants.push({
                  name: website.name,
                  url: website.url,
                  refreshDetected: false,
                  pageClosed: false,
                  manualNavigation: true
                });
              } else {
                console.log(`♻️ ${website.name} already tested - not adding duplicate to successful list`);
              }
            } else {
              console.log(`⚠️ NOT marking ${website.name} as successful - it has another status`);
              if (isAlreadyFlagged) console.log(`   - Already flagged by user`);
              if (hasError) console.log(`   - Has error status`);
            }
            
            // Update the loop index to jump to the target website
            i = nav.targetIndex - 1; // -1 because the loop will increment
            console.log(`🔄 Jumping to website ${nav.targetIndex + 1}: ${randomizedWebsites[nav.targetIndex].name}`);
          } else {
            // For other navigation actions, continue current loop iteration
            continue;
          }
          continue;
        }
        
        if (errorCheck.hasError) {
          // Error detected - keep this tab open and track it
          console.log(`❌ ERROR DETECTED: ${website.name} - "${errorCheck.message}"`);
          if (errorCheck.navigatedBack) {
            console.log(`✅ Tab has been navigated back to original ${website.name} website`);
          }
          console.log(`🔗 Keeping ${website.name} tab open for review`);
          
                      // Check if this merchant is already in the error list to avoid duplicates
            const isAlreadyInErrorList = openMerchantTabs.some(merchant => merchant.name === website.name);
            
            if (!isAlreadyInErrorList) {
              console.log(`📝 Adding ${website.name} to error merchants list`);
          openMerchantTabs.push({
            name: website.name,
            url: website.url,
            error: errorCheck.message,
            navigatedBack: errorCheck.navigatedBack || false,
            page: page // Keep reference to the page
          });
            } else {
              console.log(`♻️ ${website.name} already in error list - not adding duplicate`);
            }
          
          console.log(`\n📋 RUNNING LIST OF MERCHANTS WITH ERRORS:`);
          openMerchantTabs.forEach((merchant, index) => {
            const backStatus = merchant.navigatedBack ? ' (navigated back)' : '';
            console.log(`   ${index + 1}. ${merchant.name} - "${merchant.error}"${backStatus}`);
          });
          console.log('');
          
          // Create a new reusable tab for the next website since this one has errors
          console.log(`🆕 Creating new tab for next website (current tab kept for error review)...`);
          reusablePage = await context.newPage();
          
        } else {
          // No error detected - keep this tab open but DO NOT auto-mark as successful
          const refreshStatus = errorCheck.refreshDetected ? 'with page refresh' : 
                               errorCheck.pageClosed ? 'page closed manually' : 'no refresh detected';
          console.log(`✅ ${website.name} loaded successfully - ${refreshStatus}`);
          console.log(`⏸️ Waiting for manual navigation (use Next button or keyboard → to mark as successful)`);
          
          console.log(`♻️ Keeping ${website.name} tab open for next website...`);
          // Keep the page open for reuse - do NOT close it
        }
        
        // Only count unique merchants tested, not revisits
        const allTestedMerchants = [
          ...successfulMerchants.map(m => m.name),
          ...openMerchantTabs.map(m => m.name),
          ...flaggedWebsites.map(m => m.name)
        ];
        
        // Only count unique merchants
        const uniqueTestedCount = new Set(allTestedMerchants).size;
        completedWebsites = uniqueTestedCount;
        
        // Show simple progress after each merchant
        console.log(`\n📈 PROGRESS: ${completedWebsites}/${randomizedWebsites.length} completed | ✅ ${successfulMerchants.length} successful | ❌ ${openMerchantTabs.length} errors | 🚩 ${flaggedWebsites.length} flagged\n`);
        
      } catch (error) {
        // Check if this is a timeout error that we should ignore
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          console.log(`⚠️ Timeout error on ${website.name} - this is expected with indefinite monitoring`);
          console.log(`🔄 Continuing to monitor ${website.name}...`);
          
          // Don't count this as an error - continue monitoring this website
          try {
            const errorCheck = await waitForPageAndCheckErrors(page, website.name, website.url, i, randomizedWebsites.length, randomizedWebsites, flaggedWebsites, successfulMerchants, openMerchantTabs);
            
            // Check for page closure in fallback handling too!
            if (errorCheck.userNavigation && (errorCheck.userNavigation.action === 'page_closed' || errorCheck.userNavigation.action === 'stop_testing')) {
              console.log(`🚪 Page closed or stop requested during fallback monitoring - stopping test completely`);
              
              // Update the stop button to show it's actually stopped if it was a stop request
              if (errorCheck.userNavigation.action === 'stop_testing') {
                try {
                  await page.evaluate(() => {
                    if (window.updateStopButtonStatus) {
                      window.updateStopButtonStatus('stopped');
                    }
                  });
                } catch (e) {
                  // Silently ignore if page context is unavailable
                }
              }
              
              shouldStopTest = true;
              break;
            }
            
            if (errorCheck.hasError) {
              console.log(`❌ ERROR DETECTED: ${website.name} - "${errorCheck.message}"`);
              if (errorCheck.navigatedBack) {
                console.log(`✅ Tab has been navigated back to original ${website.name} website`);
              }
              console.log(`🔗 Keeping ${website.name} tab open for review`);
              
              openMerchantTabs.push({
                name: website.name,
                url: website.url,
                error: errorCheck.message,
                navigatedBack: errorCheck.navigatedBack || false,
                page: page
              });
            } else {
              const refreshStatus = errorCheck.refreshDetected ? 'with page refresh' : 
                                   errorCheck.pageClosed ? 'page closed manually' : 'no refresh detected';
              console.log(`✅ ${website.name} loaded successfully - ${refreshStatus}`);
              console.log(`⏸️ Waiting for manual navigation (use Next button or keyboard → to mark as successful)`);
              
              console.log(`♻️ Keeping ${website.name} tab open for next website...`);
              // Keep the page open for reuse - do NOT close it
            }
            
            completedWebsites++;
          } catch (monitorError) {
            console.log(`❌ Monitoring error for ${website.name}: ${monitorError.message}`);
            console.log(`⚠️ Skipping to next website...\n`);
          }
        } else {
          console.log(`❌ Non-timeout error testing ${website.name}: ${error.message}`);
          console.log(`⚠️ Continuing to next website automatically...\n`);
          
          // Quick delay for error visibility  
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Handle the last website completion if not already marked (even if manually stopped)
    if (randomizedWebsites.length > 0) {
      const lastWebsite = randomizedWebsites[randomizedWebsites.length - 1];
      console.log(`\n🏁 Checking completion status of final website: ${lastWebsite.name}`);
      console.log(`🔍 Debug: Current successful count: ${successfulMerchants.length}, flagged: ${flaggedWebsites.length}`);
      
      // Check if the last website was already processed
      const isLastAlreadySuccessful = successfulMerchants.some(merchant => merchant.name === lastWebsite.name);
      const isLastFlagged = flaggedWebsites.some(flagged => flagged.name === lastWebsite.name);
      
      console.log(`🔍 Debug: ${lastWebsite.name} status - successful: ${isLastAlreadySuccessful}, flagged: ${isLastFlagged}`);
      
      if (!isLastAlreadySuccessful && !isLastFlagged) {
        console.log(`✅ Final website ${lastWebsite.name} was not flagged - marking as successful`);
        successfulMerchants.push({
          name: lastWebsite.name,
          url: lastWebsite.url,
          refreshDetected: false,
          pageClosed: false,
          finalWebsite: true
        });
        
        // Update completion count
        const allTestedMerchants = [
          ...successfulMerchants.map(m => m.name),
          ...flaggedWebsites.map(m => m.name)
        ];
        completedWebsites = new Set(allTestedMerchants).size;
        
        console.log(`📊 Updated counts: ${completedWebsites}/${randomizedWebsites.length} completed | ✅ ${successfulMerchants.length} successful`);
      } else {
        console.log(`ℹ️ Final website ${lastWebsite.name} already has a status - no action needed`);
        if (isLastAlreadySuccessful) console.log(`   - Already marked as successful`);
        if (isLastFlagged) console.log(`   - Already flagged by user`);
      }
    }
    
         // Final summary
     console.log(`\n${'='.repeat(70)}`);
     if (shouldStopTest) {
       console.log(`🛑 CITISHOP TEST STOPPED EARLY`);
       console.log(`📊 Websites tested before stopping: ${completedWebsites}/${randomizedWebsites.length}`);
     } else {
       console.log(`🎉 CITISHOP MULTI-WEBSITE TEST COMPLETED!`);
       console.log(`📊 All ${randomizedWebsites.length} websites tested successfully!`);
     }
     
     console.log(`\n📊 FINAL RESULTS SUMMARY:`);
     console.log(`✅ Successful merchants: ${successfulMerchants.length}`);
     console.log(`🚩 Manually flagged merchants: ${flaggedWebsites.length}`);
     console.log(`📋 Total processed: ${completedWebsites}/${randomizedWebsites.length}`);
     console.log(`🔐 Citi session: ${citiCookies.length > 0 ? 'Preserved throughout testing' : 'Not detected'}`);
     
     // Filter out any flagged websites from successful list (should not happen, but safety check)
     const trueSuccessfulMerchants = successfulMerchants.filter(merchant => 
       !flaggedWebsites.some(flagged => flagged.name === merchant.name)
     );
     
     if (trueSuccessfulMerchants.length > 0) {
       console.log(`\n✅ SUCCESSFUL MERCHANTS (${trueSuccessfulMerchants.length}):`);
       trueSuccessfulMerchants.forEach((merchant, index) => {
         console.log(`   ${index + 1}. ${merchant.name} - ${merchant.url}`);
       });
     }
     
     // Log any double-counted merchants for debugging
     const doubleCountedMerchants = successfulMerchants.filter(merchant => 
       flaggedWebsites.some(flagged => flagged.name === merchant.name)
     );
     if (doubleCountedMerchants.length > 0) {
       console.log(`\n⚠️ DEBUG: Found ${doubleCountedMerchants.length} merchants that were both successful and flagged:`);
       doubleCountedMerchants.forEach(merchant => {
         console.log(`   - ${merchant.name} (should be ONLY in flagged list)`);
       });
     }
     
     
     
     if (flaggedWebsites.length > 0) {
       console.log(`\n🚩 MANUALLY FLAGGED MERCHANTS - TABS LEFT OPEN (${flaggedWebsites.length}):`);
       flaggedWebsites.forEach((merchant, index) => {
         console.log(`   ${index + 1}. ${merchant.name}`);
         console.log(`      URL: ${merchant.url}`);
         console.log(`      Flagged: ${merchant.flaggedBy} at ${new Date(merchant.timestamp).toLocaleTimeString()}`);
         console.log(`      Status: TAB KEPT OPEN FOR REVIEW`);
         console.log('');
       });
       
       console.log(`🔍 MANUAL FLAG REVIEW INSTRUCTIONS:`);
       console.log(`📋 ${flaggedWebsites.length} merchant tab(s) were manually flagged by user`);
       console.log(`🔗 Please review each tab to investigate the flagged issues`);
       console.log(`⚠️ These merchants may need special attention or have specific issues`);
     }
     
     if (openMerchantTabs.length === 0 && flaggedWebsites.length === 0) {
       console.log(`\n🎉 PERFECT RUN! All merchants loaded successfully with no errors or manual flags!`);
     }
     
     console.log(`${'='.repeat(70)}\n`);
     
     if (shouldStopTest) {
       console.log(`🛑 CitiShop test stopped by user request`);
     } else {
       console.log(`✅ CitiShop automated error detection test completed!`);
     }
     console.log(`ℹ️ Browser will remain open for review of any error tabs...`);
     
     // Remove the SIGINT listener
     process.off('SIGINT', stopHandler);
     
     // Keep browser open - DO NOT CLOSE AND DO NOT END TEST
     console.log(`🌐 Browser will remain open indefinitely for manual review...`);
     console.log(`🔗 You can manually close the browser when finished reviewing`);
     console.log(`♾️ Test will continue running indefinitely - press CTRL+C to stop`);
     
     // Keep the test running indefinitely
     console.log(`⏸️ Test completed but keeping process alive...`);
     while (true) {
       await new Promise(resolve => setTimeout(resolve, 10000));
       console.log(`♾️ Test still running... Press CTRL+C to stop`);
     }
     
     // This will never be reached
     // await context.close(); // Commented out to keep browser open
  });
}); 