const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const LATEST = path.join(DATA_DIR, 'latest.json');
const REMOVALS = path.join(DATA_DIR, 'removals.json');
const META = path.join(DATA_DIR, 'meta.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, obj) {
  ensureDir();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

async function readLatest() {
  return readJson(LATEST, null);
}

async function readRemovals() {
  const arr = readJson(REMOVALS, []);
  return Array.isArray(arr) ? arr : [];
}

async function readMeta() {
  return readJson(META, {});
}

async function writeLatest(doc) {
  writeJsonAtomic(LATEST, doc);
}

async function writeRemovals(list) {
  writeJsonAtomic(REMOVALS, list);
}

async function writeMeta(partial) {
  const cur = await readMeta();
  writeJsonAtomic(META, { ...cur, ...partial, updatedAt: new Date().toISOString() });
}

function kind() {
  return 'file';
}

module.exports = {
  DATA_DIR,
  kind,
  readLatest,
  readRemovals,
  readMeta,
  writeLatest,
  writeRemovals,
  writeMeta
};
