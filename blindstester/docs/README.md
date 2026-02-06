# Blinds Tester

CLI tool to test Home Depot blinds configurator max height constraints using Playwright automation.

## Overview

This tool tests the Home Depot custom blinds configurator to verify that it properly enforces maximum height constraints at different width breakpoints. It automates the configuration process and documents cases where the system allows heights exceeding the specified maximums.

## Installation

```bash
cd blindstester
npm install
```

## Usage

### Basic Usage

```bash
npm start
```

This will run tests on all products where max height is less than 144" (focus mode).

### Command Line Options

```bash
node index.js [options]
```

**Options:**

- `-u, --url <url>` - Configurator URL (default: provided draft URL)
- `-h, --headless` - Run in headless mode (default: false, shows browser)
- `-o, --output <file>` - Output file for results (default: `test-results-[timestamp].json`)
- `-f, --focus-only` - Only test products with max height < 144" (default: true)
- `-w, --width <width>` - Test specific width only
- `-p, --product <product>` - Test specific product only (partial match)

### Examples

**Test all products (including 144" max height):**
```bash
node index.js --no-focus-only
```

**Test specific product:**
```bash
node index.js -p "Newport"
```

**Test specific width:**
```bash
node index.js -w 72
```

**Run in headless mode:**
```bash
node index.js --headless
```

**Test specific product at specific width:**
```bash
node index.js -p "Catalina" -w 90
```

## How It Works

1. **Configuration Testing**: For each product and width breakpoint:
   - Navigates to the configurator
   - Selects inside/outside mount
   - Enters width (2" below breakpoint)
   - Tests three heights:
     - At max height (should work)
     - 1" over max (should be blocked)
     - 10" over max (should definitely be blocked)

2. **Validation Checks**:
   - Looks for error messages on the page
   - Checks if "Continue" button is enabled
   - Tests color and lift selection availability

3. **Bug Detection**: Documents cases where:
   - Height exceeds the specified maximum
   - No error messages are shown
   - User can proceed to next step

## Test Data

The tool tests against the grid data showing:
- Product names (e.g., "2% Cretella", "1% Newport")
- Width breakpoints (54", 72", 90", etc.)
- Maximum heights at each breakpoint

Focus is on products where max height is less than 144".

## Output

Results are saved to a JSON file containing:
- Total tests run
- Passed/failed counts
- Bug count (configurations that exceeded max height)
- Detailed results for each test including:
  - Product name
  - Width and height tested
  - Maximum height allowed
  - Errors found
  - Whether the system allowed exceeding max height

Console output provides real-time feedback with:
- ✅ Passed tests (correctly blocked invalid heights)
- 🐛 Bugs found (allowed heights over maximum)
- 📊 Summary report

## Example Output

```
🧪 Testing: 1% Newport @ 70" width (max height: 120", testing: 121")
  📌 Selecting mount type: inside
  📏 Entering dimensions: 70" x 121"
  🔍 Checking for validation errors...
  ✅ Checking if can proceed to next step...
  ⚠️  BUG FOUND: Allowed 121" when max is 120"

📊 TEST RESULTS SUMMARY
✅ Passed: 45
❌ Failed: 2
🐛 Bugs Found: 3
```

## Notes

- Tests run with a visible browser by default (add `--headless` to hide)
- Each test includes delays to allow for page loading and validation
- The tool attempts multiple selector strategies to find form elements
- Motorized options are selected when available
