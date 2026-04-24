# Merchant rate weekly report (plug-and-play)

Self-contained folder: **web UI**, **Monday cron**, **Google Sheets** export, **BigQuery/CSV commissions**, and a **bundled** copy of `merchant-rate-auditor` (`auditor.js` + `offer-activation-auditor.js`). You do **not** need the rest of the original monorepo.

## Requirements

- **Node.js 18+**
- Network access to Wildlink JSON feeds, Google APIs, and (optional) BigQuery

## Quick start

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

Open **http://localhost:3847** (or your `PORT`). Optional App IDs in the UI; blank run uses `data/config.json` defaults after you save.

### Sheets smoke test (optional)

```bash
npm run test:sheets
```

Creates a small test append so you can confirm credentials before a full audit.

## Sharing this folder with someone else

Zip **this entire directory** but **omit** `node_modules/` and any `secrets/*.json` (they should run `npm install` and add their own keys):

```bash
cd ..
zip -r merchant-rate-weekly-report.zip merchant-rate-weekly-report \
  -x "merchant-rate-weekly-report/node_modules/*" \
  -x "merchant-rate-weekly-report/secrets/*.json" \
  -x "merchant-rate-weekly-report/data/last-run.json"
```

Recipient: unzip, `npm install`, `cp .env.example .env`, add keys, `npm start`.

## Layout

| Path | Purpose |
|------|---------|
| `server.js` | Express app + `/api/*` + Monday `node-cron` |
| `public/index.html` | UI |
| `lib/` | Audit runner, Sheets sync, commission fetch, next-run countdown |
| `data/` | `config.json` (App IDs) and `last-run.json` (state; created at runtime) |
| `secrets/` | Service account JSON (not committed) |
| `merchant-rate-auditor/` | Bundled `auditor.js` + `offer-activation-auditor.js` only |

Runtime `chdir`s into `merchant-rate-auditor/` while calling `auditAppId`; npm packages resolve from the **parent** `node_modules` (single install).

## Updating the bundled auditor

If rules change upstream, replace:

- `merchant-rate-auditor/auditor.js`
- `merchant-rate-auditor/offer-activation-auditor.js`

from your main `merchant-rate-auditor` project, then re-run `npm start` (add any new npm dependencies to this folder’s `package.json` if the auditor starts requiring them).

## Security

- Never commit `.env` or `secrets/*.json`.
- Use a service account that only has access to spreadsheets you share.
