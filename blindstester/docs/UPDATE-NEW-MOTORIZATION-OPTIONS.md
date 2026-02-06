# Update: Added 3 New Motorization Lift Types

## What's New

Added **3 new motorization lift type options** to the first menu:

10. **Motorization Wand**
11. **Motorization Wand 2 on 1**
12. **Motorization TDBU**

These appear before the "Delete All Test Results" option (now option 13).

## Updated Menu

```
🎯 What do you want to test?

  1. Cordless
  2. Cordloop
  3. Medium Cassette Valance
  4. Large Cassette Valance
  5. Motorization
  6. Cordless 2 on 1
  7. Cordloop 2 on 1
  8. Large Cassette Valance 2 on 1
  9. Motorization 2 on 1
  10. Motorization Wand                    ← NEW!
  11. Motorization Wand 2 on 1            ← NEW!
  12. Motorization TDBU                   ← NEW!

  13. 🗑️  Delete All Test Results

  Enter number (1-13) or press Enter to skip interactive mode:

  Selection: _
```

## Example Usage

### Test Motorization Wand with Solar Shades at Home Depot

```bash
npm start
```

**Step 1:** Select `10` (Motorization Wand)
**Step 2:** Select `2` (Solar)
**Step 3:** Select `1` (Home Depot)
**Step 4:** Paste configurator URL (if first time)

**Generated files:**
- Grid: `configs/grids/motorization-wand-solar-home-depot.png`
- Config: `configs/motorization-wand-solar-home-depot-config.js`
- URL saved in: `configs/saved-configs.json`

### Test Motorization TDBU with Cellular at Lowe's

```bash
npm start
```

**Step 1:** Select `12` (Motorization TDBU)
**Step 2:** Select `9` (Cellular)
**Step 3:** Select `2` (Lowe's)
**Step 4:** Paste configurator URL (if first time)

**Generated files:**
- Grid: `configs/grids/motorization-tdbu-cellular-lowes.png`
- Config: `configs/motorization-tdbu-cellular-lowes-config.js`
- URL saved in: `configs/saved-configs.json`

## File Naming Examples

| Lift Type | Model | Brand | Config Key |
|-----------|-------|-------|------------|
| Motorization Wand | Roller | Home Depot | `motorization-wand-roller-home-depot` |
| Motorization Wand 2 on 1 | Solar | Lowe's | `motorization-wand-2on1-solar-lowes` |
| Motorization TDBU | Cellular | Home Depot | `motorization-tdbu-cellular-home-depot` |

## Total Configurations Updated

**Before:** 9 lift types × 20 models × 2 brands = **360 configurations**

**After:** 12 lift types × 20 models × 2 brands = **480 configurations**

**Added:** 120 new possible configurations!

## What is TDBU?

TDBU stands for **Top Down Bottom Up** - a motorization option that allows controlling the shade from both the top and bottom, giving you more flexibility in light control and privacy.

## Changes Made

### Code Changes

**File:** `index.js`

1. Added 3 new entries to `LIFT_TYPES` object:
   ```javascript
   'motorization-wand': 'Motorization Wand',
   'motorization-wand-2on1': 'Motorization Wand 2 on 1',
   'motorization-tdbu': 'Motorization TDBU'
   ```

2. Updated menu prompt from "1-10" to "1-13"

### Documentation Updates

1. **docs/ENHANCED-INTERACTIVE-MODE.md**
   - Updated Step 1 menu to show all 12 lift types + delete option

2. **ENHANCED-INTERACTIVE-COMPLETE.md**
   - Updated lift types count from 9 to 12
   - Updated total configurations from 360 to 480
   - Updated delete option number from 10 to 13

3. **README.md**
   - Updated lift types description

## Backward Compatibility

✅ **All existing features work unchanged**
✅ **Previous configurations still valid**
✅ **Saved URLs preserved**
✅ **Command-line options unchanged**

Only addition is 3 new lift type options - no breaking changes!

## Next Steps

To test these new motorization options:

1. **Run** `npm start`
2. **Select** option 10, 11, or 12
3. **Choose** your model (1-20)
4. **Choose** your brand (1-2)
5. **Paste** configurator URL (first time)
6. **Add** grid image when prompted
7. **Create** config file when prompted
8. **Test runs!**

---

**Updated:** February 6, 2026  
**Changes:** Added Motorization Wand, Motorization Wand 2on1, Motorization TDBU
