# Fixing OCR Extraction Errors

## The Problem

OCR (Optical Character Recognition) sometimes misreads product names from grid images, especially if:
- Image quality is poor
- Font is small or unusual
- Special characters are present
- Contrast is low

## Example

**What OCR extracted:**
```
[sbewpore — [raal taal
```

**What it should be:**
```
Light Filtering
```

## How to Check OCR Results

After OCR auto-creates a config file, verify it:

```bash
npm run verify-ocr configs/motorization-solar-home-depot-config.js
```

**Output:**
```
╔════════════════════════════════════════════╗
║         OCR Extraction Results             ║
╚════════════════════════════════════════════╝

1. "[mation Traal vas" ⚠️  INCORRECT OCR
2. "[stacscia — Tiaaliaal" ⚠️  INCORRECT OCR
3. "[sbewpore — [raal taal" ⚠️  INCORRECT OCR

⚠️  PRODUCT NAMES NEED CORRECTION
```

## How to Fix

### Step 1: Open Config File

```bash
# Open the config file in your editor
code configs/motorization-solar-home-depot-config.js
```

### Step 2: Look at Your Grid Image

Open your grid image side-by-side to see the actual product names:
```
configs/grids/motorization-solar-home-depot.png
```

### Step 3: Replace Product Names

Find the garbled text and replace with correct names:

**Before:**
```javascript
{
  product: "[sbewpore — [raal taal",  // ⚠️ Wrong!
  widthBreakpoints: [...]
}
```

**After:**
```javascript
{
  product: "Light Filtering",  // ✓ Correct!
  widthBreakpoints: [...]
}
```

### Step 4: Verify Again

```bash
npm run verify-ocr configs/motorization-solar-home-depot-config.js
```

**Output:**
```
1. "Light Filtering" ✓
2. "Room Darkening" ✓
3. "Blackout" ✓

✅ All product names look correct!
```

## Common Solar Shade Product Names

When fixing OCR errors, these are common names you'll see:

- **Light Filtering** - Semi-transparent
- **Room Darkening** - Blocks most light
- **Blackout** - Blocks all light
- **Screen 3%** - 3% openness
- **Screen 5%** - 5% openness
- **Screen 10%** - 10% openness
- **Solar Screen** - General sun blocking
- **Designer** - Premium line
- **Translucent** - See-through

## Why Product Names Matter

The tester uses product names to:
1. **Select colors** - Looks for matching color swatches
2. **Report results** - Shows which product passed/failed
3. **Save results** - Organizes by product name

**Wrong name = tests might fail or select wrong colors!**

## Alternative: Manual Config Creation

If OCR consistently fails, use the paste method instead:

```bash
npm run create-config
# Select option 2: Paste from spreadsheet
# Copy from your grid (Excel/Sheets)
# Paste - will be more accurate!
```

## Complete Example

### 1. OCR Auto-Created Bad Config

```bash
npm start
# Select: 5, 2, 1 (Motorization, Solar, Home Depot)
# Select: 1 (Read grid image)

# OCR creates config with garbage names:
# "[sbewpore — [raal taal"
```

### 2. Verify OCR

```bash
npm run verify-ocr configs/motorization-solar-home-depot-config.js

# Shows 3 products with incorrect names
```

### 3. Fix Config File

```bash
code configs/motorization-solar-home-depot-config.js

# Look at grid image side-by-side
# Replace garbled names:
#   "[sbewpore — [raal taal" → "Light Filtering"
#   "[mation Traal vas" → "Room Darkening"
#   "[stacscia — Tiaaliaal" → "Blackout"
```

### 4. Verify Again

```bash
npm run verify-ocr configs/motorization-solar-home-depot-config.js

# ✅ All product names look correct!
```

### 5. Run Tests

```bash
npm start
# Select same configuration
# Config loads instantly
# Tests run with correct product names! ✓
```

## Pro Tips

### Tip 1: Check Width Values Too

The verifier also shows widths and heights. If these look wrong:
```
Widths: 36", 66", 14", 126", 348"
Max Heights: 14", 12", 1", 14", 14"
```

Check if:
- Widths are reasonable (usually 36-144")
- Heights are reasonable (usually 48-144")
- Values match your grid image

### Tip 2: Use Better Grid Images

For better OCR results:
- ✅ High resolution screenshots
- ✅ Good contrast (dark text, light background)
- ✅ Clear, readable fonts
- ✅ No shadows or glare

### Tip 3: Paste Method More Reliable

If OCR keeps failing:
```bash
npm run create-config
# Choose option 2: Paste from spreadsheet
# Much more accurate!
```

## Quick Reference

**Check OCR results:**
```bash
npm run verify-ocr configs/your-config.js
```

**Fix incorrect names:**
```bash
# 1. Open config file
# 2. Look at grid image
# 3. Replace garbled names with real names
# 4. Save file
# 5. Verify again
```

**Avoid OCR issues:**
```bash
npm run create-config
# Choose option 2: Paste from spreadsheet
# More reliable than OCR!
```

---

**Remember:** Wrong product names = wrong tests!  
Always verify OCR results before running tests.
