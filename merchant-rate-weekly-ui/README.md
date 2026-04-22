# Merchant rate weekly UI

Small **web UI** plus a **Monday** scheduled job that runs the same **merchant rate audit** as [`../merchant-rate-auditor`](../merchant-rate-auditor) and **appends** issue rows to your [Google Sheet](https://docs.google.com/spreadsheets/d/194oJaxgMLAfoFvPgbqVOfTZnU3mVBSqT-hl8EIOnNQE/edit?gid=1072101362).

## What it does

1. Loads App IDs from `data/config.json` (or defaults `451, 206, 209` until you save from the UI).
2. For each App ID, calls `auditAppId` + `generateReport` / `generateSimplifiedExport` from `merchant-rate-auditor/auditor.js`.
3. **Monday** (configurable hour, default 08:00 in `TZ`) runs the audit and, if there are issue rows, writes them to Google Sheets.
4. **Default (`SHEET_APPEND_MODE=new`):** creates a **new tab** each run (e.g. `Rate audit 2026-04-22 143052`) and fills it from **A1** with header + rows. Use **`SHEET_APPEND_MODE=fixed`** plus `SHEET_GID` or `SHEET_TAB_NAME` to append into one existing tab instead.
5. Columns: run date, merchant name, merchant ID, app ID, category, issue type, severity, reason, rate name, rate amount, count.

## Setup

```bash
cd merchant-rate-weekly-ui
npm install
cp .env.example .env
```

### Google Sheets API

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project → **APIs & Services** → enable **Google Sheets API**.
2. **IAM & Admin** → **Service Accounts** → create a service account → **Keys** → add JSON key → save as e.g. `secrets/google-sheets-key.json` (do not commit).
3. Open your spreadsheet → **Share** → add the service account email (from the JSON `client_email`) as **Editor**.
4. Set in `.env`:

   - `GOOGLE_APPLICATION_CREDENTIALS=./secrets/google-sheets-key.json`
   - `SPREADSHEET_ID=194oJaxgMLAfoFvPgbqVOfTZnU3mVBSqT-hl8EIOnNQE`
   - `SHEET_GID=1072101362` (from the URL `#gid=…`) **or** set `SHEET_TAB_NAME` to the exact tab title.

### Run

```bash
npm start
```

Open **http://localhost:3847** (or your `PORT`). Save App IDs, then **Run audit now**. Check “append to Google Sheet” only after credentials work.

For development without the Monday job:

```env
DISABLE_WEEKLY_CRON=1
```

## Deploying “every Monday”

The server must stay running (or use a process manager / container). The in-process cron uses `node-cron` with `TZ` (e.g. `America/New_York`). Adjust `WEEKLY_CRON_HOUR` / `WEEKLY_CRON_MINUTE` in `.env` if needed.

Alternatively, use system cron to `curl -X POST http://127.0.0.1:3847/api/run -H "Content-Type: application/json" -d '{"syncSheet":true}'` on Mondays—but then you still need the server up, or extract `lib/run-job.js` into a standalone script later.

## Security

- Never commit `secrets/*.json` or `.env`.
- The service account should only have access to spreadsheets you explicitly share.

## Dependency

Requires the sibling package **`merchant-rate-auditor`** (same repo layout as this folder).
