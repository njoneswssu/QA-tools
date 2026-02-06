# Blinds Max Height Tester

Automated testing tool for Home Depot custom blinds configurator to verify max height validation.

## 📁 Project Structure

```
blindstester/
├── index.js              # Main test runner
├── create-config.js      # Config file generator
├── grid-reporter.js      # Report generation
├── package.json          # Dependencies
│
├── configs/              # Configuration files
│   ├── example-config.js # Example configuration
│   ├── saved-configs.json # Saved configurator URLs
│   └── README.md         # Config folder guide
│
├── docs/                 # Documentation
│   ├── HOW-TO-PASTE-GRID.md           # Paste grid guide
│   └── PARTIAL-SAVE-AND-2ON1-TESTING.md # Latest features
│
└── test-results/         # Test output (JSON, grid, compact)
    ├── test-results-*.json
    ├── test-results-*-grid.txt
    └── test-results-*-compact.txt
```

## 🚀 Quick Start

### Super Simple Setup (Just Paste Your Grid!)

```bash
# 1. Install dependencies
npm install

# 2. Run tests
npm start
#
#    Select: Lift type, model, brand
#    Paste: Configurator URL (first time)
#    Paste: Grid data from your spreadsheet
#
#    Tests run immediately! ⭐

# That's it!
```

**No files needed!** Just copy/paste your grid = automatic testing.

See [docs/HOW-TO-PASTE-GRID.md](docs/HOW-TO-PASTE-GRID.md) for detailed paste instructions.

### Optional: Create Config File

If you prefer to save grid data for reuse:

```bash
npm run create-config
#
# Choose method:
#   1. Paste from spreadsheet - 2 min ⭐ RECOMMENDED
#   2. Auto-extract from image (OCR) - Sometimes unreliable
#   3. Manual entry - 10 min (fallback)
```

Saved configs load instantly on subsequent runs.

### Interactive Testing Mode

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
- ✅ **Saves your data** - Config files load instantly next time
- ✅ **Provides guidance** - Clear instructions for missing files
- ✅ **Generates names** - Consistent file naming automatically

### Available Options

**Lift Types (12):** Cordless, Cordloop, Medium Cassette, Large Cassette, Motorization, Motorization Wand, Motorization TDBU, and 2-on-1 variants

**Models (20):** Roller, Solar, Roman, Banded, Faux Wood, Real Wood, Verticals, Perceptions, Cellular (multiple types), Classic Value Faux Wood, Naturals, Sheer, Vertical Cellular, Panel, Riviera Select/Complete/Classic

**Brands (2):** Home Depot, Lowe's

### Creating New Configurations

You can create multiple configurations for different products:

1. **Run `npm start`** and select options
2. **Paste grid data** when prompted
3. **Config saved automatically** for future use

See `configs/README.md` for manual config creation.

## 📊 How It Works

### For Regular Configs
1. **Selects mount type** (inside/outside)
2. **Enters dimensions** (width and height)
3. **Selects matching color swatch** (required for validation)
4. **Checks if Single headrail is available**
   - ✅ PASS: Single NOT available (properly blocked)
   - 🐛 BUG: Single IS available (should be blocked)

### For 2 on 1 Configs
1. **Selects mount type** (inside/outside)
2. **Enters dimensions** (width and height)
3. **Selects matching color swatch** (required for validation)
4. **Checks if 2 on 1 headrail is available**
   - ✅ PASS: 2 on 1 NOT available (properly blocked)
   - 🐛 BUG: 2 on 1 IS available (should be blocked)

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
- **1st Ctrl+C**: Waits for current test to complete, then saves results
- **2nd Ctrl+C**: Force exit - saves partial results immediately

## 📚 Documentation

- **[docs/HOW-TO-PASTE-GRID.md](docs/HOW-TO-PASTE-GRID.md)** - How to paste grid data
- **[docs/PARTIAL-SAVE-AND-2ON1-TESTING.md](docs/PARTIAL-SAVE-AND-2ON1-TESTING.md)** - Latest features
- **[configs/README.md](configs/README.md)** - Config file guide
