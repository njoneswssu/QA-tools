# URL Change Detection - Grid Update Prompt

## Overview

When you update a configurator URL, the tool now asks if you want to update the grid data too, since product grids may have changed with the new URL.

## How It Works

### URL Change Detection

The tool detects URL changes in two scenarios:

1. **During URL confirmation** - When you choose to update a saved URL
2. **When config file exists** - If grid data already exists for this configuration

### The Prompt Sequence

#### Step 1: URL Confirmation (existing saved URL)

```
📍 Found saved URL:
   https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389

  Is this the correct URL? (y/n): n

  Please paste the new configurator URL:

  URL: https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=999999

  ✓ URL updated and saved
```

#### Step 2: Grid Update Prompt (if URL changed and config exists)

```
  ⚠️  The configurator URL has changed!

  The product grid data might have changed too.

  Do you want to update the grid data? (y/n): _
```

**Two Options:**

**Option 1: Yes - Update Grid Data**
```
  Do you want to update the grid data? (y/n): y

  ✓ Old grid data cleared. You will be prompted to paste new data.

📋 Validating configuration...

  ❌ Config file not found: configs/motorization-solar-home-depot-config.js

  📝 You need to provide your grid data to run tests.

  Option 1: Paste grid data now (Quick & Accurate) ⭐
  ...
```

**Option 2: No - Keep Existing Data**
```
  Do you want to update the grid data? (y/n): n

  ✓ Keeping existing grid data. Starting tests with current data.

📋 Validating configuration...

  ✓ Config file found: configs/motorization-solar-home-depot-config.js
  ✓ Config data looks valid (20 products)

✅ Configuration validated successfully!
```

## When Grid Update Prompt Appears

### ✅ Prompt WILL appear when:
1. You change the saved URL (answer 'n' to "Is this the correct URL?")
2. A config file with grid data already exists
3. The new URL is different from the old URL

### ❌ Prompt will NOT appear when:
1. No URL change (you confirm existing URL with 'y')
2. No existing config file (will be prompted for grid data anyway)
3. First time setting up this configuration (no previous data to update)

## Use Cases

### Use Case 1: Product Updated in Configurator

**Scenario:** Home Depot updated their Solar Shade configurator with new products

**Steps:**
```bash
npm start
# Select: Motorization
# Select: Solar
# Select: Home Depot

📍 Found saved URL:
   https://www.homedepot.com/.../Draft?draftProductId=722389

  Is this the correct URL? (y/n): n

  URL: https://www.homedepot.com/.../Draft?draftProductId=800000

  ⚠️  The configurator URL has changed!
  Do you want to update the grid data? (y/n): y

  ✓ Old grid data cleared. You will be prompted to paste new data.
  
# Now paste updated grid with new products
```

**Result:** Tests run with new URL and updated grid data

---

### Use Case 2: URL Changed But Grid Same

**Scenario:** URL changed (maybe different draft ID) but product grid is identical

**Steps:**
```bash
npm start
# Select config...

  Is this the correct URL? (y/n): n
  URL: [new URL]

  ⚠️  The configurator URL has changed!
  Do you want to update the grid data? (y/n): n

  ✓ Keeping existing grid data. Starting tests with current data.
```

**Result:** Tests run with new URL but existing grid data

---

### Use Case 3: Testing Different Brand

**Scenario:** Same lift type and model, but different brand (URL will be different)

**Steps:**
```bash
npm start
# Select: Motorization
# Select: Solar
# Select: Lowe's  ← Different brand

  ⚠️  No saved URL found for this configuration.
  Please paste the configurator URL:
  
  URL: [Lowe's URL]
```

**Result:** New configuration, prompts for grid data (no URL change prompt needed)

---

### Use Case 4: Correcting Wrong URL

**Scenario:** You accidentally pasted wrong URL last time, need to fix it

**Steps:**
```bash
npm start
# Select config...

  Is this the correct URL? (y/n): n
  URL: [correct URL]

  ⚠️  The configurator URL has changed!
  Do you want to update the grid data? (y/n): n  ← Grid was correct

  ✓ Keeping existing grid data. Starting tests with current data.
```

**Result:** URL corrected, existing (correct) grid data preserved

## What Happens to Old Data

### If You Choose "Yes" (Update Grid):
1. ✅ Old config file is **deleted**
2. ✅ You're prompted to paste new grid data
3. ✅ New config file created with new data
4. ✅ Tests run with new URL and new data

### If You Choose "No" (Keep Grid):
1. ✅ Old config file is **preserved**
2. ✅ No grid data prompt
3. ✅ Tests run immediately
4. ✅ Tests use new URL with old grid data

**Note:** Old test results are never deleted

## Progress File Handling

**Important:** If you update the grid data (choose "yes"), the progress file is NOT automatically cleared.

**Why?** You might be testing the same products, just with updated height limits.

**Manual clear if needed:**
```bash
rm test-results/.progress-motorization-solar-home-depot.json
```

Or choose "Start fresh" when prompted for resume.

## Files Affected

### When Grid Update Selected (Yes):

**Deleted:**
- `configs/motorization-solar-home-depot-config.js` ← Old grid data

**Preserved:**
- `configs/saved-configs.json` ← URL updated
- `test-results/.progress-*.json` ← Progress preserved
- `test-results/*.json` ← Old test results preserved

**Created:**
- `configs/motorization-solar-home-depot-config.js` ← New grid data (after paste)

### When Grid Kept (No):

**Updated:**
- `configs/saved-configs.json` ← URL updated

**Preserved:**
- `configs/motorization-solar-home-depot-config.js` ← Old grid data kept
- `test-results/.progress-*.json` ← Progress preserved
- `test-results/*.json` ← Old test results preserved

## Decision Guide

### Choose "Yes" (Update Grid) when:
- ✅ Products were added/removed from configurator
- ✅ Height limits changed for existing products
- ✅ Width breakpoints changed
- ✅ Product names changed
- ✅ You're not sure (safer to update)

### Choose "No" (Keep Grid) when:
- ✅ Only URL changed (same configurator)
- ✅ Grid data is definitely still correct
- ✅ Just testing with different draft ID
- ✅ Fixing a typo in URL

**When in doubt:** Choose "Yes" to update. Takes 2 minutes to paste fresh data and ensures accuracy.

## Implementation Details

### Code Flow

```javascript
// 1. User says URL is incorrect
if (confirmAnswer === 'n') {
  // 2. Get new URL
  const newUrl = await askQuestion('URL: ');
  const oldUrl = configuratorUrl;
  configuratorUrl = newUrl;
  
  // 3. Check if URL actually changed
  const urlChanged = oldUrl !== configuratorUrl;
  
  // 4. Update saved URL
  saveSavedConfigs(savedConfigs);
  
  // 5. If URL changed and config exists
  if (urlChanged && configExists) {
    // 6. Prompt for grid update
    const updateGrid = await askQuestion('Do you want to update the grid data?');
    
    if (updateGrid === 'y') {
      // 7. Delete old config file
      fs.unlinkSync(configPath);
      // Validation loop will prompt for new data
    } else {
      // 8. Keep existing config
      // Tests will run with old data
    }
  }
}
```

### Files Changed

**`/Users/neil/playwrightautomation/blindstester/index.js`**

**Lines 433-473:** Added URL change detection and grid update prompt logic

**New logic:**
1. Compare old URL to new URL
2. Check if config file exists
3. Prompt user for grid update decision
4. Delete config file if user chooses to update
5. Let validation loop handle re-prompting for data

## Testing

### Test URL Change with Grid Update

```bash
npm start
# Select existing config
# Answer 'n' to URL confirmation
# Paste new URL
# Answer 'y' to update grid data
# Verify: Prompted to paste grid
# Paste grid data
# Verify: Tests run with new URL and new data
```

### Test URL Change without Grid Update

```bash
npm start
# Select existing config
# Answer 'n' to URL confirmation
# Paste new URL
# Answer 'n' to update grid data
# Verify: Tests start immediately
# Verify: Uses new URL with old grid data
```

---

**Status:** Complete ✅

URL changes are now detected and user is prompted to update grid data, preventing tests from running with mismatched URL and grid data.
