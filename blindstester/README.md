# Blinds Max Height Tester

Automated testing tool for Home Depot custom blinds configurator to verify max height validation.

## 📁 Project Structure

```
blindstester/
├── index.js              # Main test runner
├── test-data.js          # Test data (products, widths, max heights)
├── grid-reporter.js      # Report generation
├── cli.js                # CLI helper
├── show-focus.js         # Show test scope
├── package.json          # Dependencies
│
├── docs/                 # Documentation files
│   ├── README-FINAL.md   # Complete documentation
│   ├── QUICKSTART.md     # Quick start guide
│   └── ...
│
├── debug-scripts/        # Debug and utility scripts
│   ├── inspect.js
│   ├── manual-test.js
│   ├── quick-test.js
│   └── ...
│
└── test-results/         # Test output (JSON, grid, compact)
    ├── test-results-*.json
    ├── test-results-*-grid.txt
    └── test-results-*-compact.txt
```

## 🚀 Quick Start

### Interactive Mode (Recommended)

```bash
# Install dependencies
npm install

# Start with 3-step interactive wizard
npm start

# Step 1: Choose lift type (Cordless, Cordloop, etc.)
# Step 2: Choose model (Roller, Solar, Cellular, etc.)
# Step 3: Choose brand (Home Depot or Lowe's)
# 
# The tool will:
# - Remember your configurator URL
# - Validate grid images exist
# - Validate config files exist
# - Guide you through any missing setup
```

### Command Line Mode

```bash
# Show what will be tested
npm run focus

# Run with default config
npm start -- --skip-interactive

# Test specific product
npm start -- -p "3% Catalina" --skip-interactive

# Test specific width
npm start -- -w 114 --skip-interactive

# Test with custom config
npm start -- --config configs/my-config.js

# Delete all test results
npm run clean-results -- --force
```

## 🔧 Multiple Configurations

### Using Enhanced Interactive Mode

The easiest way to test different configurations with a **3-step wizard**:

1. **Run** `npm start`
2. **Select lift type** - Cordless, Motorization, etc.
3. **Select model** - Roller, Cellular, Faux Wood, etc. (20 options)
4. **Select brand** - Home Depot or Lowe's
5. **Paste URL** (first time only - it's saved for future use!)
6. Tool validates everything and guides you through setup

The tool automatically:
- ✅ **Remembers URLs** - Saved in `configs/saved-configs.json`
- ✅ **Validates files** - Checks grid images and config files
- ✅ **Provides guidance** - Clear instructions for missing files
- ✅ **Generates names** - Consistent file naming automatically

See [docs/ENHANCED-INTERACTIVE-MODE.md](docs/ENHANCED-INTERACTIVE-MODE.md) for complete guide.

### Available Options

**Lift Types (9):** Cordless, Cordloop, Medium Cassette, Large Cassette, Motorization, and 2-on-1 variants

**Models (20):** Roller, Solar, Roman, Banded, Faux Wood, Real Wood, Verticals, Perceptions, Cellular (multiple types), Classic Value Faux Wood, Naturals, Sheer, Vertical Cellular, Panel, Riviera Select/Complete/Classic

**Brands (2):** Home Depot, Lowe's

### Creating New Configurations

You can create multiple configurations for different products or scenarios:

1. **Add grid image** to `configs/grids/` folder
2. **Create config file** (see `configs/example-config.js`)
3. **Run with config**: `npm start -- --config configs/your-config.js`

See `configs/README.md` for detailed instructions.

## 📊 How It Works

1. **Selects mount type** (inside/outside)
2. **Enters dimensions** (width and height)
3. **Selects matching color swatch** (required for validation)
4. **Checks if Single headrail is available**
   - ✅ PASS: Single NOT available (properly blocked)
   - 🐛 BUG: Single IS available (should be blocked)

## 🎯 Test Strategy

- Tests at **width - 2 inches** (before breakpoint)
- Tests at **one random height above max** (between max+1 and max+20)
- Only tests products where **max height < 144"**

## 📄 Output Files

Each test run creates 3 files in `test-results/`:
- **`.json`** - Complete test data
- **`-grid.txt`** - Human-readable grid format
- **`-compact.txt`** - Condensed grid format

## ⚙️ Options

```
-c, --config <path>     Use custom config file
-p, --product <name>    Test specific product only
-w, --width <width>     Test specific width only
-u, --url <url>         Override configurator URL
--no-focus-only         Test all products (including max height 144")
--headless              Run without visible browser
-h, --help              Show help
```

## 🗑️ Managing Results

```bash
# View what would be deleted
npm run clean-results

# Actually delete all results
npm run clean-results -- --force
```

## 🛑 Stopping Tests

Press **Ctrl+C** to gracefully stop tests:
- Waits for current test to complete
- Saves partial results
- Press Ctrl+C twice to force exit

## 📚 Documentation

See `docs/README-FINAL.md` for complete documentation.
