const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { initDatabase } = require('./database/init');
const { testProduct } = require('./scrapers/lowes-tester');
const { chromium } = require('playwright');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Keep screenshots route for backward compatibility with old file-based screenshots
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Initialize database
let db;
try {
  db = initDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Track testing state
let testingState = {
  isRunning: false,
  shouldStop: false,
  currentProduct: null,
  totalProducts: 0,
  completedProducts: 0
};

// Load products from JSON file
function loadProducts() {
  try {
    const productsPath = path.join(__dirname, 'products.json');
    const productsData = fs.readFileSync(productsPath, 'utf8');
    return JSON.parse(productsData);
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
  try {
    const products = loadProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new product
app.post('/api/products', (req, res) => {
  try {
    const { name, url, model } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    const products = loadProducts();
    const newProduct = {
      id: Date.now().toString(),
      name,
      url,
      model: model || 'Unknown'
    };
    products.push(newProduct);

    const productsPath = path.join(__dirname, 'products.json');
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));

    res.json(newProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const products = loadProducts();
    const filtered = products.filter(p => p.id !== productId);

    const productsPath = path.join(__dirname, 'products.json');
    fs.writeFileSync(productsPath, JSON.stringify(filtered, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all test results
app.get('/api/test-results', (req, res) => {
  try {
    const { date } = req.query; // Optional date filter (YYYY-MM-DD format)
    
    let query = `
      SELECT 
        tr.*,
        p.name as product_name,
        p.url as product_url,
        p.model as product_model
      FROM test_results tr
      LEFT JOIN products p ON tr.product_id = p.id
    `;
    
    const params = [];
    if (date) {
      query += ` WHERE tr.test_date = ?`;
      params.push(date);
    }
    
    query += ` ORDER BY tr.test_date DESC, tr.created_at DESC`;

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching test results:', err);
        return res.status(500).json({ error: err.message });
      }

      // Convert screenshot data to URLs
      const results = rows.map(row => ({
        ...row,
        screenshot_url: row.screenshot_data 
          ? `/api/screenshots/${row.id}`
          : (row.screenshot_path ? `/screenshots/${row.screenshot_path}` : null),
        screenshot_data: undefined // Don't send base64 data in list (too large)
      }));

      res.json(results);
    });
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all test results
app.delete('/api/test-results/clear', (req, res) => {
  try {
    db.run('DELETE FROM test_results', (err) => {
      if (err) {
        console.error('Error clearing test results:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log('All test results cleared');
      res.json({ success: true, message: 'All test results cleared' });
    });
  } catch (error) {
    console.error('Error clearing test results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a single test result
app.delete('/api/test-results/:resultId', (req, res) => {
  try {
    const resultId = req.params.resultId;
    
    db.run('DELETE FROM test_results WHERE id = ?', [resultId], (err) => {
      if (err) {
        console.error('Error deleting test result:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`Test result ${resultId} deleted`);
      res.json({ success: true, message: 'Test result deleted' });
    });
  } catch (error) {
    console.error('Error deleting test result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get test results for a specific product
app.get('/api/test-results/product/:productId', (req, res) => {
  try {
    const productId = req.params.productId;
    const query = `
      SELECT * FROM test_results
      WHERE product_id = ?
      ORDER BY test_date DESC, created_at DESC
    `;

    db.all(query, [productId], (err, rows) => {
      if (err) {
        console.error('Error fetching test results:', err);
        return res.status(500).json({ error: err.message });
      }

      const results = rows.map(row => ({
        ...row,
        screenshot_url: row.screenshot_data 
          ? `/api/screenshots/${row.id}`
          : (row.screenshot_path ? `/screenshots/${row.screenshot_path}` : null),
        screenshot_data: undefined // Don't send base64 data in list
      }));

      res.json(results);
    });
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get screenshot by test result ID
app.get('/api/screenshots/:testId', (req, res) => {
  try {
    const testId = req.params.testId;
    
    db.get(`
      SELECT screenshot_data, screenshot_path FROM test_results WHERE id = ?
    `, [testId], (err, row) => {
      if (err) {
        console.error('Error fetching screenshot:', err);
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Screenshot not found' });
      }

      // If we have base64 data in database, use it
      if (row.screenshot_data) {
        const imageBuffer = Buffer.from(row.screenshot_data, 'base64');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', imageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        return res.send(imageBuffer);
      }

      // Fallback to file path for backward compatibility
      if (row.screenshot_path) {
        const screenshotPath = path.join(__dirname, 'screenshots', row.screenshot_path);
        if (fs.existsSync(screenshotPath)) {
          return res.sendFile(screenshotPath);
        }
      }

      res.status(404).json({ error: 'Screenshot not found' });
    });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get testing status
app.get('/api/test/status', (req, res) => {
  // Check if there's an active batch test running
  res.json({
    isRunning: testingState.isRunning || false,
    totalProducts: testingState.totalProducts || 0,
    completedProducts: testingState.completedProducts || 0,
    currentProduct: testingState.currentProduct || null
  });
});

// Stop testing
app.post('/api/test/stop', (req, res) => {
  testingState.shouldStop = true;
  console.log('\n🛑 Stop requested by user');
  res.json({ 
    success: true, 
    message: 'Stop request received. Testing will stop after current product completes.'
  });
});

// Get products ready for testing (returns product list with test links)
app.post('/api/test/prepare', (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs are required' });
    }

    const allProducts = loadProducts();
    const selectedProducts = allProducts.filter(p => productIds.includes(p.id));

    if (selectedProducts.length === 0) {
      return res.status(400).json({ error: 'No valid products selected' });
    }

    // Return products with test URLs
    const productsWithLinks = selectedProducts.map(product => ({
      id: product.id,
      name: product.name,
      model: product.model,
      url: product.url,
      testUrl: `/api/test/product/${product.id}`
    }));

    res.json({ 
      success: true, 
      products: productsWithLinks
    });
  } catch (error) {
    console.error('Error preparing test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test a single product endpoint removed - now using POST /api/test/product/:productId/run directly

// Run test for a product (POST endpoint) - attaches to existing Chrome or opens new tab
app.post('/api/test/product/:productId/run', async (req, res) => {
  try {
    const productId = req.params.productId;
    const allProducts = loadProducts();
    const product = allProducts.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Start testing in background - this will try to connect to existing Chrome first
    testSingleProduct(product)
      .then(async (result) => {
        if (result.success) {
          // Use local date instead of UTC to avoid day-behind issue
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const screenshotData = result.screenshot_data || null;
          
          db.run(`
            INSERT INTO test_results (
              product_id, product_name, product_url, model, test_date,
              width, height, color, original_price, promotional_price,
              promo_percentage, screenshot_path, screenshot_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            productId,
            result.product_name,
            result.product_url,
            result.model,
            today,
            result.width,
            result.height,
            result.color,
            result.original_price,
            result.promotional_price,
            result.promo_percentage,
            result.screenshot_path || null,
            screenshotData
          ], (err) => {
            if (err) {
              console.error('Error saving test result:', err);
            } else {
              console.log(`✅ Saved test result for ${result.product_name}`);
            }
          });
        }
      })
      .catch(error => {
        console.error('Error during product testing:', error);
      });

    res.json({ success: true, message: 'Test started - automation will run in background' });
  } catch (error) {
    console.error('Error starting product test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get test status for a product
app.get('/api/test/product/:productId/status', (req, res) => {
  // Simple status check - in a real implementation, you'd track this
  res.json({ completed: true });
});

// Test all selected products sequentially
app.post('/api/test/all', async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs are required' });
    }

    const allProducts = loadProducts();
    const selectedProducts = allProducts.filter(p => productIds.includes(p.id));

    if (selectedProducts.length === 0) {
      return res.status(400).json({ error: 'No valid products selected' });
    }

    // Start testing all products in background
    testAllProductsSequentially(selectedProducts)
      .then(() => {
        console.log(`✅ Completed testing all ${selectedProducts.length} products`);
      })
      .catch(error => {
        console.error('Error during batch testing:', error);
      });

    res.json({ 
      success: true, 
      message: `Testing started for ${selectedProducts.length} product(s)`,
      productCount: selectedProducts.length
    });
  } catch (error) {
    console.error('Error starting batch test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test all products sequentially (helper function)
async function testAllProductsSequentially(products) {
  const { testProduct } = require('./scrapers/lowes-tester');
  let browser = null;
  let context = null;
  let page = null;
  let connectedToExisting = false;

  // Set testing state
  testingState.isRunning = true;
  testingState.shouldStop = false;
  testingState.totalProducts = products.length;
  testingState.completedProducts = 0;
  testingState.currentProduct = null;

  try {
    // Connect to existing Chrome or launch new one
    const { chromium } = require('playwright');
    
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      connectedToExisting = true;
      console.log('   ✓ Connected to existing Chrome instance');
      
      const contexts = browser.contexts();
      if (contexts.length > 0) {
        context = contexts[0];
      } else {
        context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York',
          permissions: ['geolocation'],
          geolocation: { longitude: -74.006, latitude: 40.7128 },
          colorScheme: 'light',
          extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });
      }
      
      // Check if any existing pages contain lowes.com
      const pages = context.pages();
      let hasLowesPage = false;
      let lowesPage = null;
      
      for (const p of pages) {
        try {
          const url = p.url();
          if (url.includes('lowes.com')) {
            hasLowesPage = true;
            lowesPage = p;
            break;
          }
        } catch (e) {
          // Skip inaccessible pages
        }
      }
      
      if (hasLowesPage && lowesPage) {
        // Use existing Lowe's page
        page = lowesPage;
        console.log('   ✓ Using existing Lowe\'s page for sequential testing');
      } else {
        // No Lowe's page found - create new tab
        page = await context.newPage();
        console.log('   ✓ Created new tab for sequential testing (no Lowe\'s page found)');
      }
    } catch (cdpError) {
      // Launch new Chrome if connection fails
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run'
        ]
      });
      
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        geolocation: { longitude: -74.006, latitude: 40.7128 },
        colorScheme: 'light',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      page = await context.newPage();
    }

    // Add anti-detection scripts
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Test each product sequentially
    for (let i = 0; i < products.length; i++) {
      if (testingState.shouldStop) {
        console.log('\n🛑 Testing stopped by user');
        break;
      }

      const product = products[i];
      testingState.currentProduct = product.name;
      testingState.completedProducts = i;
      
      console.log(`\n[${i + 1}/${products.length}] Testing: ${product.name}`);
      
      try {
        const result = await testProduct(product, { 
          sharedPage: page, 
          sharedContext: context, 
          keepBrowserOpen: true // Don't close browser between products
        });
        
        if (result.success) {
          // Save result to database
          // Use local date instead of UTC to avoid day-behind issue
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const screenshotData = result.screenshot_data || null;
          
          db.run(`
            INSERT INTO test_results (
              product_id, product_name, product_url, model, test_date,
              width, height, color, original_price, promotional_price,
              promo_percentage, screenshot_path, screenshot_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            product.id,
            result.product_name,
            result.product_url,
            result.model,
            today,
            result.width,
            result.height,
            result.color,
            result.original_price,
            result.promotional_price,
            result.promo_percentage,
            result.screenshot_path || null,
            screenshotData
          ], (err) => {
            if (err) {
              console.error('Error saving test result:', err);
            } else {
              console.log(`✅ Saved test result for ${result.product_name}`);
            }
          });
        }
        
        testingState.completedProducts = i + 1;
        
        // Wait between products (except for the last one)
        if (i < products.length - 1 && !testingState.shouldStop) {
          const delay = 3000 + Math.random() * 2000;
          console.log(`   ⏳ Waiting ${(delay / 1000).toFixed(1)}s before next product...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ Error testing ${product.name}:`, error);
        testingState.completedProducts = i + 1;
      }
    }
  } finally {
    // Reset testing state
    testingState.isRunning = false;
    testingState.shouldStop = false;
    testingState.currentProduct = null;
    testingState.completedProducts = 0;
    testingState.totalProducts = 0;
    
    // Only close browser if we launched it (not if connected to existing)
    if (!connectedToExisting) {
      try {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
        console.log('   ✅ Browser closed');
      } catch (e) {
        // Ignore cleanup errors
      }
    } else {
      // If connected to existing Chrome, just close the page
      try {
        if (page) await page.close();
        console.log('   ✅ Tab closed');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Test a single product (helper function)
async function testSingleProduct(product) {
  console.log(`\n🚀 Starting test for: ${product.name}`);
  
  // Use the testProduct function from the scraper
  // It will create its own browser, test, and close
  const { testProduct } = require('./scrapers/lowes-tester');
  
  try {
    // Test the product - testProduct handles browser creation/cleanup
    const result = await testProduct(product, {});
    console.log(`✅ Completed test for: ${product.name}`);
    return result;
  } catch (error) {
    console.error(`❌ Error testing ${product.name}:`, error);
    return {
      success: false,
      product_name: product.name,
      product_url: product.url,
      model: product.model,
      error: error.message
    };
  }
}

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const queries = {
      totalTests: 'SELECT COUNT(*) as count FROM test_results',
      totalProducts: 'SELECT COUNT(*) as count FROM (SELECT DISTINCT product_id FROM test_results WHERE product_id IS NOT NULL)',
      avgPromoPercentage: 'SELECT AVG(promo_percentage) as avg FROM test_results WHERE promo_percentage IS NOT NULL',
      recentTests: 'SELECT COUNT(*) as count FROM test_results WHERE test_date >= date("now", "-7 days")'
    };

    Promise.all([
      new Promise((resolve, reject) => {
        db.get(queries.totalTests, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      new Promise((resolve, reject) => {
        db.get(queries.totalProducts, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      new Promise((resolve, reject) => {
        db.get(queries.avgPromoPercentage, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.avg || 0);
        });
      }),
      new Promise((resolve, reject) => {
        db.get(queries.recentTests, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      })
    ]).then(([totalTests, totalProducts, avgPromoPercentage, recentTests]) => {
      res.json({
        totalTests,
        totalProducts,
        avgPromoPercentage: parseFloat(avgPromoPercentage).toFixed(2),
        recentTests
      });
    }).catch(error => {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Lowe's Promotional Testing Dashboard running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
});

module.exports = { app, db };
