# Merchant Test Results Dashboard

A comprehensive system for testing merchant websites and viewing results through a modern web dashboard.

## Features

### 🧪 Automated Testing
- **Website Availability Testing**: Automated checks for merchant website functionality
- **Smart Detection**: Identifies business models, e-commerce features, and availability patterns
- **User Controls**: Manual pass/fail controls with keyboard shortcuts and UI buttons
- **Real-time Progress**: Live progress tracking with checkpoints every 10 merchants
- **Error Handling**: Comprehensive timeout and network error detection

### 📊 Database Storage
- **SQLite Database**: Persistent storage of all test results
- **Session Management**: Track multiple test sessions with timestamps
- **Merchant Master Data**: Integration with merchant information (categories, rates, etc.)
- **Detailed Analytics**: Store comprehensive test analysis and reasoning

### 🎨 Modern Dashboard
- **Responsive UI**: Beautiful, mobile-friendly interface
- **Advanced Filtering**: Filter by status, category, date range, and search terms
- **Multiple Views**: Switch between table and card layouts
- **Real-time Stats**: Live statistics and success rates
- **Export Functionality**: Download results as CSV files
- **Detailed Modals**: In-depth view of individual test results

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database
```bash
npm run setup
```

This will:
- Install all Node.js dependencies
- Create the SQLite database with proper schema
- Populate merchant master data

### 3. Start the Dashboard
```bash
npm start
```

The dashboard will be available at: http://localhost:3000

### 4. Run Tests (Optional)
```bash
# Navigate to the e2e directory and run Playwright tests
cd e2e
npx playwright test website-quickcheck.spec.js --headed
```

## Project Structure

```
├── database/
│   ├── init_db.js              # Database schema and functions
│   ├── populate_merchants.js   # Merchant data population
│   └── merchant_tests.db       # SQLite database (created after setup)
├── frontend/
│   ├── index.html              # Main dashboard HTML
│   ├── styles.css              # Dashboard styling
│   └── script.js               # Frontend JavaScript
├── e2e/
│   └── website-quickcheck.spec.js  # Playwright test script (enhanced with DB)
├── server.js                   # Express server with API endpoints
├── package.json                # Node.js dependencies
└── README.md                   # This file
```

## Database Schema

### Test Sessions
- Session tracking with start/end times
- Summary statistics (total, successful, flagged, user-passed)
- Session status (running, completed, interrupted)

### Merchant Test Results
- Individual test results with detailed analysis
- Test status (success, flagged, user_passed)
- Error patterns and duration tracking
- Links to merchant master data

### Merchant Master Data
- Complete merchant information from your JSON data
- Categories, rates, images, and metadata
- Used for enhanced filtering and display

## API Endpoints

### GET /api/merchant-results
Get paginated merchant test results with filtering options.

**Query Parameters:**
- `session_id` - Filter by test session
- `status` - Filter by test status (success, flagged, user_passed)
- `category` - Filter by merchant category
- `search` - Search merchant names and URLs
- `date_from` / `date_to` - Date range filtering
- `page` / `limit` - Pagination

### GET /api/sessions
Get all test sessions with summary statistics.

### GET /api/categories
Get all available merchant categories for filtering.

### GET /api/stats
Get overall statistics across all tests.

### POST /api/sessions
Create a new test session.

### POST /api/merchant-results
Save a new merchant test result.

## Dashboard Features

### 📈 Statistics Dashboard
- **Total Tested**: Overall count of tested merchants
- **Successful**: Merchants that passed all checks
- **Flagged**: Merchants requiring manual review
- **User Passed**: Merchants manually approved by users

### 🔍 Advanced Filtering
- **Session Filter**: View results from specific test runs
- **Status Filter**: Filter by success/flagged/user-passed status
- **Category Filter**: Filter by merchant categories
- **Search**: Find merchants by name or URL
- **Date Range**: Filter by test date

### 📋 Multiple Views
- **Table View**: Detailed tabular data with sorting
- **Card View**: Visual card layout for easier browsing
- **Modal Details**: Comprehensive details for each merchant

### 📤 Export Options
- **CSV Export**: Download filtered results as CSV
- **Real-time Updates**: Refresh data without page reload

## Enhanced Test Script Features

The Playwright test script now includes:

### 🎮 User Controls
- **F8 / Ctrl+P**: Pause testing and download results
- **Ctrl+S**: Mark current site as successful (user pass)
- **UI Buttons**: Visual controls for pause and pass actions

### 📊 Progress Tracking
- **Checkpoints**: Progress reports every 10 merchants
- **Real-time Stats**: Success rates and flagging rates
- **Auto-download**: Results files every 50 merchants

### 💾 Database Integration
- **Automatic Saving**: All results saved to database
- **Session Tracking**: Each test run gets a unique session ID
- **Detailed Analysis**: Enhanced descriptions for all results

### 🔍 Smart Detection
- **Business Models**: Automatic detection of e-commerce patterns
- **Error Categorization**: Detailed timeout and network error analysis
- **Protection Systems**: Whitelist and brand protection logic

## Development

### Running in Development Mode
```bash
npm run dev
```

This uses nodemon for automatic server restarts during development.

### Database Management
```bash
# Reinitialize database
npm run init-db

# Repopulate merchant data
npm run populate-merchants
```

### Adding New Merchant Data
1. Update the merchant data in `database/populate_merchants.js`
2. Run `npm run populate-merchants` to update the database

## Troubleshooting

### Database Issues
- Ensure SQLite3 is properly installed: `npm install sqlite3`
- Check database file permissions in the `database/` directory
- Reinitialize database if corrupted: `npm run init-db`

### Test Script Issues
- Ensure Playwright is installed: `npx playwright install`
- Check that the database module path is correct in the test script
- Verify browser permissions for file downloads

### Dashboard Issues
- Check that the server is running on port 3000
- Verify API endpoints are responding: `curl http://localhost:3000/api/stats`
- Check browser console for JavaScript errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
