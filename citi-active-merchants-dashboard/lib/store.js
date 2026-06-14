/**
 * Shared store: set DATABASE_URL for Postgres (one source of truth for the whole team).
 * Otherwise uses DATA_DIR (default ./data) on disk.
 */

let backend = null;

async function initStore() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (url) {
    const { createPgStore } = require('./store-pg');
    backend = await createPgStore();
    console.log('Store: PostgreSQL — history is shared for everyone using this deployment.');
  } else {
    backend = require('./store-file');
    console.log('Store: local files — use DATABASE_URL in production so the team shares one history.');
  }
}

function ensureInit() {
  if (!backend) {
    throw new Error('Store not initialized; call initStore() before handling requests.');
  }
}

function kind() {
  ensureInit();
  return backend.kind();
}

async function readLatest() {
  ensureInit();
  return backend.readLatest();
}

async function readRemovals() {
  ensureInit();
  return backend.readRemovals();
}

async function readMeta() {
  ensureInit();
  return backend.readMeta();
}

async function writeLatest(doc) {
  ensureInit();
  return backend.writeLatest(doc);
}

async function writeRemovals(list) {
  ensureInit();
  return backend.writeRemovals(list);
}

async function writeMeta(partial) {
  ensureInit();
  return backend.writeMeta(partial);
}

module.exports = {
  initStore,
  kind,
  readLatest,
  readRemovals,
  readMeta,
  writeLatest,
  writeRemovals,
  writeMeta
};
