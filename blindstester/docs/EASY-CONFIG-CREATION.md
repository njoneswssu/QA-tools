# Easy Config File Creation

## What is a Config File?

A **config file** tells the tool:
1. **What products to test** (e.g., "3% Catalina", "Light Filtering")
2. **Width breakpoints** - At what widths to test
3. **Max heights** - What the maximum height should be at each width

This information comes from **your grid image** - the screenshot showing max height limits.

## Why Do You Need It?

The tool needs to know what's in your grid image so it can:
- Test the correct product names
- Test at the right widths
- Verify the correct max heights

**Previously:** You had to manually create this file by copying and editing JavaScript code.

**Now:** Use the **Easy Config Generator** that asks you simple questions!

## Easy Way: Use the Config Generator

### Step 1: Run the Generator

```bash
npm run create-config
```

### Step 2: Answer Simple Questions

The tool will ask you:

```
╔════════════════════════════════════════════╗
║     Config File Generator - Easy Mode      ║
╚════════════════════════════════════════════╝

First, tell me about your configuration:

  Config name (e.g., "motorization-solar-home-depot"): motorization-solar-home-depot

What's the configurator URL?

  URL: https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389

Grid image should be at: configs/grids/motorization-solar-home-depot.png
  ✓ Grid image found!

📊 Now let's extract the test data from your grid image:

  (Look at your grid image while answering these questions)

━━━ Product #1 ━━━

  Product name (e.g., "3% Catalina" or "Light Filtering"): Light Filtering

  Now enter the width breakpoints for this product.
  For each width column in your grid, enter the width and max height.

    Width breakpoint #1:
      Width (inches, e.g., 72): 72
      Max height at this width (e.g., 96): 96
      ✓ Added: 72" width, max 96" height

      Add another width for this product? (y/n): y

    Width breakpoint #2:
      Width (inches, e.g., 72): 96
      Max height at this width (e.g., 96): 72
      ✓ Added: 96" width, max 72" height

      Add another width for this product? (y/n): n

  ✓ Added product "Light Filtering" with 2 width breakpoints

Add another product? (y/n): y

━━━ Product #2 ━━━

  Product name: Room Darkening
  ...
```

### Step 3: File Created!

```
✅ Config file created successfully!

📁 Saved to: configs/motorization-solar-home-depot-config.js
📊 Products: 2
🔗 URL: https://www.homedepot.com/...

━━━ Summary ━━━

  1. Light Filtering
     2 width breakpoints: 72", 96"
  2. Room Darkening
     2 width breakpoints: 72", 96"

🚀 Next Steps:

  1. Run: npm start
  2. Select your lift type, model, and brand
  3. URL and config are already set up!

✓ Ready to test!
```

## Complete Example Workflow

### Scenario: Testing Solar Shades at Home Depot

**You have:**
- Grid image showing max heights for "Light Filtering" and "Room Darkening"
- Configurator URL

**Step 1: Save Grid Image**
```bash
# Save your screenshot as:
configs/grids/motorization-solar-home-depot.png
```

**Step 2: Run Config Generator**
```bash
npm run create-config
```

**Step 3: Answer Questions**
- Config name: `motorization-solar-home-depot`
- URL: `https://www.homedepot.com/custom-blinds/...`
- Product 1: `Light Filtering`
  - Width 72", max height 96"
  - Width 96", max height 72"
- Product 2: `Room Darkening`
  - Width 72", max height 96"
  - Width 96", max height 72"

**Step 4: File Created**
- `configs/motorization-solar-home-depot-config.js` ✓

**Step 5: Run Tests**
```bash
npm start
```
- Select: 5 (Motorization), 2 (Solar), 1 (Home Depot)
- URL and config already set up!
- Tests run immediately! ✓

## Reading Your Grid Image

Your grid image typically looks like this:

```
Product Name    | 72" Width | 96" Width | 120" Width
----------------|-----------|-----------|------------
Light Filtering |    96"    |    72"    |    48"
Room Darkening  |    96"    |    72"    |    48"
Blackout        |    84"    |    60"    |    36"
```

**How to read it:**
- **Product Name:** What to test (first column)
- **Width columns:** Test widths (72", 96", 120")
- **Heights in cells:** Max height allowed at that width

**When entering data:**
- For "Light Filtering" at 72" width → max height is 96"
- For "Light Filtering" at 96" width → max height is 72"
- For "Light Filtering" at 120" width → max height is 48"

## Tips for Using the Generator

### Tip 1: Have Your Grid Image Open
Open the grid image on your screen while running the generator so you can easily read the values.

### Tip 2: Enter Data Width by Width
For each product, enter all its width breakpoints before moving to the next product.

### Tip 3: Press Enter to Stop
If you accidentally start entering a product or width, just press Enter without typing anything to skip it.

### Tip 4: Double-Check Your Data
After the generator shows the summary, verify the numbers match your grid image before running tests.

## Manual Method (Advanced)

If you prefer to create the config file manually:

```bash
# 1. Copy the example
cp configs/example-config.js configs/your-config-name-config.js

# 2. Edit the file
# Update:
#   - name: Your configuration name
#   - url: Your configurator URL
#   - gridImage: Path to your grid image
#   - testData: Extract from your grid image
```

## Config File Format

The generated file looks like this:

```javascript
export const config = {
  name: "motorization-solar-home-depot",
  url: "https://www.homedepot.com/custom-blinds/...",
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
    {
      product: "Room Darkening",
      widthBreakpoints: [
        { width: 72, maxHeight: 96 },
        { width: 96, maxHeight: 72 },
        { width: 120, maxHeight: 48 }
      ]
    }
  ]
};
```

## Troubleshooting

### "Config file not found"

**Solution:** Run `npm run create-config` to generate it.

### "Grid image not found"

**Solution:** Save your grid screenshot to the path shown (usually `configs/grids/your-config-name.png`)

### Wrong Test Data

**Solution:** 
1. Delete the config file
2. Run `npm run create-config` again
3. Enter the correct values from your grid image

### Tool Tests Wrong Products

**Solution:** Make sure the product names in your config exactly match the names in the configurator (e.g., "Light Filtering" not "light filtering")

## Quick Reference

**Create config file:**
```bash
npm run create-config
```

**Then run tests:**
```bash
npm start
```

**That's it!** No manual file editing required!

---

**Why This is Easier:**

❌ **Old Way:** Copy example file, understand JavaScript syntax, manually format data  
✅ **New Way:** Answer simple questions, file created automatically

The tool still needs the same information (products, widths, heights) but now you just **tell** it what's in your grid image instead of formatting JavaScript code yourself!
