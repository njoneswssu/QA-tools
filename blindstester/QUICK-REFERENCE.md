# Quick Reference - Blinds Tester

## 🎯 Interactive Mode (New!)

The fastest way to run tests:

```bash
npm start

# You'll see a menu:
🎯 What do you want to test?
  1. Cordless
  2. Cordloop
  3. Medium Cassette Valance
  4. Large Cassette Valance
  5. Motorization
  6. Cordless 2 on 1
  7. Cordloop 2 on 1
  8. Large Cassette Valance 2 on 1
  9. Motorization 2 on 1

Selection: _
```

**Benefits:**
- ✅ Validates grid image exists
- ✅ Validates config file exists
- ✅ Clear instructions if anything is missing
- ✅ No need to remember command-line arguments

**Skip Interactive Mode:** Press Enter or use `--skip-interactive`

See [docs/INTERACTIVE-MODE.md](docs/INTERACTIVE-MODE.md) for details.

## 🚀 Common Commands

```bash
# Run with interactive menu
npm start

# Run all tests (skip interactive)
npm start -- --skip-interactive

# Run specific product
npm start -- -p "3% Catalina" --skip-interactive

# Run specific width  
npm start -- -w 114 --skip-interactive

# Show what will be tested
npm run focus

# Delete all results
npm run clean-results -- --force

# Use custom config directly
npm start -- --config configs/my-config.js
```

## 📁 Project Structure

```
blindstester/
├── index.js              # Main runner
├── test-data.js          # Default test data
├── configs/              # Configuration files
│   ├── default-config.js
│   ├── example-config.js
│   └── grids/           # Grid images
├── test-results/         # All test outputs
├── docs/                 # Documentation
└── debug-scripts/        # Debug utilities
```

## 🔧 Creating New Config

### Method 1: Interactive (Recommended)

1. Run `npm start`
2. Select the configuration you want
3. Follow the prompts to add missing files

### Method 2: Manual

1. **Get configurator URL** with `draftProductId`
2. **Take grid screenshot** → save to `configs/grids/your-config-grid.png`
3. **Copy example config**:
   ```bash
   cp configs/example-config.js configs/your-config.js
   ```
4. **Update config**:
   - Set name, url, gridImage
   - Extract testData from grid
5. **Add to interactive menu** (optional):
   - Edit `index.js`
   - Add entry to `TEST_CONFIGS` object
6. **Run**: `npm start` (then select from menu)

## 📊 Test Data Format

```javascript
{
  product: "3% Catalina",  // Must match color swatch names
  widthBreakpoints: [
    { width: 114, maxHeight: 132 },  // Tests at 112" width
    { width: 120, maxHeight: 90 }    // Tests at 118" width
  ]
}
```

**Important:**
- Product name format: "3% Catalina" (test data)
- Color alt text format: "Catalina 3% Powder" (on page)
- Tool automatically reverses the format for matching

## ✅ Test Results

**Files created per test run:**
- `test-results/[config]-[timestamp].json` - Full data
- `test-results/[config]-[timestamp]-grid.txt` - Grid format
- `test-results/[config]-[timestamp]-compact.txt` - Compact

**Result types:**
- ✅ PASS - Single headrail blocked (correct)
- 🐛 BUG - Single headrail available (incorrect)
- ❌ ERROR - Test failed to run
- ⚠️ UNEXPECTED - Unexpected behavior

## 🛑 Stopping Tests

- **Ctrl+C once** - Wait for current test, then save
- **Ctrl+C twice** - Force exit without saving

## 📋 Validation Logic

1. Select matching color swatch (required for proper validation)
2. Check if "Single" headrail button exists and is clickable
3. If Single NOT found → ✅ PASS (properly blocked)
4. If Single IS found → 🐛 BUG (should be blocked)
