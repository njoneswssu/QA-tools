const { fetchActiveDomainJson, normalize } = require('./feed');
const store = require('./store');

/**
 * Fetch Citi active-domain feed, diff vs last snapshot, append removals, persist latest.
 */
async function runSync() {
  const { url, fetchedAt, raw } = await fetchActiveDomainJson();
  const records = raw.map(normalize).filter((r) => r.domain && r.merchantId != null);

  const prevDoc = await store.readLatest();
  const prevRecords = prevDoc && Array.isArray(prevDoc.records) ? prevDoc.records : [];
  const prevByKey = new Map(prevRecords.map((r) => [r.key, r]));

  const newKeys = new Set(records.map((r) => r.key));
  const removals = await store.readRemovals();
  const newlyRemoved = [];

  if (prevRecords.length > 0) {
    for (const [key, rec] of prevByKey) {
      if (!newKeys.has(key)) {
        newlyRemoved.push({
          ...rec,
          detectedAt: fetchedAt,
          feedUrl: url,
          sourceLabel: 'Citi active domain (Wildlink 209)'
        });
      }
    }
  }

  if (newlyRemoved.length > 0) {
    removals.unshift(...newlyRemoved);
    await store.writeRemovals(removals);
  }

  await store.writeLatest({
    feedUrl: url,
    fetchedAt,
    count: records.length,
    records
  });

  await store.writeMeta({
    lastRunAt: fetchedAt,
    lastRunOk: true,
    lastRunError: null,
    lastRemovedCount: newlyRemoved.length,
    lastPreviousCount: prevRecords.length,
    lastFeedCount: records.length
  });

  return {
    ok: true,
    fetchedAt,
    feedUrl: url,
    count: records.length,
    previousCount: prevRecords.length,
    removedCount: newlyRemoved.length,
    removedSample: newlyRemoved.slice(0, 20)
  };
}

async function runSyncSafe() {
  try {
    return await runSync();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    await store.writeMeta({
      lastRunAt: new Date().toISOString(),
      lastRunOk: false,
      lastRunError: msg
    });
    return { ok: false, message: msg };
  }
}

module.exports = { runSync, runSyncSafe };
