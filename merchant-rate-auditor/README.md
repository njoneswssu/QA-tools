# Merchant Testing Tool

A comprehensive Node.js application for testing Wildlink merchants. Includes two main testing modes plus a combined full audit:

1. **Merchant Rate Audit** - Audits merchant rate JSON feeds for problematic rates
2. **Offer Activation Testing** - Tests if merchant offers work when activated (detects broken/expired offers)
3. **Run Full Audit** - Runs merchant rate audit and offer activation in one flow, using the same set of merchants, and saves a single combined report

## Features

### Merchant Rate Audit
- ✅ **Interactive Mode**: Prompts you to enter App IDs (or use command-line arguments)
- ✅ Fetches merchant rate data from Wildlink JSON feeds
- ✅ Detects rates with "ShareASale commission" in the name
- ✅ Flags rates with "commission" in name, content, or default lead fields
- ✅ Identifies hex code values that shouldn't be commission rates
- ✅ Detects invalid/nonsensical rate names
- ✅ Generates detailed audit reports
- ✅ Saves results to JSON files

### Offer Activation Testing
- 🔗 **Redirect Chain Analysis**: Follows full redirect chains from wild.link/affiliate URLs
- 🔗 **Error Page Detection**: Identifies when offers land on error/expired pages
- 🔗 **Visual Redirect Path**: Shows redirect chain like browser dev tools
- 🔗 **Batch Testing**: Test multiple merchants from feeds at once
- 🔗 **Progress Updates**: Progress every 10 merchants (e.g. 10, 20, 30 … up to total)
- 🔗 **False Negatives**: After tests with failures, you can mark specific merchants as false negatives (user-tested and passed); results are updated and you can save
- 🔗 **Export Results**: Save failed activations to JSON/CSV

### Run Full Audit (Main menu option 4)
- 📋 **Single flow**: Part 1 = Merchant rate audit; Part 2 = Offer activation (optional) on the **same** merchants
- 📋 **App IDs**: Enter one or more App IDs (comma- or space-separated)
- 📋 **Max merchants**: "Max merchants to test per App ID (blank = all)" — leave blank to test every merchant, or enter a number to limit per app (e.g. 50)
- 📋 **Specific merchants**: "Or test only these merchant IDs (comma-separated, leave blank to use max/all)" — restrict the run to specific merchant IDs across all selected apps
- 📋 **No save after Part 1**: Rate audit results are not saved until the end; only one combined save is offered
- 📋 **Part 2 question**: After Part 1 you are asked "Run offer activation for these App IDs? (yes/no)"
- 📋 **Combined output**: At the end you can save **one combined JSON** and **one combined CSV** (rate + activation) with filenames like `full-audit-combined-{timestamp}.json` and `.csv`
- 📋 **Mark as tested**: Option to mark merchants as tested for offer activation (for skip-next-time logic)
- 📋 **False negatives**: If any offer activation tests failed, you can mark specific merchants as false negatives (user tested) before saving

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

**Main menu (What do you want to do?):**
0. File manager — Combine offer activation / merchant rate / or both into one report
1. Merchant Rate Audit — Check for problematic rates in feeds
2. Offer Activation Testing — Test if offers work when activated
3. Lookup results — By App ID (shows what's tested) or by merchant name
4. Run full audit — Merchant rate + offer activation in one run (same merchants, combined save)
5. Exit

**Merchant Rate Audit submenu:**
1. Run new audit
2. List previous audits
3. Lookup audits by App ID
4. Clear merchant rate results (only merchant rate files)
5. Back to main menu
6. Exit

### Command-Line Mode

#### Run Merchant Rate Audit

```bash
node auditor.js 451 206 209
node auditor.js 451
```

#### Test Offer Activation (URL)

```bash
# Test a wild.link or affiliate URL
node auditor.js --test-url "https://wild.link/e?c=101920&d=37588627..."
node auditor.js -u "https://www.jdoqocy.com/click-100815616-14504623"
```

#### Test Offer Activation (Domain)

```bash
# Test a merchant domain directly
node auditor.js --test-domain bobore.com
node auditor.js -d amazon.com
```

#### Open Offer Activation Menu

```bash
node auditor.js --offer
node auditor.js -o
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

---

## Offer Activation Testing

The Offer Activation Testing feature simulates what happens when a user tries to activate an offer through wild.link or other affiliate tracking URLs. It follows the full redirect chain and detects when offers fail.

### What It Detects

#### Error URL Patterns
- `expired.jsp` - CJ expired offer page
- `qksrv.net/media/offers/` - CJ "offer not found" page
- `members.cj.com/expired` - CJ expired links
- Various error pages on Rakuten, Impact, Pepperjam, etc.

#### Error Content Patterns
- "offer not found"
- "offer has expired"
- "link is no longer available"
- "campaign has ended"
- "merchant is not available"

### Example Output

```
🔗 Testing Wild.link activation...
   URL: https://www.jdoqocy.com/click-100815616-14504623

📊 REDIRECT PATH
────────────────────────────────────────────────────────────────────────────────
  ↓ https://www.jdoqocy.com/click-100815616-14504623
     302: Found
     → Redirect to: https://cj.dotomi.com/...

  ↓ https://cj.dotomi.com/...
     302: Found
     → Redirect to: https://www.emjcd.com/...

  ↓ https://www.emjcd.com/...
     302: Found
     → Redirect to: http://members.cj.com/expired.jsp...

  ↓ http://members.cj.com/expired.jsp...
     301: Moved permanently
     → Redirect to: https://members.cj.com/expired.jsp...

  ↓ https://members.cj.com/expired.jsp...
     302: Found
     → Redirect to: http://www.qksrv.net/media/offers/...

  ✓ http://www.qksrv.net/media/offers/...
     200: OK

────────────────────────────────────────────────────────────────────────────────
❌ Activation failed
   Issues found:
   • [ERROR_URL] Final URL indicates an error
   • [ERROR_CONTENT] Page content indicates offer is not found or expired
   • [NETWORK_ERROR_PAGE] Landed on affiliate network page instead of merchant
```

### Interactive Menu Options

When you select "Offer Activation Testing" from the main menu:

1. **Test a specific URL** - Enter any wild.link, CJ, or affiliate URL
2. **Test a specific domain** - Enter a merchant domain like "bobore.com"
3. **Test merchants from feed** - Batch test merchants from the JSON feed (with progress every 10 merchants; P to pause, S to stop)

### Progress and False Negatives (Offer Activation)

- **Progress**: During batch or full-audit offer activation, progress is printed every 10 merchants (e.g. `Progress: 20/200 — 18 OK, 2 failed`).
- **False negatives**: When there are failed activations, you are asked: "Would you like to mark any of these as false negatives? (yes/no)". If yes, you enter **merchant IDs** (comma-separated) that you manually verified as working. Those results are updated to success with reason "User tested (false negative)". You can then save results (combined JSON/CSV in full audit, or offer activation JSON/CSV in batch).

---

## Run Full Audit (Main Menu Option 4)

Run full audit combines **Part 1: Merchant Rate Audit** and **Part 2: Offer Activation** in one run, using the **same** set of merchants for both.

1. **App IDs** — Enter comma- or space-separated App IDs.
2. **Max merchants per App ID** — Blank = test all merchants; or enter a number (e.g. 200) to limit per app (random subset).
3. **Specific merchant IDs (optional)** — Comma-separated merchant IDs to test *only* those merchants across the selected apps. Leave blank to use max/all from step 2.
4. **Part 1** runs (rate audit for that set). Results are printed but **not** saved yet.
5. **Part 2** — You are asked: "Run offer activation for these App IDs? (yes/no)". If yes, the same merchants are tested for offer activation (progress every 10).
6. **Multiple issues** — Merchants that failed both rate audit and offer activation are listed.
7. **False negatives** — If any activation tests failed, you can mark specific merchant IDs as false negatives (user tested); results are updated before save.
8. **Save** — One prompt: "Save full audit results (combined JSON + CSV)? (yes/no)". If yes, one `full-audit-combined-{timestamp}.json` and one `.csv` are written (rate + activation in one file). Option to mark merchants as tested for offer activation follows.

---

## Merchant Rate Audit

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

### 3. Percentage in Rate Name
Rates that contain percentage values in the name field (should be in the Amount field instead).

**Examples:**
- Name: `"30%"` ❌
- Name: `"5% commission"` ❌
- Name: `"Online Purchase 5%"` ❌
- Name: `"10% Cashback"` ❌
- Name: `"15% Bonus"` ❌

**Note:** ALL percentages in rate names are flagged. The percentage value should be in the Amount field, and the name should only describe what the rate is for (e.g., `"Online Purchase"`, `"Cashback"`, `"Bonus"`).

### 4. Invalid Rate Names
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

### 5. Hex Code Commission Rates
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

