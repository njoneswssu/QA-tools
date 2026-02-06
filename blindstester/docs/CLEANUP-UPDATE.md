# Cleanup & Multi-Config Update

## ✅ Changes Made

### 1. Folder Organization

**Created 3 subdirectories:**
- `docs/` - All markdown documentation files (16 files)
- `debug-scripts/` - Debug and test helper scripts (16 files)
- `test-results/` - Test output files (JSON, grid, compact)

**Clean root directory now contains only:**
- `index.js` - Main test runner
- `test-data.js` - Default test data
- `grid-reporter.js` - Report generator
- `cli.js` - CLI helper
- `show-focus.js` - Show test scope
- `delete-results.js` - Clean up utility
- `README.md` - Project documentation
- `package.json` - Dependencies
- `configs/` - Configuration files

### 2. Test Strategy Updated

**Random Height Testing:**
- Now tests only **ONE random height** per width breakpoint
- Height is randomly selected between `maxHeight + 1` and `maxHeight + 20`
- More efficient than testing fixed heights (+1" and +10")

**Example:**
```
Testing width 112" (max height: 96")
   Note: Testing at 103" (randomly selected above max height)
```

### 3. Color Selection Fixed

**Correct Product Matching:**
- Product names are reversed for color matching
- Test data: "3% Catalina" → Searches for: "Catalina 3%"
- Only selects colors that match the exact product being tested
- Verifies color appears in "Review Your Selections"

**Example output:**
```
🎨 Selecting color for 3% Catalina...
  Looking for "Catalina 3%" color swatches...
  Total images with alt attribute: 150
    ✓ Match found: Catalina 3% Powder LS01401
    ✓ Match found: Catalina 3% Bone LS01402
  Found 6 "Catalina 3%" color swatch images
  Attempting to click color: Catalina 3% Powder LS01401
  ✓ Color CONFIRMED selected: Catalina 3% Powder LS01401
  ✓ Color appears in "Review Your Selections"
```

### 4. Delete All Results Feature

**Safe deletion with confirmation:**

```bash
# View what would be deleted
npm run clean-results

# Actually delete
npm run clean-results -- --force
```

**Safety features:**
- Shows number of files to delete
- Requires `--force` flag to actually delete
- Confirms deletion count

### 5. Multi-Configuration Support

**New config system for multiple test scenarios:**

**Structure:**
```
configs/
├── default-config.js     # Default configuration
├── example-config.js     # Template for new configs
├── grids/                # Grid images
│   └── default-grid.png
└── README.md             # Config documentation
```

**Usage:**
```bash
# Use default config
npm start

# Use custom config
npm start -- --config configs/my-config.js

# Override URL
npm start -- --config configs/my-config.js --url "https://..."
```

**Creating a new config:**

1. Add grid image to `configs/grids/`
2. Create new config file (copy `example-config.js`)
3. Extract test data from grid
4. Run tests with `--config` flag

**Config format:**
```javascript
export const config = {
  name: "My Custom Test",
  url: "https://...",
  gridImage: "grids/my-grid.png",
  testData: [
    {
      product: "3% Fabric Name",
      widthBreakpoints: [
        { width: 114, maxHeight: 132 },
        { width: 120, maxHeight: 90 }
      ]
    }
  ]
};
```

## 📊 Current Test Data

- **20 products** (all valid color names)
- **61 width breakpoints** (only where maxHeight < 144")
- **61 total tests** (1 random height per breakpoint)

## 🎯 Validation Logic

1. Navigate to configurator URL
2. Select mount type (inside/outside)
3. Enter dimensions (width and height)
4. **Select matching color swatch** (REQUIRED for validation)
5. Check if "Single" headrail is available
   - ✅ PASS: Single NOT available (properly blocked)
   - 🐛 BUG: Single IS available (should be blocked)

## 📝 New NPM Scripts

```bash
npm run focus           # Show test scope
npm run clean-results   # Delete results (with --force)
npm start              # Run default config
```

## 🚀 Ready for New Tests

To test a different configurator:
1. Get the configurator URL with `draftProductId`
2. Take a screenshot of the grid
3. Create a new config file in `configs/`
4. Extract the test data
5. Run: `npm start -- --config configs/your-config.js`
