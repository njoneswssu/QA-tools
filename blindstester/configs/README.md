# Configurator Configs

This folder contains different configurator configurations for testing.

## Interactive Mode

The tester now includes an **interactive mode** that automatically prompts you to select which configuration to test:

```bash
npm start

# You'll see:
# 🎯 What do you want to test?
#   1. Cordless
#   2. Cordloop
#   3. Medium Cassette Valance
#   ... (9 options total)
```

When you select an option, the tool:
1. ✅ Validates the grid image exists in `configs/grids/`
2. ✅ Validates the config file exists in `configs/`
3. ✅ Provides clear instructions if anything is missing
4. 🚀 Runs the test automatically

See [../docs/INTERACTIVE-MODE.md](../docs/INTERACTIVE-MODE.md) for complete details.

## Structure

```
configs/
├── default-config.js        # Default configuration (current one)
├── cordless-config.js       # Cordless configuration
├── motorization-config.js   # Motorization configuration
├── example-config.js        # Template for new configs
├── grids/                   # Grid images for reference
│   ├── default-grid.png
│   ├── cordless-grid.png
│   ├── motorization-grid.png
│   └── ...
└── README.md                # This file
```

## Quick Start: Adding a New Configuration

Want to test a new configurator? Here's the fastest way:

### 1. Run Interactive Mode

```bash
npm start
```

### 2. Select Your Option

Choose the configuration you want (e.g., option 1 for "Cordless")

### 3. Follow the Prompts

If the grid image or config file is missing, you'll see:

```
❌ Grid image not found: configs/grids/cordless-grid.png
Please add the grid image to: /path/to/blindstester/configs/grids/cordless-grid.png
```

or

```
❌ Config file not found: configs/cordless-config.js
Please create the config file:
  1. Copy: configs/example-config.js
  2. Save as: configs/cordless-config.js
  3. Extract test data from grid image
  4. Update config with URL and test data
```

### 4. Add the Missing Files

Follow the instructions provided by the tool!

## Creating a New Config Manually

1. **Add your grid image** to `configs/grids/` folder
   - Name it descriptively (e.g., `roller-shades-grid.png`)

2. **Create a new config file** (e.g., `roller-shades-config.js`)

```javascript
export const config = {
  name: "Roller Shades",
  url: "https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=YOUR_ID",
  gridImage: "grids/roller-shades-grid.png",
  testData: [
    {
      product: "3% Fabric Name",
      widthBreakpoints: [
        { width: 114, maxHeight: 132 },
        { width: 120, maxHeight: 90 },
        { width: 126, maxHeight: 54 }
      ]
    }
    // Add more products...
  ]
};
```

3. **Run tests with your config**

```bash
node index.js --config configs/roller-shades-config.js
```

## Config Format

Each config file should export a `config` object with:

- `name` (string): Descriptive name for this configurator
- `url` (string): The configurator URL with draftProductId
- `gridImage` (string): Path to the reference grid image
- `testData` (array): Array of products with width breakpoints
  - `product` (string): Product name (e.g., "3% Catalina")
  - `widthBreakpoints` (array): Array of `{ width, maxHeight }` objects

## Extracting Grid Data

1. Open your grid image
2. For each product row:
   - Note the product name
   - For each width column where maxHeight < 144":
     - Record the width breakpoint
     - Record the max height value

Example grid:
```
Product Name  | 108" | 114" | 120" | 126"
3% Fabric A   | 144  | 132  | 90   | 54
1% Fabric B   | 144  | 96   | 72   | 48
```

Becomes:
```javascript
{
  product: "3% Fabric A",
  widthBreakpoints: [
    { width: 114, maxHeight: 132 },
    { width: 120, maxHeight: 90 },
    { width: 126, maxHeight: 54 }
  ]
},
{
  product: "1% Fabric B",
  widthBreakpoints: [
    { width: 114, maxHeight: 96 },
    { width: 120, maxHeight: 72 },
    { width: 126, maxHeight: 48 }
  ]
}
```

## Tips

- Only include widths where maxHeight < 144"
- Product names must match EXACTLY how they appear in color swatches
- The alt text format is usually "ProductName Percentage% Color Code"
  - Test data: "3% Catalina" 
  - Alt text: "Catalina 3% Powder LS01401"
- Test with one product first to verify color matching works
