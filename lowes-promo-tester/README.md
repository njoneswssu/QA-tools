# Lowe's Promotional Testing Dashboard

A comprehensive dashboard for testing promotional pricing on Lowe's product pages. Automatically tests products by selecting random dimensions and colors, captures screenshots, and tracks promotional pricing information.

## Features

- 🎯 **Automated Product Testing**: Tests products by selecting random width (18-84"), height (16-84"), and colors
- 📸 **Screenshot Capture**: Takes full-page screenshots of configured products
- 💰 **Price Tracking**: Extracts and tracks original and promotional prices
- 📊 **Promo Percentage Calculation**: Automatically calculates promotional discount percentages
- 📅 **Test History**: Stores all test results with dates, models, and configurations
- 🔍 **Product Management**: Dropdown selector with search and check-all functionality
- 📈 **Dashboard Statistics**: View total tests, products tested, and average promo percentages

## Installation

1. **Install Dependencies**
   ```bash
   cd lowes-promo-tester
   npm install
   ```

2. **Install Playwright Browsers**
   ```bash
   npx playwright install chromium
   ```

3. **Add Products**
   
   Edit `products.json` to add your Lowe's product URLs:
   ```json
   [
     {
       "id": "1",
       "name": "Product Name",
       "url": "https://www.lowes.com/pd/product-url",
       "model": "Model-Name"
     }
   ]
   ```

## Usage

### Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The dashboard will be available at: **http://localhost:3001**

### Testing Products

1. Open the dashboard in your browser
2. Click the product dropdown to see available products
3. Use the search bar to filter products
4. Select products using checkboxes (or use "Check All")
5. Click "Start Testing" to begin automated testing
6. Results will appear automatically as tests complete

### Viewing Results

The dashboard displays:
- **Test Date**: When the test was performed
- **Model**: Product model name
- **Dimensions**: Selected width and height
- **Color**: Selected color option
- **Original Price**: Regular product price
- **Promotional Price**: Current promotional price
- **Promo Percentage**: Calculated discount percentage
- **Screenshot**: Click to view full-size screenshot

## Project Structure

```
lowes-promo-tester/
├── server.js                 # Main Express server
├── products.json             # Product list configuration
├── database/
│   ├── init.js              # Database initialization
│   └── lowes_promo_tests.db # SQLite database (auto-created)
├── scrapers/
│   └── lowes-tester.js      # Playwright testing logic
├── screenshots/             # Screenshot storage (auto-created)
└── public/
    ├── index.html           # Dashboard UI
    ├── styles.css           # Styling
    └── app.js               # Frontend JavaScript
```

## API Endpoints

- `GET /api/products` - Get all products
- `POST /api/products` - Add a new product
- `DELETE /api/products/:id` - Delete a product
- `GET /api/test-results` - Get all test results
- `GET /api/test-results/product/:productId` - Get results for a specific product
- `GET /api/screenshots/:testId` - Get screenshot image for a test result
- `POST /api/test/start` - Start testing selected products
- `GET /api/test/status` - Get current testing status
- `POST /api/test/stop` - Stop current testing
- `GET /api/stats` - Get dashboard statistics

## How It Works

1. **Product Selection**: User selects products from the dropdown
2. **Automated Testing**: For each selected product:
   - Navigates to the product page
   - Selects random width (18-84")
   - Selects random height (16-84")
   - Selects a random color option
   - Waits for prices to update
   - Extracts original and promotional prices
   - Calculates promo percentage
   - Takes a full-page screenshot (stored as base64 in database)
3. **Data Storage**: Results are saved to SQLite database with screenshots stored as base64 data
4. **Dashboard Display**: Results appear in real-time with all captured information

## Customization

### Adjusting Dimension Ranges

Edit `scrapers/lowes-tester.js` to change the random dimension ranges:

```javascript
// Width range (default: 18-84)
selectedWidth = Math.floor(Math.random() * (84 - 18 + 1)) + 18;

// Height range (default: 16-84)
selectedHeight = Math.floor(Math.random() * (84 - 16 + 1)) + 16;
```

### Changing Port

Set the `PORT` environment variable:

```bash
PORT=3002 npm start
```

## Notes

- **Web Scraping**: Be respectful of Lowe's website terms of service. The scraper includes delays to avoid overloading servers.
- **Selectors**: Website structure may change. You may need to update selectors in `scrapers/lowes-tester.js` if the page structure changes.
- **Screenshots**: Screenshots are stored in the database as base64-encoded data to save disk space. They are served via the `/api/screenshots/:testId` endpoint. Old file-based screenshots are still supported for backward compatibility.

## Troubleshooting

### Tests Not Finding Elements

- Check if Lowe's website structure has changed
- Verify product URLs are correct
- Check browser console for errors
- Update selectors in `scrapers/lowes-tester.js` if needed

### Prices Not Extracting

- Verify the product page has price information visible
- Check if price selectors need updating
- Some products may not have promotional pricing

### Screenshots Not Displaying

- Ensure the `screenshots/` directory exists and is writable
- Check that screenshots are being saved correctly
- Verify the `/screenshots` static route is working

## License

MIT
