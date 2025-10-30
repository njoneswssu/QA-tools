# API Merchant Tester

A standalone web application for testing merchant websites using API data and Playwright automation.

## 🚀 Features

- **API Data Input**: Paste merchant JSON data directly or use bulk API fetching
- **Bulk API Fetching**: Automatically fetch all pages from paginated APIs
- **Smart Filtering**: Filter by App ID, category, and test status
- **Real Playwright Testing**: Automated browser testing with full website interaction
- **Terminal-Style Logging**: Real-time terminal with color-coded progress updates
- **Live Results**: Real-time progress tracking and result updates with current merchant display
- **Shuffle Testing**: Option to randomize merchant testing order
- **Website Preview**: Preview merchant websites during testing
- **Database Integration**: Automatic result storage and retrieval with multi-App ID support
- **User-Friendly UI**: Modern, responsive interface with vibrant animations
- **Fast Loading**: Optimized page loading without freezing on large datasets

## 📁 Files

### Frontend
- `merchant-tester.html` - Main UI interface
- `tester-styles.css` - Styling for the interface
- `tester-script.js` - Frontend JavaScript functionality

### Backend
- `server.js` - Express.js backend server (consolidated)
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
- **Main Dashboard**: http://localhost:3000
- **API Merchant Tester**: http://localhost:3000/tester

## 📖 How to Use

### 1. Input API Data

#### Option A: Manual JSON Paste
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

#### Option B: Multi-Page JSON
For multiple pages, separate with `---`:
```
Page 1 JSON
---
Page 2 JSON
---
Page 3 JSON
```

#### Option C: Bulk API Fetch
Use the API URL field with `{page}` placeholder:
```
https://api.example.com/merchants?page={page}&pageSize=50
```
The system will automatically fetch all pages.

### 2. Apply Filters
- **App ID**: Select from available App IDs in your data
- **Category**: Filter by merchant category
- **Status**: View tested, successful, or flagged merchants
- **Limit**: Set maximum number of merchants to test

### 3. Configure Testing
- **Shuffle Order**: Check to randomize merchant testing order (recommended)
- **Save to Database**: Store processed merchants for future use
- **Load Stored Merchants**: Use previously saved merchant data

### 4. Start Testing
Click "Start Testing" to:
- Launch Playwright browser automation
- Test each merchant website automatically
- Save results to database
- Display live progress and results in terminal-style log

### 5. Monitor Results
- **Terminal Log**: Real-time color-coded progress with emojis and status indicators
- **Live Stats**: Total tested, successful, flagged with progress percentage
- **Current Testing**: See which merchant is being tested in real-time
- **Milestone Updates**: Progress notifications every 10 merchants
- **Results Tabs**: View successful, flagged, and all results
- **Dashboard Integration**: Navigate between tester and main dashboard

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
- **Real-time updates**: Current merchant tracking during testing
- **Multi-App ID support**: Same merchants can exist under different App IDs
- **Detailed result storage**: Full merchant data and test results
- **Historical test data**: View past test sessions and results
- **Master merchant data**: Store and query merchant information from API
- **Fast loading**: Optimized queries prevent UI freezing on large datasets
- **Export capabilities**: Download results as CSV or view in dashboard

### Playwright Settings
- Headed browser mode for visibility
- 30-second action timeout
- 60-second navigation timeout
- Screenshot on failure
- Video recording on failure

## 📊 API Endpoints

### Main Interface
- `GET /` - Main dashboard
- `GET /tester` - API merchant tester interface

### Data Management
- `GET /api/app-ids` - Get available App IDs
- `GET /api/stored-merchants` - Get stored merchant data
- `POST /api/store-merchants` - Store merchant data
- `GET /api/sessions` - Get test sessions
- `POST /api/sessions` - Create test session

### Testing
- `POST /api/start-test` - Start Playwright test
- `POST /api/stop-test` - Stop running test
- `GET /api/merchant-results` - Get test results
- `POST /api/merchant-results` - Save test result

### Utilities
- `POST /api/reset-database` - Reset all data
- `GET /api/stats` - Get testing statistics
- `GET /api/categories` - Get merchant categories

## 🚨 Troubleshooting

### Test Not Starting
- Ensure Playwright browsers are installed: `npx playwright install`
- Check that port 3000 is available
- Verify database connection and tables are created
- Check terminal log for error messages

### No Results Showing
- Check browser console for errors
- Verify API data format is correct
- Ensure database is accessible

### Browser Not Opening
- Confirm Playwright is installed correctly
- Check system permissions for browser automation
- Try running test manually: `npm run test`

## 🔗 Integration

This tester is fully integrated with the main merchant testing dashboard:
- **Unified Server**: Single server hosts both dashboard and tester
- **Shared Database**: Common SQLite database for all results
- **Navigation Links**: Easy switching between dashboard and tester
- **Compatible Sessions**: Seamless session management across interfaces
- **Unified Result Viewing**: View API test results in main dashboard

## 📝 Development

### Start Development Server
```bash
npm run dev
```

### Run Tests Manually
```bash
npm run test        # Original quick check test (headed)
npm run test-headless  # Original quick check test (headless)
npm run test-api    # API merchant test (headed)
npm run test-api-headless  # API merchant test (headless)
```

## 🎯 Use Cases

- **QA Testing**: Validate merchant website functionality with real browser automation
- **Bulk Validation**: Test thousands of merchants efficiently with optimized performance
- **API Integration**: Seamlessly test merchants from external APIs with bulk fetching
- **Multi-App Testing**: Support merchants across different App IDs without duplicates
- **Non-Technical Users**: User-friendly interface with terminal-style feedback
- **Automated Monitoring**: Regular merchant health checks with historical tracking
- **Real-Time Testing**: Live progress monitoring with current merchant display
- **Team Collaboration**: Shared dashboard for viewing and analyzing results
