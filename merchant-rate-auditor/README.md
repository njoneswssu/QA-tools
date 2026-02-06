# Merchant Rate Auditor

A Node.js application that audits Wildlink merchant rate JSON feeds for problematic rates.

## Features

- ✅ **Interactive Mode**: Prompts you to enter App IDs (or use command-line arguments)
- ✅ Fetches merchant rate data from Wildlink JSON feeds
- ✅ Detects rates with "ShareASale commission" in the name
- ✅ Flags rates with "commission" in name, content, or default lead fields
- ✅ Identifies hex code values that shouldn't be commission rates
- ✅ Detects invalid/nonsensical rate names
- ✅ Generates detailed audit reports
- ✅ Saves results to JSON files

## Installation

```bash
cd merchant-rate-auditor
npm install
```

## Usage

### Interactive Mode (Recommended)

When you run the application without arguments, it shows an interactive menu:

```bash
npm start
# or
node auditor.js
```

**Menu Options:**
1. Run new audit
2. List previous audits
3. Lookup audits by App ID
4. Clear all audit results
5. Exit

### Command-Line Mode

#### Run Audit

```bash
node auditor.js 451 206 209
node auditor.js 451
```

#### List Previous Audits

```bash
node auditor.js --list
# or
node auditor.js -l
```

#### Lookup Audits by App ID

```bash
node auditor.js --lookup 451
node auditor.js --lookup 451 206 209
# or
node auditor.js --find 451
```

#### Clear All Audit Results

```bash
node auditor.js --clear
# or
node auditor.js -c
```

To skip confirmation prompt:
```bash
node auditor.js --clear --yes
# or
node auditor.js -c -y
```

### Examples

```bash
# Audit a single app ID
node auditor.js 451

# Audit multiple app IDs
node auditor.js 451 206 209

# Use npm script
npm run audit 451 206
```

## What It Detects

### 1. ShareASale Commission Rates
Rates that contain "ShareASale commission" (case-insensitive) as a phrase in the name field.

**Example:**
```json
{
  "ID": 12345,
  "Name": "ShareASale commission",
  "Kind": "PERCENTAGE",
  "Amount": "5.0"
}
```

### 2. Commission in Rate Fields
Rates that contain the word "commission" in:
- **Name** field
- **Content** field (if present)
- **DefaultLead** field (if present)

This helps identify rates that may have incorrect descriptions or placeholder text.

**Examples:**
- Name: `"RP Commission 8.0 Regular"` ⚠️
- Name: `"Non-Commissionable Transactions"` ⚠️
- Content: `"This is a commission rate..."` ⚠️

### 3. Product-Like Rate Names
Rates with names that look like product names, location names, or other non-rate descriptions instead of rate descriptions.

**Examples:**
- Name: `"gummies returning"` ❌
- Name: `"gummies new"` ❌
- Name: `"Artificial christmas tree"` ❌
- Name: `"chicago"` ❌
- Name: `"shoes"` ❌
- Name: `"vitamins"` ❌

**Not flagged (valid rate names):**
- Name: `"Online Purchase"` ✅
- Name: `"B2B Transaction"` ✅
- Name: `"Returning Customer"` ✅
- Name: `"New Customer Purchase"` ✅

These should be descriptive rate names like `"Online Purchase"` or `"Returning Customer"`, not product names, locations, or simple nouns.

### 4. Percentage in Rate Name
Rates that contain percentage values in the name field (should be in the Amount field instead).

**Examples:**
- Name: `"30%"` ❌
- Name: `"5% commission"` ❌
- Name: `"Online Purchase 5%"` ❌
- Name: `"10% Cashback"` ❌
- Name: `"15% Bonus"` ❌

**Note:** ALL percentages in rate names are flagged. The percentage value should be in the Amount field, and the name should only describe what the rate is for (e.g., `"Online Purchase"`, `"Cashback"`, `"Bonus"`).

### 5. Invalid Rate Names
Rates with names that don't make sense for merchant rates, such as:
- Generic placeholders: `"commission"`, `"default"`, `"test"`, `"placeholder"`
- Empty or whitespace-only names
- Names that are just numbers or IDs
- Very short or generic names without meaningful context

**Examples:**
- Name: `"commission"` ❌
- Name: `"test"` ❌
- Name: `"12345"` ❌
- Name: `""` (empty) ❌

### 6. Hex Code Commission Rates
Rates where the amount or name field contains a hex code value instead of a valid commission rate.

**Examples:**
- Amount: `"FF0000"` (should be a number like `"5.0"`)
- Amount: `"#ABCDEF"` (should be a number)
- Amount: `"0x123456"` (should be a number)

## Output

The auditor generates:

1. **Console Output**: Real-time progress and a formatted report
2. **Merchant Issues JSON**: Saved to `audit-results/merchant-issues-[timestamp].json` (merchant names and flag reasons)
3. **Optional CSV Export**: After the audit completes, you'll be prompted if you want to also export as CSV

**Note:** The CSV export is optional and only generated if you answer "yes" when prompted. The JSON file is always created.

### Report Structure

#### Merchant Issues JSON (`merchant-issues-[timestamp].json`)
Easy-to-read format with merchant names and flag reasons (one example per merchant per issue type):

```json
{
  "exportDate": "2025-01-15T10:30:00.000Z",
  "totalIssues": 319,
  "merchants": [
    {
      "merchantName": "RAVPower",
      "merchantId": "6765",
      "appId": 451,
      "issueType": "commission_in_name",
      "severity": "medium",
      "reason": "Rate name contains \"commission\": \"RP Commission 8.0 Regular\"",
      "rateName": "RP Commission 8.0 Regular",
      "rateAmount": "3",
      "count": 5
    }
  ]
}
```

**Note:** The `count` field shows how many times this issue type appeared for this merchant. Only one example is shown per merchant per issue type.

## Features

### Audit Management

- **List Previous Audits**: View all previous audit results with dates, app IDs, and issue counts
- **Lookup by App ID**: Find all audits that included specific app IDs
- **Clear Results**: Delete all saved audit results (with confirmation)

### Export Formats

- **Full JSON Report**: Complete audit data with all rate details
- **Simplified CSV**: Merchant names and flag reasons (one example per merchant per issue type)
- **Simplified JSON**: Same as CSV but in JSON format

## Exit Codes

- `0`: Audit completed successfully with no issues found
- `1`: Audit completed but issues were found

## Issue Severity Levels

- **High**: Critical issues that definitely need attention (ShareASale commission, hex codes, invalid names)
- **Medium**: Issues that may need review (commission in name/content/default lead)

## Configuration

Edit `auditor.js` to modify:

- `CONFIG.baseUrl`: Base URL for Wildlink API
- `CONFIG.outputDir`: Directory for saving reports
- `INVALID_RATE_NAMES`: Patterns for invalid rate names
- `VALID_RATE_NAME_PATTERNS`: Patterns for valid rate names

## Troubleshooting

### Network Errors
If you encounter network errors:
- Check your internet connection
- Verify the app IDs are valid
- The API might be rate-limited - wait and try again

### No Issues Found
If no issues are found, the auditor will exit with code 0 and show a success message.

### Invalid JSON
If the API returns invalid JSON, the auditor will report the error and continue with other app IDs.

## License

ISC

