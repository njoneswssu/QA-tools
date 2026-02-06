# Quick Start Guide

## Installation
```bash
cd blindstester
npm install
npx playwright install chromium
```

## Run Tests

### 1. Quick test (verify everything works)
```bash
npm run test:quick
```

### 2. Manual test with custom dimensions
```bash
node manual-test.js 70 125 inside
node manual-test.js 90 130 outside
```

### 3. Test all focus products (max height < 144")
```bash
npm start
```

### 4. Test specific product
```bash
node index.js -p "Newport"
```

### 5. Test specific width breakpoint
```bash
node index.js -w 72
```

### 6. Run in headless mode (no browser window)
```bash
npm run test:headless
```

### 7. Test everything (including 144" max heights)
```bash
npm run test:all
```

## Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `-p, --product <name>` | Test specific product | `node index.js -p "Catalina"` |
| `-w, --width <width>` | Test specific width | `node index.js -w 90` |
| `-h, --headless` | Run without showing browser | `node index.js --headless` |
| `--no-focus-only` | Test all products | `node index.js --no-focus-only` |
| `-o, --output <file>` | Custom output file | `node index.js -o results.json` |

## What It Tests

For each product and width breakpoint:
1. ✅ At max height (should work)
2. 🔍 1" over max height (should be blocked)
3. 🔍 10" over max height (should be blocked)

## Output

The tool will:
- Show real-time progress in the terminal
- Display a summary at the end
- Save detailed results to a JSON file
- Highlight any bugs where the system allows exceeding max height

## Example

```bash
node index.js -p "Newport" -w 72
```

This will test the Newport product at 72" width with heights at, just above, and well above the maximum.
