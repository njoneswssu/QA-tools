#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Offer Activation Auditor
 * 
 * Tests if merchant offers are working properly by:
 * 1. Following redirect chains from wild.link URLs
 * 2. Detecting error pages (expired offers, offer not found, etc.)
 * 3. Identifying merchants with broken activation flows
 */

// Configuration
const CONFIG = {
  baseUrl: 'https://www.wildlink.me/data',
  wildlinkBaseUrl: 'https://wild.link',
  outputDir: './audit-results',
  sessionFilePath: null, // set at runtime: offer-activation-session.json next to outputDir
  requestTimeout: 30000,
  maxRedirects: 15,
  defaultAppIds: [451, 206, 209],
  /** Delay in ms between each redirect hop (wild.link → affiliate → merchant) to avoid 429 rate limits */
  delayBetweenRedirectHopsMs: 2000,
  /** Delay in ms between testing each merchant in batch */
  delayBetweenMerchantsMs: 2500
};
CONFIG.sessionFilePath = path.join(CONFIG.outputDir, 'offer-activation-session.json');
CONFIG.testedMerchantsFilePath = path.join(CONFIG.outputDir, 'offer-activation-tested-merchants.json');

/** Used by SIGINT handler to save partial results when user presses Ctrl+C. */
let _interruptSaveRef = null;
let _interruptSaveAppId = null;

function saveInterruptedResults() {
  if (!_interruptSaveRef || _interruptSaveRef.length === 0) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  try {
    const csvPath = exportResultsToCSV(_interruptSaveRef, `offer-activation-interrupted-${ts}.csv`);
    if (csvPath) console.log(chalk.yellow('\n⚠️  Interrupted. Partial results saved to ' + csvPath));
  } catch (_) {}
  _interruptSaveRef = null;
  _interruptSaveAppId = null;
}

function setInterruptSave(resultsRef, appId) {
  _interruptSaveRef = resultsRef;
  _interruptSaveAppId = appId;
}

function clearInterruptSave() {
  _interruptSaveRef = null;
  _interruptSaveAppId = null;
}

process.on('SIGINT', () => {
  if (typeof process.__fullAuditRecoveryCallback === 'function') {
    try {
      process.__fullAuditRecoveryCallback();
    } catch (e) {
      console.error(chalk.red('Full audit recovery failed: ' + (e && e.message ? e.message : String(e))));
    }
  }
  saveInterruptedResults();
  process.exit(130);
});

/**
 * Load set of merchant IDs that have been tested for an app (persisted across runs).
 * @param {number} appId
 * @returns {Set<number>} Set of merchant IDs
 */
function loadTestedMerchants(appId) {
  try {
    if (!fs.existsSync(CONFIG.testedMerchantsFilePath)) return new Set();
    const raw = fs.readFileSync(CONFIG.testedMerchantsFilePath, 'utf8');
    const data = JSON.parse(raw);
    const ids = data[String(appId)];
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map(Number));
  } catch {
    return new Set();
  }
}

/**
 * Persist tested merchants by app. Merges new IDs into existing data.
 * @param {number} appId
 * @param {number[]} merchantIds
 */
function markMerchantsAsTested(appId, merchantIds) {
  try {
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    let data = {};
    if (fs.existsSync(CONFIG.testedMerchantsFilePath)) {
      try {
        data = JSON.parse(fs.readFileSync(CONFIG.testedMerchantsFilePath, 'utf8'));
      } catch (_) {}
    }
    const key = String(appId);
    const existing = Array.isArray(data[key]) ? data[key] : [];
    const merged = new Set([...existing, ...merchantIds.map(Number)]);
    data[key] = [...merged];
    fs.writeFileSync(CONFIG.testedMerchantsFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Shuffle array randomly (Fisher–Yates).
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Load saved device/session (deviceId, trackingCode, shoppingTripCode).
 * @returns {{ deviceId: string, trackingCode: string, shoppingTripCode: string } | null}
 */
function loadSavedSession() {
  try {
    if (!fs.existsSync(CONFIG.sessionFilePath)) return null;
    const raw = fs.readFileSync(CONFIG.sessionFilePath, 'utf8');
    const data = JSON.parse(raw);
    if (data && (data.deviceId || data.trackingCode || data.shoppingTripCode)) {
      return {
        deviceId: data.deviceId || '',
        trackingCode: data.trackingCode || '',
        shoppingTripCode: data.shoppingTripCode || ''
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save device/session for next time.
 */
function saveSession(deviceId, trackingCode, shoppingTripCode) {
  try {
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    const data = {
      deviceId: deviceId || '',
      trackingCode: trackingCode || '',
      shoppingTripCode: shoppingTripCode || '',
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG.sessionFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    return false;
  }
}

// Error page indicators - URLs that indicate a failed offer activation
const ERROR_URL_PATTERNS = [
  /expired\.jsp/i,
  /qksrv\.net\/media\/offers/i,
  /\/offers\/\?cjdata=/i,
  /\/error\//i,
  /\/notfound/i,
  /\/404/i,
  /\/offer-not-found/i,
  /\/offer-expired/i,
  /\/link-expired/i,
  /\/invalid-link/i,
  /\/unavailable/i,
  /rakuten\.com\/mer\/error/i,
  /impactradius.*\/error/i,
  /pepperjam.*\/error/i,
  /partnerize.*\/error/i,
  /shareasale.*\/error/i,
  /awin.*\/error/i,
  /cj\.com.*\/expired/i,
  /members\.cj\.com\/expired/i
];

// Error page content indicators - text on the page that indicates failure
const ERROR_CONTENT_PATTERNS = [
  /offer\s+(is\s+)?not\s+found/i,
  /offer\s+(has\s+)?expired/i,
  /link\s+(is\s+)?no\s+longer\s+(available|valid)/i,
  /this\s+offer\s+(is\s+)?(no\s+longer|not)\s+(available|active)/i,
  /campaign\s+(has\s+)?ended/i,
  /promotion\s+(has\s+)?expired/i,
  /deal\s+(is\s+)?no\s+longer\s+available/i,
  /sorry.*this\s+offer/i,
  /oops.*offer/i,
  /we\s+couldn't\s+find\s+(this\s+)?offer/i,
  /the\s+link\s+you\s+followed.*expired/i,
  /this\s+program\s+is\s+(not|no\s+longer)\s+active/i,
  /merchant\s+(is\s+)?(not|no\s+longer)\s+available/i,
  /advertiser\s+(has\s+)?left\s+the\s+network/i
];

// Known affiliate network domains (for identifying redirect chains)
// If the final destination is one of these (instead of the merchant site), activation failed.
const AFFILIATE_NETWORK_DOMAINS = [
  'wild.link',
  'wildlink.me',
  'jdoqocy.com',
  'cj.com',
  'commission-junction.com',
  'dotomi.com',
  'emjcd.com',
  'qksrv.net',
  'members.cj.com',
  'tkqlhce.com',
  'kqzyfj.com',
  'anrdoezrs.com',
  'dpbolvw.net',
  'awltovhc.com',
  'ftjcfx.com',
  'lduhtrp.net',
  'tqlkg.com',
  'apmebf.com',
  'rakuten.com',
  'linksynergy.com',
  'impactradius.com',
  'impact.com',
  'pepperjam.com',
  'pjatr.com',
  'partnerize.com',
  'shareasale.com',
  'awin1.com',
  'awin.com',
  'webgains.com',
  'flexoffers.com',
  'sjv.io',       // e.g. atkins.sjv.io (affiliate redirector)
  'ztk5.net'      // e.g. ulta.ztk5.net (affiliate redirector)
];

// Domains/paths that indicate an ACTIVATION LINK (what the extension uses when you click "Activate Offer")
// If the URL is NOT one of these, we treat it as a merchant website and build the activation link from it.
const ACTIVATION_LINK_INDICATORS = [
  /^https?:\/\/(www\.)?wild\.link\//i,
  /^https?:\/\/[^/]*\.wildlink\./i,
  /^https?:\/\/(www\.)?jdoqocy\.com\/click-/i,
  /^https?:\/\/[^/]*\.(cj\.com|dotomi\.com|emjcd\.com)\//i,
  /^https?:\/\/[^/]*\.(tkqlhce|kqzyfj|anrdoezrs|dpbolvw|awltovhc|ftjcfx|lduhtrp|tqlkg|apmebf)\.com\//i,
  /\/click-\d+/i,
  /[?&]c=\d+/i  // wild.link style ?c=101920
];

/**
 * Redirect entry in the chain
 */
class RedirectEntry {
  constructor(url, statusCode, statusText, headers = {}) {
    this.url = url;
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.headers = headers;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Check if a URL matches error patterns
 */
function isErrorUrl(url) {
  if (!url) return false;
  return ERROR_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if page content indicates an error
 */
function isErrorContent(content) {
  if (!content) return false;
  return ERROR_CONTENT_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check if domain is an affiliate network
 */
function isAffiliateNetworkDomain(domain) {
  if (!domain) return false;
  return AFFILIATE_NETWORK_DOMAINS.some(networkDomain => 
    domain.includes(networkDomain) || networkDomain.includes(domain)
  );
}

/**
 * Check if the given URL is an activation link (what the extension opens when you click "Activate Offer").
 * If false, the URL is treated as a merchant website and we build the activation link from it.
 */
function isActivationLink(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const fullUrl = parsed.href;
    return ACTIVATION_LINK_INDICATORS.some(pattern => pattern.test(fullUrl));
  } catch {
    return false;
  }
}

/**
 * Build the wild.link activation URL the same way the Citi Edge extension does (worker.js).
 * Extension logic: new URL(vanityUrlBase+"/e"), append d, c, tc?, sc?, then searchParams.sort(), then append url.
 * @param {string} originalUrl - Merchant URL (e.g. https://bobore.com)
 * @param {number} campaignId - Campaign/merchant ID (c= param; from activeDomain.Merchant.ID or alternate merchant ID)
 * @param {object} options - Optional. { deviceId, trackingCode, shoppingTripCode }
 * @returns {string|null} Vanity URL
 */
function buildActivationUrlLikeExtension(originalUrl, campaignId, options = {}) {
  const { deviceId = '0', trackingCode = '', shoppingTripCode = '' } = options;
  try {
    const u = new URL(`${CONFIG.wildlinkBaseUrl}/e`);
    u.searchParams.append('d', String(deviceId));
    u.searchParams.append('c', String(campaignId));
    if (trackingCode) u.searchParams.append('tc', trackingCode);
    if (shoppingTripCode) u.searchParams.append('sc', shoppingTripCode);
    // Extension sorts params then appends url last
    u.searchParams.sort();
    u.searchParams.append('url', originalUrl || '');
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Build the wild.link activation URL for a merchant site (simple fallback when we don't have feed data).
 * Format: https://wild.link/e?c=APP_ID&url=ENCODED_MERCHANT_URL
 */
function buildWildlinkActivationUrl(merchantWebsiteUrl, appId = 451, options = {}) {
  if (!merchantWebsiteUrl || typeof merchantWebsiteUrl !== 'string') return null;
  let url = merchantWebsiteUrl.trim();
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  try {
    new URL(url); // validate
  } catch {
    return null;
  }
  const session = {
    deviceId: options.deviceId || '',
    trackingCode: options.trackingCode || '',
    shoppingTripCode: options.shoppingTripCode || ''
  };
  return buildActivationUrlLikeExtension(url, appId, session);
}

/**
 * Normalize user input to a full URL (add https if missing).
 */
function normalizeToUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Normalize domain for lookup (lowercase, strip www).
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const host = new URL(url).hostname || domain;
    return host.replace(/^www\./, '').toLowerCase();
  } catch {
    return domain.replace(/^www\./, '').toLowerCase();
  }
}

/**
 * Parse the original merchant URL from an activation link (e.g. wild.link has url= param).
 * Returns the URL string or null if not present.
 */
function parseOriginalUrlFromActivationLink(activationUrl) {
  if (!activationUrl || typeof activationUrl !== 'string') return null;
  try {
    const u = new URL(activationUrl.startsWith('http') ? activationUrl : `https://${activationUrl}`);
    const urlParam = u.searchParams.get('url');
    if (urlParam) return decodeURIComponent(urlParam);
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch active-domain feed (extension uses this to resolve domain → merchant/campaign).
 * Returns array of { ID, Domain, Merchant: { ID, Name, MaxRate } }.
 */
async function fetchActiveDomains(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/active-domain/1`;
  try {
    const response = await axios.get(url, {
      timeout: CONFIG.requestTimeout,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OfferActivationAuditor/1.0)' }
    });
    if (Array.isArray(response.data)) return response.data;
    return [];
  } catch (err) {
    console.warn(chalk.yellow(`Could not fetch active-domain feed: ${err.message}`));
    return [];
  }
}

/**
 * Fetch alternative-domains feed (extension's second domain list).
 * Returns array of { Domain, Company, AlternateMerchantIDs }.
 */
async function fetchAlternativeDomains(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/alternative-domains/1`;
  try {
    const response = await axios.get(url, {
      timeout: CONFIG.requestTimeout,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OfferActivationAuditor/1.0)' }
    });
    if (Array.isArray(response.data)) return response.data;
    return [];
  } catch (err) {
    console.warn(chalk.yellow(`Could not fetch alternative-domains feed: ${err.message}`));
    return [];
  }
}

/**
 * Resolve a domain using the active-domain feed. Returns { campaignId, merchantName, domain, originalUrl } or null.
 */
function resolveDomainWithActiveDomains(domain, activeDomains) {
  const norm = normalizeDomain(domain);
  if (!norm) return null;
  const entry = activeDomains.find(
    (e) => normalizeDomain(e.Domain) === norm
  );
  if (!entry || !entry.Merchant || entry.Merchant.ID == null) return null;
  const originalUrl = `https://${entry.Domain.replace(/^www\./, '')}`;
  return {
    campaignId: entry.Merchant.ID,
    merchantName: entry.Merchant.Name || entry.Domain,
    domain: entry.Domain,
    originalUrl
  };
}

/**
 * Resolve a domain using the alternative-domains feed. Returns { campaignId, merchantName, domain, originalUrl } or null.
 * Uses first AlternateMerchantIDs when multiple.
 */
function resolveDomainWithAlternativeDomains(domain, alternativeDomains) {
  const norm = normalizeDomain(domain);
  if (!norm) return null;
  const entry = alternativeDomains.find(
    (e) => normalizeDomain(e.Domain) === norm
  );
  if (!entry || !entry.AlternateMerchantIDs || entry.AlternateMerchantIDs.length === 0) return null;
  const campaignId = entry.AlternateMerchantIDs[0];
  const originalUrl = `https://${entry.Domain.replace(/^www\./, '')}`;
  return {
    campaignId,
    merchantName: entry.Company || entry.Domain,
    domain: entry.Domain,
    originalUrl
  };
}

/**
 * Analyze the redirect chain for issues.
 * Success = "redirects back to the original website" (final destination is the expected merchant domain).
 * @param {Array} redirects - Redirect chain entries
 * @param {string} finalContent - Body of final response
 * @param {object} options - Optional. { expectedMerchantDomain: string } — domain we expect to land on if activation works
 */
function analyzeRedirectChain(redirects, finalContent = '', options = {}) {
  const { expectedMerchantDomain = null } = options;
  const issues = [];
  const finalRedirect = redirects[redirects.length - 1];
  
  if (!finalRedirect) {
    return { issues: [{ type: 'no_response', message: 'No response received' }], isError: true, redirectedBackToMerchant: false };
  }
  
  const finalUrl = finalRedirect.url;
  const finalDomain = extractDomain(finalUrl);
  const finalDomainNorm = normalizeDomain(finalDomain);
  const firstHop = redirects[0];

  // Success criterion: activation is good when we redirect BACK to the original merchant website
  const expectedNorm = expectedMerchantDomain ? normalizeDomain(expectedMerchantDomain) : null;
  const redirectedBackToMerchant = !!(
    expectedNorm &&
    finalDomainNorm &&
    finalRedirect.statusCode >= 200 &&
    finalRedirect.statusCode < 300 &&
    finalDomainNorm === expectedNorm
  );

  // If the first request got 404 — wild.link requires a valid session (real device id + tracking code from the extension)
  if (firstHop && firstHop.statusCode === 404 && redirects.length === 1) {
    issues.push({
      type: 'activation_link_unavailable',
      severity: 'high',
      message: 'Wild.link returned 404 — it needs a valid session (device id + tracking code from the extension). To run the full flow: open the merchant site, click Activate Offer, then copy the wild.link URL from the address bar and paste it here.'
    });
  }

  // If the redirect chain ended at 404 (e.g. affiliate or merchant URL returned Not Found), flag the merchant
  if (finalRedirect.statusCode === 404) {
    issues.push({
      type: 'redirect_404',
      severity: 'high',
      message: `Redirect chain ended at 404 Not Found: ${finalUrl}`
    });
  }

  // If the chain ended at 429 after retries, flag for retest
  if (finalRedirect.statusCode === 429) {
    issues.push({
      type: 'rate_limited_429',
      severity: 'high',
      message: 'Rate limited (429) after retries — retest this merchant later.'
    });
  }

  // Check if final URL indicates an error (unless we landed back on the merchant)
  if (!redirectedBackToMerchant && isErrorUrl(finalUrl)) {
    issues.push({
      type: 'error_url',
      severity: 'high',
      message: `Final URL indicates an error: ${finalUrl}`
    });
  }
  
  // Check if final page content indicates an error (unless we're clearly back on merchant)
  if (!redirectedBackToMerchant && isErrorContent(finalContent)) {
    issues.push({
      type: 'error_content',
      severity: 'high',
      message: 'Page content indicates offer is not found or expired'
    });
  }
  
  // Check if we ended on affiliate network instead of merchant (failure = did not redirect back to original website)
  if (
    !redirectedBackToMerchant &&
    isAffiliateNetworkDomain(finalDomain) &&
    finalRedirect.statusCode === 200
  ) {
    issues.push({
      type: 'network_error_page',
      severity: 'high',
      message: `Landed on affiliate network page instead of merchant: ${finalDomain}. Did not redirect back to original website.`
    });
  }
  
  // Check for too many redirects
  if (redirects.length >= CONFIG.maxRedirects) {
    issues.push({
      type: 'too_many_redirects',
      severity: 'medium',
      message: `Excessive redirects (${redirects.length})`
    });
  }
  
  // Check for redirect loop indicators
  const urlCounts = {};
  for (const redirect of redirects) {
    const domain = extractDomain(redirect.url);
    urlCounts[domain] = (urlCounts[domain] || 0) + 1;
    if (urlCounts[domain] > 3) {
      issues.push({
        type: 'redirect_loop',
        severity: 'high',
        message: `Possible redirect loop detected on ${domain}`
      });
      break;
    }
  }
  
  // Success = redirected back to original merchant site; failure = any high-severity issue (and not back on merchant)
  const isError = !redirectedBackToMerchant && issues.some(i => i.severity === 'high');
  
  return { issues, isError, finalUrl, finalDomain, redirectedBackToMerchant };
}

/**
 * Follow redirects and capture the chain
 */
async function followRedirects(url, headers = {}) {
  const redirectChain = [];
  let currentUrl = url;
  let finalContent = '';
  let redirectCount = 0;
  
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    ...headers
  };
  
  const RETRY_429_BASE_MS = 30000;
  const RETRY_429_MAX_MS = 300000;
  const RETRY_429_MAX_ATTEMPTS = 4;

  while (redirectCount < CONFIG.maxRedirects) {
    try {
      let response;
      let attempt = 0;
      for (;;) {
        response = await axios({
          method: 'GET',
          url: currentUrl,
          maxRedirects: 0,
          validateStatus: () => true,
          timeout: CONFIG.requestTimeout,
          headers: defaultHeaders,
          responseType: 'text'
        });
        if (response.status !== 429) break;
        if (attempt >= RETRY_429_MAX_ATTEMPTS) break;
        let waitMs = RETRY_429_BASE_MS * Math.pow(1.5, attempt);
        if (waitMs > RETRY_429_MAX_MS) waitMs = RETRY_429_MAX_MS;
        const retryAfter = response.headers && response.headers['retry-after'];
        if (retryAfter) {
          const sec = parseInt(retryAfter, 10);
          if (!isNaN(sec) && sec > 0) waitMs = Math.min(sec * 1000, RETRY_429_MAX_MS);
        }
        if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
          console.log(chalk.yellow(`   Rate limited (429). Waiting ${Math.round(waitMs / 1000)}s before retry (attempt ${attempt + 1})...`));
        }
        await new Promise(r => setTimeout(r, waitMs));
        attempt++;
      }

      const statusCode = response.status;
      const statusText = response.statusText || getStatusText(statusCode);

      redirectChain.push(new RedirectEntry(
        currentUrl,
        statusCode,
        statusText,
        {
          location: response.headers.location,
          contentType: response.headers['content-type']
        }
      ));

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, currentUrl).href;
        currentUrl = nextUrl;
        redirectCount++;
        if (CONFIG.delayBetweenRedirectHopsMs > 0) {
          await new Promise(r => setTimeout(r, CONFIG.delayBetweenRedirectHopsMs));
        }
      } else {
        if (typeof response.data === 'string') {
          finalContent = response.data.substring(0, 50000);
        }
        break;
      }
    } catch (error) {
      redirectChain.push(new RedirectEntry(
        currentUrl,
        0,
        `Error: ${error.message}`,
        {}
      ));
      break;
    }
  }

  return { redirectChain, finalContent };
}

/**
 * Get status text for common codes
 */
function getStatusText(code) {
  const statusTexts = {
    200: 'OK',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  return statusTexts[code] || 'Unknown';
}

/**
 * Fetch merchant data for a specific app ID
 */
async function fetchMerchantData(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/merchant/1`;
  
  try {
    console.log(chalk.blue(`📡 Fetching merchant data for App ID ${appId}...`));
    const response = await axios.get(url, {
      timeout: CONFIG.requestTimeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OfferActivationAuditor/1.0)'
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      console.log(chalk.green(`✅ Loaded ${response.data.length} merchants`));
      return response.data;
    }
    return [];
  } catch (error) {
    console.error(chalk.red(`❌ Error fetching merchants: ${error.message}`));
    return [];
  }
}

/**
 * Generate the activation URL for a merchant (same process as single-link: resolve domain with active-domains, then build).
 * When activeDomains is provided, uses the same campaign resolution as testWildlinkActivation.
 * @param {object} merchant - Merchant object with URL or Domain
 * @param {number} appId - App ID (used as campaignId fallback when domain not in feed)
 * @param {object} session - { deviceId, trackingCode, shoppingTripCode }
 * @param {Array} [activeDomains] - Optional. If provided, resolve domain to get campaignId (same as single-link testing).
 */
function generateWildlinkUrl(merchant, appId, session = {}, activeDomains = null) {
  let merchantSiteUrl = null;
  if (merchant.URL) {
    merchantSiteUrl = merchant.URL.startsWith('http') ? merchant.URL : `https://${merchant.URL}`;
  } else if (merchant.Domain) {
    merchantSiteUrl = `https://${merchant.Domain.replace(/^www\./, '')}`;
  }
  if (!merchantSiteUrl) return null;
  let campaignId = appId;
  if (activeDomains && activeDomains.length > 0) {
    const resolved = resolveDomainWithActiveDomains(merchantSiteUrl, activeDomains);
    if (resolved) campaignId = resolved.campaignId;
  }
  return buildActivationUrlLikeExtension(merchantSiteUrl, campaignId, {
    deviceId: session.deviceId || '0',
    trackingCode: session.trackingCode || '',
    shoppingTripCode: session.shoppingTripCode || ''
  });
}

/**
 * Test offer activation for a single merchant (same process as single-link: resolve with active-domains when activeDomains provided).
 */
async function testMerchantActivation(merchant, appId, testUrl = null, session = {}, activeDomains = null) {
  const merchantName = merchant.Name || `Merchant ID ${merchant.ID}`;
  const merchantId = merchant.ID;
  const merchantDomain = merchant.Domain || extractDomain(merchant.URL) || 'unknown';
  
  // Use provided test URL or generate one (with session + optional activeDomains for same process as single-link)
  const url = testUrl || generateWildlinkUrl(merchant, appId, session, activeDomains);
  
  if (!url) {
    return {
      merchantId,
      merchantName,
      merchantDomain,
      success: false,
      error: 'No URL available for testing',
      redirectChain: [],
      issues: [{ type: 'no_url', severity: 'low', message: 'No URL available for testing' }]
    };
  }
  
  const expectedMerchantDomain = (merchantDomain && merchantDomain !== 'unknown')
    ? merchantDomain
    : (extractDomain(merchant.URL) || merchant.Domain || null);
  const maxAttempts = 3;
  let lastResult = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) console.log(chalk.gray(`  Retry ${attempt}/${maxAttempts}: ${merchantName} (${merchantDomain})...`));
    else console.log(chalk.gray(`  Testing: ${merchantName} (${merchantDomain})...`));
    try {
      const { redirectChain, finalContent } = await followRedirects(url);
      const analysis = analyzeRedirectChain(redirectChain, finalContent, { expectedMerchantDomain });
      if (!analysis.isError) {
        return {
          merchantId,
          merchantName,
          merchantDomain,
          testUrl: url,
          success: true,
          redirectedBackToMerchant: analysis.redirectedBackToMerchant,
          redirectChain,
          finalUrl: analysis.finalUrl,
          finalDomain: analysis.finalDomain,
          issues: analysis.issues,
          redirectCount: redirectChain.length
        };
      }
      lastResult = {
        merchantId,
        merchantName,
        merchantDomain,
        testUrl: url,
        success: false,
        redirectChain,
        finalUrl: analysis.finalUrl,
        finalDomain: analysis.finalDomain,
        issues: analysis.issues,
        redirectCount: redirectChain.length,
        error: (analysis.issues && analysis.issues[0] && analysis.issues[0].message) || 'Activation failed'
      };
    } catch (error) {
      lastResult = {
        merchantId,
        merchantName,
        merchantDomain,
        testUrl: url,
        success: false,
        error: error.message,
        redirectChain: [],
        issues: [{ type: 'request_error', severity: 'high', message: error.message }]
      };
    }
  }
  const failedAfter = lastResult ? {
    ...lastResult,
    error: lastResult.error ? `Failed after ${maxAttempts} attempts: ${lastResult.error}` : `Failed after ${maxAttempts} attempts`,
    issues: (lastResult.issues || []).concat({ type: 'max_retries', severity: 'high', message: `Offer activation failed after ${maxAttempts} attempts` })
  } : {
    merchantId,
    merchantName,
    merchantDomain,
    testUrl: url,
    success: false,
    error: `Failed after ${maxAttempts} attempts`,
    redirectChain: [],
    issues: [{ type: 'max_retries', severity: 'high', message: `Offer activation failed after ${maxAttempts} attempts` }]
  };
  return failedAfter;
}

/**
 * Test activation for a specific domain (builds wild.link activation URL and follows it).
 */
async function testDomain(domain, name = null, appId = 451) {
  const merchantUrl = normalizeToUrl(domain);
  if (!merchantUrl) {
    return {
      merchantName: name || domain,
      merchantDomain: domain,
      testUrl: null,
      success: false,
      error: 'Invalid domain',
      redirectChain: [],
      issues: [{ type: 'invalid_domain', severity: 'high', message: 'Invalid domain' }]
    };
  }

  const activationUrl = buildWildlinkActivationUrl(merchantUrl, appId);
  const merchantName = name || extractDomain(merchantUrl) || domain;

  console.log(chalk.bold.cyan('\n🧪 Simulating extension "Activate Offer"'));
  console.log(chalk.yellow(`   Testing activation for: ${merchantName}`));
  console.log(chalk.gray(`   Activation URL: ${activationUrl}`));

  const expectedMerchantDomain = extractDomain(merchantUrl);
  try {
    const { redirectChain, finalContent } = await followRedirects(activationUrl);
    const analysis = analyzeRedirectChain(redirectChain, finalContent, { expectedMerchantDomain });

    return {
      merchantName,
      merchantDomain: extractDomain(merchantUrl),
      testUrl: activationUrl,
      success: !analysis.isError,
      redirectedBackToMerchant: analysis.redirectedBackToMerchant,
      redirectChain,
      finalUrl: analysis.finalUrl,
      finalDomain: analysis.finalDomain,
      issues: analysis.issues,
      redirectCount: redirectChain.length
    };
  } catch (error) {
    return {
      merchantName,
      merchantDomain: extractDomain(merchantUrl),
      testUrl: activationUrl,
      success: false,
      error: error.message,
      redirectChain: [],
      issues: [{ type: 'request_error', severity: 'high', message: error.message }]
    };
  }
}

/**
 * Simulate offer activation from a merchant link (or test an activation link directly).
 * When given a merchant URL we build the activation URL (extension-style). Use real deviceId/tc/sc to get past wild.link.
 * @param {string} inputLink - Merchant link or activation link.
 * @param {object} options - Optional. { appId, deviceId, trackingCode, shoppingTripCode } for building from merchant link.
 */
async function testWildlinkActivation(inputLink, options = {}) {
  const { appId = 451, deviceId = '', trackingCode = '', shoppingTripCode = '' } = options;
  let link = typeof inputLink === 'string' ? inputLink.trim() : (inputLink && inputLink.link && inputLink.link.trim());
  if (typeof inputLink === 'object' && inputLink.link != null) {
    link = inputLink.link.trim();
  }

  if (!link) {
    return {
      testUrl: null,
      success: false,
      error: 'No URL provided',
      redirectChain: [],
      issues: [{ type: 'no_url', severity: 'high', message: 'No URL provided' }]
    };
  }

  const normalizedUrl = normalizeToUrl(link);
  let activationUrl;
  let expectedMerchantDomain;

  if (isActivationLink(normalizedUrl)) {
    // They pasted an activation link — use it as-is (full flow: wild.link → affiliate → merchant)
    activationUrl = normalizedUrl;
    const originalUrl = parseOriginalUrlFromActivationLink(activationUrl);
    expectedMerchantDomain = originalUrl ? extractDomain(originalUrl) : null;
    console.log(chalk.bold.cyan('\n🧪 Testing activation link (full redirect flow)'));
    console.log(chalk.yellow('   Success = redirects back to the original website.'));
    console.log(chalk.gray(`   Link: ${activationUrl.length > 70 ? activationUrl.slice(0, 67) + '...' : activationUrl}`));
    if (expectedMerchantDomain) {
      console.log(chalk.gray(`   Expected back to: ${expectedMerchantDomain}`));
    }
  } else {
    // Merchant link — build activation URL; use provided deviceId/tc/sc so wild.link can redirect
    expectedMerchantDomain = extractDomain(normalizedUrl);
    const hasSession = !!(deviceId || trackingCode || shoppingTripCode);
    let campaignId = appId;
    try {
      const activeDomains = await fetchActiveDomains(appId);
      const resolved = resolveDomainWithActiveDomains(normalizedUrl, activeDomains);
      if (resolved) {
        campaignId = resolved.campaignId;
        console.log(chalk.bold.cyan('\n🧪 Simulating offer activation from merchant link'));
        console.log(chalk.gray(`   Merchant: ${resolved.merchantName} (ID ${campaignId})`));
      } else {
        console.log(chalk.bold.cyan('\n🧪 Simulating offer activation from merchant link'));
        console.log(chalk.gray(`   Domain not in active-domain feed; using App ID ${appId} as campaign.`));
      }
    } catch (_) {
      console.log(chalk.bold.cyan('\n🧪 Simulating offer activation from merchant link'));
      console.log(chalk.gray(`   Using App ID ${appId} as campaign.`));
    }
    activationUrl = buildActivationUrlLikeExtension(normalizedUrl, campaignId, {
      deviceId: deviceId || '0',
      trackingCode: trackingCode || '',
      shoppingTripCode: shoppingTripCode || ''
    });
    if (!hasSession) {
      console.log(chalk.yellow('   No device/tracking provided — wild.link may not redirect. Paste the activation link from the extension for the full flow.'));
    }
    console.log(chalk.yellow('   Success = redirects back to the merchant site.'));
    console.log(chalk.gray(`   Merchant link: ${normalizedUrl}`));
    console.log(chalk.gray(`   Activation URL: ${activationUrl.length > 70 ? activationUrl.slice(0, 67) + '...' : activationUrl}`));
    console.log(chalk.gray(`   Expected back to: ${expectedMerchantDomain}`));
  }

  try {
    const { redirectChain, finalContent } = await followRedirects(activationUrl);
    const analysis = analyzeRedirectChain(redirectChain, finalContent, { expectedMerchantDomain });

    return {
      testUrl: activationUrl,
      success: !analysis.isError,
      redirectedBackToMerchant: analysis.redirectedBackToMerchant,
      redirectChain,
      finalUrl: analysis.finalUrl,
      finalDomain: analysis.finalDomain,
      issues: analysis.issues,
      redirectCount: redirectChain.length
    };
  } catch (error) {
    return {
      testUrl: activationUrl,
      success: false,
      error: error.message,
      redirectChain: [],
      issues: [{ type: 'request_error', severity: 'high', message: error.message }]
    };
  }
}

/**
 * Print redirect chain in a visual format (like the screenshot).
 * @param {object} result - Result object with redirectChain, success, issues, etc.
 * @param {object} [options] - { batchMode: true } to skip title (caller prints merchant header).
 */
function printRedirectChain(result, options = {}) {
  const batchMode = !!options.batchMode;
  if (!batchMode) {
    console.log(chalk.bold.cyan('\n📊 REDIRECT PATH'));
    console.log(chalk.gray('  (Same path as when the extension\'s "Activate Offer" is clicked)'));
  }
  console.log(chalk.gray('─'.repeat(80)));
  
  if (!result.redirectChain || result.redirectChain.length === 0) {
    console.log(chalk.red('  No redirect data available'));
    if (!batchMode) console.log(chalk.gray('─'.repeat(80)));
    return;
  }
  
  result.redirectChain.forEach((redirect, index) => {
    const isLast = index === result.redirectChain.length - 1;
    const statusColor = redirect.statusCode >= 200 && redirect.statusCode < 300 
      ? chalk.green 
      : redirect.statusCode >= 300 && redirect.statusCode < 400 
        ? chalk.yellow 
        : chalk.red;
    
    const icon = isLast ? '✓' : '↓';
    const iconColor = isLast 
      ? (result.success ? chalk.green : chalk.red)
      : chalk.yellow;
    
    // Truncate URL for display
    const displayUrl = redirect.url.length > 60 
      ? redirect.url.substring(0, 57) + '...' 
      : redirect.url;
    
    console.log(iconColor(`  ${icon} `) + chalk.cyan(displayUrl));
    console.log(chalk.gray(`     ${statusColor(redirect.statusCode)}: ${redirect.statusText}`));
    
    if (redirect.headers.location && !isLast) {
      const nextUrl = redirect.headers.location.length > 50 
        ? redirect.headers.location.substring(0, 47) + '...' 
        : redirect.headers.location;
      console.log(chalk.gray(`     → Redirect to: ${nextUrl}`));
    }
    console.log('');
  });
  
  console.log(chalk.gray('─'.repeat(80)));
  
  // Summary: success = redirected back to the original website (skip in batchMode; summary is at top)
  if (!batchMode) {
    if (result.success) {
      console.log(chalk.green(`✅ Activation OK — redirected back to the original website (${result.finalDomain || 'merchant site'})`));
    } else {
      console.log(chalk.red(`❌ Activation failed — did not redirect back to the original website`));
      if (result.issues && result.issues.length > 0) {
        console.log(chalk.red('   Issues found:'));
        result.issues.forEach(issue => {
          console.log(chalk.red(`   • [${issue.type.toUpperCase()}] ${issue.message}`));
        });
      }
    }
  }
}

/**
 * Print only the test stats (total, successful, failed, success rate). Used at top and bottom of results.
 */
function printTestStats(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const rate = results.length ? ((successful.length / results.length) * 100).toFixed(1) : '0.0';
  console.log(chalk.bold('Summary:'));
  console.log(`  Total tested: ${results.length}`);
  console.log(`  Successful: ${chalk.green(successful.length)}`);
  console.log(`  Failed: ${chalk.red(failed.length)}`);
  console.log(`  Success rate: ${rate}%\n`);
}

/**
 * Print results summary
 */
function printResultsSummary(results) {
  console.log(chalk.bold.cyan('\n' + '='.repeat(80)));
  console.log(chalk.bold.cyan('OFFER ACTIVATION AUDIT RESULTS'));
  console.log(chalk.bold.cyan('='.repeat(80)) + '\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  printTestStats(results);
  
  if (failed.length > 0) {
    console.log(chalk.bold.red('\n⚠️  Failed Activations:'));
    failed.forEach((result, index) => {
      console.log(chalk.red(`\n  ${index + 1}. ${result.merchantName || result.testUrl}`));
      if (result.merchantDomain) {
        console.log(chalk.gray(`     Domain: ${result.merchantDomain}`));
      }
      if (result.finalUrl) {
        const displayUrl = result.finalUrl.length > 60 
          ? result.finalUrl.substring(0, 57) + '...' 
          : result.finalUrl;
        console.log(chalk.gray(`     Final URL: ${displayUrl}`));
      }
      if (result.issues) {
        result.issues.forEach(issue => {
          console.log(chalk.yellow(`     • [${issue.type}] ${issue.message}`));
        });
      }
      if (result.error) {
        console.log(chalk.red(`     Error: ${result.error}`));
      }
    });
  }
  
  // Show redirect path for each merchant (same format as single-link testing)
  console.log(chalk.bold.cyan('\n📊 REDIRECT PATHS (per merchant)'));
  results.forEach((r, i) => {
    console.log(chalk.bold.cyan(`\n  ${i + 1}. ${r.merchantName || 'Merchant'} (${r.merchantDomain || '?'})`));
    printRedirectChain(r, { batchMode: true });
  });
  
  console.log(chalk.bold.cyan('\n' + '─'.repeat(80)));
  printTestStats(results);
  if (failed.length > 0) {
    console.log(chalk.bold.red('Failed at bottom of report:'));
    failed.forEach((result, index) => {
      console.log(chalk.red(`  ${index + 1}. ${result.merchantName || result.testUrl}`) +
        (result.merchantDomain ? chalk.gray(` (${result.merchantDomain})`) : ''));
      if (result.error) console.log(chalk.gray(`     ${result.error}`));
    });
    console.log('');
  }
  console.log(chalk.bold.cyan('='.repeat(80)) + '\n');
}

/**
 * Export results to JSON
 */
function exportResults(results, filename = null) {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = filename || `offer-activation-${timestamp}.json`;
  const filepath = path.join(CONFIG.outputDir, fname);
  
  const exportData = {
    exportDate: new Date().toISOString(),
    totalTested: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results.map(r => ({
      merchantName: r.merchantName,
      merchantId: r.merchantId,
      merchantDomain: r.merchantDomain,
      appId: r.appId,
      testUrl: r.testUrl,
      success: r.success,
      finalUrl: r.finalUrl,
      finalDomain: r.finalDomain,
      redirectCount: r.redirectCount,
      issues: r.issues,
      error: r.error
    }))
  };
  
  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
  console.log(chalk.green(`📄 Results saved to: ${filepath}`));
  
  return filepath;
}

/**
 * Export all results to CSV with redirect path for each merchant (where they went).
 */
function exportResultsToCSV(results, filename = null) {
  if (!results || results.length === 0) {
    console.log(chalk.yellow('⚠️  No results to export'));
    return null;
  }

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = filename || `offer-activation-results-${timestamp}.csv`;
  const filepath = path.join(CONFIG.outputDir, fname);

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build redirect path string: URL1 (200) → URL2 (307) → URL3 (200)
  const redirectPathFor = (r) => {
    if (!r.redirectChain || r.redirectChain.length === 0) return r.finalUrl || '';
    return r.redirectChain
      .map((hop) => `${hop.url} (${hop.statusCode} ${hop.statusText || ''})`.trim())
      .join(' → ');
  };

  const headers = [
    'Merchant Name',
    'Merchant ID',
    'Domain',
    'Success',
    'False Negative',
    'Test URL',
    'Final URL',
    'Redirect Path',
    'Redirect Count',
    'Issue Type',
    'Issue Message'
  ];

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...results.map((r) => {
      const redirectPath = redirectPathFor(r);
      const issues = (r.issues && r.issues.length > 0)
        ? r.issues
        : (r.error ? [{ type: 'error', message: r.error }] : [{ type: '', message: '' }]);
      const issueTypes = issues.map((i) => i.type ?? '').filter(Boolean).join('; ') || (r.error ? 'error' : '');
      const issueMessages = issues.map((i) => i.message ?? '').filter(Boolean).join('; ') || (r.error ? r.error : '');
      return [
        escapeCSV(r.merchantName),
        escapeCSV(r.merchantId),
        escapeCSV(r.merchantDomain),
        escapeCSV(r.success ? 'Yes' : 'No'),
        escapeCSV(r.falseNegative ? 'Yes' : ''),
        escapeCSV(r.testUrl),
        escapeCSV(r.finalUrl),
        escapeCSV(redirectPath),
        escapeCSV(r.redirectCount),
        escapeCSV(issueTypes),
        escapeCSV(issueMessages)
      ].join(',');
    })
  ];

  fs.writeFileSync(filepath, csvRows.join('\n'));
  console.log(chalk.green(`📊 Results CSV saved to: ${filepath}`));

  return filepath;
}

/**
 * Delete all offer activation result files in the output folder (JSON, CSV, session, tested merchants).
 */
async function deleteAllOfferActivationResults() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    console.log(chalk.gray('No results folder found.'));
    return;
  }

  const files = fs.readdirSync(CONFIG.outputDir);
  const toDelete = files.filter((f) => {
    const lower = f.toLowerCase();
    return (
      f.startsWith('offer-activation-') && (lower.endsWith('.json') || lower.endsWith('.csv')) ||
      f === 'offer-activation-session.json' ||
      f === 'offer-activation-tested-merchants.json'
    );
  });

  if (toDelete.length === 0) {
    console.log(chalk.gray('No offer activation results to delete.'));
    return;
  }

  console.log(chalk.yellow(`Found ${toDelete.length} file(s):`));
  toDelete.forEach((f) => console.log(chalk.gray(`  ${f}`)));
  const confirm = await askYesNo('\nDelete all these results? (yes/no): ');
  if (!confirm) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  let deleted = 0;
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(CONFIG.outputDir, f));
      deleted++;
    } catch (err) {
      console.log(chalk.red(`  Could not delete ${f}: ${err.message}`));
    }
  }
  console.log(chalk.green(`Deleted ${deleted} file(s).`));
}

/**
 * Run offer activation batch for a single App ID (no prompts). Used by combined full audit.
 * @param {number} appId
 * @param {{ limit: number, session: object, skipAlreadyTested: boolean, merchants: Array }} options
 *   - merchants: if provided, use this list instead of fetching (same merchants as rate audit).
 * @returns {Promise<Array>} results
 */
async function runBatchForOneAppId(appId, options = {}) {
  const { limit = 10, session = {}, skipAlreadyTested = true, merchants: providedMerchants = null, activationResultsRef = null, onMerchantDone = null } = options;
  let toTest;
  if (providedMerchants && providedMerchants.length > 0) {
    toTest = providedMerchants.filter(m => m.URL || m.Domain);
  } else {
    const merchants = await fetchMerchantData(appId);
    if (merchants.length === 0) return [];
    const allTestable = merchants.filter(m => m.URL || m.Domain);
    const testedSet = loadTestedMerchants(appId);
    let list = allTestable;
    if (skipAlreadyTested && testedSet.size > 0) {
      list = allTestable.filter(m => !testedSet.has(Number(m.ID)));
    }
    toTest = shuffleArray(list).slice(0, limit);
  }
  if (toTest.length === 0) return [];
  let activeDomains = [];
  try {
    activeDomains = await fetchActiveDomains(appId);
  } catch (_) {}
  const sessionObj = {
    deviceId: session.deviceId || '',
    trackingCode: session.trackingCode || '',
    shoppingTripCode: session.shoppingTripCode || ''
  };
  const results = [];
  const totalToTest = toTest.length;
  const progressEvery = 10;
  setInterruptSave(results, appId);
  for (let idx = 0; idx < toTest.length; idx++) {
    const merchant = toTest[idx];
    let result;
    try {
      result = await testMerchantActivation(merchant, appId, null, sessionObj, activeDomains);
    } catch (err) {
      const merchantName = merchant.Name || `Merchant ID ${merchant.ID}`;
      const merchantId = merchant.ID;
      const merchantDomain = merchant.Domain || (merchant.URL ? extractDomain(merchant.URL) : null) || 'unknown';
      const errMsg = err && (err.message || String(err)) || 'Test threw unexpectedly';
      console.log(chalk.red(`  Error testing ${merchantName} (${merchantDomain}): ${errMsg}`));
      result = {
        merchantId,
        merchantName,
        merchantDomain,
        success: false,
        error: errMsg,
        redirectChain: [],
        issues: [{ type: 'test_error', severity: 'high', message: errMsg }]
      };
    }
    const row = { ...result, appId };
    results.push(row);
    if (options.activationResultsRef) options.activationResultsRef.push(row);
    if (typeof options.onMerchantDone === 'function') options.onMerchantDone();
    const done = results.length;
    if (done % progressEvery === 0 || done === totalToTest) {
      const ok = results.filter(r => r.success).length;
      const fail = done - ok;
      console.log(chalk.blue(`  Progress: ${done}/${totalToTest} — ${chalk.green(ok)} OK, ${fail > 0 ? chalk.red(fail) : fail} failed`));
    }
    await new Promise(r => setTimeout(r, CONFIG.delayBetweenMerchantsMs));
  }
  clearInterruptSave();
  return results;
}

/**
 * Run offer activation batch for multiple App IDs. Gets session once (saved or prompt), then runs batch per app.
 * Used by combined full audit from main menu.
 * @param {number[]} appIds
 * @param {{ limit?: number, merchantsByAppId?: Object }} options - merchantsByAppId[appId] = array of merchants (same set as rate audit).
 * @returns {Promise<{ results: Array, byAppId: Object }>}
 */
async function runOfferActivationBatchForAppIds(appIds, options = {}) {
  const { limit = 10, merchantsByAppId = null, activationResultsRef = null, onMerchantDone = null } = options;
  let session = { deviceId: '', trackingCode: '', shoppingTripCode: '' };
  const saved = loadSavedSession();
  if (saved && (saved.deviceId || saved.trackingCode || saved.shoppingTripCode)) {
    const useSaved = await askYesNo('Use saved device/tracking for offer activation batch? (yes/no): ');
    if (useSaved) {
      session = { deviceId: saved.deviceId || '', trackingCode: saved.trackingCode || '', shoppingTripCode: saved.shoppingTripCode || '' };
      console.log(chalk.gray('  Using saved session.'));
    }
  }
  if (!session.deviceId && !session.trackingCode && !session.shoppingTripCode) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const d = await new Promise(r => rl.question(chalk.cyan('Device ID (optional): '), r));
    const tc = await new Promise(r => rl.question(chalk.cyan('Tracking code (optional): '), r));
    const sc = await new Promise(r => rl.question(chalk.cyan('Shopping trip (optional): '), r));
    rl.close();
    session = { deviceId: (d && d.trim()) || '', trackingCode: (tc && tc.trim()) || '', shoppingTripCode: (sc && sc.trim()) || '' };
    if (session.deviceId || session.trackingCode || session.shoppingTripCode) {
      const saveIt = await askYesNo('Save this device/session for next time? (yes/no): ');
      if (saveIt) saveSession(session.deviceId, session.trackingCode, session.shoppingTripCode);
    }
  }
  const allResults = [];
  const byAppId = {};
  for (const appId of appIds) {
    const merchants = merchantsByAppId && merchantsByAppId[appId];
    const count = merchants ? merchants.length : limit;
    console.log(chalk.blue(`\n🚀 Offer activation batch for App ID ${appId} (${count} merchants)...`));
    const results = merchants
      ? await runBatchForOneAppId(appId, { session, merchants, activationResultsRef, onMerchantDone })
      : await runBatchForOneAppId(appId, { limit, session, skipAlreadyTested: true, activationResultsRef, onMerchantDone });
    byAppId[appId] = results;
    allResults.push(...results);
  }
  return { results: allResults, byAppId };
}

/**
 * Interactive menu for offer activation testing
 */
async function showOfferActivationMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log(chalk.bold.magenta('\n🔗 Offer Activation Testing\n'));
    console.log(chalk.yellow('What would you like to test?'));
    console.log(chalk.gray('  1) Test a merchant link (simulate offer activation from the link)'));
    console.log(chalk.gray('  2) Test merchants from feed (batch)'));
    console.log(chalk.gray('  3) Back to main menu'));
    console.log(chalk.gray('  4) Exit'));
    console.log(chalk.gray('  5) Delete all results\n'));
    
    rl.question(chalk.cyan('Choice (1-5): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Ask a single question (yes/no). Re-prompts until the user enters yes, no, y, or n (case-insensitive). Returns true for yes.
 */
async function askYesNo(question) {
  for (;;) {
    const answer = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.cyan(question), (a) => {
        rl.close();
        resolve((a && a.trim()) ? a.toLowerCase().trim() : '');
      });
    });
    if (answer === 'yes' || answer === 'y') return true;
    if (answer === 'no' || answer === 'n') return false;
    console.log(chalk.yellow('Please enter yes or no.'));
  }
}

/**
 * If there are failed activation results, offer to mark some as false negatives (user tested and they passed).
 * Modifies activationResults in place: sets success = true, error = 'User tested (false negative)', falseNegative = true.
 * @param {Array} activationResults - Array of { success, merchantId, merchantName, error, ... }
 * @returns {Promise<void>}
 */
async function promptAndMarkFalseNegatives(activationResults) {
  const failed = (activationResults || []).filter(r => !r.success);
  if (failed.length === 0) return;
  console.log(chalk.yellow('\nFailed merchants:\n'));
  failed.forEach((r, i) => {
    console.log(chalk.gray(`  ${i + 1}. ID ${r.merchantId} — ${r.merchantName || '(no name)'}`));
  });
  console.log('');
  const wantMark = await askYesNo('Would you like to mark any of these as false negatives? (yes/no): ');
  if (!wantMark) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(chalk.cyan('Enter the numbers of merchants that were false negatives (e.g. 1, 3, 5 or "all"): '), (a) => {
      rl.close();
      resolve((a && a.trim()) || '');
    });
  });
  const numbers = (answer.trim().toLowerCase() === 'all')
    ? Array.from({ length: failed.length }, (_, i) => i + 1)
    : answer.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= failed.length);
  if (numbers.length === 0) return;
  const indexSet = new Set(numbers);
  let marked = 0;
  failed.forEach((r, i) => {
    if (indexSet.has(i + 1)) {
      r.success = true;
      r.error = 'User tested (false negative)';
      r.falseNegative = true;
      marked++;
    }
  });
  console.log(chalk.green(`Marked ${marked} merchant(s) as false negatives.\n`));
}

/**
 * Prompt for merchant link or activation link. Uses saved session if available and user agrees; offers to save after entering device/tracking.
 */
async function promptForLink() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log(chalk.yellow('\nPaste the activation link from the extension to run the full flow (recommended):'));
    console.log(chalk.gray('  Open the merchant site → click Activate Offer → copy the wild.link URL from the address bar, then paste here.'));
    console.log(chalk.gray('  Or paste a merchant link and optional device/tracking (see below) to build the link.\n'));
    
    rl.question(chalk.cyan('Activation link or merchant link: '), async (linkAnswer) => {
      const link = linkAnswer.trim();
      const looksLikeActivation = link && isActivationLink(normalizeToUrl(link));
      if (looksLikeActivation || !link) {
        rl.close();
        resolve({ link, deviceId: '', trackingCode: '', shoppingTripCode: '', askedToSave: false });
        return;
      }
      const saved = loadSavedSession();
      let deviceId = '';
      let trackingCode = '';
      let shoppingTripCode = '';
      let usedSaved = false;
      if (saved && (saved.deviceId || saved.trackingCode || saved.shoppingTripCode)) {
        const useSaved = await askYesNo('Use saved device/tracking? (yes/no): ');
        if (useSaved) {
          deviceId = saved.deviceId || '';
          trackingCode = saved.trackingCode || '';
          shoppingTripCode = saved.shoppingTripCode || '';
          usedSaved = true;
          console.log(chalk.gray('  Using saved session.'));
        }
      }
      if (!usedSaved) {
        console.log(chalk.gray('\n  To get past wild.link we need a real session. From the extension (or network tab), get:'));
        const dAnswer = await new Promise((r) => {
          const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl2.question(chalk.cyan('  Device ID (d=, optional): '), (a) => { rl2.close(); r(a); });
        });
        const tcAnswer = await new Promise((r) => {
          const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl2.question(chalk.cyan('  Tracking code (tc=, optional): '), (a) => { rl2.close(); r(a); });
        });
        const scAnswer = await new Promise((r) => {
          const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl2.question(chalk.cyan('  Shopping trip (sc=, optional): '), (a) => { rl2.close(); r(a); });
        });
        deviceId = (dAnswer && dAnswer.trim()) || '';
        trackingCode = (tcAnswer && tcAnswer.trim()) || '';
        shoppingTripCode = (scAnswer && scAnswer.trim()) || '';
        if (deviceId || trackingCode || shoppingTripCode) {
          const saveIt = await askYesNo('  Save this device/session for next time? (yes/no): ');
          if (saveIt) {
            if (saveSession(deviceId, trackingCode, shoppingTripCode)) {
              console.log(chalk.green('  Saved.'));
            }
          }
        }
      }
      rl.close();
      resolve({ link, deviceId, trackingCode, shoppingTripCode, askedToSave: true });
    });
  });
}

/**
 * Prompt for batch test configuration
 */
async function promptForBatchConfig() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const appIdAnswer = await new Promise((r) => {
    console.log(chalk.yellow('\nBatch testing configuration:'));
    rl.question(chalk.cyan('App ID to test: '), r);
  });
  const limitAnswer = await new Promise((r) => {
    rl.question(chalk.cyan('Max merchants to test (default: 10): '), r);
  });
  rl.close();

  const appId = parseInt(appIdAnswer.trim());
  const limit = parseInt(limitAnswer.trim()) || 10;

  if (isNaN(appId) || appId <= 0) {
    console.log(chalk.red('Invalid App ID'));
    return null;
  }

  let deviceId = '';
  let trackingCode = '';
  let shoppingTripCode = '';
  const saved = loadSavedSession();
  if (saved && (saved.deviceId || saved.trackingCode || saved.shoppingTripCode)) {
    const useSaved = await askYesNo('Use saved device/tracking for this batch? (yes/no): ');
    if (useSaved) {
      deviceId = saved.deviceId || '';
      trackingCode = saved.trackingCode || '';
      shoppingTripCode = saved.shoppingTripCode || '';
      console.log(chalk.gray('  Using saved session.'));
    }
  }
  if (!deviceId && !trackingCode && !shoppingTripCode) {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const dAnswer = await new Promise((r) => rl2.question(chalk.cyan('Device ID (optional): '), r));
    const tcAnswer = await new Promise((r) => rl2.question(chalk.cyan('Tracking code (optional): '), r));
    const scAnswer = await new Promise((r) => rl2.question(chalk.cyan('Shopping trip (optional): '), r));
    rl2.close();
    deviceId = (dAnswer && dAnswer.trim()) || '';
    trackingCode = (tcAnswer && tcAnswer.trim()) || '';
    shoppingTripCode = (scAnswer && scAnswer.trim()) || '';
    if (deviceId || trackingCode || shoppingTripCode) {
      const saveIt = await askYesNo('Save this device/session for next time? (yes/no): ');
      if (saveIt && saveSession(deviceId, trackingCode, shoppingTripCode)) {
        console.log(chalk.green('  Saved.'));
      }
    }
  }

  return { appId, limit, deviceId, trackingCode, shoppingTripCode };
}

/**
 * Run a single activation test from a built URL (used by active/alternative domain flows).
 * Success = redirects back to the original merchant domain.
 */
async function testActivationUrl(activationUrl, merchantName, merchantDomain) {
  const expectedMerchantDomain = merchantDomain ? normalizeDomain(merchantDomain) : null;
  try {
    const { redirectChain, finalContent } = await followRedirects(activationUrl);
    const analysis = analyzeRedirectChain(redirectChain, finalContent, { expectedMerchantDomain });
    return {
      merchantName: merchantName || merchantDomain,
      merchantDomain,
      testUrl: activationUrl,
      success: !analysis.isError,
      redirectedBackToMerchant: analysis.redirectedBackToMerchant,
      redirectChain,
      finalUrl: analysis.finalUrl,
      finalDomain: analysis.finalDomain,
      issues: analysis.issues,
      redirectCount: redirectChain.length
    };
  } catch (error) {
    return {
      merchantName: merchantName || merchantDomain,
      merchantDomain,
      testUrl: activationUrl,
      success: false,
      error: error.message,
      redirectChain: [],
      issues: [{ type: 'request_error', severity: 'high', message: error.message }]
    };
  }
}

/**
 * Run offer activation test flow
 */
async function runOfferActivationTest() {
  let unsavedLinkResults = [];
  let unsavedBatchResults = null;

  async function offerSaveBeforeLeaving() {
    const hasLink = unsavedLinkResults.length > 0;
    const hasBatch = unsavedBatchResults && unsavedBatchResults.length > 0;
    if (!hasLink && !hasBatch) return;
    const save = await askYesNo('\nSave results before leaving? (yes/no): ');
    if (!save) return;
    if (hasLink) {
      exportResultsToCSV(unsavedLinkResults);
      unsavedLinkResults = [];
    }
    if (hasBatch) {
      exportResultsToCSV(unsavedBatchResults);
      unsavedBatchResults = null;
    }
  }

  while (true) {
    const choice = await showOfferActivationMenu();

    switch (choice) {
      case '1': {
        // Test a link — loop: test → "Test another link?" → if no, "Save results?"
        let lastResult = null;
        do {
          const input = await promptForLink();
          if (!input || !input.link) break;
          lastResult = await testWildlinkActivation(input.link, {
            deviceId: input.deviceId,
            trackingCode: input.trackingCode,
            shoppingTripCode: input.shoppingTripCode
          });
          if (lastResult && (lastResult.redirectChain?.length || lastResult.issues?.length)) {
            unsavedLinkResults.push(lastResult);
          }
          if (lastResult && lastResult.redirectChain && lastResult.redirectChain.length > 0) {
            printRedirectChain(lastResult);
          } else if (lastResult && lastResult.issues && lastResult.issues.length > 0) {
            console.log(chalk.red('\n❌ ' + (lastResult.issues[0].message || lastResult.error || 'Test failed.')));
          }
          const testAnother = await askYesNo('\nTest another link? (yes/no): ');
          if (!testAnother) {
            if (unsavedLinkResults.length > 0) {
              const save = await askYesNo('Save results? (yes/no): ');
              if (save) {
                exportResultsToCSV(unsavedLinkResults);
                unsavedLinkResults = [];
              }
            }
            break;
          }
        } while (true);
        break;
      }

      case '2': {
        unsavedBatchResults = null;
        const config = await promptForBatchConfig();
        if (config) {
          console.log(chalk.blue(`\n🚀 Starting batch test for App ID ${config.appId}...`));
          const merchants = await fetchMerchantData(config.appId);
          if (merchants.length === 0) {
            console.log(chalk.red('No merchants found'));
            break;
          }
          const allTestable = merchants.filter(m => m.URL || m.Domain);
          const testedSet = loadTestedMerchants(config.appId);
          const alreadyTestedInList = allTestable.filter(m => testedSet.has(Number(m.ID)));
          let toTest = allTestable;
          if (alreadyTestedInList.length > 0) {
            console.log(chalk.yellow(`  ${alreadyTestedInList.length} of ${allTestable.length} merchants were already tested.`));
            const action = await new Promise((resolve) => {
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              rl.question(chalk.cyan('Skip them, test them again, or cancel? (skip / again / cancel): '), (answer) => {
                rl.close();
                const a = (answer && answer.trim().toLowerCase()) || '';
                if (a === 'skip' || a === 's') resolve('skip');
                else if (a === 'again' || a === 'a') resolve('again');
                else resolve('cancel');
              });
            });
            if (action === 'cancel') {
              console.log(chalk.gray('  Batch cancelled.'));
              break;
            }
            if (action === 'skip') {
              toTest = allTestable.filter(m => !testedSet.has(Number(m.ID)));
              if (toTest.length === 0) {
                console.log(chalk.yellow('  No untested merchants left.'));
                break;
              }
              console.log(chalk.gray(`  Testing ${Math.min(config.limit, toTest.length)} untested merchants (random order).`));
            } else {
              console.log(chalk.gray(`  Testing ${Math.min(config.limit, toTest.length)} merchants (random order).`));
            }
          } else {
            console.log(chalk.gray(`  Testing ${Math.min(config.limit, toTest.length)} merchants (random order).`));
          }
          // Random order, then take up to limit
          toTest = shuffleArray(toTest).slice(0, config.limit);
          // Same process as single-link: fetch active domains so we resolve each merchant to the correct campaignId
          let activeDomains = [];
          try {
            activeDomains = await fetchActiveDomains(config.appId);
            if (activeDomains.length > 0) {
              console.log(chalk.gray(`  Using active-domain feed for campaign resolution (${activeDomains.length} domains).`));
            }
          } catch (_) {
            console.log(chalk.gray('  Active-domain feed unavailable; using App ID as campaign for all merchants.'));
          }
          console.log(chalk.blue(`\nTesting ${toTest.length} merchants...\n`));
          const session = {
            deviceId: config.deviceId || '',
            trackingCode: config.trackingCode || '',
            shoppingTripCode: config.shoppingTripCode || ''
          };
          const results = [];
          setInterruptSave(results, config.appId);
          let paused = false;
          let stopRequested = false;
          const wasRaw = process.stdin.isTTY && process.stdin.isRaw;
          const useKeypress = process.stdin.isTTY;
          const pauseRl = readline.createInterface({ input: process.stdin, output: process.stdout });
          pauseRl.on('line', (line) => {
            const t = (line || '').trim().toLowerCase();
            if (t === 'p') paused = true;
            else if (t === 's') stopRequested = true;
          });
          if (useKeypress) {
            readline.emitKeypressEvents(process.stdin);
            if (!process.stdin.isRaw) process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdin.on('keypress', (_str, key) => {
              if (key && (key.name === 'p' || key.name === 'P')) paused = true;
              else if (key && (key.name === 's' || key.name === 'S')) stopRequested = true;
            });
          }
          // Progress update every 10 merchants (e.g. 200 merchants → updates at 10, 20, 30, … 200)
          const totalToTest = toTest.length;
          const progressEvery = 10;
          console.log(chalk.gray('  (Press P to pause, S to stop early. When paused, press Enter to resume.)\n'));
          for (let idx = 0; idx < toTest.length; idx++) {
            const merchant = toTest[idx];
            if (stopRequested) {
              console.log(chalk.yellow('\n  ⏹ Stopping test early.\n'));
              break;
            }
            if (paused) {
              if (useKeypress) process.stdin.setRawMode(false);
              console.log(chalk.yellow('\n  ⏸ Paused. Press Enter to resume, or type s + Enter to stop and save.'));
              await new Promise((resolve) => {
                const resumeRl = readline.createInterface({ input: process.stdin, output: process.stdout });
                resumeRl.question('', (line) => {
                  resumeRl.close();
                  const input = (line || '').trim().toLowerCase();
                  if (input === 's') stopRequested = true;
                  paused = false;
                  if (useKeypress && !wasRaw) process.stdin.setRawMode(true);
                  resolve();
                });
              });
              if (stopRequested) {
                console.log(chalk.yellow('\n  ⏹ Stopping test early.\n'));
                break;
              }
              console.log(chalk.gray('  Resuming...\n'));
            }
            let result;
            try {
              result = await testMerchantActivation(merchant, config.appId, null, session, activeDomains);
            } catch (err) {
              const merchantName = merchant.Name || `Merchant ID ${merchant.ID}`;
              const merchantId = merchant.ID;
              const merchantDomain = merchant.Domain || (merchant.URL ? extractDomain(merchant.URL) : null) || 'unknown';
              const errMsg = err && (err.message || String(err)) || 'Test threw unexpectedly';
              console.log(chalk.red(`  Error testing ${merchantName} (${merchantDomain}): ${errMsg}`));
              result = {
                merchantId,
                merchantName,
                merchantDomain,
                success: false,
                error: errMsg,
                redirectChain: [],
                issues: [{ type: 'test_error', severity: 'high', message: errMsg }]
              };
            }
            results.push({ ...result, appId: config.appId });
            const done = results.length;
            if (done % progressEvery === 0 || done === totalToTest) {
              const ok = results.filter(r => r.success).length;
              const fail = done - ok;
              console.log(chalk.blue(`  Progress: ${done}/${totalToTest} — ${chalk.green(ok)} OK, ${fail > 0 ? chalk.red(fail) : fail} failed`));
            }
            await new Promise(r => setTimeout(r, CONFIG.delayBetweenMerchantsMs));
          }
          if (useKeypress) {
            process.stdin.removeAllListeners('keypress');
            if (!wasRaw) process.stdin.setRawMode(false);
          }
          pauseRl.removeAllListeners('line');
          pauseRl.close();
          clearInterruptSave();
          printResultsSummary(results);
          await promptAndMarkFalseNegatives(results);
          const save = await askYesNo('Save results? (yes/no): ');
          if (save) {
            exportResultsToCSV(results);
            unsavedBatchResults = null;
            const merchantIds = results.map(r => r.merchantId).filter(id => id != null);
            if (merchantIds.length > 0) markMerchantsAsTested(config.appId, merchantIds);
          }
        }
        break;
      }

      case '3':
        await offerSaveBeforeLeaving();
        return;

      case '4':
        await offerSaveBeforeLeaving();
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        process.exit(0);

      case '5':
        await deleteAllOfferActivationResults();
        break;

      default:
        console.log(chalk.red('Invalid choice. Enter 1-5.'));
    }
  }
}

// Export functions for use in main auditor
module.exports = {
  testWildlinkActivation,
  testDomain,
  testMerchantActivation,
  testActivationUrl,
  followRedirects,
  analyzeRedirectChain,
  printRedirectChain,
  printResultsSummary,
  exportResults,
  exportResultsToCSV,
  runOfferActivationTest,
  runOfferActivationBatchForAppIds,
  runBatchForOneAppId,
  markMerchantsAsTested,
  loadTestedMerchants,
  promptAndMarkFalseNegatives,
  showOfferActivationMenu,
  fetchMerchantData,
  fetchActiveDomains,
  fetchAlternativeDomains,
  resolveDomainWithActiveDomains,
  resolveDomainWithAlternativeDomains,
  buildActivationUrlLikeExtension,
  buildWildlinkActivationUrl,
  parseOriginalUrlFromActivationLink,
  isErrorUrl,
  isErrorContent,
  ERROR_URL_PATTERNS,
  ERROR_CONTENT_PATTERNS
};

// Run standalone if called directly
if (require.main === module) {
  runOfferActivationTest().catch(error => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}

