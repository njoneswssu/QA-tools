const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '../data/last-run.json');

function readState() {
  if (!fs.existsSync(STATE_PATH)) {
    return {
      lastRunAt: null,
      lastRunOk: null,
      lastRunMessage: null,
      lastRowsCount: null,
      lastSheetSyncAt: null,
      lastSheetSyncOk: null,
      lastSheetSyncMessage: null,
      running: false
    };
  }
  try {
    return { ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')), running: false };
  } catch (_) {
    return { lastRunAt: null, lastRunOk: null, lastRunMessage: 'Corrupt state file', running: false };
  }
}

function writeState(partial) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const prev = readState();
  const next = { ...prev, ...partial, running: partial.running !== undefined ? partial.running : prev.running };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { readState, writeState, STATE_PATH };
