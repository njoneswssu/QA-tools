# Resume Feature - Test Progress Tracking

## Overview

The tester now tracks which products have been completed and allows you to resume tests from where you left off if interrupted.

## How It Works

### Progress File

Progress is saved to: `test-results/.progress-{config-name}.json`

**Example:** `test-results/.progress-motorization-solar-home-depot.json`

**Content:**
```json
{
  "completedProducts": [
    "3% Catalina",
    "5% Catalina",
    "1% Catalina"
  ],
  "lastUpdated": "2026-02-06T20:45:30.123Z"
}
```

### When Progress is Saved

Progress is saved after each product is **fully completed**:
- ✅ STEP 1: 144" test completed
- ✅ STEP 2: All width breakpoints tested
- ✅ STEP 3: Max width test completed

**Not saved if:**
- ❌ Product skipped due to error
- ❌ Tests interrupted mid-product (Ctrl+C)
- ❌ Test failed on first attempt

### When Progress is Cleared

Progress file is automatically deleted when:
- ✅ All tests complete successfully
- ✅ User chooses "Start fresh" option
- ✅ Manual deletion by user

## User Experience

### Scenario 1: No Previous Progress

```bash
npm start
# Select config...

🚀 Initializing browser...
🎯 Starting test for motorization-solar-home-depot

📦 Testing Product: 3% Catalina
...
```

**Behavior:** Tests run normally

---

### Scenario 2: Previous Progress Found

```bash
npm start
# Select config...

🚀 Initializing browser...

📋 Previous test progress found!
   3 product(s) already completed:
     1. 3% Catalina
     2. 5% Catalina
     3. 1% Catalina

   What would you like to do?

     1. Resume from where you left off (test remaining products)
     2. Start fresh (clear progress and test all products)
     3. Exit

   Selection (1-3): _
```

**Option 1: Resume**
```
Selection (1-3): 1

✓ Resuming tests - 17 product(s) remaining

🎯 Starting test for motorization-solar-home-depot

✓ Loaded progress: 3 products already completed
  Will skip completed products

⏭️  Skipping 3% Catalina - already completed
⏭️  Skipping 5% Catalina - already completed
⏭️  Skipping 1% Catalina - already completed

📦 Testing Product: 10% Solapur  ← Resumes here
...
```

**Option 2: Start Fresh**
```
Selection (1-3): 2

✓ Starting fresh - all products will be tested
  A new results file will be created
  Previous results are preserved

🎯 Starting test for motorization-solar-home-depot

📦 Testing Product: 3% Catalina  ← Starts from beginning
...
```

**What happens:**
- Progress file is cleared
- All products are tested again
- **New results file created** with current timestamp
- Previous results files are **preserved** (not deleted)

**Option 3: Exit**
```
Selection (1-3): 3

⏹️  Exiting.
```

---

### Important: Results Files Are Never Deleted

**Resume (Option 1):**
- Continues in the **same test run**
- Results append to the same session
- Single results file when done

**Start Fresh (Option 2):**
- Starts a **new test run**
- Creates **new results file** with new timestamp
- **Previous results preserved** (not deleted)

**Example:**
```
test-results/
├── motorization-solar-home-depot-2026-02-06T14-30-00.000Z.json  ← Old (3 products)
├── motorization-solar-home-depot-2026-02-06T14-30-00.000Z-grid.txt
├── motorization-solar-home-depot-2026-02-06T14-30-00.000Z-compact.txt
├── motorization-solar-home-depot-2026-02-06T15-45-00.000Z.json  ← New (20 products)
├── motorization-solar-home-depot-2026-02-06T15-45-00.000Z-grid.txt
└── motorization-solar-home-depot-2026-02-06T15-45-00.000Z-compact.txt
```

You can compare results between runs to see if behavior changed.

---

### Scenario 3: Tests Complete Successfully

```bash
📦 Testing Product: 3% Newport

📏 STEP 3: Testing max width restriction
...
✅ PASS: Width 156" exceeds max - Single headrail correctly unavailable

✅ Completed all tests for 3% Newport

Test Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Products Tested: 20
...

💾 Saving results to: test-results/motorization-solar-home-depot-...
✅ Results saved successfully

✅ All tests completed! Progress file cleared.  ← Automatically cleaned up
```

---

### Scenario 4: Tests Interrupted (Ctrl+C)

```bash
📦 Testing Product: 10% Solapur

📏 STEP 2: Testing width 112" (max height: 132")
...

^C
⏳ Shutdown requested. Will complete current test and save results...

⏹️  Test completed. Shutting down...

✅ Completed all tests for 10% Solapur  ← Progress saved

Test Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Products Tested: 4 (of 20)
...

💾 Saving results to: test-results/motorization-solar-home-depot-...
✅ Results saved successfully
```

**Next run:**
```bash
npm start

📋 Previous test progress found!
   4 product(s) already completed:
     1. 3% Catalina
     2. 5% Catalina
     3. 1% Catalina
     4. 10% Solapur

   What would you like to do?
   ...
```

## Progress File Location

Progress files are stored in `test-results/` folder with `.progress-` prefix:

```
test-results/
├── .progress-motorization-solar-home-depot.json  ← Progress file
├── motorization-solar-home-depot-2026-02-06T20-04-07.641Z.json
├── motorization-solar-home-depot-2026-02-06T20-04-07.641Z-grid.txt
└── motorization-solar-home-depot-2026-02-06T20-04-07.641Z-compact.txt
```

**Note:** Progress files start with `.` (hidden on Unix systems)

## Manual Progress Management

### View Progress

```bash
cat test-results/.progress-motorization-solar-home-depot.json
```

### Delete Progress (Force Fresh Start)

```bash
rm test-results/.progress-*.json
```

Or delete specific config:
```bash
rm test-results/.progress-motorization-solar-home-depot.json
```

### Delete Old Results (Optional)

Results files are **never automatically deleted**. To clean up old results:

```bash
# Delete all results
npm run clean-results -- --force

# Or manually delete specific results
rm test-results/motorization-solar-home-depot-2026-02-06T14-*.json
rm test-results/motorization-solar-home-depot-2026-02-06T14-*-grid.txt
rm test-results/motorization-solar-home-depot-2026-02-06T14-*-compact.txt
```

**Tip:** Keep old results to compare behavior across different test runs!

## What Gets Tracked

### Tracked:
✅ **Product name** - Fully completed products only
✅ **Last updated time** - Timestamp of last save

### Not Tracked:
❌ Partial product progress (which widths completed)
❌ Test results (stored separately)
❌ Failed/skipped products

**Why?** Keeps progress file simple and reliable

## Benefits

### 1. Long Test Sessions
- Test 20+ products over multiple sessions
- Don't restart from beginning if interrupted
- Continue where you left off

### 2. Error Recovery
- If a product fails, fix the config
- Resume without re-testing successful products
- Save time on retries

### 3. Incremental Testing
- Test a few products at a time
- Build up complete test coverage gradually
- Flexible testing schedule

### 4. Data Preservation
- Partial results are always saved
- No lost work from interruptions
- Can review results before continuing

## Edge Cases

### Case 1: Config Changed Between Runs

**What happens:** If you modify the config file (add/remove products), progress still applies to product names.

**Example:**
```
# First run (old config)
Products: 3% Catalina, 5% Catalina, 1% Catalina
Completed: 3% Catalina

# Second run (new config - added product)
Products: 3% Catalina, 5% Catalina, 1% Catalina, 10% Solapur
Resume: Skips 3% Catalina, tests the rest
```

### Case 2: Product Name Changed

**What happens:** Treated as a new product (will be tested)

**Example:**
```
# First run
Completed: "3% Catalina"

# Second run (renamed to "3 Percent Catalina")
Resume: Won't skip (different name)
```

### Case 3: Multiple Configs

**What happens:** Each config has its own progress file

**Example:**
```
.progress-motorization-solar-home-depot.json
.progress-cordless-roller-lowes.json
.progress-motorization-2on1-cellular-home-depot.json
```

Progress is independent per configuration.

## Implementation Details

### Class Methods Added

```javascript
class BlindsConfiguratorTester {
  setProgressFile(configName)   // Sets progress file path
  loadProgress()                 // Loads progress from file
  saveProgress()                 // Saves progress to file
  clearProgress()                // Deletes progress file
}
```

### New Properties

```javascript
this.completedProducts = new Set();  // Tracks completed product names
this.progressFile = null;            // Path to progress file
```

### Updated Methods

```javascript
async runTests(productsToTest, resumeFromProgress = false)
```

**Parameters:**
- `productsToTest` - Array of products to test
- `resumeFromProgress` - Boolean, if true, skip completed products

## Files Changed

### `/Users/neil/playwrightautomation/blindstester/index.js`

1. **Constructor** - Added progress tracking properties
2. **Progress methods** - Added load/save/clear functions
3. **runTests()** - Added resume parameter and skip logic
4. **main()** - Added prompt for resume/restart choice

## Testing

### Test Resume Feature

```bash
# Start tests
npm start
# Select config and let a few products complete
# Press Ctrl+C

# Run again
npm start
# Should see: "Previous test progress found!"
# Select option 1 to resume

# Verify:
# - Completed products are skipped
# - Tests continue from next product
# - Progress updates as products complete
```

### Test Fresh Start

```bash
# With existing progress
npm start
# Select option 2 (Start fresh)

# Verify:
# - Progress file deleted
# - All products tested from beginning
```

---

**Status:** Complete ✅

Tests can now be resumed from where you left off, making long test sessions more manageable and efficient.
