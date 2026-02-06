# Enhanced Interactive Mode - Complete Guide

## Overview

The blinds tester now features a **comprehensive 3-step interactive wizard** that guides you through:

1. **What do you want to test?** (Lift type: Cordless, Cordloop, etc.)
2. **What model?** (Roller, Solar, Roman, Cellular, etc.)
3. **What brand?** (Home Depot or Lowe's)

After selection, the tool automatically:
- ✅ Saves and remembers configurator URLs
- ✅ Validates grid images exist
- ✅ Validates config files exist
- ✅ Provides clear instructions for missing files

## Complete Workflow

### Quick Delete Test Results

If you need to clear all test results:

```
🎯 What do you want to test?

  1. Cordless
  ...
  9. Motorization 2 on 1

  10. 🗑️  Delete All Test Results

  Selection: 10
```

**Confirmation Required:**
```
📁 Found 15 files in test-results/

  - test-results-2026-02-06T16-27-58.577Z.json
  - test-results-2026-02-06T16-27-58.577Z-grid.txt
  - test-results-2026-02-06T16-27-58.577Z-compact.txt
  ...

⚠️  This will permanently delete all test result files!

  Are you sure? Type "yes" to confirm: yes

🗑️  Deleting all test results...

  ✓ Deleted test-results-2026-02-06T16-27-58.577Z.json
  ✓ Deleted test-results-2026-02-06T16-27-58.577Z-grid.txt
  ...

✅ Successfully deleted 15 files
```

### Test Configuration Workflow

### Step 1: Choose Lift Type

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
  10. Motorization Wand
  11. Motorization Wand 2 on 1
  12. Motorization TDBU

  13. 🗑️  Delete All Test Results

  Enter number (1-13) or press Enter to skip interactive mode:

  Selection: 1
```

### Step 2: Choose Model

```
🏷️  What model?

  1. Roller
  2. Solar
  3. Roman
  4. Banded
  5. Faux Wood
  6. Real Wood
  7. Verticals
  8. Perceptions
  9. Cellular
  10. Cellular 9/16"
  11. Cellular 9/16" Day/Night
  12. Cellular Day/Night
  13. Classic Value Faux Wood
  14. Naturals
  15. Sheer
  16. Vertical Cellular
  17. Panel
  18. Riviera Select
  19. Riviera Complete
  20. Riviera Classic

  Enter number (1-20):

  Selection: 1
```

### Step 3: Choose Brand

```
🏪 What brand?

  1. Home Depot
  2. Lowe's

  Enter number (1-2):

  Selection: 1
```

### Step 4: URL Management

The tool now **remembers configurator URLs** automatically!

#### First Time (No Saved URL)

```
📋 Configuration: Cordless - Roller - Home Depot
   Key: cordless-roller-home-depot

  ⚠️  No saved URL found for this configuration.

  Please paste the configurator URL:

  URL: https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389

  ✓ URL saved for future use
```

#### Next Time (URL Already Saved)

```
📋 Configuration: Cordless - Roller - Home Depot
   Key: cordless-roller-home-depot

📍 Found saved URL:
   https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389

  Is this the correct URL? (y/n): y

  ✓ Using saved URL
```

#### Updating a Saved URL

```
📍 Found saved URL:
   https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389

  Is this the correct URL? (y/n): n

  Please paste the new configurator URL:

  URL: https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=999999

  ✓ URL updated and saved
```

### Step 5: File Validation

After URL is confirmed, the tool validates files:

```
📋 Validating files...

  ✓ Grid image found: configs/grids/cordless-roller-home-depot.png
  ✓ Config file found: configs/cordless-roller-home-depot-config.js

✅ Configuration validated successfully!
```

### Step 5a: If Files Are Missing - Retry Loop

If files are missing, you can retry after adding them:

```
📋 Validating files...

  ❌ Grid image not found: configs/grids/cordless-roller-home-depot.png

  Please add the grid image to:
     /full/path/to/configs/grids/cordless-roller-home-depot.png

  ❌ Config file not found: configs/cordless-roller-home-depot-config.js

  Please create the config file:
     1. Copy: configs/example-config.js
     2. Save as: configs/cordless-roller-home-depot-config.js
     3. Extract test data from grid image
     4. Update config with URL and test data

  See configs/README.md for instructions.

  What would you like to do?

    1. Retry (after adding missing files)
    2. Exit

  Selection (1-2): 1

🔄 Rechecking files...

📋 Validating files...

  ✓ Grid image found: configs/grids/cordless-roller-home-depot.png
  ❌ Config file not found: configs/cordless-roller-home-depot-config.js
  
  [Still missing config file...]
  
  What would you like to do?

    1. Retry (after adding missing files)
    2. Exit

  Selection (1-2): 1

🔄 Rechecking files...

📋 Validating files...

  ✓ Grid image found: configs/grids/cordless-roller-home-depot.png
  ✓ Config file found: configs/cordless-roller-home-depot-config.js

✅ Configuration validated successfully!
```

**Benefits:**
- ✅ **No need to restart** - Add files and retry in the same session
- ✅ **Instant validation** - See immediately if files are recognized
- ✅ **Step by step** - Add one file, check, add another, check
- ✅ **No fallback** - Won't start with wrong configuration

## File Naming Convention

The tool automatically generates consistent file names based on your selections:

### Format

`{lift-type}-{model}-{brand}`

All spaces and special characters are converted to hyphens and lowercase.

### Examples

| Lift Type | Model | Brand | File Key |
|-----------|-------|-------|----------|
| Cordless | Roller | Home Depot | `cordless-roller-home-depot` |
| Motorization | Cellular 9/16" | Lowe's | `motorization-cellular-9-16-lowes` |
| Cordloop 2 on 1 | Faux Wood | Home Depot | `cordloop-2on1-faux-wood-home-depot` |

### Generated Files

For `cordless-roller-home-depot`:
- **Grid image**: `configs/grids/cordless-roller-home-depot.png`
- **Config file**: `configs/cordless-roller-home-depot-config.js`
- **URL stored in**: `configs/saved-configs.json`

## URL Storage System

### saved-configs.json

URLs are automatically saved in `configs/saved-configs.json`:

```json
{
  "cordless-roller-home-depot": {
    "url": "https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389"
  },
  "motorization-cellular-lowes": {
    "url": "https://www.lowes.com/custom-blinds/Configurator/Draft?draftProductId=123456"
  }
}
```

### Benefits

- ✅ **No re-pasting** - URL remembered for each configuration
- ✅ **Easy updates** - Just answer "n" when asked if URL is correct
- ✅ **Shareable** - Commit `saved-configs.json` to share with team
- ✅ **Organized** - One central file for all URLs

## Complete Example Workflow

### Scenario: First Time Testing Cordless Roller Blinds from Home Depot

```bash
npm start
```

**Step 1: Lift Type**
```
Selection: 1  (Cordless)
```

**Step 2: Model**
```
Selection: 1  (Roller)
```

**Step 3: Brand**
```
Selection: 1  (Home Depot)
```

**Step 4: URL (First Time)**
```
URL: https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389
✓ URL saved
```

**Step 5: Validation - Missing Grid**
```
❌ Grid image not found: configs/grids/cordless-roller-home-depot.png
Please add the grid image to: /full/path/to/cordless-roller-home-depot.png
```

**Action: Add Grid Image**
1. Navigate to the configurator URL
2. Take a screenshot of the max height grid
3. Save as `configs/grids/cordless-roller-home-depot.png`

**Select Retry (Don't Need to Restart!)**
```
What would you like to do?

  1. Retry (after adding missing files)
  2. Exit

Selection (1-2): 1

🔄 Rechecking files...
```

**Now Grid Found, Config Still Missing**
```
📋 Validating files...

✓ Grid image found: configs/grids/cordless-roller-home-depot.png
❌ Config file not found: configs/cordless-roller-home-depot-config.js

Please create the config file:
  1. Copy: configs/example-config.js
  2. Save as: configs/cordless-roller-home-depot-config.js
  3. Extract test data from grid image
  4. Update config with URL and test data

What would you like to do?

  1. Retry (after adding missing files)
  2. Exit

Selection (1-2): _
```

**Action: Create Config File**
```bash
# In another terminal/window:
cp configs/example-config.js configs/cordless-roller-home-depot-config.js
# Edit the file, extract test data from grid, save
```

**Select Retry Again**
```
Selection (1-2): 1

🔄 Rechecking files...

📋 Validating files...

✓ Grid image found: configs/grids/cordless-roller-home-depot.png
✓ Config file found: configs/cordless-roller-home-depot-config.js

✅ Configuration validated successfully!

🚀 Initializing browser...
[Test runs]
```

### Next Time (Everything Already Set Up)

```bash
npm start
```
- Select: 1 (Cordless)
- Select: 1 (Roller)
- Select: 1 (Home Depot)
- URL confirmed: y
- ✅ Test runs immediately!

## Available Models

The following 20 models are available:

1. **Roller** - Standard roller shades
2. **Solar** - Solar/sun shades
3. **Roman** - Roman shades
4. **Banded** - Banded shades
5. **Faux Wood** - Faux wood blinds
6. **Real Wood** - Real wood blinds
7. **Verticals** - Vertical blinds
8. **Perceptions** - Perceptions blinds
9. **Cellular** - Standard cellular shades
10. **Cellular 9/16"** - 9/16" cellular shades
11. **Cellular 9/16" Day/Night** - 9/16" day/night cellular
12. **Cellular Day/Night** - Day/night cellular shades
13. **Classic Value Faux Wood** - Value faux wood blinds
14. **Naturals** - Natural woven shades
15. **Sheer** - Sheer shades
16. **Vertical Cellular** - Vertical cellular shades
17. **Panel** - Panel track blinds
18. **Riviera Select** - Riviera Select shutters
19. **Riviera Complete** - Riviera Complete shutters
20. **Riviera Classic** - Riviera Classic shutters

## Available Brands

1. **Home Depot**
2. **Lowe's**

## Tips & Best Practices

### Organization

1. **Name screenshots clearly**
   - The tool generates names automatically
   - Example: `cordless-roller-home-depot.png`

2. **Keep URLs updated**
   - If a configurator URL changes, just answer "n" when asked
   - The tool will prompt for the new URL and save it

3. **Share configurations**
   - Commit `configs/saved-configs.json` to your repository
   - Team members get all saved URLs automatically

### Testing Strategy

1. **Start with one complete configuration**
   - Pick one lift type, model, and brand
   - Set up grid image and config file completely
   - Verify tests run successfully

2. **Add more configurations gradually**
   - Each new combination needs its own grid and config
   - URLs are saved automatically as you go

3. **Use consistent naming**
   - The tool handles naming automatically
   - Just ensure your grid screenshots match the generated names

## Command-Line Overrides

You can still use command-line arguments to bypass interactive mode:

```bash
# Skip interactive mode entirely
npm start -- --skip-interactive

# Use specific config file
npm start -- --config configs/cordless-roller-home-depot-config.js

# Override URL even if saved
npm start -- --url "https://example.com/configurator"
```

## Troubleshooting

### "No saved URL found"

**Cause:** First time using this configuration combination

**Solution:** Paste the configurator URL when prompted - it will be saved for next time

### "Grid image not found"

**Cause:** Haven't created the grid screenshot yet

**Solution:** 
1. Navigate to the configurator URL
2. Take a screenshot of the max height grid
3. Save to the path shown in the error message

### "Config file not found"

**Cause:** Haven't created the config file yet

**Solution:**
1. Copy `configs/example-config.js`
2. Rename to the path shown in the error message
3. Extract test data from your grid image
4. Update the config file with your data

### "Invalid selection"

**Cause:** Entered a number outside the valid range

**Solution:** Re-run and enter a number within the shown range

## See Also

- [configs/README.md](../configs/README.md) - Config file creation guide
- [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) - Command reference
- [README.md](../README.md) - Main documentation
