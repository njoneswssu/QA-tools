# Parser Fix - Title Row Support

## Problem

User's grid has a **title row** before the actual header:

```
MOTORIZATION (InMotion and Wand)  CONTROL + OPEN ROLL  LIMITATIONS  BY  COLLECTION  ← Title row
Width To:  36"  42"  48"  54"  60"  66"  72"  ...                                    ← Header row
3% Catalina  144  144  144  144  144  144  144  ...                                 ← Data rows
5% Catalina  144  144  144  144  144  144  144  ...
```

Old parser assumed the **first line** was the header, so it was looking for widths in the title row and failing.

## Solution

Updated `parseGridData()` to **auto-detect** the header row:

### New Logic

1. **Check first 5 lines** for header row
2. **Count numeric columns** in each line (e.g., `36"`, `42"`, `48"`)
3. **First line with 3+ width columns** = header row
4. **Parse products** starting from the row after header

### Output

```
📊 Parsing grid data...

Checking 5 lines for header row...

  Line 1: 5 columns, first 3: MOTORIZATION (InMotion and Wand) | CONTROL + OPEN ROLL | LIMITATIONS
  Line 2: 20 columns, first 3: Width To: | 36" | 42"
  ✓ Found header row at line 2 with 19 width columns

✓ Found 19 width columns: 36", 42", 48", ..., 144"
✓ Successfully parsed 5 products!
```

## Changes Made

### 1. Updated `parseGridData()` in `index.js`

**Before:**
```javascript
const headerParts = splitLine(lines[0]); // Always used first line
```

**After:**
```javascript
// Auto-detect header row
for (let i = 0; i < Math.min(5, lines.length); i++) {
  const parts = splitLine(lines[i]);
  const widthCount = parts.filter(p => /^\d+\"?$/.test(p)).length;
  
  if (widthCount >= 3) {
    headerIndex = i;
    headerParts = parts;
    break;
  }
}
```

### 2. Updated Loop to Start After Header

**Before:**
```javascript
for (let i = 1; i < lines.length; i++) { // Always started at line 1
```

**After:**
```javascript
for (let i = headerIndex + 1; i < lines.length; i++) { // Start after header
```

### 3. Updated Test Script

Added title row to `test-your-grid.js` to verify it works with real data format.

## Benefits

Now supports grids with:
- ✅ Title rows
- ✅ Multiple header lines
- ✅ Notes or metadata before data
- ✅ Any format where header row contains width columns like `36"`, `42"`, `48"`

## Backward Compatible

Still works with grids that:
- ✅ Start directly with header row (no title)
- ✅ Have "Width To:" label
- ✅ Have just numbers without "Width To:"

## Testing

Run this to verify:

```bash
node test-your-grid.js
```

Expected:
```
✓ Found header row at line 2 with 19 width columns
✓ Successfully parsed 5 products!
```

## How to Use

When you run `npm start` and paste your grid:

1. **Include everything** - title rows, header, data rows
2. Type `done`
3. Press Enter

The parser will:
- Skip the title row automatically
- Find the actual header row with widths
- Parse all products correctly

---

**Status:** Complete ✅

The parser now intelligently detects the header row regardless of title rows or metadata above it.
