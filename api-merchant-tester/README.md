# API Merchant Tester

A standalone web application for testing merchant websites using API data and Playwright automation.

## 🚀 Features

- **API Data Input**: Paste merchant JSON data directly into the interface
- **Smart Filtering**: Filter by App ID, category, and test status
- **Real Playwright Testing**: Automated browser testing with full website interaction
- **Live Results**: Real-time progress tracking and result updates
- **Website Preview**: Preview merchant websites during testing
- **Database Integration**: Automatic result storage and retrieval
- **User-Friendly UI**: Modern, responsive interface for non-technical users

## 📁 Files

### Frontend
- `merchant-tester.html` - Main UI interface
- `tester-styles.css` - Styling for the interface
- `tester-script.js` - Frontend JavaScript functionality

### Backend
- `tester-server.js` - Express.js backend server
- `api-test-runner.js` - Playwright test execution engine
- `api-merchant-tester.spec.js` - Playwright test specification

### Database
- `database/init_db.js` - SQLite database initialization and functions
- `database/merchant_tests.db` - SQLite database file
- `database/populate_merchants.js` - Script to populate merchant master data
- `setup-database.js` - Database setup utility

### Utilities
- `package.json` - Dependencies and scripts
- `start.sh` / `start.bat` - Cross-platform startup scripts
- `README.md` - This documentation

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Playwright Browsers
```bash
npx playwright install
```

### 3. Start the Server
```bash
npm start
```

### 4. Access the Interface
Open your browser to: http://localhost:3001

## 📖 How to Use

### 1. Input API Data
Paste your merchant JSON data in this format:
```json
{
  "Merchants": [
    {
      "AppID": 451,
      "MerchantID": 6745,
      "MerchantName": "Example Store",
      "MerchantDomains": ["example.com"],
      "PrimaryCategory": "Clothing & Apparel",
      "MaxRate": "1.875",
      "MaxRateKind": "PERCENTAGE"
    }
  ]
}
```

### 2. Apply Filters
- **App ID**: Select from available App IDs in your data
- **Category**: Filter by merchant category
- **Status**: View tested, successful, or flagged merchants
- **Limit**: Set maximum number of merchants to test

### 3. Validate Data
Click "Validate API Data" to:
- Parse and validate JSON structure
- Display merchant list with filtering options
- Populate App ID dropdown
- Show merchant count and categories

### 4. Start Testing
Click "Start Testing" to:
- Launch Playwright browser automation
- Test each merchant website automatically
- Save results to database
- Display live progress and results

### 5. Monitor Results
- **Live Stats**: Total tested, successful, flagged
- **Current Testing**: See which merchant is being tested
- **Website Preview**: Preview current merchant's website
- **Results Tabs**: View successful, flagged, and all results

## 🎯 Testing Features

### Automated Detection
- E-commerce functionality (cart, checkout, purchase)
- Pricing information
- Website availability
- Error patterns and timeouts

### Manual Controls
- **Pass Current**: Mark current merchant as successful
- **Pause Test**: Pause testing at any time
- **Preview Website**: View merchant website in modal
- **Stop Test**: End testing early

### Result Categories
- **Successful**: Website loads and appears functional
- **Flagged**: Website has issues (unavailable, errors, timeouts)
- **User Passed**: Manually marked as successful

## 🔧 Configuration

### Database Integration
The tester includes its own SQLite database:
- **Self-contained**: No external database dependencies
- **Automatic session tracking**: Each test run gets a unique session
- **Detailed result storage**: Full merchant data and test results
- **Historical test data**: View past test sessions and results
- **Master merchant data**: Store and query merchant information from API
- **Export capabilities**: Download results as CSV or view in dashboard

### Playwright Settings
- Headed browser mode for visibility
- 30-second action timeout
- 60-second navigation timeout
- Screenshot on failure
- Video recording on failure

## 📊 API Endpoints

- `GET /` - Main tester interface
- `GET /api/app-ids` - Get available App IDs
- `GET /api/merchant-results` - Get test results
- `POST /api/sessions` - Create test session
- `POST /api/start-test` - Start Playwright test
- `POST /api/merchant-results` - Save test result
- `GET /health` - Health check

## 🚨 Troubleshooting

### Test Not Starting
- Ensure Playwright browsers are installed: `npx playwright install`
- Check that port 3001 is available
- Verify database connection in main project

### No Results Showing
- Check browser console for errors
- Verify API data format is correct
- Ensure database is accessible

### Browser Not Opening
- Confirm Playwright is installed correctly
- Check system permissions for browser automation
- Try running test manually: `npm run test`

## 🔗 Integration

This tester integrates with the main merchant testing dashboard:
- Shared database for result storage
- Compatible session management
- Unified result viewing and analysis

## 📝 Development

### Start Development Server
```bash
npm run dev
```

### Run Tests Manually
```bash
npm run test        # Headed mode
npm run test-headless  # Headless mode
```

## 🎯 Use Cases

- **QA Testing**: Validate merchant website functionality
- **Bulk Validation**: Test hundreds of merchants efficiently  
- **API Integration**: Test merchants from external APIs
- **Non-Technical Users**: User-friendly interface for manual testing
- **Automated Monitoring**: Regular merchant health checks
