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

# Start with interactive menu
npm start

# You'll be prompted:
# 🎯 What do you want to test?
#   1. Cordless
#   2. Cordloop
#   3. Medium Cassette Valance
#   ... (9 options total)
#
# Select a number or press Enter to skip
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

### Using Interactive Mode

The easiest way to test different configurations:

1. Run `npm start`
2. Select from 9 pre-configured options
3. The tool validates the config and grid image exist
4. If missing, you get clear instructions on what to add

See [docs/INTERACTIVE-MODE.md](docs/INTERACTIVE-MODE.md) for complete guide.

### Available Configurations

- **Cordless** - Standard cordless blinds
- **Cordloop** - Continuous cord loop lift
- **Medium Cassette Valance** - Medium-sized cassette
- **Large Cassette Valance** - Large-sized cassette
- **Motorization** - Motorized lift option
- **Cordless 2 on 1** - Two blinds, one headrail
- **Cordloop 2 on 1** - Cord loop with 2-on-1
- **Large Cassette Valance 2 on 1** - Large cassette with 2-on-1
- **Motorization 2 on 1** - Motorized with 2-on-1

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
