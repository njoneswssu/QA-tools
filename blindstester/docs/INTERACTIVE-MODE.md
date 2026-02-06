# Interactive Configuration Selection

## Overview

The blinds tester now includes an **interactive mode** that asks you what configuration to test before starting. This makes it easy to switch between different test scenarios without using command-line arguments.

## How It Works

### 1. Start the Test Without Config

Simply run:

```bash
npm start
```

### 2. Select Configuration

You'll see a menu with 9 test configuration options:

```
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

  Enter number (1-9) or press Enter to skip interactive mode:

  Selection: 
```

### 3. Validation

After you select an option, the tool validates:

- **Grid Image Exists**: Checks if the grid image file is present in `configs/grids/`
- **Config File Exists**: Checks if the configuration file exists in `configs/`

If either is missing, you'll get clear instructions on what to add.

### 4. Test Runs

Once validated, the test runs automatically with your selected configuration.

## Available Configurations

| # | Configuration | Grid Image | Config File |
|---|--------------|------------|-------------|
| 1 | Cordless | `configs/grids/cordless-grid.png` | `configs/cordless-config.js` |
| 2 | Cordloop | `configs/grids/cordloop-grid.png` | `configs/cordloop-config.js` |
| 3 | Medium Cassette Valance | `configs/grids/medium-cassette-grid.png` | `configs/medium-cassette-config.js` |
| 4 | Large Cassette Valance | `configs/grids/large-cassette-grid.png` | `configs/large-cassette-config.js` |
| 5 | Motorization | `configs/grids/motorization-grid.png` | `configs/motorization-config.js` |
| 6 | Cordless 2 on 1 | `configs/grids/cordless-2on1-grid.png` | `configs/cordless-2on1-config.js` |
| 7 | Cordloop 2 on 1 | `configs/grids/cordloop-2on1-grid.png` | `configs/cordloop-2on1-config.js` |
| 8 | Large Cassette Valance 2 on 1 | `configs/grids/large-cassette-2on1-grid.png` | `configs/large-cassette-2on1-config.js` |
| 9 | Motorization 2 on 1 | `configs/grids/motorization-2on1-grid.png` | `configs/motorization-2on1-config.js` |

## Setting Up a New Configuration

### Step 1: Get the Grid Image

1. Navigate to the configurator URL you want to test
2. Take a screenshot of the max height grid
3. Save it to `configs/grids/` with an appropriate name
   - Example: `configs/grids/cordless-grid.png`

### Step 2: Create the Config File

1. Copy the example config:
   ```bash
   cp configs/example-config.js configs/cordless-config.js
   ```

2. Edit the new config file:
   ```javascript
   export const config = {
     name: "Cordless",
     url: "https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=YOUR_ID",
     gridImage: "configs/grids/cordless-grid.png",
     testData: [
       {
         product: "3% Catalina",
         widthBreakpoints: [
           { width: 72, maxHeight: 132 },
           { width: 96, maxHeight: 96 },
           // ... more breakpoints
         ]
       },
       // ... more products
     ]
   };
   ```

3. Extract test data from your grid image (see `configs/README.md` for details)

### Step 3: Test Your Configuration

Run the tester and select your new configuration from the menu!

## Skipping Interactive Mode

### Press Enter

If you press Enter without selecting a number, the tool will skip interactive mode and use the default configuration.

### Use Command Line

You can also bypass interactive mode completely:

```bash
# Use specific config
npm start -- --config configs/cordless-config.js

# Skip interactive mode and use default
npm start -- --skip-interactive
```

## Validation Messages

### ✅ Success

```
📋 Validating configuration for: Cordless

  ✓ Grid image found: configs/grids/cordless-grid.png
  ✓ Config file found: configs/cordless-config.js
```

### ❌ Missing Grid Image

```
📋 Validating configuration for: Cordless

  ❌ Grid image not found: configs/grids/cordless-grid.png

  Please add the grid image to: /path/to/blindstester/configs/grids/cordless-grid.png
  Then run the test again.
```

**What to do:** Take a screenshot of the max height grid and save it to the specified path.

### ❌ Missing Config File

```
📋 Validating configuration for: Cordless

  ✓ Grid image found: configs/grids/cordless-grid.png
  ❌ Config file not found: configs/cordless-config.js

  Please create the config file:
     1. Copy: configs/example-config.js
     2. Save as: configs/cordless-config.js
     3. Extract test data from grid image
     4. Update config with URL and test data

  See configs/README.md for instructions.
```

**What to do:** Follow the steps shown to create the config file.

## Tips

1. **Organize Your Grids**: Keep all grid screenshots in `configs/grids/` for easy reference
2. **Name Consistently**: Use descriptive names like `cordless-2on1-grid.png`
3. **Test First**: After creating a new config, run a quick test with `-p` and `-w` to verify accuracy
4. **Document URLs**: Keep track of the configurator URLs in your config files

## Example Workflow

```bash
# 1. Start the tester
npm start

# 2. You see the menu, select option 1 (Cordless)
Selection: 1

# 3. Oh no! Grid image is missing
❌ Grid image not found: configs/grids/cordless-grid.png

# 4. Add the grid image
# (Take screenshot, save to configs/grids/cordless-grid.png)

# 5. Try again
npm start
Selection: 1

# 6. Now config file is missing
✓ Grid image found: configs/grids/cordless-grid.png
❌ Config file not found: configs/cordless-config.js

# 7. Create the config file
cp configs/example-config.js configs/cordless-config.js
# (Edit the file with your data)

# 8. Try once more
npm start
Selection: 1

# 9. Success! Test runs
✓ Grid image found: configs/grids/cordless-grid.png
✓ Config file found: configs/cordless-config.js

🚀 Initializing browser...
```

## Benefits

- **No memorizing command-line arguments**: Just run `npm start` and pick from a menu
- **Validation before testing**: Ensures all required files exist before starting the browser
- **Clear instructions**: If something's missing, you get step-by-step guidance
- **Easy to extend**: Add new configurations without modifying core code

## See Also

- [configs/README.md](../configs/README.md) - How to create configuration files
- [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) - All CLI commands
- [docs/CLEANUP-UPDATE.md](CLEANUP-UPDATE.md) - Project structure overview
