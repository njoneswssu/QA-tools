# How to Paste Your Grid Data

## Your Grid Format

Your grid looks like this (from your screenshot):

```
Width To:    36"  42"  48"  54"  60"  66"  72"  78"  84"  90"  96"  102"  108"  114"  120"  126"  132"  138"  144"
3% Catalina  144  144  144  144  144  144  144  144  144  144  144  144   144   132    90    54     -     -     -
5% Catalina  144  144  144  144  144  144  144  144  144  144  144  144   144   132    90    54     -     -     -
1% Catalina  144  144  144  144  144  144  144  144  144  144  144  144   144    96    72    48     -     -     -
...
```

## How to Paste

### Step 1: Select Cells in Your Spreadsheet

Select from the header row (Width To:) down to the last product row.

**Include:**
- ✅ Header row with widths (36", 42", 48", ...)
- ✅ All product rows
- ✅ Product names column
- ✅ All width columns with max height values

**Don't include:**
- ❌ Extra columns like "Motorization Max Width", "Fabric Max Width", etc.
- ❌ Empty rows
- ❌ Notes or footer text

### Step 2: Copy

Press **Ctrl+C** (Windows) or **Cmd+C** (Mac)

### Step 3: Paste in Tool

When the tool prompts:

```
📋 Ready to receive grid data!

═══════════════════════════════════════════════════════
Paste your grid (including header row with widths)
Then type "done" on a new line and press Enter
═══════════════════════════════════════════════════════

[Paste here with Ctrl+V or Cmd+V]
[Then type "done" and press Enter]
```

### Step 4: Type "done"

After pasting, on a new line type:
```
done
```

Press Enter.

## Example

### What You Copy:
```
Width To:	36"	42"	48"	60"	66"	72"	78"	84"	90"	96"	102"	108"	114"	120"	126"
3% Catalina	144	144	144	144	144	144	144	144	144	144	144	144	132	90	54
5% Catalina	144	144	144	144	144	144	144	144	144	144	144	144	132	90	54
1% Catalina	144	144	144	144	144	144	144	144	144	144	144	144	96	72	48
10% Solapur	144	144	144	144	144	144	144	144	144	144	144	144	96	72	48
```

### What You Paste:
1. Ctrl+V or Cmd+V
2. Type "done"
3. Press Enter

### What Tool Shows:
```
📊 Parsing grid data...

✓ Found 15 width columns: 36", 42", 48", 60", 66", 72", 78", 84", 90", 96", 102", 108", 114", 120", 126"

  1. 3% Catalina - 15 widths
  2. 5% Catalina - 15 widths
  3. 1% Catalina - 15 widths
  4. 10% Solapur - 15 widths

✓ Successfully parsed 4 products!
```

## Tips

### Tip 1: Include Full Header Row

Make sure your header row has "Width To:" or width values like "36", "42", "48"

The parser looks for numbers with `"` to detect width columns.

### Tip 2: Tab-Separated is Best

Copy directly from Excel preserves tabs, which makes parsing more reliable.

### Tip 3: Don't Include Extra Columns

Only include:
- Product name column
- Width columns with max height values

Skip columns like "Motorization Max Width", "RR?", "Moto Group", etc.

### Tip 4: Dashes are OK

If a cell has "-" (no value), the parser will skip it. That's fine!

## Troubleshooting

### "Could not find width columns"

**Problem:** Header row missing or doesn't have width values

**Fix:** Make sure first row includes widths like: `36"  42"  48"`

### "Not enough lines"

**Problem:** Didn't paste enough data

**Fix:** Include header row + at least 1 product row

### "Successfully parsed 0 products"

**Problem:** Data format not recognized

**Fix:** 
1. Make sure data is tab-separated or space-separated
2. Include product names in first column
3. Include numeric values in other columns

## Quick Test

You can test the parser with your data:

```bash
node test-paste-parser.js
```

This shows if the parser can read your format!

---

**Key Point:** After pasting, type "done" and press Enter to finish!
