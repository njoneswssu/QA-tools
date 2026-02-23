# Resume Tests - Same File Continuation

## Overview

When you resume a test (after stopping with Ctrl+C), the results now append to the **same file** you were using before, rather than creating a new timestamped file. This keeps all results for a configuration together.

## How It Works

### First Test Run (Fresh Start)

1. You start tests for "Medium Cassette Valance - Solar - Home Depot"
2. Results filename is generated: `medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json`
3. You test a few widths, then stop with Ctrl+C
4. Progress is saved to `.progress-Medium Cassette Valance - Solar - Home Depot.json` including:
   - Which tests are completed
   - The results filename: `medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json`

### Resuming Tests

1. You run `npm start` again and select the same configuration
2. Progress file is detected and shows:
   ```
   📋 Previous test progress found!
      3 individual test(s) completed
      Partial progress for:
        1. 3% Catalina (widths: 82", 88")
   
      📄 Will append to: medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json
   ```
3. You select "Resume"
4. **Results append to the SAME file** - not a new one
5. Grid reports (grid.txt and compact.txt) are updated with all results

### Starting Fresh

1. You run `npm start` and see the progress prompt
2. You select "Start fresh"
3. Progress is cleared
4. **A NEW timestamped file is created**: `medium-cassette-valance---solar---home-depot-2026-02-06T22-30-00.json`
5. Old files are preserved

## File Behavior

### Resume (Option 1)
- ✅ Uses same JSON file
- ✅ Uses same grid report files  
- ✅ Appends new results to existing data
- ✅ Updates grid reports with all tests
- ✅ No duplicate files

### Start Fresh (Option 2)
- ✅ Creates new timestamped JSON file
- ✅ Creates new grid report files
- ✅ Preserves all old files
- ✅ Starts testing from beginning

## Example Workflow

**Day 1 - Testing:**
```
📦 Testing Product: 1% Catalina
   📏 STEP 2: Testing width 82"
   ✅ PASS
   💾 Saving progress...
   
   📏 STEP 2: Testing width 88"  
   ✅ PASS
   💾 Saving progress...
   
   [Ctrl+C - Stop for the day]
   💾 Saving progress for resume...
   
Files created:
   - medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json
   - medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00-grid.txt
   - medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00-compact.txt
   - .progress-Medium Cassette Valance - Solar - Home Depot.json
```

**Day 2 - Resume:**
```
npm start

📋 Previous test progress found!
   2 individual test(s) completed
   Partial progress for:
     1. 1% Catalina (widths: 82", 88")
   
   What would you like to do?
   
     1. Resume from where you left off
     2. Start fresh
     3. Exit
   
   Selection: 1

📄 Will append to: medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json

Testing Product: 1% Catalina
  ⏭️  Skipping 1% Catalina @ 84" - already completed
  ⏭️  Skipping 1% Catalina @ 90" - already completed
  
  📏 STEP 2: Testing width 96"
  ✅ PASS
  💾 Saving progress...
  
  [Continue testing...]
  
Files updated (SAME files):
   - medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json (appended)
   - medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00-grid.txt (updated)
   - medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00-compact.txt (updated)
```

## Benefits

### 1. Organized Results
- All tests for a configuration stay in one file
- Easy to track progress over multiple sessions
- No need to merge multiple result files

### 2. Consistent Reports
- Grid reports show complete picture
- No confusion about which file has the latest results
- Historical view of testing progress

### 3. File Management
- Fewer files to manage
- Clear distinction between "resume" (same file) and "start fresh" (new file)
- Old results preserved when starting fresh

## Technical Details

### Progress File Structure
```json
{
  "completedProducts": [],
  "completedTests": {
    "1% Catalina": ["82", "88"]
  },
  "lastUpdated": "2026-02-06T22:24:30.000Z",
  "resultsFilename": "test-results/medium-cassette-valance---solar---home-depot-2026-02-06T22-24-00.json"
}
```

### Filename Tracking
- When tests start, `resultsFilename` is saved to progress file
- When resuming, `resultsFilename` is loaded from progress
- `options.output` is set to the saved filename
- All result saving operations use this consistent filename

### Append Behavior
- `saveResults()` method loads existing JSON if file exists
- New results are appended to `results` array
- File is overwritten with combined data
- Grid reports are regenerated with all results

## Notes

- **Same configuration required**: Resume only works for the same configuration
- **File preservation**: Starting fresh never deletes old files
- **Multiple sessions**: Can resume any number of times from the same progress
- **Manual cleanup**: You can manually delete old files when no longer needed
