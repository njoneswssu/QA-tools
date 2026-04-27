/**
 * BigQuery REST — same SQL as lib/weekly-commission-fetch.js.
 * Handles large jobs: chunks IN (...) lists, polls async jobs, paginates results.
 */

const MAX_IDS_PER_CHUNK = 2500;
const JOB_POLL_MS = 900;
const JOB_MAX_WAIT_MS = 420000;

function buildDatePredicate(dateColumn, lookbackMonths) {
  const col = dateColumn && String(dateColumn).trim();
  if (!col || /^none$/i.test(col) || /^off$/i.test(col)) return '';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) return '';
  const m = Math.max(1, Math.min(36, Number(lookbackMonths) || 6));
  return ` AND DATE(c.${col}) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${m} MONTH)`;
}

function buildQuery(projectId, idList, datePred) {
  const inList = idList.join(', ');
  return `
    SELECT m.name, c.merchant_id, sum(c.commission_amount) as Total_Commissions
    FROM \`${projectId}.stephsandbox.commission_detail_view_2\` c
    JOIN \`${projectId}.firepublic.merchant\` m ON c.merchant_id = m.ID
    WHERE c.merchant_id IN (${inList})${datePred}
    GROUP BY c.merchant_id, m.name
    ORDER BY sum(c.commission_amount) DESC
  `.trim();
}

async function bqJson(accessToken, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`BigQuery: invalid JSON (${res.status})`);
  }
  if (!res.ok) {
    const msg = (data.error && data.error.message) || text.slice(0, 400);
    throw new Error(`BigQuery ${res.status}: ${msg}`);
  }
  return data;
}

function fieldIndices(schema) {
  const fields = (schema && schema.fields) || [];
  const names = fields.map((f) => (f.name || '').toLowerCase());
  let idxMid = names.findIndex((n) => n === 'merchant_id');
  let idxTotal = names.findIndex((n) => n === 'total_commissions');
  if (idxMid < 0) idxMid = 1;
  if (idxTotal < 0) idxTotal = 2;
  return { idxMid, idxTotal };
}

function rowsToMap(rows, schema) {
  const map = new Map();
  const { idxMid, idxTotal } = fieldIndices(schema);
  for (const row of rows || []) {
    const cells = row.f || [];
    const mid = cells[idxMid] != null && cells[idxMid].v != null ? String(cells[idxMid].v) : null;
    const totalRaw = cells[idxTotal] != null && cells[idxTotal].v != null ? cells[idxTotal].v : null;
    const commission = totalRaw != null ? Number(totalRaw) : NaN;
    if (mid && !isNaN(commission)) map.set(mid, commission);
  }
  return map;
}

/**
 * BigQuery returns `jobReference.location` for regional jobs. Omitting `location` on
 * jobs.get / jobs.getQueryResults yields 404 Not found for that job id.
 * @typedef {{ projectId: string, jobId: string, location?: string }} BqJobRef
 */

/** @param {BqJobRef} jobRef */
function jobsGetUrl(jobRef) {
  const { projectId, jobId, location } = jobRef;
  let u = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}?fields=status,jobReference`;
  if (location) u += `&location=${encodeURIComponent(location)}`;
  return u;
}

/** @param {BqJobRef} jobRef */
function jobResultsUrl(jobRef, maxResults, pageToken) {
  const { projectId, jobId, location } = jobRef;
  const u = new URL(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}/results`
  );
  u.searchParams.set('maxResults', String(maxResults));
  if (pageToken) u.searchParams.set('pageToken', pageToken);
  if (location) u.searchParams.set('location', location);
  return u.toString();
}

/**
 * @param {BqJobRef} refFromApi
 * @param {string} fallbackProjectId
 * @returns {BqJobRef}
 */
function normalizeJobRef(refFromApi, fallbackProjectId) {
  if (!refFromApi || !refFromApi.jobId) return null;
  const loc = refFromApi.location && String(refFromApi.location).trim();
  return {
    projectId: String(refFromApi.projectId || fallbackProjectId).trim(),
    jobId: String(refFromApi.jobId),
    ...(loc ? { location: loc } : {})
  };
}

async function waitForJob(accessToken, jobRef) {
  const start = Date.now();
  while (Date.now() - start < JOB_MAX_WAIT_MS) {
    let job;
    try {
      job = await bqJson(accessToken, jobsGetUrl(jobRef));
    } catch (e) {
      // Right after jobs.query, job metadata can briefly 404; regional jobs need `location` on the URL.
      if (/BigQuery 404/.test(String(e.message)) && Date.now() - start < 20000) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw e;
    }
    const state = job.status && job.status.state;
    if (state === 'DONE') {
      const er = job.status.errorResult;
      if (er && er.message) throw new Error(er.message);
      return;
    }
    if (state === 'FAILED') {
      const er = job.status.errorResult || job.status.error;
      throw new Error(er && er.message ? er.message : 'BigQuery job FAILED');
    }
    await new Promise((r) => setTimeout(r, JOB_POLL_MS));
  }
  throw new Error('BigQuery job timed out while waiting for completion.');
}

async function fetchAllResults(accessToken, jobRef, schemaHint) {
  const allRows = [];
  let pageToken = null;
  let schema = schemaHint;
  do {
    const data = await bqJson(accessToken, jobResultsUrl(jobRef, 10000, pageToken));
    if (data.schema) schema = data.schema;
    for (const row of data.rows || []) allRows.push(row);
    pageToken = data.pageToken || null;
  } while (pageToken);
  return { rows: allRows, schema };
}

/**
 * Run one query; if async, poll job and pull all result pages.
 */
async function runCommissionQueryChunk(accessToken, projectId, query) {
  const encP = encodeURIComponent(projectId);
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${encP}/queries`;
  const data = await bqJson(accessToken, url, {
    method: 'POST',
    body: JSON.stringify({ query, useLegacySql: false })
  });

  if (data.jobComplete) {
    return rowsToMap(data.rows, data.schema);
  }

  const jobRef = normalizeJobRef(data.jobReference, projectId);
  if (!jobRef) {
    throw new Error('BigQuery returned an incomplete job with no jobId.');
  }

  await waitForJob(accessToken, jobRef);
  const { rows, schema } = await fetchAllResults(accessToken, jobRef, data.schema);
  return rowsToMap(rows, schema);
}

/**
 * @param {string} accessToken
 * @param {number[]} merchantIds
 * @param {{ projectId?: string, dateColumn?: string, lookbackMonths?: number }} [opts]
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchCommissionMapFromBigQuery(accessToken, merchantIds, opts = {}) {
  const projectId = (opts.projectId || 'wildfire-1000').trim();
  const ids = (merchantIds || []).map(Number).filter((n) => !isNaN(n) && n > 0);
  if (!ids.length) return new Map();

  const datePred = buildDatePredicate(opts.dateColumn || '', opts.lookbackMonths);
  const merged = new Map();

  for (let i = 0; i < ids.length; i += MAX_IDS_PER_CHUNK) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_CHUNK);
    const query = buildQuery(projectId, chunk, datePred);
    const part = await runCommissionQueryChunk(accessToken, projectId, query);
    for (const [k, v] of part) merged.set(k, v);
  }

  return merged;
}
