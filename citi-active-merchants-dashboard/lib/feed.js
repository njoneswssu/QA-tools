const DEFAULT_FEED_URL = 'https://www.wildlink.me/data/209/active-domain/1';

function buildKey(record) {
  const domain = String(record.Domain || '').trim().toLowerCase();
  const mid = record.Merchant && record.Merchant.ID != null ? record.Merchant.ID : '';
  return `${domain}|${mid}`;
}

function normalize(raw) {
  const m = raw.Merchant || {};
  const mr = m.MaxRate || {};
  return {
    key: buildKey(raw),
    domainRowId: raw.ID,
    domain: String(raw.Domain || '').trim(),
    merchantId: m.ID,
    merchantName: m.Name != null ? String(m.Name) : '',
    maxRateKind: mr.Kind != null ? String(mr.Kind) : '',
    maxRateAmount: mr.Amount != null ? String(mr.Amount) : '',
    maxRateCurrency: mr.Currency != null ? String(mr.Currency) : ''
  };
}

async function fetchActiveDomainJson(url = process.env.CITI_FEED_URL || DEFAULT_FEED_URL) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'follow'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Feed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    throw new Error(`Feed was not valid JSON (${e.message})`);
  }
  if (!Array.isArray(data)) {
    throw new Error('Feed JSON must be an array');
  }
  return { url, fetchedAt: new Date().toISOString(), raw: data };
}

module.exports = {
  DEFAULT_FEED_URL,
  buildKey,
  normalize,
  fetchActiveDomainJson
};
