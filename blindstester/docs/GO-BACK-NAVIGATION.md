# Go Back Feature - Interactive Navigation

## Overview

Added "Go back" option to model and brand selection menus, allowing you to change previous selections without restarting the tool.

## How It Works

### Navigation Flow

```
Step 1: Lift Type  →  Step 2: Model  →  Step 3: Brand  →  Validation
     ↑                       ↓                    ↓
     └───────────────────────┴────────────────────┘
              (Go back arrows)
```

You can navigate:
- From **Model** → back to **Lift Type**
- From **Brand** → back to **Model**

### Menu Options

#### Step 1: Select Lift Type
```
🎯 What do you want to test?

  1. Cordless
  2. Cordloop
  3. Medium Cassette Valance
  ...
  12. Motorization TDBU
  
  13. 🗑️  Delete All Test Results
  
  Enter number (1-13) or press Enter to skip interactive mode:
```

**No go back option** (first step)

---

#### Step 2: Select Model
```
🏷️  What model?

  1. Roller
  2. Solar
  3. Roman
  ...
  20. Riviera Classic
  
  21. ⬅️  Go back
  
  Enter number (1-20 or 21 to go back):
```

**Go back → Returns to Lift Type selection**

---

#### Step 3: Select Brand
```
🏪 What brand?

  1. Home Depot
  2. Lowe's
  
  3. ⬅️  Go back
  
  Enter number (1-2 or 3 to go back):
```

**Go back → Returns to Model selection**

## User Experience

### Scenario 1: Change Lift Type from Brand Selection

```bash
npm start

🎯 What do you want to test?
  Selection: 5  (Motorization)

🏷️  What model?
  Selection: 2  (Solar)

🏪 What brand?
  Selection: 3  (Go back)

🏷️  What model?  ← Back at model selection
  Selection: 21  (Go back)

🎯 What do you want to test?  ← Back at lift type selection
  Selection: 1  (Cordless)

🏷️  What model?
  Selection: 1  (Roller)

🏪 What brand?
  Selection: 1  (Home Depot)

✅ Configuration validated successfully!
```

**Result:** Changed from "Motorization Solar" to "Cordless Roller"

---

### Scenario 2: Change Model

```bash
npm start

🎯 What do you want to test?
  Selection: 5  (Motorization)

🏷️  What model?
  Selection: 2  (Solar)

🏪 What brand?
  Selection: 3  (Go back)

🏷️  What model?  ← Back at model
  Selection: 3  (Roman)  ← Changed model

🏪 What brand?
  Selection: 1  (Home Depot)

✅ Configuration validated successfully!
```

**Result:** Changed from "Solar" to "Roman"

---

### Scenario 3: Change Brand

```bash
npm start

🎯 What do you want to test?
  Selection: 5  (Motorization)

🏷️  What model?
  Selection: 2  (Solar)

🏪 What brand?
  Selection: 1  (Home Depot)

📍 Found saved URL: ...

  Is this the correct URL? (y/n): n
  
  URL: [new URL]
  
  ⚠️  Wait, I meant to select Lowe's instead!
  
  # Press Ctrl+C to restart
  # OR
  # Continue and change selections next run
```

**Note:** Can't go back from URL/validation step. Press Ctrl+C and restart if needed.

## Navigation Rules

### Can Go Back From:
✅ Model selection → Lift Type
✅ Brand selection → Model
✅ Brand selection → Lift Type (go back twice)

### Cannot Go Back From:
❌ Lift Type selection (first step)
❌ URL confirmation (after brand selection)
❌ Grid data paste (after validation)

**Workaround:** Press Ctrl+C and restart if you need to change after URL/validation.

## Implementation Details

### State Management

```javascript
let liftTypeSelection = null;
let model = null;
let brand = null;
let validatedConfig = null;

while (true) {
  // Step 1: If no lift type, select it
  if (!liftTypeSelection) {
    liftTypeSelection = await selectLiftType();
    continue;
  }
  
  // Step 2: If no model, select it
  if (!model) {
    model = await selectModel(true); // showGoBack = true
    
    // If go back, reset lift type
    if (model.action === 'go-back') {
      liftTypeSelection = null;
      model = null;
      continue;
    }
    continue;
  }
  
  // Step 3: If no brand, select it
  if (!brand) {
    brand = await selectBrand(true); // showGoBack = true
    
    // If go back, reset model
    if (brand.action === 'go-back') {
      model = null;
      brand = null;
      continue;
    }
    continue;
  }
  
  // Step 4: Validate and break
  validatedConfig = await validateAndGetConfiguration(...);
  break;
}
```

**Key points:**
- Variables persist in the loop
- "Go back" resets the appropriate variable(s)
- Loop continues until all selections made

### Return Value for Go Back

Functions return an object with `action: 'go-back'`:

```javascript
async function selectModel(showGoBack = false) {
  // ... display options ...
  
  if (showGoBack) {
    console.log('  21. ⬅️  Go back');
  }
  
  // ... get selection ...
  
  if (showGoBack && selection === MODELS.length + 1) {
    return { action: 'go-back' };  // ← Special return value
  }
  
  return MODELS[selection - 1];  // ← Normal return value
}
```

## Benefits

✅ **Fix mistakes** - Change selection without restarting
✅ **Explore options** - Try different combinations easily
✅ **Better UX** - Standard navigation pattern
✅ **No data loss** - Saved URLs/configs preserved
✅ **Fast** - No need to restart the tool

## Edge Cases

### Case 1: Go Back Multiple Times

```bash
🏪 What brand?
  Selection: 3  (Go back)

🏷️  What model?
  Selection: 21  (Go back)

🎯 What do you want to test?  ← Back at start
```

**✅ Works:** Can go back multiple times

---

### Case 2: Go Back Then Forward Again

```bash
🏪 What brand?
  Selection: 3  (Go back)

🏷️  What model?
  Selection: 2  (Solar)  ← Re-select same model

🏪 What brand?
  Selection: 1  (Home Depot)
```

**✅ Works:** Can re-select same options

---

### Case 3: Go Back After Invalid Selection

```bash
🏷️  What model?
  Selection: 99  (Invalid)
  
  ❌ Invalid selection.

🏷️  What model?  ← Prompts again
  Selection: 21  (Go back)

🎯 What do you want to test?  ← Back at lift type
```

**✅ Works:** Can go back even after errors

## Visual Indicators

### Selection Numbers

The last option is always the "Go back" option:

**Model (20 models):**
```
  20. Riviera Classic
  
  21. ⬅️  Go back  ← Last option
```

**Brand (2 brands):**
```
  2. Lowe's
  
  3. ⬅️  Go back  ← Last option
```

### Prompt Text

Shows the range including go back option:
```
Enter number (1-20 or 21 to go back):
```

## Files Changed

### `/Users/neil/playwrightautomation/blindstester/index.js`

**Lines 169-204:** Updated `selectModel()` function
- Added `showGoBack` parameter (default false)
- Added "Go back" option when `showGoBack === true`
- Return `{ action: 'go-back' }` when selected

**Lines 206-232:** Updated `selectBrand()` function
- Added `showGoBack` parameter (default false)
- Added "Go back" option when `showGoBack === true`
- Return `{ action: 'go-back' }` when selected

**Lines 720-808:** Replaced linear selection flow with navigation loop
- All selections in `while (true)` loop
- Variables persist across loop iterations
- "Go back" resets appropriate variables
- Loop continues until all selections made

## Testing

### Test Go Back from Brand

```bash
npm start
# Select lift type: 5 (Motorization)
# Select model: 2 (Solar)
# Select brand: 3 (Go back)
# Verify: Returns to model selection
# Select model: 3 (Roman)
# Select brand: 1 (Home Depot)
# Verify: Proceeds to validation
```

### Test Go Back from Model

```bash
npm start
# Select lift type: 5 (Motorization)
# Select model: 21 (Go back)
# Verify: Returns to lift type selection
# Select lift type: 1 (Cordless)
# Select model: 1 (Roller)
# Select brand: 1 (Home Depot)
# Verify: Proceeds to validation
```

### Test Go Back Multiple Times

```bash
npm start
# Select lift type: 5 (Motorization)
# Select model: 2 (Solar)
# Select brand: 3 (Go back)
# Select model: 21 (Go back)
# Verify: Returns to lift type
# Select lift type: 1 (Cordless)
# Continue...
```

---

**Status:** Complete ✅

Interactive menus now support "Go back" navigation, allowing you to change previous selections without restarting the tool.
