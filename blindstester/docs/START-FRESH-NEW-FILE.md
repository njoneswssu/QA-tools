# Start Fresh - New File Creation

## Summary

The "Start fresh" option (Option 2) now creates a **new results file** instead of overwriting the old one. Previous results are always preserved.

## What Changed

### Before (Incorrect Understanding)
User thought "Start fresh" would delete old results.

### After (Correct Implementation)
"Start fresh" creates a new timestamped results file. Old results are preserved.

## How Results Files Work

### File Naming

All results files include a timestamp in the filename:

```
{config-name}-{timestamp}.json
```

**Example:**
```
motorization-solar-home-depot-2026-02-06T14-30-00.000Z.json
```

**Timestamp format:** ISO 8601 (year-month-day-T-hour-minute-second.milliseconds-Z)

### Automatic File Creation

Every test run creates **3 files** with the same timestamp:
1. `.json` - Complete test data
2. `-grid.txt` - Human-readable grid format
3. `-compact.txt` - Condensed grid format

## Resume vs Start Fresh

### Option 1: Resume from Progress

**What happens:**
- Continues the **same test run**
- Tests only remaining products
- Results append to the **same session**
- Creates **one results file** when done

**Example:**
```bash
# First run (interrupted after 3 products)
npm start
# Ctrl+C after 3 products
# Creates: motorization-solar-home-depot-2026-02-06T14-30-00.000Z.json (3 products)

# Second run (resume)
npm start
# Select option 1: Resume
# Continues with remaining 17 products
# Updates: motorization-solar-home-depot-2026-02-06T14-30-00.000Z.json (now 20 products)
```

**Result:** Single file with all 20 products

---

### Option 2: Start Fresh

**What happens:**
- Starts a **new test run**
- Tests **all products** from beginning
- Creates a **new results file** with new timestamp
- **Previous results preserved** (not deleted or overwritten)

**Example:**
```bash
# First run (interrupted after 3 products)
npm start
# Ctrl+C after 3 products
# Creates: motorization-solar-home-depot-2026-02-06T14-30-00.000Z.json (3 products)

# Second run (start fresh)
npm start
# Select option 2: Start fresh
# Tests all 20 products
# Creates: motorization-solar-home-depot-2026-02-06T15-45-00.000Z.json (20 products)
```

**Result:** Two files:
- Old: `...14-30-00...json` (3 products) ← Preserved
- New: `...15-45-00...json` (20 products) ← New file

## Benefits of Preserving Old Results

### 1. Compare Runs

Compare results between different test runs to see if configurator behavior changed:

```bash
# View old results
cat test-results/motorization-solar-home-depot-2026-02-06T14-*.json

# View new results
cat test-results/motorization-solar-home-depot-2026-02-06T15-*.json

# Compare
diff test-results/motorization-solar-home-depot-2026-02-06T14-*-grid.txt \
     test-results/motorization-solar-home-depot-2026-02-06T15-*-grid.txt
```

### 2. Track History

Keep a history of test results to track when bugs were introduced or fixed.

### 3. Safety

Never lose test data. If you accidentally start fresh, old results are still available.

### 4. Audit Trail

Document testing activity over time for compliance or review purposes.

## File Management

### View All Results for a Config

```bash
ls -la test-results/motorization-solar-home-depot-*.json
```

**Output:**
```
motorization-solar-home-depot-2026-02-06T14-30-00.000Z.json
motorization-solar-home-depot-2026-02-06T15-45-00.000Z.json
motorization-solar-home-depot-2026-02-06T16-20-00.000Z.json
```

### Delete Old Results (Manual)

Results are **never automatically deleted**. To clean up:

**Delete all results:**
```bash
npm run clean-results -- --force
```

**Delete specific config results:**
```bash
rm test-results/motorization-solar-home-depot-*
```

**Delete specific run:**
```bash
rm test-results/motorization-solar-home-depot-2026-02-06T14-30-00.000Z.*
```

### Disk Space Considerations

Each results file set (JSON + grid + compact) is typically:
- JSON: ~5-50 KB
- Grid: ~2-10 KB
- Compact: ~1-5 KB

**Total per run:** ~10-65 KB

Even with 100 test runs, total space is ~1-6 MB. Storage is not typically a concern.

## Updated Prompt Messages

### Option 2 Now Shows:

```
     2. Start fresh (clear progress and test all products in new file)
```

**After selecting:**
```
✓ Starting fresh - all products will be tested
  A new results file will be created
  Previous results are preserved
```

**Clear indication that:**
1. New file will be created
2. Old files are preserved

## Use Cases

### Case 1: Re-test After Bug Fix

```bash
# First test (found bugs)
npm start
# Results: motorization-solar-home-depot-2026-02-06T14-00-00.000Z.json
# Status: 5 bugs found

# Fix configurator issues...

# Second test (verify fixes)
npm start
# Select: Start fresh (option 2)
# Results: motorization-solar-home-depot-2026-02-06T16-00-00.000Z.json
# Status: 0 bugs found

# Compare to see what changed
diff test-results/*14-00-00*-grid.txt test-results/*16-00-00*-grid.txt
```

### Case 2: Different Grid Data

```bash
# Test with old grid data
npm start
# Results: motorization-solar-home-depot-2026-02-06T10-00-00.000Z.json

# Update grid data (products changed)...

# Test with new grid data
npm start
# Select: Start fresh (option 2)
# Results: motorization-solar-home-depot-2026-02-06T11-00-00.000Z.json

# Compare products tested
cat test-results/*10-00-00*.json | jq '.products'
cat test-results/*11-00-00*.json | jq '.products'
```

### Case 3: Weekly Testing

```bash
# Monday
npm start
# Results: motorization-solar-home-depot-2026-02-03T09-00-00.000Z.json

# Tuesday (test again)
npm start
# Select: Start fresh (option 2)
# Results: motorization-solar-home-depot-2026-02-04T09-00-00.000Z.json

# Track results over time
ls -lt test-results/motorization-solar-home-depot-*
```

## Summary Table

| Action | Creates New File? | Preserves Old Files? | Use Case |
|--------|-------------------|---------------------|----------|
| **Resume** (Option 1) | No | Yes | Continue interrupted test |
| **Start Fresh** (Option 2) | **Yes** ✅ | **Yes** ✅ | Re-test all products |
| **New Test Run** | **Yes** ✅ | **Yes** ✅ | First time testing |

**Key Point:** Old results files are **NEVER** automatically deleted.

## Progress File vs Results Files

### Progress File
- **Purpose:** Track which products completed
- **Lifetime:** Temporary (cleared on completion or start fresh)
- **Location:** `test-results/.progress-{config}.json`

### Results Files
- **Purpose:** Store test results permanently
- **Lifetime:** Permanent (manual deletion only)
- **Location:** `test-results/{config}-{timestamp}.{ext}`

**Different files, different purposes!**

## Files Changed

### `/Users/neil/playwrightautomation/blindstester/index.js`

**Line 1556:** Updated prompt text
```javascript
console.log('     2. Start fresh (clear progress and test all products in new file)');
```

**Lines 1565-1568:** Updated confirmation messages
```javascript
console.log(chalk.yellow('\n✓ Starting fresh - all products will be tested\n'));
console.log(chalk.gray('  A new results file will be created\n'));
console.log(chalk.gray('  Previous results are preserved\n'));
```

### `/Users/neil/playwrightautomation/blindstester/docs/RESUME-FEATURE.md`

Updated documentation to clarify:
- New file creation behavior
- Previous results preservation
- File comparison examples

---

**Status:** Complete ✅

"Start fresh" now clearly indicates it creates a new file and preserves old results. User can safely re-test without losing previous test data.
