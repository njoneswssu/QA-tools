#!/usr/bin/env node
require('dotenv').config();

const path = require('path');
const express = require('express');
const cron = require('node-cron');

const store = require('./lib/store');
const { runSyncSafe } = require('./lib/sync');
const { DEFAULT_FEED_URL } = require('./lib/feed');

const PORT = parseInt(process.env.PORT || '3950', 10);
const TZ = process.env.TZ || 'America/New_York';
const CRON_HOUR = String(process.env.WEEKLY_CRON_HOUR || '7').padStart(2, '0');
const CRON_MINUTE = String(process.env.WEEKLY_CRON_MINUTE || '5').padStart(2, '0');
const CRON_EXPR = `${CRON_MINUTE} ${CRON_HOUR} * * 1`;
const RUN_API_KEY = process.env.RUN_API_KEY || '';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireRunKey(req, res, next) {
  if (!RUN_API_KEY) return next();
  const key = req.get('x-api-key') || (req.body && req.body.apiKey) || '';
  if (key !== RUN_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key for this action.' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, store: store.kind() });
});

app.get('/api/status', async (req, res) => {
  try {
    const latest = await store.readLatest();
    const removals = await store.readRemovals();
    const meta = await store.readMeta();
    res.json({
      feedUrl: (latest && latest.feedUrl) || DEFAULT_FEED_URL,
      lastSnapshotAt: latest && latest.fetchedAt,
      liveCount: latest && typeof latest.count === 'number' ? latest.count : null,
      removalsTotal: removals.length,
      meta,
      store: store.kind(),
      cron: {
        expression: CRON_EXPR,
        timezone: TZ,
        description: `Every Monday at ${CRON_HOUR}:${CRON_MINUTE} (${TZ})`
      },
      runApiKeyRequired: Boolean(RUN_API_KEY)
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/merchants', async (req, res) => {
  try {
    const latest = await store.readLatest();
    if (!latest || !Array.isArray(latest.records)) {
      return res.json({ fetchedAt: null, count: 0, records: [] });
    }
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase();
    let records = latest.records;
    if (q) {
      records = records.filter(
        (r) =>
          r.domain.toLowerCase().includes(q) ||
          String(r.merchantName).toLowerCase().includes(q) ||
          String(r.merchantId).includes(q)
      );
    }
    res.json({
      fetchedAt: latest.fetchedAt,
      feedUrl: latest.feedUrl,
      count: records.length,
      total: latest.count,
      records
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/removals', async (req, res) => {
  try {
    const removals = await store.readRemovals();
    res.json({ count: removals.length, removals });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/api/run', requireRunKey, async (req, res) => {
  const result = await runSyncSafe();
  if (!result.ok) {
    return res.status(500).json(result);
  }
  res.json(result);
});

if (process.env.DISABLE_WEEKLY_CRON === '1' || process.env.DISABLE_WEEKLY_CRON === 'true') {
  console.log('Weekly cron disabled (DISABLE_WEEKLY_CRON).');
} else {
  cron.schedule(
    CRON_EXPR,
    () => {
      console.log(`[cron] Citi active-domain sync (${new Date().toISOString()})`);
      runSyncSafe().then((r) => console.log('[cron]', r.ok ? JSON.stringify(r) : r.message));
    },
    { timezone: TZ }
  );
}

async function main() {
  try {
    await store.initStore();
  } catch (e) {
    console.error('Failed to initialize store:', e.message || e);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Citi active merchants dashboard http://localhost:${PORT}`);
    console.log(`Weekly cron: ${CRON_EXPR} (${TZ})`);
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in .env (e.g. PORT=3951).`);
      console.error(`Hint: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

main();
