# Save Partial Results + 2on1 Headrail Testing

## Changes Made

### 1. Save Partial Results on Abrupt Stop ✅

**Problem:** When tests are stopped abruptly (Ctrl+C twice), results weren't being saved.

**Root Cause:** 
- Results only saved in main flow after all tests complete
- On force exit (2nd Ctrl+C), process exits before reaching save logic

**Solution:**

#### Added `cleanupAndSave()` method:
```javascript
async cleanupAndSave(outputFile) {
  // Save results first, then cleanup browser
  if (this.results.length > 0) {
    console.log(chalk.cyan('\n💾 Saving partial results before exit...'));
    await this.saveResults(outputFile);
  }
  await this.cleanup();
}
```

#### Updated SIGINT/SIGTERM handlers:
```javascript
let shutdownCount = 0;
const handleShutdown = async () => {
  shutdownCount++;
  if (shutdownCount === 1) {
    tester.requestShutdown(); // Graceful shutdown
  } else if (shutdownCount === 2) {
    console.log(chalk.red('\n🛑 Force exit requested. Saving results immediately...\n'));
    await tester.cleanupAndSave(options.output);
    process.exit(0);
  }
};
```

**Behavior:**
- **1st Ctrl+C**: Graceful shutdown (finish current test, then save)
- **2nd Ctrl+C**: Force exit (save partial results immediately)

---

### 2. 2 on 1 Headrail Testing ✅

**Requirement:** For 2on1 configurations, verify that the **2 on 1 headrail option disappears** (not just single headrail).

**Implementation:**

#### Added `canSelect2on1Headrail()` method:
```javascript
async canSelect2on1Headrail() {
  console.log(chalk.cyan('  🔍 Checking if 2 on 1 headrail is available...'));
  
  const allButtons = await this.page.$$('button');
  let twoOnOneButton = null;
  
  for (const button of allButtons) {
    const text = await button.textContent();
    const trimmedText = text.trim().toLowerCase();
    
    // Look for "2 on 1" button
    if (trimmedText.includes('2 on 1') || 
        trimmedText.includes('2on1') || 
        trimmedText.includes('2-on-1')) {
      // Check if visible and enabled
      if (isVisible && !isDisabled && ...) {
        twoOnOneButton = button;
        break;
      }
    }
  }

  if (twoOnOneButton) {
    console.log(chalk.yellow('  ⚠️  2 on 1 headrail IS available (should be blocked!)'));
    return true;
  } else {
    console.log(chalk.green('  ✓ 2 on 1 headrail NOT available (correctly hidden)'));
    return false;
  }
}
```

#### Updated `BlindsConfiguratorTester` constructor:
```javascript
constructor(configuratorUrl, headless = false, is2on1 = false) {
  this.configuratorUrl = configuratorUrl;
  this.headless = headless;
  this.is2on1 = is2on1;  // NEW: Track if testing 2on1 config
  // ...
}
```

#### Updated `testConfiguration()` method:
```javascript
async testConfiguration(product, width, maxHeight, testHeight) {
  // ... (setup)
  
  if (this.is2on1) {
    // For 2on1 configurations, check if 2on1 headrail option is available
    const twoOnOneAvailable = await this.canSelect2on1Headrail();
    testResult.twoOnOneAvailable = twoOnOneAvailable;

    if (testHeight > maxHeight && !twoOnOneAvailable) {
      testResult.status = 'PASS';
      console.log('✅ PASS: Correctly blocked - 2 on 1 headrail not available');
    } else if (testHeight > maxHeight && twoOnOneAvailable) {
      testResult.status = 'BUG';
      console.log('🐛 BUG: 2 on 1 headrail still available!');
    }
    // ...
  } else {
    // For regular configurations, check single headrail (existing logic)
    const singleAvailable = await this.canSelectSingleHeadrail();
    // ...
  }
}
```

#### Auto-detect 2on1 configs:
```javascript
const is2on1 = config && config.name && config.name.toLowerCase().includes('2on1');

const tester = new BlindsConfiguratorTester(configuratorUrl, options.headless, is2on1);

if (is2on1) {
  console.log('🔧 Detected 2 on 1 configuration - will test for 2 on 1 headrail option');
}
```

**Detection:** Automatically detects 2on1 configs by checking if config name contains "2on1"

**Examples:**
- `cordless-2on1-roller-home-depot` → Tests 2on1 headrail
- `motorization-2on1-solar-lowes` → Tests 2on1 headrail
- `cordless-roller-home-depot` → Tests single headrail

---

## Test Results Now Include

### For Regular Configs:
```json
{
  "product": "3% Catalina",
  "width": 114,
  "maxHeight": 132,
  "testHeight": 145,
  "singleAvailable": false,
  "status": "PASS"
}
```

### For 2on1 Configs:
```json
{
  "product": "3% Catalina",
  "width": 114,
  "maxHeight": 132,
  "testHeight": 145,
  "twoOnOneAvailable": false,
  "status": "PASS"
}
```

---

## How It Works

### Testing Regular Configs

1. Set dimensions (width, height above max)
2. Select color
3. Check if **Single headrail** button is available
4. **PASS** if Single is NOT available (correctly blocked)
5. **BUG** if Single IS available (should be blocked)

### Testing 2on1 Configs

1. Set dimensions (width, height above max)
2. Select color
3. Check if **2 on 1 headrail** button is available
4. **PASS** if 2on1 is NOT available (correctly blocked)
5. **BUG** if 2on1 IS available (should be blocked)

---

## User Experience

### Graceful Shutdown (1st Ctrl+C)

```
🧪 Testing: 3% Catalina @ 112" width
...
✅ PASS: Correctly blocked 145" (max: 132")

^C
⏳ Shutdown requested. Will complete current test and save results...

⏹️  Test completed. Shutting down...

Test Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Products Tested: 5
Configurations: 15 total
...

💾 Saving results to: test-results/...
✅ Results saved successfully
```

### Force Exit (2nd Ctrl+C)

```
🧪 Testing: 5% Catalina @ 112" width
...

^C
⏳ Shutdown requested. Will complete current test and save results...

^C
🛑 Force exit requested. Saving results immediately...

💾 Saving partial results before exit...
✅ Results saved to: test-results/...
```

### 2on1 Config Detection

```
npm start
# Select: Cordless 2on1
# Select: Roller
# Select: Home Depot
...

✅ Configuration validated successfully!

🔧 Detected 2 on 1 configuration - will test for 2 on 1 headrail option

🚀 Initializing browser...
🎯 Starting test for cordless-2on1-roller-home-depot

🧪 Testing: Light Filtering @ 112" width
   Max Height: 132" | Testing: 145"
   Mode: 2 on 1 headrail test
   
🔍 Checking if 2 on 1 headrail is available...
✓ 2 on 1 headrail NOT available (correctly hidden)
✅ PASS: Correctly blocked 145" (max: 132") - 2 on 1 headrail not available
```

---

## Files Changed

### `/Users/neil/playwrightautomation/blindstester/index.js`

1. **Line 791-800**: Added `cleanupAndSave()` method
2. **Line 831**: Added `is2on1` parameter to constructor
3. **Line 990-1032**: Added `canSelect2on1Headrail()` method
4. **Line 1060-1158**: Updated `testConfiguration()` to support 2on1 testing
5. **Line 1279-1283**: Auto-detect 2on1 from config name
6. **Line 1285-1296**: Updated shutdown handlers to save on force exit

---

## Testing

### Test Regular Config
```bash
npm start
# Select: Motorization
# Select: Solar
# Select: Home Depot
# Let tests run...
# Press Ctrl+C twice → Results saved
```

### Test 2on1 Config
```bash
npm start
# Select: Cordless 2on1
# Select: Roller
# Select: Home Depot
# Should see: "🔧 Detected 2 on 1 configuration"
# Tests check for 2on1 headrail option
```

---

**Status:** Complete ✅

1. ✅ Partial results save on force exit (2nd Ctrl+C)
2. ✅ 2on1 headrail testing logic added
3. ✅ Auto-detection of 2on1 configs from name
4. ✅ Test results include appropriate headrail check data
