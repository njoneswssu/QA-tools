# Super Easy Config Creation - 3 Methods

## The Problem

Manually typing 20 products with multiple width breakpoints each would take **30-45 minutes** and be error-prone.

## The Solution: 3 Easy Methods

Choose the method that works best for you!

### Method 1: Auto-Extract from Image (FASTEST) 🚀

**Time:** ~2 minutes (OCR does the work!)

```bash
npm run create-config
```

**Steps:**
1. Config name: `motorization-solar-home-depot`
2. URL: `https://www.homedepot.com/...`
3. Select: **1** (Auto-extract from grid image)
4. OCR reads your grid image automatically!
5. Preview and confirm
6. Done!

**Best for:** When you have a clear grid screenshot

### Method 2: Paste from Spreadsheet (EASY) 📋

**Time:** ~3 minutes (copy/paste!)

```bash
npm run create-config
```

**Steps:**
1. Config name: `motorization-solar-home-depot`
2. URL: `https://www.homedepot.com/...`
3. Select: **2** (Paste grid data as text)
4. Copy grid from Excel/Google Sheets/Website
5. Paste it
6. Preview and confirm
7. Done!

**Best for:** When you have grid data in a spreadsheet

### Method 3: Manual Entry (FALLBACK) ⌨️

**Time:** ~10-15 minutes

```bash
npm run create-config
```

**Steps:**
1. Config name: `motorization-solar-home-depot`
2. URL: `https://www.homedepot.com/...`
3. Select: **3** (Manual entry)
4. Enter each product and width breakpoint
5. Done!

**Best for:** Small grids (< 5 products) or when other methods don't work

## Complete Examples

### Example 1: Auto-Extract from Image

```bash
npm run create-config
```

```
Smart Config Generator - Auto Extract

Config name: motorization-solar-home-depot
URL: https://www.homedepot.com/custom-blinds/...

How would you like to provide the test data?
  1. Auto-extract from grid image (using OCR)
  2. Paste grid data as text
  3. Manual entry

Selection: 1

🔍 Reading grid image with OCR...
This may take 30-60 seconds...

Progress: 100%

📊 Parsing grid data...

Found 3 width columns: 72", 96", 120"

✓ Found 20 products!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Light Filtering
   72" width → max 96" height
   96" width → max 72" height
   120" width → max 48" height

2. Room Darkening
   72" width → max 96" height
   96" width → max 72" height
   120" width → max 48" height

... (18 more products)

Does this look correct? (y/n): y

✅ Config file created successfully!

📁 Saved to: configs/motorization-solar-home-depot-config.js
📊 Products: 20
🔗 URL: https://www.homedepot.com/...

🚀 Next Steps:
  1. Run: npm start
  2. Select lift type, model, and brand

✓ Ready to test!
```

**Total time:** ~2 minutes! (Most of it is OCR processing)

### Example 2: Paste from Spreadsheet

You have this in Excel:

```
Product Name     | 72" Width | 96" Width | 120" Width
Light Filtering  |    96"    |    72"    |    48"
Room Darkening   |    96"    |    72"    |    48"
Blackout         |    84"    |    60"    |    36"
```

**Steps:**

```bash
npm run create-config
```

```
Config name: motorization-solar-home-depot
URL: https://www.homedepot.com/...

Selection: 2

📋 Paste your grid data:

You can copy from Excel, Google Sheets, or the configurator page.
Format: Product Name [tab/spaces] 72" [tab/spaces] 96" ...

(Paste your data, then press Enter twice to finish)

Product Name     | 72" Width | 96" Width | 120" Width
Light Filtering  |    96"    |    72"    |    48"
Room Darkening   |    96"    |    72"    |    48"
Blackout         |    84"    |    60"    |    36"
[Press Enter]
[Press Enter again]

📊 Parsing pasted data...

Found 3 width columns: 72", 96", 120"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Light Filtering
   72" width → max 96" height
   96" width → max 72" height
   120" width → max 48" height

2. Room Darkening
   72" width → max 96" height
   96" width → max 72" height
   120" width → max 48" height

3. Blackout
   72" width → max 84" height
   96" width → max 60" height
   120" width → max 36" height

Does this look correct? (y/n): y

✅ Config file created successfully!
```

**Total time:** ~3 minutes! (Just copy/paste!)

## Method Comparison

| Method | Time | Ease | Best For |
|--------|------|------|----------|
| **1. Auto-Extract** | 2 min | ⭐⭐⭐⭐⭐ | Clear grid screenshots |
| **2. Paste** | 3 min | ⭐⭐⭐⭐ | Data in spreadsheets |
| **3. Manual** | 10-15 min | ⭐⭐ | Small grids, fallback |

## Tips for Each Method

### Method 1: Auto-Extract Tips

**For best OCR results:**
- ✅ Take a **high-resolution** screenshot
- ✅ Ensure **good contrast** (dark text on light background)
- ✅ Include the **full grid** with headers
- ✅ Avoid **shadows or glare**
- ✅ Save as **PNG** (better quality than JPG)

**If OCR fails:**
- Tool automatically offers Method 2 (paste) as fallback
- Or you can re-run and choose Method 2 manually

### Method 2: Paste Tips

**Accepted formats:**
- ✅ Tab-separated (from Excel copy/paste)
- ✅ Multiple spaces (from text tables)
- ✅ Pipe-separated (from markdown tables)

**Example paste formats:**

**From Excel:**
```
Product Name	72" Width	96" Width
Light Filtering	96"	72"
```

**From Text:**
```
Product Name     72" Width    96" Width
Light Filtering  96"          72"
```

**From Markdown:**
```
| Product Name | 72" Width | 96" Width |
| Light Filtering | 96" | 72" |
```

All work!

### Method 3: Manual Tips

**Shortcuts:**
- Press Enter (empty input) to skip
- Answer "n" to stop adding products/widths
- Faster for small grids (< 5 products)

## What Gets Created

All methods create the same file:

```javascript
export const config = {
  name: "motorization-solar-home-depot",
  url: "https://www.homedepot.com/...",
  gridImage: "configs/grids/motorization-solar-home-depot.png",
  testData: [
    {
      product: "Light Filtering",
      widthBreakpoints: [
        { width: 72, maxHeight: 96 },
        { width: 96, maxHeight: 72 },
        { width: 120, maxHeight: 48 }
      ]
    },
    // ... more products
  ]
};
```

## Troubleshooting

### OCR Returns Garbage

**Cause:** Poor image quality or contrast

**Solution:**
1. Retake screenshot with better lighting
2. Or use Method 2 (paste) instead

### Paste Doesn't Parse

**Cause:** Unusual formatting

**Solution:**
1. Ensure columns are separated by tabs or multiple spaces
2. Or use Method 3 (manual) as fallback

### Preview Shows Wrong Data

**Cause:** Parsing interpreted data incorrectly

**Solution:**
1. Answer "n" to cancel
2. Try a different method
3. Or edit the generated file manually after creation

### Tool Asks for Method but I Want Different One

**Solution:** Just run `npm run create-config` again and choose different option

## Time Savings

### Manual Entry (Old Way)
- 20 products × 3 widths each = 60 entries
- ~30 seconds per entry
- **Total: 30 minutes**
- Plus typing errors!

### Auto-Extract (New Way)
- Take screenshot: 10 seconds
- Run tool: 30 seconds
- OCR processing: 60 seconds
- Review: 20 seconds
- **Total: 2 minutes**
- No typing errors!

### Paste Method (New Way)
- Copy from spreadsheet: 5 seconds
- Run tool: 30 seconds
- Paste: 5 seconds
- Review: 20 seconds
- **Total: 1 minute**
- No typing errors!

## Quick Start

**Fastest way to create a config:**

1. **Have your grid image ready**
2. **Run:**
   ```bash
   npm run create-config
   ```
3. **Choose method 1 or 2**
4. **Done in 2-3 minutes!**

---

**Updated:** February 6, 2026  
**New:** Auto-extract from images + paste from spreadsheets  
**Time saved:** 25-28 minutes per config file!
