// Purchase Automation Crouton Injector
// This script creates the floating crouton interface on websites

let purchaseCroutonContainer = null;
let isAutomationRunning = false;

function initializePurchaseCrouton() {
    if (purchaseCroutonContainer) {
        return; // Already initialized
    }

    createPurchaseCrouton();
    console.log('Purchase automation crouton initialized');
}

function createPurchaseCrouton() {
    // Create crouton container
    purchaseCroutonContainer = document.createElement('div');
    purchaseCroutonContainer.id = 'purchase-automation-crouton';
    purchaseCroutonContainer.innerHTML = `
        <div class="crouton-header">
            <h3>🛒 Smart Purchase Bot</h3>
            <button class="minimize-btn" onclick="window.purchaseAutomationToggle()" aria-label="Minimize">−</button>
        </div>
        <div class="crouton-content">
            <div class="form-group">
                <label for="category-input">Category</label>
                <input type="text" id="category-input" placeholder="Electronics, Clothing, Books..." />
            </div>
            <div class="price-range">
                <div class="form-group">
                    <label for="min-price">Min ($)</label>
                    <input type="number" id="min-price" min="0" step="0.01" placeholder="0" />
                </div>
                <div class="form-group">
                    <label for="max-price">Max ($)</label>
                    <input type="number" id="max-price" min="0" step="0.01" placeholder="100" />
                </div>
            </div>
            <button id="start-automation-btn" onclick="window.startPurchaseAutomation()">
                🚀 Start Shopping
            </button>
            <div id="automation-status" class="status-display">Ready to find the best deals...</div>
        </div>
    `;

    document.body.appendChild(purchaseCroutonContainer);
    
    // Load default settings
    loadDefaultSettings();
}

async function loadDefaultSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        const settings = result.settings || {};
        
        if (settings.defaultPriceRange) {
            document.getElementById('min-price').value = settings.defaultPriceRange.min || 0;
            document.getElementById('max-price').value = settings.defaultPriceRange.max || 100;
        }
    } catch (error) {
        console.error('Failed to load default settings:', error);
    }
}

function toggleCrouton() {
    if (!purchaseCroutonContainer) return;
    
    const content = purchaseCroutonContainer.querySelector('.crouton-content');
    const minimizeBtn = purchaseCroutonContainer.querySelector('.minimize-btn');
    
    if (!content || !minimizeBtn) return;
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        minimizeBtn.textContent = '−';
        minimizeBtn.setAttribute('aria-label', 'Minimize');
    } else {
        content.style.display = 'none';
        minimizeBtn.textContent = '+';
        minimizeBtn.setAttribute('aria-label', 'Expand');
    }
}

async function startPurchaseAutomation() {
    console.log('Start automation button clicked');
    
    if (isAutomationRunning) {
        console.log('Automation already running, returning');
        return;
    }

    const categoryInput = document.getElementById('category-input');
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const startBtn = document.getElementById('start-automation-btn');

    if (!categoryInput || !minPriceInput || !maxPriceInput || !startBtn) {
        console.error('Could not find required form elements');
        updateStatus('❌ Form elements not found', 'error');
        return;
    }

    const category = categoryInput.value.trim();
    const minPrice = parseFloat(minPriceInput.value) || 0;
    const maxPrice = parseFloat(maxPriceInput.value) || 1000;

    console.log('Form values:', { category, minPrice, maxPrice });

    if (!category) {
        updateStatus('❌ Please enter a category', 'error');
        return;
    }

    if (minPrice >= maxPrice) {
        updateStatus('❌ Min price must be less than max price', 'error');
        return;
    }

    isAutomationRunning = true;
    startBtn.disabled = true;
    
    try {
        updateStatus('🔍 Starting automation...', 'info');
        
        const config = {
            category,
            minPrice,
            maxPrice
        };

        console.log('Sending automation config:', config);

        // Execute automation directly on the current page
        await executeAutomationProcess(config);
        
        updateStatus('✅ Automation completed successfully!', 'success');

    } catch (error) {
        console.error('Automation error:', error);
        updateStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
        isAutomationRunning = false;
        startBtn.disabled = false;
    }
}

async function executeAutomationProcess(config) {
    const { category, minPrice, maxPrice } = config;
    
    try {
        updateStatus('🔍 Searching for category...', 'info');
        
        // Step 1: Find and navigate to category
        const categoryFound = await findAndNavigateToCategory(category);
        if (!categoryFound) {
            throw new Error(`Category "${category}" not found on this website`);
        }

        await wait(2000); // Wait for page to load
        updateStatus('💰 Filtering by price...', 'info');
        
        // Step 2: Apply price filters and sort by price
        await applyPriceFiltersAndSort(minPrice, maxPrice);

        await wait(2000);
        updateStatus('🛍️ Finding product in price range...', 'info');
        
        // Step 3: Find product within price range
        const product = await findProductInPriceRange(minPrice, maxPrice);
        if (!product) {
            throw new Error(`No products found between $${minPrice} and $${maxPrice}`);
        }

        updateStatus('🛒 Adding product to cart...', 'info');
        
        // Step 4: Add product to cart
        await addProductToCart(product);
        
        updateStatus('✅ Product added to cart successfully!', 'success');
        
        // Send results to background for tracking
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'purchaseComplete',
                results: {
                    timestamp: new Date().toISOString(),
                    website: window.location.hostname,
                    category: category,
                    priceRange: { min: minPrice, max: maxPrice },
                    orderDetails: {
                        productUrl: window.location.href,
                        orderPrice: product.price,
                        orderTax: null,
                        orderFees: null,
                        orderTotal: product.price
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Automation process error:', error);
        throw error;
    }
}

async function findAndNavigateToCategory(category) {
    console.log('Looking for category:', category);
    
    // Common category selectors for different e-commerce sites
    const categorySelectors = [
        // Navigation menus
        `nav a:contains("${category}")`,
        `.nav-item a:contains("${category}")`,
        `.menu-item a:contains("${category}")`,
        `.category a:contains("${category}")`,
        
        // Category links
        `a[href*="${category.toLowerCase()}"]`,
        `[data-category*="${category.toLowerCase()}"]`,
        
        // Dropdown menus
        `.dropdown a:contains("${category}")`,
        `.submenu a:contains("${category}")`,
        
        // Sidebar categories
        `.sidebar a:contains("${category}")`,
        `.categories a:contains("${category}")`
    ];

    // Try text-based search first
    const links = document.querySelectorAll('a');
    for (const link of links) {
        const linkText = link.textContent.toLowerCase().trim();
        const categoryLower = category.toLowerCase();
        
        if (linkText.includes(categoryLower) || categoryLower.includes(linkText)) {
            console.log('Found category link:', link.textContent, link.href);
            link.click();
            return true;
        }
    }

    // Try search functionality if category navigation fails
    return await searchForCategory(category);
}

async function searchForCategory(category) {
    console.log('Trying search for category:', category);
    
    const searchSelectors = [
        'input[type="search"]',
        'input[name="search"]',
        'input[placeholder*="search" i]',
        '.search-input',
        '#search',
        '[data-testid*="search"]'
    ];

    for (const selector of searchSelectors) {
        const searchInput = document.querySelector(selector);
        if (searchInput && searchInput.offsetParent !== null) { // Check if visible
            console.log('Found search input:', selector);
            
            searchInput.focus();
            searchInput.value = category;
            
            // Trigger input events
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Try to find and click search button
            const searchButton = findSearchButton(searchInput);
            if (searchButton) {
                searchButton.click();
            } else {
                // Try Enter key
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            }
            
            return true;
        }
    }

    return false;
}

function findSearchButton(searchInput) {
    // Look for search button near the input
    const parent = searchInput.parentElement;
    const searchButtons = [
        parent?.querySelector('button[type="submit"]'),
        parent?.querySelector('.search-button'),
        parent?.querySelector('[data-testid*="search"]'),
        document.querySelector('button:contains("Search")'),
        document.querySelector('.search-btn')
    ];

    return searchButtons.find(btn => btn && btn.offsetParent !== null);
}

async function applyPriceFiltersAndSort(minPrice, maxPrice) {
    console.log('Applying price filters:', minPrice, maxPrice);
    
    // Try to find price filter inputs
    const priceInputs = document.querySelectorAll('input[type="number"], input[name*="price"], input[placeholder*="price" i]');
    
    for (const input of priceInputs) {
        const placeholder = input.placeholder.toLowerCase();
        const name = input.name.toLowerCase();
        
        if (placeholder.includes('min') || name.includes('min')) {
            input.value = minPrice.toString();
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Set min price:', minPrice);
        } else if (placeholder.includes('max') || name.includes('max')) {
            input.value = maxPrice.toString();
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Set max price:', maxPrice);
        }
    }

    // Try to sort by price (low to high)
    const sortSelectors = [
        'select[name*="sort"]',
        '.sort-dropdown select',
        '[data-testid*="sort"] select',
        '.sort-select'
    ];

    for (const selector of sortSelectors) {
        const sortElement = document.querySelector(selector);
        if (sortElement) {
            const options = sortElement.querySelectorAll('option');
            for (const option of options) {
                const text = option.textContent.toLowerCase();
                if (text.includes('price') && (text.includes('low') || text.includes('asc') || text.includes('cheap'))) {
                    option.selected = true;
                    sortElement.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Applied price sort:', option.textContent);
                    break;
                }
            }
            break;
        }
    }
}

async function findProductInPriceRange(minPrice, maxPrice) {
    console.log('Finding products in range:', minPrice, maxPrice);
    
    const productSelectors = [
        '.product-item',
        '.product-card',
        '.product',
        '.item',
        '[data-testid*="product"]',
        '.listing-item',
        '.search-result'
    ];

    let products = [];

    // Find product containers
    for (const selector of productSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            products = Array.from(elements);
            console.log(`Found ${products.length} products using selector: ${selector}`);
            break;
        }
    }

    if (products.length === 0) {
        throw new Error('No products found on this page');
    }

    // Extract product information
    const productData = [];
    
    for (const product of products) {
        try {
            const priceElement = product.querySelector('.price, .cost, [data-testid*="price"], .amount, .price-current, .sale-price');
            const titleElement = product.querySelector('.title, .name, h2, h3, h4, [data-testid*="title"], .product-title');
            const linkElement = product.querySelector('a') || product;

            if (priceElement) {
                const priceText = priceElement.textContent.trim();
                const price = extractPrice(priceText);
                
                if (price && price >= minPrice && price <= maxPrice) {
                    productData.push({
                        element: product,
                        title: titleElement ? titleElement.textContent.trim() : 'Unknown Product',
                        price: price,
                        priceText: priceText,
                        link: linkElement
                    });
                    console.log('Found product in range:', { title: titleElement?.textContent, price, priceText });
                }
            }
        } catch (error) {
            console.log('Error processing product:', error);
        }
    }

    if (productData.length === 0) {
        throw new Error(`No products found in price range $${minPrice} - $${maxPrice}`);
    }

    // Sort by price and return the cheapest
    productData.sort((a, b) => a.price - b.price);
    console.log('Selected cheapest product:', productData[0]);
    
    return productData[0];
}

function extractPrice(text) {
    if (!text) return null;
    
    // Remove common currency symbols and extract number
    const cleanText = text.replace(/[^\d.,]/g, '');
    const match = cleanText.match(/(\d+(?:[.,]\d{2})?)/);
    
    if (match) {
        return parseFloat(match[1].replace(',', '.'));
    }
    
    return null;
}

async function addProductToCart(product) {
    console.log('Adding product to cart:', product.title);
    
    // Click on the product first to go to product page
    if (product.link && product.link.href) {
        product.link.click();
        await wait(3000); // Wait for product page to load
    } else {
        product.element.click();
        await wait(3000);
    }

    // Look for add to cart button
    const addToCartSelectors = [
        'button:contains("Add to Cart")',
        'button:contains("Add to Bag")',
        'button:contains("Buy Now")',
        '[data-testid*="add-to-cart"]',
        '.add-to-cart',
        '.btn-add-cart',
        'button[name*="add"]',
        '.addtocart-btn'
    ];

    // Try text-based search for add to cart buttons
    const buttons = document.querySelectorAll('button, input[type="submit"], a.btn');
    
    for (const button of buttons) {
        const buttonText = button.textContent.toLowerCase().trim();
        if (buttonText.includes('add to cart') || 
            buttonText.includes('add to bag') || 
            buttonText.includes('buy now') ||
            buttonText.includes('purchase')) {
            
            console.log('Found add to cart button:', buttonText);
            button.click();
            await wait(2000);
            return true;
        }
    }

    // Try selector-based search
    for (const selector of addToCartSelectors) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
            console.log('Found add to cart button via selector:', selector);
            button.click();
            await wait(2000);
            return true;
        }
    }

    throw new Error('Could not find add to cart button');
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('automation-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-display ${type}`;
    }
}

function displayResults(results) {
    const statusElement = document.getElementById('automation-status');
    if (statusElement && results.orderDetails) {
        const { orderPrice, orderTax, orderFees, orderTotal } = results.orderDetails;
        statusElement.innerHTML = `
            <div class="results-display">
                <h4>📊 Order Results</h4>
                <div class="result-item">
                    <span class="label">Product URL:</span>
                    <span class="value">${results.orderDetails.productUrl}</span>
                </div>
                <div class="result-item">
                    <span class="label">Order Price:</span>
                    <span class="value">$${orderPrice?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="result-item">
                    <span class="label">Order Tax:</span>
                    <span class="value">$${orderTax?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="result-item">
                    <span class="label">Order Fees:</span>
                    <span class="value">$${orderFees?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="result-item">
                    <span class="label">Order Total:</span>
                    <span class="value total">$${orderTotal?.toFixed(2) || 'N/A'}</span>
                </div>
            </div>
        `;
        statusElement.className = 'status-display success';
    }
}

// Listen for messages from content script
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'updateCroutonStatus':
                updateStatus(message.message, message.type);
                break;
            case 'displayResults':
                displayResults(message.results);
                break;
        }
    });
}

// Make functions available globally with unique names to avoid conflicts
window.initializePurchaseCrouton = initializePurchaseCrouton;
window.purchaseAutomationToggle = function() {
    console.log('Toggle button clicked');
    toggleCrouton();
};
window.startPurchaseAutomation = function() {
    console.log('Start automation called from window');
    startPurchaseAutomation();
};
