# 🎯 Blinds Tester - Home Depot Configurator Testing Tool

CLI tool to automate testing of the Home Depot custom blinds configurator and validate maximum height constraints.

## ✅ Status: FULLY WORKING

All issues have been fixed! The tool now successfully:
- ✅ Clicks mount type buttons (Inside/Outside)
- ✅ Selects width from dropdown (not text input!)
- ✅ Selects height from dropdown (not text input!)
- ✅ Selects colors
- ✅ Selects motorized lift options
- ✅ Detects validation errors
- ✅ Checks if configuration is allowed

**Key Fix:** Width and height are SELECT dropdowns (`#Width-Inches`, `#Height-Inches`), not text inputs!

## 🚀 Quick Start

```bash
cd blindstester
npm install

# Run quick test to verify setup
npm run test:quick

# Test specific dimensions manually
node manual-test.js 70 125 inside

# Run full test suite
npm start
```

## 📋 Commands

### Quick Test (Recommended First)
```bash
npm run test:quick
```
Tests one configuration (70" x 125") to verify everything works.

### Manual Testing
```bash
# Format: width height mount-type
node manual-test.js 70 125 inside
node manual-test.js 90 140 outside
```

### Full Test Suite
```bash
npm start                          # Test focus products (max height < 144")
node index.js -p "Newport"         # Test specific product
node index.js -w 72                # Test specific width
node index.js --headless           # Run without showing browser
npm run test:all                   # Test ALL products
```

### Using the CLI Helper
```bash
node cli.js quick                      # Quick test
node cli.js manual 70 125 inside       # Manual test
node cli.js full                       # Full suite
node cli.js product "Newport"          # Specific product
node cli.js width 72                   # Specific width
node cli.js help-examples              # Show examples
```

## 🎯 What It Tests

Based on your grid data, for each product and width breakpoint:

1. **At max height** - Should be accepted ✅
2. **1" over max** - Should be blocked if validation works ❌
3. **10" over max** - Should definitely be blocked ❌

### Example: Newport 1%
- Width: 70" (2" below breakpoint of 72")
- Test heights: 120" (max), 121" (+1), 130" (+10)

### Configuration Process
1. Navigate to configurator
2. Select inside/outside mount
3. Enter width and height
4. Select a color
5. Select motorized lift with rechargeable battery
6. Check for validation errors
7. Check if "Continue" button is enabled
8. Document results

## 📊 Test Data

Includes data from your grid with products:
- 2% Cretella, 2% Catalina
- 1% Catalina, 1% Newport
- 10% Solapur, 3% Melika
- 5% Kew West, 5% Solano, 5% Sonoma
- And 11 more products...

**Focus:** Products where max height < 144" at certain widths.

## 🐛 Bug Detection

Reports bugs when:
- Height exceeds the maximum specified in the grid
- No validation errors are shown
- User can still proceed to next step

Example Bug: "Allowed 131" height when max is 120" at 70" width"

## 📄 Output

### Console Output
Real-time colored feedback:
```
🧪 Testing: 1% Newport @ 70" width (max: 120", testing: 121")
  📌 Selecting mount type: inside
  ✓ Selected Inside Mount
  📏 Entering dimensions: 70" x 121"
  ✓ Entered width: 70"
  ✓ Entered height: 121"
  🎨 Selecting color...
  ✓ Selected color: Newport 1% Powder LS01001
  🔧 Selecting lift option...
  ✓ Selected Motorized lift
  ✓ Selected Rechargeable Battery
  🔍 Checking for validation errors...
  ⚠️  Found 1 potential errors/warnings
  ✅ Checking if can proceed...
  ⚠️  BUG FOUND: Allowed 121" when max is 120"
```

### JSON Report
Saves to `test-results-[timestamp].json`:
```json
{
  "total": 60,
  "passed": 55,
  "failed": 2,
  "bugs": 3,
  "results": [
    {
      "product": "1% Newport",
      "width": 70,
      "maxHeight": 120,
      "testHeight": 121,
      "allowedOverMax": true,
      "errors": [...],
      "canProceed": true
    }
  ]
}
```

## 🛠️ Technical Details

### Built With
- **Playwright** - Browser automation
- **Commander** - CLI interface  
- **Chalk** - Colored output
- **Node.js ES Modules**

### How It Works
1. Launches Chrome browser via Playwright
2. Iterates through all buttons to find correct elements
3. Scrolls elements into view before clicking
4. Validates visibility states before interaction
5. Checks both error messages and button states
6. Tests with motorized options as requested

### Recent Fixes
- ✅ Fixed mount type selection (now iterates through buttons)
- ✅ Fixed dimension entry (proper input identification)
- ✅ Fixed color selection (finds product code buttons)
- ✅ Fixed motorized lift selection (scrolls and finds buttons)
- ✅ Improved error detection (searches page text)
- ✅ Better proceed validation (checks CSS states)

## 📁 Project Structure

```
blindstester/
├── index.js           # Main test suite
├── test-data.js       # Grid data from image
├── quick-test.js      # Quick verification test
├── manual-test.js     # Manual dimension testing
├── inspect.js         # Page inspection tool
├── cli.js             # CLI helper
├── package.json       # Dependencies
├── README.md          # Full documentation
├── QUICKSTART.md      # Quick reference
├── SUMMARY.md         # Complete summary
└── FIXES.md           # What was fixed
```

## 🎬 Demo Flow

1. **Run quick test:**
   ```bash
   npm run test:quick
   ```
   Browser opens → navigates → selects options → shows results

2. **Test manually:**
   ```bash
   node manual-test.js 70 125 inside
   ```
   Tests your specific dimensions and shows if valid

3. **Full suite:**
   ```bash
   npm start
   ```
   Tests all products/breakpoints, generates report

## ⚠️ Notes

- Browser runs in **visible mode** by default (helps debug)
- Each test includes delays for page loading
- Motorized + rechargeable battery options are selected
- Screenshots saved during inspection
- Tests run sequentially (not parallel)

## 🎯 Next Steps

1. ✅ Verify installation: `npm run test:quick`
2. 🧪 Try manual test: `node manual-test.js 70 125 inside`
3. 🚀 Run full suite: `npm start`
4. 📊 Review results JSON file
5. 🐛 Document any bugs found

## 📖 Additional Documentation

- `QUICKSTART.md` - Quick reference guide
- `SUMMARY.md` - Complete feature summary
- `FIXES.md` - Technical details on fixes
- `README.md` - Full documentation

## 🔗 Test URL
https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389

---

**Ready to test!** Start with `npm run test:quick` to verify everything works.
