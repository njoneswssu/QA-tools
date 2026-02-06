# Blinds Tester - Complete Summary

## 🎯 Purpose
Automated CLI tool to test the Home Depot custom blinds configurator and validate that it properly enforces maximum height constraints at different width breakpoints.

## 📁 Location
`/Users/neil/playwrightautomation/blindstester/`

## 🚀 Quick Start

### Installation
```bash
cd blindstester
npm install
npx playwright install chromium
```

### Run Quick Test (Verify Setup)
```bash
npm run test:quick
```
This will test one configuration (70" x 125") and show you that all clicks are working.

### Test Manually with Custom Dimensions
```bash
node manual-test.js 70 130 inside
```
Format: `node manual-test.js [width] [height] [mount-type]`

### Run Full Test Suite
```bash
npm start
```
This tests all products where max height < 144" against their breakpoints.

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm run test:quick` | Quick verification test (70" x 125") |
| `node manual-test.js [w] [h] [mount]` | Test specific dimensions |
| `npm start` | Full test suite (focus products) |
| `node index.js -p "Newport"` | Test specific product |
| `node index.js -w 72` | Test specific width breakpoint |
| `node index.js --headless` | Run without showing browser |
| `npm run test:all` | Test ALL products (including 144") |

## 🧪 What It Tests

For each product and width breakpoint from your grid:
1. **At max height** - Should be accepted ✅
2. **1" over max** - Should be blocked ❌
3. **10" over max** - Should definitely be blocked ❌

### Test Process
1. Navigate to configurator
2. Select inside/outside mount
3. Enter width (2" below breakpoint as requested)
4. Enter height
5. Select a color
6. Select motorized lift option
7. Check for validation errors
8. Check if Continue button is enabled
9. Document results

## 📊 Test Data

The tool includes data from your grid image with products like:
- 2% Cretella (max heights: 144", 126", 126" at widths: 54", 90", 126")
- 1% Catalina (max heights: 144", 126", 126" at widths: 48", 72", 96")
- 1% Newport (max heights: 144", 120", 120" at widths: 48", 72", 102")
- ...and 17 more products

**Focus:** Products where max height is less than 144" at some breakpoints.

## 🐛 Bug Detection

The tool identifies bugs when:
- Height exceeds the specified maximum
- No error messages are displayed
- User can still proceed to the next step

## 📄 Output

### Console Output
Real-time feedback with color coding:
- 🔵 Blue: Navigation/progress
- 🟢 Green: Success
- 🟡 Yellow: Warnings
- 🔴 Red: Errors/bugs

### JSON Report
Automatically saves to `test-results-[timestamp].json` with:
```json
{
  "total": 60,
  "passed": 55,
  "failed": 2,
  "bugs": 3,
  "results": [...]
}
```

Each result includes:
- Product name
- Width and height tested
- Maximum height allowed
- Mount type
- Errors found
- Whether system allowed exceeding max
- Timestamp

## 🔧 Technical Details

### Built With
- **Playwright** - Browser automation
- **Commander** - CLI interface
- **Chalk** - Colored terminal output

### Key Features
- Iterates through all buttons to find correct elements
- Scrolls elements into view before clicking
- Checks visibility states
- Validates both error messages and button states
- Tests with motorized options as requested
- Handles dynamic page loading

### Fixed Issues
✅ Now properly clicks on mount type buttons
✅ Correctly enters width and height
✅ Successfully selects colors
✅ Selects motorized lift options
✅ Detects validation errors
✅ Checks if can proceed

## 📖 Files

- `index.js` - Main test suite runner
- `test-data.js` - Grid data from your image
- `quick-test.js` - Fast verification test
- `manual-test.js` - Test custom dimensions
- `inspect.js` - Page inspection tool
- `README.md` - Full documentation
- `QUICKSTART.md` - Quick reference
- `FIXES.md` - Details on what was fixed

## 💡 Examples

### Test Newport at 72" width
```bash
node index.js -p "Newport" -w 72
```

### Manually test if 131" height works at 70" width
```bash
node manual-test.js 70 131 inside
```

### Test with outside mount
```bash
node manual-test.js 90 140 outside
```

## 🎬 What You'll See

When running tests, you'll see:
1. Browser window opens (unless headless mode)
2. Page loads the configurator
3. Mount type is selected
4. Width and height are entered
5. Color is selected
6. Motorized option is selected
7. Validation is checked
8. Result is logged

For the full test suite, this repeats for all products/breakpoints and results are compiled into a report.

## ⚠️ Notes

- Tests run with visible browser by default (helps with debugging)
- Each test includes delays for page loading and validation
- Attempts multiple strategies to find elements
- Takes screenshot during inspection
- Keeps browser open during manual tests for inspection

## 🎯 Next Steps

1. Run quick test to verify: `npm run test:quick`
2. Try manual test: `node manual-test.js 70 125 inside`
3. Run full suite: `npm start`
4. Review results JSON file
5. Identify any bugs where max height was exceeded
