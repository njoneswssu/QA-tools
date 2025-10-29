// Purchase Automation Browser Extension Content Script
// Handles communication between the crouton and background script

class PurchaseAutomationContent {
    constructor() {
        this.isInitialized = false;
        this.automationRunning = false;
        
        this.initializeContentScript();
    }

    initializeContentScript() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Check if crouton should be auto-injected
        this.checkAutoInject();
        
        this.isInitialized = true;
        console.log('Purchase Automation content script initialized');
    }

    async checkAutoInject() {
        try {
            const result = await chrome.storage.local.get(['settings', 'automationState', 'targetMerchants']);
            const settings = result.settings || { autoInjectCrouton: true };
            const automationState = result.automationState || {};
            const targetMerchants = result.targetMerchants || [];
            
            console.log('Content script checking auto-inject:', {
                autoInject: settings.autoInjectCrouton,
                merchants: targetMerchants,
                currentUrl: window.location.href
            });
            
            if (settings.autoInjectCrouton && targetMerchants.length > 0) {
                // Check if current site is a target merchant
                const isTargetMerchant = this.isCurrentSiteTargetMerchant(targetMerchants);
                
                console.log('Is target merchant (content script):', isTargetMerchant);
                
                if (isTargetMerchant) {
                    console.log('Auto-injecting crouton from content script');
                    // Wait a bit for page to fully load
                    setTimeout(() => {
                        this.injectCrouton();
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Failed to check auto-inject:', error);
        }
    }

    isCurrentSiteTargetMerchant(targetMerchants) {
        try {
            const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
            
            return targetMerchants.some(merchant => {
                // Normalize merchant name - add .com if not present
                let normalizedMerchant = merchant.toLowerCase();
                if (!normalizedMerchant.includes('.')) {
                    normalizedMerchant = `${normalizedMerchant}.com`;
                }
                
                // Check exact match or if hostname contains merchant
                return hostname === normalizedMerchant || 
                       hostname.includes(normalizedMerchant) || 
                       normalizedMerchant.includes(hostname);
            });
        } catch (error) {
            console.error('Error checking if current site is target merchant:', error);
            return false;
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'executePurchaseAutomation':
                    await this.executePurchaseAutomation(message.config);
                    sendResponse({ success: true });
                    break;
                    
                case 'injectCrouton':
                    this.injectCrouton();
                    sendResponse({ success: true });
                    break;
                    
                case 'getCroutonStatus':
                    sendResponse({ 
                        success: true, 
                        injected: this.isCroutonInjected(),
                        running: this.automationRunning 
                    });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Content script message error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    injectCrouton() {
        if (this.isCroutonInjected()) {
            console.log('Crouton already injected');
            return;
        }

        try {
            // Create and inject the crouton script
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('crouton-injector.js');
            script.onload = () => {
                // Initialize the crouton after script loads
                if (window.initializePurchaseCrouton) {
                    window.initializePurchaseCrouton();
                }
                script.remove();
            };
            (document.head || document.documentElement).appendChild(script);

            console.log('Crouton injected successfully');
        } catch (error) {
            console.error('Failed to inject crouton:', error);
        }
    }

    isCroutonInjected() {
        return document.getElementById('purchase-automation-crouton') !== null;
    }

    async executePurchaseAutomation(config) {
        if (this.automationRunning) {
            throw new Error('Automation already running');
        }

        try {
            this.automationRunning = true;
            
            // Execute the automation using the injected crouton functions
            const results = await this.runAutomationProcess(config);
            
            // Send results to background script
            await chrome.runtime.sendMessage({
                action: 'purchaseComplete',
                results: results
            });
            
        } catch (error) {
            console.error('Purchase automation error:', error);
            
            // Send error to background script
            await chrome.runtime.sendMessage({
                action: 'purchaseError',
                error: { message: error.message, stack: error.stack }
            });
            
            throw error;
        } finally {
            this.automationRunning = false;
        }
    }

    async runAutomationProcess(config) {
        const { category, minPrice, maxPrice } = config;
        
        const results = {
            timestamp: new Date().toISOString(),
            website: window.location.hostname,
            category,
            priceRange: { min: minPrice, max: maxPrice },
            products: [],
            orderDetails: null,
            status: 'started'
        };

        try {
            // Step 1: Find and navigate to category
            this.updateCroutonStatus('🔍 Searching for category...', 'info');
            const categoryFound = await this.findAndNavigateToCategory(category);
            if (!categoryFound) {
                throw new Error(`Category "${category}" not found on this website`);
            }

            // Step 2: Apply price filters and sort
            this.updateCroutonStatus('💰 Filtering by price...', 'info');
            await this.applyPriceFiltersAndSort(minPrice, maxPrice);

            // Step 3: Find cheapest product
            this.updateCroutonStatus('🛍️ Finding cheapest product...', 'info');
            const product = await this.findCheapestProduct();
            if (!product) {
                throw new Error('No products found in the specified price range');
            }

            results.products.push(product);

            // Step 4: Add to cart and proceed to checkout
            this.updateCroutonStatus('🛒 Adding to cart...', 'info');
            await this.addToCartAndProceedToCheckout(product);

            // Step 5: Extract order details
            this.updateCroutonStatus('💳 Extracting order details...', 'info');
            const orderDetails = await this.extractOrderDetails();
            results.orderDetails = orderDetails;
            results.status = 'completed';

            this.updateCroutonStatus('✅ Automation completed successfully!', 'success');
            
            return results;
        } catch (error) {
            results.status = 'failed';
            results.error = error.message;
            this.updateCroutonStatus(`❌ Error: ${error.message}`, 'error');
            throw error;
        }
    }

    updateCroutonStatus(message, type) {
        // Update the crouton status if it exists
        const statusElement = document.getElementById('automation-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-display ${type}`;
        }
    }

    async findAndNavigateToCategory(category) {
        // Generic category finding logic
        const categorySelectors = [
            `a[href*="${category.toLowerCase()}"]`,
            `.category:contains("${category}")`,
            `.nav-item:contains("${category}")`,
            `[data-category*="${category.toLowerCase()}"]`,
            `.menu-item:contains("${category}")`
        ];

        for (const selector of categorySelectors) {
            try {
                const elements = document.querySelectorAll('a, .category, .nav-item, .menu-item');
                for (const element of elements) {
                    const text = element.textContent.toLowerCase();
                    if (text.includes(category.toLowerCase())) {
                        element.click();
                        await this.wait(2000);
                        return true;
                    }
                }
            } catch (error) {
                console.log(`Selector failed: ${selector}`, error);
            }
        }

        // Try search if category navigation fails
        return await this.searchForCategory(category);
    }

    async searchForCategory(category) {
        const searchSelectors = [
            'input[type="search"]',
            'input[name="search"]',
            'input[placeholder*="search"]',
            '.search-input',
            '#search'
        ];

        for (const selector of searchSelectors) {
            const searchInput = document.querySelector(selector);
            if (searchInput) {
                searchInput.focus();
                searchInput.value = category;
                
                // Trigger search
                const searchButton = document.querySelector('button[type="submit"]') || 
                                   document.querySelector('.search-button') ||
                                   document.querySelector('[data-testid="search-button"]');
                
                if (searchButton) {
                    searchButton.click();
                } else {
                    // Try Enter key
                    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
                    searchInput.dispatchEvent(enterEvent);
                }
                
                await this.wait(3000);
                return true;
            }
        }

        return false;
    }

    async applyPriceFiltersAndSort(minPrice, maxPrice) {
        // Try to find and apply price filters
        const priceFilterSelectors = [
            'input[name*="price"]',
            'input[data-testid*="price"]',
            '.price-filter input',
            '[data-filter="price"] input'
        ];

        // Apply min price
        for (const selector of priceFilterSelectors) {
            const minPriceInput = document.querySelector(selector + '[name*="min"], ' + selector + '[placeholder*="min"]');
            if (minPriceInput) {
                minPriceInput.value = minPrice.toString();
                minPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
                break;
            }
        }

        // Apply max price
        for (const selector of priceFilterSelectors) {
            const maxPriceInput = document.querySelector(selector + '[name*="max"], ' + selector + '[placeholder*="max"]');
            if (maxPriceInput) {
                maxPriceInput.value = maxPrice.toString();
                maxPriceInput.dispatchEvent(new Event('change', { bubbles: true }));
                break;
            }
        }

        // Try to sort by price low to high
        const sortSelectors = [
            'select[name*="sort"]',
            '.sort-dropdown',
            '[data-testid*="sort"]',
            '.sort-select'
        ];

        for (const selector of sortSelectors) {
            const sortElement = document.querySelector(selector);
            if (sortElement) {
                const options = sortElement.querySelectorAll('option');
                for (const option of options) {
                    const text = option.textContent.toLowerCase();
                    if (text.includes('price') && (text.includes('low') || text.includes('asc'))) {
                        option.selected = true;
                        sortElement.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
                break;
            }
        }

        await this.wait(2000);
    }

    async findCheapestProduct() {
        const productSelectors = [
            '.product-item',
            '.product-card',
            '.item',
            '[data-testid*="product"]',
            '.product',
            '.listing-item'
        ];

        let products = [];

        for (const selector of productSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                products = Array.from(elements);
                break;
            }
        }

        if (products.length === 0) {
            throw new Error('No products found on this page');
        }

        // Extract product information
        const productData = products.map(product => {
            const priceElement = product.querySelector('.price, .cost, [data-testid*="price"], .amount');
            const titleElement = product.querySelector('.title, .name, h2, h3, [data-testid*="title"]');
            const linkElement = product.querySelector('a') || product;

            const priceText = priceElement ? priceElement.textContent : '';
            const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

            return {
                element: product,
                title: titleElement ? titleElement.textContent.trim() : 'Unknown Product',
                price: price,
                priceText: priceText,
                link: linkElement.href || window.location.href
            };
        }).filter(p => p.price > 0);

        if (productData.length === 0) {
            throw new Error('No products with valid prices found');
        }

        // Sort by price and return the cheapest
        productData.sort((a, b) => a.price - b.price);
        return productData[0];
    }

    async addToCartAndProceedToCheckout(product) {
        // Click on the product to go to product page
        const productLink = product.element.querySelector('a');
        if (productLink) {
            productLink.click();
            await this.wait(3000);
        }

        // Find and click add to cart button
        const addToCartButtons = document.querySelectorAll('button, a');
        let addToCartButton = null;
        
        for (const button of addToCartButtons) {
            const text = button.textContent.toLowerCase();
            if (text.includes('add to cart') || text.includes('add to bag')) {
                addToCartButton = button;
                break;
            }
        }

        if (addToCartButton) {
            addToCartButton.click();
            await this.wait(2000);
        }

        // Proceed to checkout
        const checkoutButtons = document.querySelectorAll('button, a');
        let checkoutButton = null;
        
        for (const button of checkoutButtons) {
            const text = button.textContent.toLowerCase();
            if (text.includes('checkout')) {
                checkoutButton = button;
                break;
            }
        }

        if (checkoutButton) {
            checkoutButton.click();
            await this.wait(3000);
        }
    }

    async extractOrderDetails() {
        // Wait for checkout page to load
        await this.wait(2000);

        const orderDetails = {
            productUrl: window.location.href,
            orderPrice: null,
            orderTax: null,
            orderFees: null,
            orderTotal: null
        };

        // Extract price information using various selectors
        const priceSelectors = {
            orderPrice: ['.subtotal', '.order-subtotal', '[data-testid*="subtotal"]', '.item-price'],
            orderTax: ['.tax', '.order-tax', '[data-testid*="tax"]', '.tax-amount'],
            orderFees: ['.shipping', '.delivery-fee', '[data-testid*="shipping"]', '.handling-fee'],
            orderTotal: ['.total', '.order-total', '[data-testid*="total"]', '.grand-total']
        };

        for (const [key, selectors] of Object.entries(priceSelectors)) {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    orderDetails[key] = this.extractPrice(element.textContent);
                    break;
                }
            }
        }

        return orderDetails;
    }

    extractPrice(text) {
        if (!text) return null;
        const match = text.match(/\$?([0-9,]+\.?[0-9]*)/);
        return match ? parseFloat(match[1].replace(',', '')) : null;
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize content script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PurchaseAutomationContent();
    });
} else {
    new PurchaseAutomationContent();
}
