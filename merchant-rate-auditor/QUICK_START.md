# Quick Start Guide

## Installation

```bash
cd merchant-rate-auditor
npm install
```

## Basic Usage

### Interactive Mode (Recommended)
The application shows a menu with options:

```bash
npm start
# or
node auditor.js
```

**Main menu:** 1 Merchant Rate Audit | 2 Offer Activation Testing | 3 Lookup results (by merchant, date, App ID) | 4 Exit

**Merchant Rate Audit submenu:**
1. Run new audit
2. List previous audits
3. Lookup audits by App ID
4. Clear merchant rate results
5. Back to main menu
6. Exit

### Command-Line Mode

**Run Audit:**
```bash
node auditor.js 451 206 209
```

**List Previous Audits:**
```bash
node auditor.js --list
```

**Lookup by App ID:**
```bash
node auditor.js --lookup 451
```

**Clear All Results:**
```bash
node auditor.js --clear
```

## What Gets Detected

1. **ShareASale Commission Rates**: Rates where the name contains "shareasale commission" (as a phrase)
   - Example: `"ShareASale commission"` ✅
   - Example: `"ShareASale Rule 123"` ❌ (not detected - this is a rule ID)

2. **Commission in Fields**: Rates with "commission" in name, content, or default lead fields
   - Example: `"RP Commission 8.0 Regular"` ⚠️
   - Example: `"Non-Commissionable Transactions"` ⚠️

3. **Percentage in Name**: Rate names containing percentage values
   - Examples: `"30%"`, `"5% commission"`, `"Online Purchase 5%"`
   - Percentages should be in the Amount field, not the name

4. **Invalid Rate Names**: Names that don't make sense for merchant rates
   - Examples: `"commission"`, `"test"`, `"placeholder"`, empty names
   - These should be descriptive like `"Online Purchase"` or `"B2B Transaction"`

5. **Hex Code Rates**: Rates where the amount or name field contains a hex code value
   - Examples: `"FF0000"`, `"#ABCDEF"`, `"0x123456"`
   - These should be numeric values like `"5.0"` or `"10.5"`

## Output

The auditor generates:

- **Console**: Real-time colored output with summary
- **Merchant Issues JSON**: `audit-results/merchant-issues-[timestamp].json` (always created)
- **Optional CSV**: `audit-results/merchant-issues-[timestamp].csv` (only if you answer "yes" when prompted)

After each audit, you'll be asked if you want to export as CSV as well. The JSON file is always created automatically.

## Exit Codes

- `0`: No issues found
- `1`: Issues found (use in CI/CD pipelines)

## Example Output

```
🔍 Merchant Rate Auditor
Auditing App IDs: 451

📡 Fetching merchant rates for App ID 451...
✅ Successfully fetched data for App ID 451

================================================================================
MERCHANT RATE AUDIT REPORT
================================================================================

Summary:
  Total App IDs audited: 1
  Successful: 1
  Failed: 0
  Total Merchants: 10012
  Total Rates: 18130
  Total Issues Found: 0
```

## Troubleshooting

**Network errors?** Check your internet connection and verify app IDs are valid.

**No issues found?** That's good! The auditor will exit with code 0.

**Want to audit more app IDs?** Just add them as command-line arguments:
```bash
node auditor.js 451 206 209 100 200
```

