# Granular Progress Tracking

## Overview

The progress tracking system tracks **every individual test** as it completes - whether it's a 144" height test, a regular width breakpoint test, or a max width test. Progress is saved immediately after each test, so you never lose your work.

## How It Works

### Progress Tracking Structure

The tool maintains two levels of tracking:

1. **Product-level tracking** (`completedProducts`): Tracks which products have been **fully** tested (all steps complete)
2. **Test-level tracking** (`completedTests`): Tracks which specific tests have been completed for each product

### Progress File Format

```json
{
  "completedProducts": ["3% Catalina"],
  "completedTests": {
    "3% Catalina": ["144-height-test", "112", "118", "126", "max-width"],
    "5% Biscayne": ["144-height-test", "96", "112"]
  },
  "lastUpdated": "2026-02-06T21:30:00.000Z"
}
```

### Test Keys

Each test is tracked by a unique key:
- **144" height test**: `"144-height-test"` (STEP 1)
- **Regular width tests**: `"<width>"` (e.g., `"112"` for testing at 112" width - STEP 2)
- **Max width test**: `"max-width"` (STEP 3 - testing beyond table limits)

## Progress Saving

### When Progress is Saved

Progress is saved **automatically after EVERY test**:

1. **After STEP 1 (144" height test)**
   ```
   📏 STEP 1: Testing 144" height capability @ 110" width
   ✅ PASS: 144" height allowed - Single headrail available
   💾 Saving progress...
   ```

2. **After each STEP 2 (width breakpoint test)**
   ```
   📏 STEP 2: Testing width 110" (max height: 90")
   ✅ PASS: ...
   💾 Saving progress...
   ```

3. **After STEP 3 (max width test)**
   ```
   📏 STEP 3: Testing max width restriction
   ✅ PASS: ...
   💾 Saving progress...
   ```

4. **On graceful shutdown (first Ctrl+C)**
   ```
   ⏳ Shutdown requested. Will complete current test and save results...
   💾 Saving progress for resume...
   ```

5. **On force exit (second Ctrl+C)**
   ```
   🛑 Force exit requested. Saving results immediately...
   💾 Saving partial results before exit...
   💾 Saving progress for resume...
   ```

### What Gets Saved

- **Every completed test** (regardless of pass/fail/bug status)
- **Timestamp** of last save
- **Products that are 100% complete** (all 3 steps for all width breakpoints)

## Resuming Tests

### Resume Behavior

When you resume tests, the tool:

1. Loads the progress file
2. Shows you what's already completed:
   ```
   ✓ Loaded progress: 0 products fully completed
   ✓ 3 individual test(s) already completed
   Will skip completed tests
   ```

3. Skips individual tests that are already done:
   ```
   ⏭️  Skipping STEP 1 (144" height test) for 3% Catalina - already completed
   ⏭️  Skipping 3% Catalina @ 112" - already completed
   ```

4. Continues testing from where you left off

### Example Scenario

**Initial Run:**
```
Testing Product: 3% Catalina
  📏 STEP 1: Testing 144" height capability
  ✅ PASS
  💾 Saving progress...
  
  📏 STEP 2: Testing width 110"
  ✅ PASS
  💾 Saving progress...
  
  📏 STEP 2: Testing width 116"
  ✅ PASS
  💾 Saving progress...
  
  [Ctrl+C pressed]
  💾 Saving progress for resume...
```

**Resume Run:**
```
✓ Loaded progress: 0 products fully completed
✓ 3 individual test(s) already completed

Testing Product: 3% Catalina
  ⏭️  Skipping STEP 1 (144" height test) - already completed
  ⏭️  Skipping 3% Catalina @ 112" - already completed
  ⏭️  Skipping 3% Catalina @ 118" - already completed
  
  📏 STEP 2: Testing width 124"
  [continues from here...]
```

## Key Features

### ✅ Save After Every Test
- You see `💾 Saving progress...` after every single test
- No progress is ever lost, even if you stop mid-product

### ✅ Resume from Exact Point
- Skips all completed tests when you resume
- Shows exactly what's being skipped

### ✅ Works with All Exit Methods
- **Graceful shutdown** (1st Ctrl+C): Completes current test, saves progress
- **Force exit** (2nd Ctrl+C): Saves partial results and progress immediately
- **Successful completion**: Clears progress file automatically

### ✅ Handles All Test Types
- STEP 1: 144" height tests
- STEP 2: Regular width breakpoint tests
- STEP 3: Max width restriction tests

## Benefits

### No Wasted Effort
- Every test is tracked immediately
- Stop at any point without losing work
- Resume exactly where you left off

### Flexible Testing
- Test in multiple sessions
- Can interrupt and resume anytime
- Perfect for long test runs

### Clear Visibility
```
💾 Saving progress...                    ← After each test
✓ 8 test(s) already completed           ← When resuming
⏭️  Skipping ... - already completed     ← Shows what's skipped
```

## Technical Notes

### Progress Saved Unconditionally
- Progress is saved after **every test**, not just successful ones
- This includes tests that result in BUG, FAIL, or UNEXPECTED statuses
- Only ERROR and SKIPPED tests might not be tracked (since they often indicate a problem)

### Force Exit Behavior
- If results exist, they're saved
- If any tests are in progress tracker, progress is saved
- This ensures you never lose work, even with abrupt termination

## Start Fresh vs Resume

### Resume
- Loads existing progress
- Skips completed tests
- Continues from where you left off
- **Shows progress summary on startup**

### Start Fresh
- Clears all progress tracking
- Creates new timestamped results file
- **Preserves old results files** (doesn't delete them)
- Retests everything from scratch

## Troubleshooting

### "I stopped but progress wasn't saved"
- Check if you see `💾 Saving progress...` messages during testing
- If not, the test might have been interrupted before completion
- Try waiting for a test to fully complete before stopping

### "Resume is retesting things I already tested"
- Check if `.progress-*.json` file exists in `test-results/`
- Verify you selected "Resume" and not "Start fresh"
- Check the progress file contains your test keys

### "Want to clear progress manually"
- Delete `.progress-*.json` files in `test-results/`
- Or select "Start fresh" when prompted

## Console Output Guide

| Message | Meaning |
|---------|---------|
| `💾 Saving progress...` | Progress saved after test |
| `✓ 8 test(s) already completed` | Loaded progress on resume |
| `⏭️  Skipping ... - already completed` | Test was done previously |
| `💾 Saving progress for resume...` | Progress saved on shutdown |

