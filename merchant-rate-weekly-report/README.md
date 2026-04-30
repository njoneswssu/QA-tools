# Merchant rate weekly report (plug-and-play)

Self-contained folder with a **Chrome extension** (primary UI) that runs the same **Wildlink `auditAppId` logic** and **weekly-style export** as the bundled `merchant-rate-auditor`. The extension can optionally use **your Google account** (OAuth) to run the **same BigQuery commission query** as the Node job and to **create a new Google Sheet tab** with the full result after each run. An optional **Node server** remains for **Monday cron** and **service-account** automation without signing in.

## Chrome extension (use this day-to-day)

1. Open Chrome → **Extensions** → enable **Developer mode**.
2. **Load unpacked** → choose the folder `merchant-rate-weekly-report/extension/`. On **first install**, the **Options** tab opens so you can sign in to Google and set the spreadsheet for export.
3. Click the extension icon → type **App IDs** you want to run (comma/space/newline separated; any positive whole numbers Wildlink exposes). The field starts **empty** until you type them. Use the **gear** (or linked “settings”) for Google / Sheets / BigQuery — same page as Options.
4. **Run audit** → **Copy TSV** if you only want clipboard export.

### BigQuery + Google Sheets from the extension (optional)

1. **Google Cloud Console** (same org as your data is fine): enable **BigQuery API** and **Google Sheets API**.
2. **Credentials** → **Create credentials** → **OAuth client ID** → Application type **Chrome extension** → add your extension’s ID (from `chrome://extensions` when the extension is loaded).
3. Copy the **Client ID** and paste it into `extension/manifest.json` as `oauth2.client_id` (replace the `PASTE_…` placeholder). **Reload** the unpacked extension.
4. Open **Extension options** (right-click the extension icon → Options, or the **gear** in the popup) → **Sign in with Google** (consent includes read-only BigQuery + Sheets). If you still see **bad client id**, the placeholder was not replaced: use a **Chrome extension** OAuth client whose ID matches this extension’s ID in Google Cloud, paste it as `oauth2.client_id` in `extension/manifest.json`, then reload the extension.
5. **Export JSON** / **Import JSON** (next to Save settings) backs up or restores the same fields (App ID text, CSV snippet, BigQuery/Sheets toggles, spreadsheet ID, etc.). OAuth tokens are not included.
6. Turn on **Load commissions from BigQuery** if you want the same SQL as `lib/weekly-commission-fetch.js` (project ID defaults to `wildfire-1000`; optional date column + lookback months match the Node env behavior).
7. Turn on **After each audit run, create a new tab…** and set the **Spreadsheet ID** from the spreadsheet URL. Share that spreadsheet with your Google user as **Editor**.

On **Run audit**, the extension will: run Wildlink audits → optionally pull commissions from BigQuery → fall back to pasted CSV only if BigQuery returns no rows → then optionally **create a new tab** and write header + rows (same columns as the Node sheet export). BigQuery runs in **chunks** (many merchant IDs) and **polls** until each job finishes, then **pages** through results — large audits no longer require the Node app for commissions alone.

**Options:** “Load commissions from BigQuery” is **on** by default for new installs. The same Google button shows **Sign out** while you are signed in, and **Sign in with Google** when you are not.

**Logic parity:** `extension/lib/auditor-core.js` mirrors `merchant-rate-auditor/auditor.js`. `extension/lib/google-bq.js` mirrors the commission query in `lib/weekly-commission-fetch.js`. `extension/lib/google-sheets-rest.js` mirrors “new tab per run” from `lib/sheets.js`.

**When you change rate rules upstream:** update `merchant-rate-auditor/auditor.js` and port the same changes into `extension/lib/auditor-core.js` (or regenerate that file from the same sections).

---

## Optional: Node server (Monday cron + Sheets + BigQuery)

Use this if you still want **automated** weekly runs that write to **Google Sheets** and pull commissions from **BigQuery**.

### Requirements

- **Node.js 18+**
- Network access to Wildlink JSON feeds, Google APIs, and (optional) BigQuery

### Quick start

```bash
cd merchant-rate-weekly-report
npm install
cp .env.example .env
```

1. Put your Google **service account JSON** under `secrets/` (e.g. `secrets/google-sheets-key.json`).
2. Edit `.env`: set `GOOGLE_APPLICATION_CREDENTIALS`, `SPREADSHEET_ID`, and optionally BigQuery / cron / port (see comments in `.env.example`).
3. Share the spreadsheet with the service account email (**Editor**).
4. Start:

```bash
npm start
```

Open **http://localhost:3847** (or your `PORT`) for the legacy web UI, or rely on cron only.

### Sheets smoke test (optional)

```bash
npm run test:sheets
```

Creates a small test append so you can confirm credentials before a full audit.

---

## Sharing this folder with someone else

Zip **this entire directory** but **omit** `node_modules/` and any `secrets/*.json` (they should run `npm install` and add their own keys):

```bash
cd ..
zip -r merchant-rate-weekly-report.zip merchant-rate-weekly-report \
  -x "merchant-rate-weekly-report/node_modules/*" \
  -x "merchant-rate-weekly-report/secrets/*.json" \
  -x "merchant-rate-weekly-report/data/last-run.json"
```

Recipient: unzip, install the **Chrome extension** from `extension/`; for Sheets automation, `npm install`, `cp .env.example .env`, add keys, `npm start`.

---

## Layout

| Path | Purpose |
|------|---------|
| `extension/` | **Chrome MV3** — Wildlink audit, optional **BigQuery** + **Sheets** (OAuth), `options.html` |
| `server.js` | Express app + `/api/*` + Monday `node-cron` (optional) |
| `public/index.html` | Legacy web UI (optional) |
| `lib/` | Audit runner, Sheets sync, commission fetch, next-run countdown |
| `data/` | `config.json` (App IDs) and `last-run.json` (state; created at runtime) |
| `secrets/` | Service account JSON (not committed) |
| `merchant-rate-auditor/` | Bundled `auditor.js` + `offer-activation-auditor.js` (Node path) |

Runtime `chdir`s into `merchant-rate-auditor/` while calling `auditAppId` from Node; npm packages resolve from the **parent** `node_modules` (single install).

## Updating the bundled auditor (Node + extension)

- Replace `merchant-rate-auditor/auditor.js` (and optionally `offer-activation-auditor.js`) from your main `merchant-rate-auditor` project, then re-run `npm start` if needed.
- **Also** port any `validateRate` / `auditAppId` changes into `extension/lib/auditor-core.js` so the extension stays aligned.

## Security

- Never commit `.env` or `secrets/*.json`.
- Use a service account that only has access to spreadsheets you share.
