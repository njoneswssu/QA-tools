/**
 * Browser port of merchant-rate-auditor `auditAppId` + `validateRate` stack
 * (Wildlink JSON only — no Node/Playwright). Kept aligned with:
 * merchant-rate-weekly-report/merchant-rate-auditor/auditor.js
 */

export const CONFIG = {
  baseUrl: 'https://www.wildlink.me/data',
  defaultAppIds: [451, 206, 209]
};

const HEX_CODE_PATTERN = /^(0x|#)?[0-9A-Fa-f]{3,8}$/;

const SHAREASALE_PATTERNS = [
  /shareasale\s+commission/i,
  /share\s*a\s*sale\s+commission/i,
  /shareasale\s+commission\s+rate/i
];

const INVALID_RATE_NAMES = [
  /^commission$/i,
  /^default$/i,
  /^lead$/i,
  /^content$/i,
  /^test$/i,
  /^placeholder$/i,
  /^example$/i,
  /^sample$/i,
  /^null$/i,
  /^undefined$/i,
  /^n\/a$/i,
  /^na$/i,
  /^tbd$/i,
  /^todo$/i,
  /^\s*$/
];

const VALID_RATE_NAME_PATTERNS = [
  /online\s+purchase/i,
  /purchase/i,
  /sale/i,
  /transaction/i,
  /order/i,
  /signup/i,
  /sign\s*up/i,
  /registration/i,
  /subscription/i,
  /recurring/i,
  /b2b/i,
  /b2c/i,
  /coupon/i,
  /verified/i,
  /payroll/i,
  /referral/i,
  /affiliate/i
];

function isHexCode(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (HEX_CODE_PATTERN.test(trimmed)) {
    const asNumber = parseFloat(trimmed);
    if (!isNaN(asNumber) && asNumber >= 0 && asNumber <= 100) {
      return false;
    }
    if (trimmed.length >= 6) {
      return true;
    }
    if (trimmed.startsWith('0x') || trimmed.startsWith('#')) {
      return true;
    }
  }
  return false;
}

function containsShareASale(name) {
  if (!name || typeof name !== 'string') return false;
  return SHAREASALE_PATTERNS.some((pattern) => pattern.test(name));
}

function containsCommission(value) {
  if (!value || typeof value !== 'string') return false;
  return /commission/i.test(value);
}

function containsPercentageInName(name) {
  if (!name || typeof name !== 'string') return false;
  const percentagePattern = /\d+\.?\d*\s*%/i;
  return percentagePattern.test(name);
}

function isInvalidRateName(name) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (INVALID_RATE_NAMES.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  if (trimmed.length < 3) {
    return true;
  }
  if (/^\d+$/.test(trimmed)) {
    return true;
  }
  const hasValidPattern = VALID_RATE_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (!hasValidPattern && trimmed.length < 10 && /^(the|a|an)\s+/i.test(trimmed)) {
    return true;
  }
  return false;
}

function isZeroRate(rate) {
  if (!rate.Amount) return false;
  const amount = String(rate.Amount).trim();
  return amount === '0' || amount === '0.0' || amount === '0.00' || parseFloat(amount) === 0;
}

function isExactlyOnlinePurchase(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim().toLowerCase();
  return trimmed === 'online purchase';
}

function containsUnderscore(name) {
  if (!name || typeof name !== 'string') return false;
  return name.includes('_');
}

function containsInAppRate(name) {
  if (!name || typeof name !== 'string') return false;
  const lowerName = name.toLowerCase();
  return /in[\s-]?app/i.test(lowerName) || /ios\s+in[\s-]?app/i.test(lowerName);
}

export function validateRate(rate, merchantId, merchantCategories = null) {
  void merchantId;
  void merchantCategories;
  const issues = [];
  const isZero = isZeroRate(rate);

  if (containsShareASale(rate.Name)) {
    issues.push({
      type: 'shareasale_commission',
      severity: 'high',
      message: `Rate name contains "ShareASale commission": "${rate.Name}"`,
      rate
    });
  }

  if (rate.Name && containsCommission(rate.Name)) {
    issues.push({
      type: 'commission_in_name',
      severity: 'medium',
      message: `Rate name contains "commission": "${rate.Name}"`,
      rate
    });
  }

  if (rate.Content && containsCommission(rate.Content)) {
    issues.push({
      type: 'commission_in_content',
      severity: 'medium',
      message: `Rate content contains "commission": "${rate.Content.substring(0, 100)}${rate.Content.length > 100 ? '...' : ''}"`,
      rate
    });
  }

  if (rate.DefaultLead && containsCommission(rate.DefaultLead)) {
    issues.push({
      type: 'commission_in_default_lead',
      severity: 'medium',
      message: `Rate default lead contains "commission": "${rate.DefaultLead}"`,
      rate
    });
  }

  if (isZero && rate.Name && isExactlyOnlinePurchase(rate.Name)) {
    issues.push({
      type: 'zero_rate_online_purchase',
      severity: 'high',
      message: `Zero rate with exactly "online purchase" name should be flagged: "${rate.Name}" (Amount: ${rate.Amount})`,
      rate
    });
  }

  if (rate.Name && containsPercentageInName(rate.Name)) {
    issues.push({
      type: 'percentage_in_name',
      severity: 'high',
      message: `Rate name contains a percentage value (should be in Amount field): "${rate.Name}"`,
      rate
    });
  }

  if (rate.Name && isInvalidRateName(rate.Name)) {
    issues.push({
      type: 'invalid_rate_name',
      severity: 'high',
      message: `Rate name doesn't make sense for a merchant rate: "${rate.Name}"`,
      rate
    });
  }

  if (rate.Name && containsUnderscore(rate.Name)) {
    issues.push({
      type: 'underscore_in_name',
      severity: 'high',
      message: `Rate name contains underscore character: "${rate.Name}"`,
      rate
    });
  }

  if (rate.Name && /api/i.test(rate.Name)) {
    issues.push({
      type: 'api_in_name',
      severity: 'medium',
      message: `Rate name contains "API": "${rate.Name}"`,
      rate
    });
  }

  if (rate.Name && /wildfire/i.test(rate.Name)) {
    issues.push({
      type: 'wildfire_in_name',
      severity: 'medium',
      message: `Rate name contains "Wildfire": "${rate.Name}"`,
      rate
    });
  }

  if (rate.Name && containsInAppRate(rate.Name) && !isZeroRate(rate)) {
    issues.push({
      type: 'in_app_rate',
      severity: 'high',
      message: `Rate name contains in-app purchase pattern: "${rate.Name}"`,
      rate
    });
  }

  if (rate.Amount && isHexCode(rate.Amount)) {
    issues.push({
      type: 'hex_code_rate',
      severity: 'high',
      message: `Rate amount appears to be a hex code: "${rate.Amount}"`,
      rate
    });
  }

  if (rate.Name && isHexCode(rate.Name)) {
    issues.push({
      type: 'hex_code_name',
      severity: 'high',
      message: `Rate name appears to be a hex code: "${rate.Name}"`,
      rate
    });
  }

  return issues;
}

async function fetchJson(url, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MerchantRateAuditor/1.0)'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchMerchantData(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/merchant/1`;
  try {
    const data = await fetchJson(url);
    if (data && Array.isArray(data)) {
      const merchantMap = {};
      for (const merchant of data) {
        if (merchant.ID) {
          const categories =
            merchant.Categories && Array.isArray(merchant.Categories)
              ? merchant.Categories.map((cat) => cat.Name).filter(Boolean)
              : [];
          merchantMap[String(merchant.ID)] = {
            name: merchant.Name || `Merchant ID ${merchant.ID}`,
            categories
          };
        }
      }
      return merchantMap;
    }
    return {};
  } catch (e) {
    console.warn(`Could not fetch merchant data for App ID ${appId}:`, e.message || e);
    return {};
  }
}

export async function fetchMerchantRates(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/merchant-rate/1`;
  try {
    const data = await fetchJson(url);
    if (data && typeof data === 'object') {
      return data;
    }
    throw new Error('Invalid response format');
  } catch (e) {
    console.error(`Error fetching App ID ${appId}:`, e.message || e);
    return null;
  }
}

/**
 * @param {number} appId
 * @param {{ limitToMerchantIds?: (string|number)[] }} [options]
 */
export async function auditAppId(appId, options = {}) {
  const { limitToMerchantIds } = options;
  const allowedIds =
    limitToMerchantIds && limitToMerchantIds.length > 0
      ? new Set(limitToMerchantIds.map((id) => String(id)))
      : null;

  const [rateData, merchantMap] = await Promise.all([
    fetchMerchantRates(appId),
    fetchMerchantData(appId)
  ]);

  if (merchantMap && Object.keys(merchantMap).length > 0) {
    console.log(`Loaded ${Object.keys(merchantMap).length} merchants with categories`);
  }

  if (!rateData) {
    return {
      appId,
      success: false,
      totalMerchants: 0,
      totalRates: 0,
      issues: [],
      allMerchants: [],
      error: 'Failed to fetch data'
    };
  }

  const issues = [];
  const allMerchants = [];
  let totalMerchants = 0;
  let totalRates = 0;

  for (const [merchantId, rates] of Object.entries(rateData)) {
    if (!Array.isArray(rates)) continue;
    if (allowedIds && !allowedIds.has(String(merchantId))) continue;

    totalMerchants++;
    totalRates += rates.length;

    const merchantInfo = merchantMap[merchantId];
    const merchantName = merchantInfo?.name || `Merchant ID ${merchantId}`;
    allMerchants.push({ merchantId, merchantName });
    const merchantCategories = merchantInfo?.categories || [];
    const merchantCategoryDisplay =
      merchantCategories.length > 0 ? merchantCategories.join(', ') : null;

    for (const rate of rates) {
      const rateIssues = validateRate(rate, merchantId, merchantCategories);
      if (rateIssues.length > 0) {
        issues.push({
          merchantId,
          merchantName,
          merchantCategory: merchantCategoryDisplay,
          appId,
          issues: rateIssues
        });
      }
    }
  }

  return {
    appId,
    success: true,
    totalMerchants,
    totalRates,
    issues,
    allMerchants,
    timestamp: new Date().toISOString()
  };
}
