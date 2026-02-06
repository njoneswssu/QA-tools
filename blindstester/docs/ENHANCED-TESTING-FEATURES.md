# Enhanced Testing Features

## Important System Constraint

**Maximum Height: 144"**
- The configurator cannot accept heights above 144"
- All test heights are capped at 144" maximum
- When testing "above max height", heights are constrained to: `min(maxHeight + 20, 144)`

**Examples:**
- maxHeight = 90" → test at random height between 91"-110"
- maxHeight = 132" → test at random height between 133"-144" (capped)
- maxHeight = 144" → test at 144" in STEP 1, skip in STEP 2

## New Features Implemented

### 1. Random Mount Selection ✅

**What Changed:**
- Mount type is now randomly selected for each test (inside or outside)
- Previously: Always used "inside" mount
- Now: 50/50 chance of inside or outside mount

**Why:**
- Tests both mount types to ensure restrictions work for both
- More comprehensive coverage
- Matches real-world usage patterns

**Implementation:**
```javascript
const mountType = Math.random() < 0.5 ? 'inside' : 'outside';
await this.selectMountType(mountType);
```

**Output:**
```
🧪 Testing: 3% Catalina @ 112" width
   Max Height: 132" | Testing: 145"
   Mount: outside  ← Shows which mount was selected
```

---

### 2. Max Width Testing ✅

**What Changed:**
- After testing all width breakpoints, tests one width BEYOND the maximum width in the table
- Verifies that headrail option becomes unavailable when width exceeds maximum

**Test Logic:**
1. Find maximum width from all breakpoints
2. Test at `maxWidth + 12"` (12 inches beyond max)
3. Use reasonable height (72") for the test
4. **Expected:** Headrail should NOT be available

**Example:**
```
📏 STEP 3: Testing max width restriction
   Max width in table: 144"
   Testing at: 156" (beyond max width)
   Headrail should NOT be available

✅ PASS: Width 156" exceeds max - Single headrail correctly unavailable
```

**Or for bugs:**
```
🐛 BUG: Width 156" exceeds max - Single headrail still available!
```

---

### 3. 144" Height Test (First) ✅

**What Changed:**
- Before testing other widths, first tests one width at exactly 144" height
- Only runs if a breakpoint with maxHeight=144" exists
- Verifies that 144" is allowed and headrail is available

**Test Logic:**
1. Find a width breakpoint that supports 144" height
2. Test at `width - 2"` and exactly `144"` height
3. **Expected:** Headrail SHOULD be available (not restricted at 144")

**Why This Matters:**
- Ensures 144" configurations are actually configurable
- Catches cases where system is overly restrictive at maximum height
- Verifies baseline functionality before testing restrictions

**Example:**
```
📏 STEP 1: Testing 144" height capability @ 112" width
   Verifying that 144" height is allowed with headrail available

✨ 144" Test: Verifying 144" height is allowed
   Mount: inside

✅ PASS: 144" height allowed - Single headrail available
```

**Or for bugs:**
```
🐛 BUG: 144" height - Single headrail NOT available (should be available)!
```

---

## Test Sequence Now

### For Each Product:

#### STEP 1: 144" Height Test (if applicable)
- Find a breakpoint with maxHeight = 144"
- Test at that width and 144" height
- Verify headrail IS available
- **Purpose:** Ensure 144" works before testing restrictions

#### STEP 2: Regular Width Breakpoint Tests
- For each width breakpoint (except those with maxHeight = 144"):
  - Test at `width - 2"` (before breakpoint)
  - Test at random height above max: `min(maxHeight + random(1-20), 144)`
  - **Height is capped at 144"** (system maximum)
  - Verify headrail is NOT available (should be blocked)
- **Purpose:** Test height restrictions at each width
- **Note:** Breakpoints with maxHeight=144" are skipped (already tested in STEP 1)

#### STEP 3: Max Width Test
- Test at `maxWidth + 12"` (beyond maximum width in table)
- Test at 72" height (reasonable height)
- Verify headrail is NOT available
- **Purpose:** Ensure width restrictions work

---

## Test Results Fields

### New Fields Added:

```json
{
  "product": "3% Catalina",
  "width": 112,
  "maxHeight": 132,
  "testHeight": 145,
  "mountType": "outside",        // NEW: inside or outside
  "isMaxWidthTest": false,       // NEW: true for max width tests
  "is144Test": false,            // NEW: true for 144" tests
  "singleAvailable": false,
  "status": "PASS"
}
```

---

## Example Test Run

```bash
npm start
# Select: Motorization
# Select: Solar
# Select: Home Depot
# Paste data...

🎯 Starting test for motorization-solar-home-depot

📦 Testing Product: 3% Catalina

📏 STEP 1: Testing 144" height capability @ 112" width
   Verifying that 144" height is allowed with headrail available

🧪 Testing: 3% Catalina @ 112" width
   Max Height: 144" | Testing: 144"
   ✨ 144" Test: Verifying 144" height is allowed
   Mount: inside
   
✓ Color CONFIRMED selected: 3% Catalina
🔍 Checking if Single headrail is available...
✓ Single headrail IS available
✅ PASS: 144" height allowed - Single headrail available

📏 STEP 2: Testing width 112" (max height: 132")
   Testing at 145" (randomly selected above max height)

🧪 Testing: 3% Catalina @ 112" width
   Max Height: 132" | Testing: 145"
   Mount: outside
   
✓ Color CONFIRMED selected: 3% Catalina
🔍 Checking if Single headrail is available...
✓ Single headrail NOT available (only "2 on 1" found)
✅ PASS: Correctly blocked 145" (max: 132") - Single headrail not available

📏 STEP 2: Testing width 130" (max height: 90")
   Testing at 105" (randomly selected above max height, capped at 144")

🧪 Testing: 3% Catalina @ 130" width
   Mount: inside
   ...

📏 STEP 2: Testing width 112" (max height: 138")
   Testing at 144" (randomly selected above max height, capped at 144")
   
🧪 Testing: 3% Catalina @ 112" width
   Max Height: 138" | Testing: 144"
   Mount: outside
   
✓ Color CONFIRMED selected: 3% Catalina
🔍 Checking if Single headrail is available...
✓ Single headrail NOT available
✅ PASS: Correctly blocked 144" (max: 138") - Single headrail not available

📏 STEP 3: Testing max width restriction
   Max width in table: 144"
   Testing at: 156" (beyond max width)
   Headrail should NOT be available

🧪 Testing: 3% Catalina @ 156" width
   Max Height: 72" | Testing: 72"
   ⚠️  Max Width Test: Testing beyond max width
   Mount: outside
   
✓ Color CONFIRMED selected: 3% Catalina
🔍 Checking if Single headrail is available...
✓ Single headrail NOT available
✅ PASS: Width 156" exceeds max - Single headrail correctly unavailable
```

---

## Test Status Values

### For Regular Tests (height above max):
- **PASS:** Height > max AND headrail NOT available ✅
- **BUG:** Height > max BUT headrail IS available 🐛
- **UNEXPECTED:** Other combinations ⚠️

### For 144" Tests:
- **PASS:** 144" height AND headrail IS available ✅
- **BUG:** 144" height BUT headrail NOT available 🐛

### For Max Width Tests:
- **PASS:** Width > max AND headrail NOT available ✅
- **BUG:** Width > max BUT headrail IS available 🐛

---

## Benefits

### 1. Random Mount Testing
✅ Tests both mount types automatically
✅ No need for separate test runs
✅ Better coverage with same number of tests

### 2. Max Width Testing
✅ Catches width restriction bugs
✅ Ensures system properly limits available widths
✅ Tests edge cases beyond normal width breakpoints

### 3. 144" Height Testing
✅ Verifies baseline functionality first
✅ Catches overly restrictive systems
✅ Ensures maximum height is actually usable
✅ Fails fast if fundamental config is broken

---

## What Gets Tested Now

### Per Product:

1. **1 test** at 144" height (if supported)
2. **N tests** for N width breakpoints (height above max)
3. **1 test** beyond max width

**Example:** Product with 5 width breakpoints
- Old: 5 tests
- New: 7 tests (1 @ 144", 5 regular, 1 max width)

### Coverage:

- ✅ Both mount types (random)
- ✅ All width breakpoints
- ✅ Heights above maximum (random selection)
- ✅ Maximum height capability (144")
- ✅ Width restrictions (beyond max)

---

## Files Changed

### `/Users/neil/playwrightautomation/blindstester/index.js`

1. **testConfiguration()** - Added parameters:
   - `isMaxWidthTest` - Flag for max width tests
   - `is144Test` - Flag for 144" tests
   - Random mount selection
   - New test logic for each test type

2. **runTests()** - New test sequence:
   - STEP 1: 144" test first
   - STEP 2: Regular width tests
   - STEP 3: Max width test last

3. **Test result object** - New fields:
   - `mountType` - "inside" or "outside"
   - `isMaxWidthTest` - boolean
   - `is144Test` - boolean

---

**Status:** Complete ✅

All three enhancements implemented and working:
1. ✅ Random mount selection (inside/outside)
2. ✅ Max width testing (beyond table max)
3. ✅ 144" height test first (baseline verification)
