# Citi active merchants dashboard

Small Node/Express app that pulls the **Wildlink Citi active-domain feed** (application 209), shows the current merchant list in a browser, and keeps a **removal history** when domains drop out of the feed compared to the previous snapshot.

Default feed URL: `https://www.wildlink.me/data/209/active-domain/1` (override with `CITI_FEED_URL` if needed).

## What you get

- **Live** tab: searchable table of domains, merchant names, IDs, and max rate fields from the latest sync.
- **Removed** tab: rows that disappeared between the last snapshot and the new one (with detection timestamp).
- **Run sync now**: fetches the feed, updates the latest snapshot, and appends new removals. A **weekly cron** runs the same job on Mondays (time configurable; see below).

## Requirements

- **Node.js 18+**
- For team-wide use: **PostgreSQL** and `DATABASE_URL` (otherwise data lives under `./data` on that machine only).

## Local quick start

```bash
cd citi-active-merchants-dashboard
npm install
cp .env.example .env   # optional; defaults work for a quick try
npm start
```

Open [http://localhost:3950](http://localhost:3950) (or whatever `PORT` you set). Use **Run sync now** once to populate data if the weekly job has not run yet.

## Configuration

Copy `.env.example` to `.env` and adjust. Common variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3950`). |
| `TZ` | Timezone for the weekly cron (default `America/New_York`). |
| `WEEKLY_CRON_MINUTE`, `WEEKLY_CRON_HOUR` | Monday job time (`minute hour` in cron terms; day-of-week is fixed to Monday in code). |
| `DISABLE_WEEKLY_CRON` | Set to `1` or `true` to turn off the scheduled job. |
| `RUN_API_KEY` | If set, `POST /api/run` requires header `x-api-key: <value>` (the UI can store the key in session storage). |
| `DATABASE_URL` | PostgreSQL connection string for shared snapshots and removal history. |
| `DATABASE_SSL` | Use with hosted Postgres when SSL is required or disabled (see `.env.example`). |
| `DATA_DIR` | Directory for JSON files when not using `DATABASE_URL` (default `./data`). |
| `CITI_FEED_URL` | Optional override for the active-domain JSON URL. |

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness; includes store kind (`postgres` or `file`). |
| `GET` | `/api/status` | Last snapshot time, counts, feed URL, cron description, meta / last error. |
| `GET` | `/api/merchants` | Latest records; optional query `q` filters domain, merchant name, or merchant ID. |
| `GET` | `/api/removals` | Full removal list. |
| `POST` | `/api/run` | Runs one sync; respects `RUN_API_KEY` when configured. |

## Project layout

- `server.js` — Express app, routes, weekly cron.
- `lib/feed.js` — Fetch and normalize feed JSON.
- `lib/sync.js` — Diff, persist latest, append removals.
- `lib/store.js` — Chooses Postgres vs file backend.
- `public/index.html` — Single-page dashboard (static assets).

## Deploying for a team

Production and Docker workflows (shared URL, Postgres, optional API key for manual sync) are documented in [DEPLOY.md](./DEPLOY.md). The included [render.yaml](./render.yaml) blueprint can deploy this service with `DATABASE_URL` set on the host.
