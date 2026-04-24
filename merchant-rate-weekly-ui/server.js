#!/usr/bin/env node
require('dotenv').config();

const path = require('path');
const express = require('express');
const cron = require('node-cron');

const { readAppIdsFromFile, writeAppIdsToFile } = require('./lib/audit-runner');
const { executeAuditAndSync } = require('./lib/run-job');
const { getNextRunIsoUtc } = require('./lib/next-cron-run');

const PORT = parseInt(process.env.PORT || '3847', 10);
const TZ = process.env.TZ || 'America/New_York';
const CRON_HOUR = String(process.env.WEEKLY_CRON_HOUR || '8').padStart(2, '0');
const CRON_MINUTE = String(process.env.WEEKLY_CRON_MINUTE || '0').padStart(2, '0');
/** Monday at configured local time */
const CRON_EXPR = `${CRON_MINUTE} ${CRON_HOUR} * * 1`;
const CRON_DISABLED =
  process.env.DISABLE_WEEKLY_CRON === '1' || process.env.DISABLE_WEEKLY_CRON === 'true';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  const { readState } = require('./lib/state');
  const state = readState();
  res.json({
    ...state,
    cron: {
      expression: CRON_EXPR,
      timezone: TZ,
      description: `Every Monday at ${CRON_HOUR}:${CRON_MINUTE} (${TZ})`,
      automatedDisabled: CRON_DISABLED,
      nextRunAt: CRON_DISABLED ? null : getNextRunIsoUtc(CRON_EXPR, TZ)
    },
    spreadsheetId: process.env.SPREADSHEET_ID || null,
    sheetGid: process.env.SHEET_GID || null
  });
});

app.get('/api/config', (req, res) => {
  res.json({ appIds: readAppIdsFromFile() });
});

app.post('/api/config', (req, res) => {
  const ids = (req.body && req.body.appIds) || [];
  const parsed = []
    .concat(ids)
    .flatMap((x) => String(x).split(/[,\s]+/))
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  if (parsed.length === 0) {
    return res.status(400).json({ error: 'Provide at least one numeric App ID.' });
  }
  writeAppIdsToFile(parsed);
  res.json({ appIds: parsed });
});

app.post('/api/run', async (req, res) => {
  const syncSheet = !!(req.body && req.body.syncSheet);
  const appIds = req.body && req.body.appIds;
  const result = await executeAuditAndSync({ syncSheet, appIds });
  if (!result.ok) {
    return res.status(500).json(result);
  }
  res.json(result);
});

if (CRON_DISABLED) {
  console.log('Weekly cron disabled (DISABLE_WEEKLY_CRON).');
} else {
  cron.schedule(
    CRON_EXPR,
    () => {
      console.log(`[cron] Weekly merchant rate audit started (${new Date().toISOString()})`);
      executeAuditAndSync({ syncSheet: true }).then((r) => {
        console.log('[cron]', r.ok ? r.message || 'OK' : r.message);
        if (r.sheet) console.log('[cron] sheet:', r.sheet.message || r.sheet);
      });
    },
    { timezone: TZ }
  );
}

app.listen(PORT, () => {
  console.log(`Merchant rate weekly UI → http://localhost:${PORT}`);
  if (!CRON_DISABLED) {
    console.log(`Scheduled: ${CRON_EXPR} (${TZ}) — sync to Google Sheet when issues exist`);
  }
});
