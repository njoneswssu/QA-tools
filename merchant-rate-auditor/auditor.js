#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import offer activation module
const offerActivation = require('./offer-activation-auditor');

/**
 * Merchant Rate Auditor
 * 
 * A comprehensive testing tool for Wildlink merchants:
 * 
 * 1. Merchant Rate Audit - Audits merchant rate JSON feeds for problematic rates:
 *    - Rates with "ShareASale commission" in the name
 *    - Rates with hex code-like values instead of actual commission amounts
 * 
 * 2. Offer Activation Testing - Tests if merchant offers work properly:
 *    - Follows redirect chains from wild.link URLs
 *    - Detects error pages (expired offers, offer not found, etc.)
 *    - Identifies merchants with broken activation flows
 * Audits Wildlink merchant rate JSON feeds for problematic rates:
 * - Rates with "ShareASale commission" in the name
 * - Rates with hex code-like values instead of actual commission amounts
 * - Zero rates with EXACTLY "online purchase" as the name (flagged)
 * - Zero rates with product-like names (NOT flagged - these are OK)
 * - Product-like rate names that DON'T match merchant category (flagged)
 * - Product-like rate names that DO match merchant category (NOT flagged - these are OK)
 * - Rates with underscores in the name
 * - Rates with "in app" or "iOS in-app" patterns
 * 
 * Categories are embedded in the merchant data from: https://www.wildlink.me/data/{appId}/merchant/1
 * Each merchant has a Categories array with multiple category names.
 */

// Configuration
const CONFIG = {
  baseUrl: 'https://www.wildlink.me/data',
  outputDir: './audit-results',
  defaultAppIds: [451, 206, 209] // Default app IDs to audit if none provided
};

// Hex code pattern: matches strings that look like hex codes
// Examples: "FF0000", "#ABCDEF", "0x123456", "abc123"
const HEX_CODE_PATTERN = /^(0x|#)?[0-9A-Fa-f]{3,8}$/;

// ShareASale commission keywords (case-insensitive)
// Match "shareasale commission" as a phrase (with variations)
const SHAREASALE_PATTERNS = [
  /shareasale\s+commission/i,
  /share\s*a\s*sale\s+commission/i,
  /shareasale\s+commission\s+rate/i
];

// Names that don't make sense for merchant rates
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
  /^\s*$/  // Empty or whitespace only
];

// Valid rate name patterns (names that make sense)
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

/**
 * Check if a string looks like a hex code
 */
function isHexCode(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  // Check if it matches hex pattern and is not a valid number
  if (HEX_CODE_PATTERN.test(trimmed)) {
    // Additional check: if it's a valid decimal number, it's probably not a hex code
    // (e.g., "123" could be hex, but if it's a reasonable commission rate, it's probably not)
    const asNumber = parseFloat(trimmed);
    // If it's a valid number and within reasonable commission range (0-100), it's probably not hex
    if (!isNaN(asNumber) && asNumber >= 0 && asNumber <= 100) {
      return false;
    }
    // If it's 6+ characters and matches hex pattern, it's likely a hex code
    if (trimmed.length >= 6) {
      return true;
    }
    // For shorter strings, be more conservative - only flag if it's clearly hex-like
    // (e.g., starts with 0x or #, or is clearly not a number)
    if (trimmed.startsWith('0x') || trimmed.startsWith('#')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a rate name contains ShareASale commission keywords
 * Specifically looks for "shareasale commission" as a phrase
 */
function containsShareASale(name) {
  if (!name || typeof name !== 'string') return false;
  return SHAREASALE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if a field contains "commission" (case-insensitive)
 */
function containsCommission(value) {
  if (!value || typeof value !== 'string') return false;
  return /commission/i.test(value);
}

/**
 * Check if a rate name contains a percentage value (like "30%", "5%", etc.)
 * Flags ALL percentages because the percentage should be in the Amount field, not the name.
 * The name should describe what the rate is for (e.g., "Online Purchase"), not include the percentage.
 */
function containsPercentageInName(name) {
  if (!name || typeof name !== 'string') return false;
  
  // Match patterns like: "30%", "5%", "10.5%", "15% commission", "10% Cashback", etc.
  // Flag ALL percentages - they should be in the Amount field, not the name
  const percentagePattern = /\d+\.?\d*\s*%/i;
  
  return percentagePattern.test(name);
}

/**
 * Check if a rate name doesn't make sense for a merchant rate
 */
function isInvalidRateName(name) {
  if (!name || typeof name !== 'string') return true; // Empty names are invalid
  
  const trimmed = name.trim();
  
  // Check against invalid patterns
  if (INVALID_RATE_NAMES.some(pattern => pattern.test(trimmed))) {
    return true;
  }
  
  // If name is too short (less than 3 chars) and not a valid pattern, it's suspicious
  if (trimmed.length < 3) {
    return true;
  }
  
  // If name is just a number or ID, it's probably invalid
  if (/^\d+$/.test(trimmed)) {
    return true;
  }
  
  // If name doesn't match any valid pattern and is generic, flag it
  const hasValidPattern = VALID_RATE_NAME_PATTERNS.some(pattern => pattern.test(trimmed));
  
  // If it's very generic and doesn't match valid patterns, it might be invalid
  // But be conservative - only flag obvious issues
  if (!hasValidPattern && trimmed.length < 10 && /^(the|a|an)\s+/i.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Check if rate amount is zero or "0"
 */
function isZeroRate(rate) {
  if (!rate.Amount) return false;
  const amount = String(rate.Amount).trim();
  return amount === '0' || amount === '0.0' || amount === '0.00' || parseFloat(amount) === 0;
}

/**
 * Check if a rate name is EXACTLY "online purchase" (and nothing else)
 * Must be exact match to flag zero rates
 */
function isExactlyOnlinePurchase(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim().toLowerCase();
  return trimmed === 'online purchase';
}

/**
 * Check if a rate name contains underscores
 */
function containsUnderscore(name) {
  if (!name || typeof name !== 'string') return false;
  return name.includes('_');
}

/**
 * Check if a rate name contains "in app" or "in-app" or "iOS in-app" patterns
 */
function containsInAppRate(name) {
  if (!name || typeof name !== 'string') return false;
  const lowerName = name.toLowerCase();
  return /in[\s-]?app/i.test(lowerName) || /ios\s+in[\s-]?app/i.test(lowerName);
}

/**
 * Map of category keywords to related product/service terms
 * This helps identify when a rate name is contextually related to the merchant's category
 */
const CATEGORY_RELATED_TERMS = {
  'travel': ['booking', 'flight', 'hotel', 'reservation', 'trip', 'vacation', 'stay', 'cruise', 'tour', 'ticket', 'itinerary', 'package', 'desk', 'mobile'],
  'hotel': ['booking', 'reservation', 'stay', 'room', 'suite', 'night', 'check-in', 'accommodation'],
  'vacation': ['booking', 'package', 'trip', 'resort', 'getaway', 'holiday', 'destination'],
  'flight': ['booking', 'ticket', 'airfare', 'airline', 'departure', 'arrival', 'domestic', 'international'],
  'air': ['booking', 'flight', 'ticket', 'airfare', 'airline', 'departure', 'arrival'],
  'car rental': ['booking', 'reservation', 'vehicle', 'rental', 'pickup', 'return'],
  'jewelry': ['diamond', 'ring', 'necklace', 'bracelet', 'earring', 'gold', 'silver', 'platinum', 'gem', 'stone', 'pendant', 'watch', 'jewel'],
  'clothing': ['shirt', 'pant', 'dress', 'shoe', 'jacket', 'coat', 'sweater', 'jean', 'top', 'bottom', 'apparel', 'garment'],
  'apparel': ['shirt', 'pant', 'dress', 'shoe', 'jacket', 'coat', 'sweater', 'jean', 'top', 'bottom', 'clothing', 'garment'],
  'electronics': ['phone', 'laptop', 'tablet', 'computer', 'tv', 'camera', 'headphone', 'speaker', 'device', 'gadget'],
  'furniture': ['chair', 'table', 'desk', 'sofa', 'bed', 'cabinet', 'shelf', 'couch', 'dresser'],
  'home': ['furniture', 'appliance', 'decor', 'kitchen', 'bedroom', 'bathroom', 'living', 'dining'],
  'beauty': ['makeup', 'cosmetic', 'skincare', 'fragrance', 'perfume', 'lotion', 'cream', 'serum'],
  'health': ['vitamin', 'supplement', 'medicine', 'wellness', 'fitness', 'nutrition'],
  'food': ['grocery', 'meal', 'snack', 'beverage', 'drink', 'restaurant', 'dining'],
  'automotive': ['car', 'truck', 'vehicle', 'auto', 'tire', 'part', 'accessory', 'motor'],
  'sports': ['equipment', 'gear', 'apparel', 'shoe', 'athletic', 'fitness', 'training'],
  'toys': ['game', 'toy', 'puzzle', 'doll', 'action', 'figure', 'playset'],
  'books': ['book', 'ebook', 'audiobook', 'textbook', 'novel', 'magazine', 'publication'],
  'music': ['album', 'song', 'cd', 'vinyl', 'track', 'instrument', 'audio'],
  'pet': ['dog', 'cat', 'pet', 'animal', 'food', 'toy', 'supply', 'care'],
  'office': ['desk', 'chair', 'supply', 'stationery', 'paper', 'pen', 'folder', 'organizer'],
  'garden': ['plant', 'seed', 'tool', 'outdoor', 'lawn', 'flower', 'pot', 'soil'],
  'baby': ['infant', 'toddler', 'baby', 'diaper', 'formula', 'stroller', 'crib', 'nursery']
};

/**
 * Check if rate name matches or is related to any of the merchant categories
 * Includes both direct matching and contextual relationship matching
 */
function rateMatchesMerchantCategory(rateName, merchantCategories) {
  if (!rateName || !merchantCategories || merchantCategories.length === 0) return false;
  
  const lowerRateName = rateName.trim().toLowerCase();
  
  // Check against each category
  for (const category of merchantCategories) {
    if (!category) continue;
    const lowerCategory = category.trim().toLowerCase();
    
    // Direct match
    if (lowerRateName === lowerCategory) return true;
    
    // Check if category contains the rate name or vice versa
    if (lowerCategory.includes(lowerRateName) || lowerRateName.includes(lowerCategory)) return true;
    
    // Check for plurals/singulars
    const singularRate = lowerRateName.replace(/s$/, '');
    const singularCategory = lowerCategory.replace(/s$/, '');
    
    if (singularRate === singularCategory) return true;
    if (lowerCategory.includes(singularRate) || (singularRate && lowerCategory.endsWith(singularRate))) return true;
    if (lowerRateName.includes(singularCategory) || (singularCategory && lowerRateName.endsWith(singularCategory))) return true;
    
    // Check for contextually related terms
    // For each word in the category, check if there are related terms that match the rate name
    const categoryWords = lowerCategory.split(/[\s,&-]+/).filter(word => word.length > 2);
    
    for (const categoryWord of categoryWords) {
      const relatedTerms = CATEGORY_RELATED_TERMS[categoryWord];
      if (relatedTerms) {
        for (const term of relatedTerms) {
          // Check if the rate name contains this related term
          if (lowerRateName.includes(term) || term.includes(lowerRateName)) {
            return true;
          }
          // Check for word boundaries to avoid partial matches
          const wordBoundaryPattern = new RegExp(`\\b${term}\\b`, 'i');
          if (wordBoundaryPattern.test(lowerRateName)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Validate a single rate object
 */
function validateRate(rate, merchantId, merchantCategories = null) {
  const issues = [];
  const isZero = isZeroRate(rate);
  
  // Check for ShareASale commission in name
  if (containsShareASale(rate.Name)) {
    issues.push({
      type: 'shareasale_commission',
      severity: 'high',
      message: `Rate name contains "ShareASale commission": "${rate.Name}"`,
      rate: rate
    });
  }
  
  // Check for "commission" in Name field
  if (rate.Name && containsCommission(rate.Name)) {
    issues.push({
      type: 'commission_in_name',
      severity: 'medium',
      message: `Rate name contains "commission": "${rate.Name}"`,
      rate: rate
    });
  }
  
  // Check for "commission" in Content field (if it exists)
  if (rate.Content && containsCommission(rate.Content)) {
    issues.push({
      type: 'commission_in_content',
      severity: 'medium',
      message: `Rate content contains "commission": "${rate.Content.substring(0, 100)}${rate.Content.length > 100 ? '...' : ''}"`,
      rate: rate
    });
  }
  
  // Check for "commission" in DefaultLead field (if it exists)
  if (rate.DefaultLead && containsCommission(rate.DefaultLead)) {
    issues.push({
      type: 'commission_in_default_lead',
      severity: 'medium',
      message: `Rate default lead contains "commission": "${rate.DefaultLead}"`,
      rate: rate
    });
  }
  
  // NEW RULE: If rate is 0 and name is EXACTLY "online purchase", flag it
  if (isZero && rate.Name && isExactlyOnlinePurchase(rate.Name)) {
    issues.push({
      type: 'zero_rate_online_purchase',
      severity: 'high',
      message: `Zero rate with exactly "online purchase" name should be flagged: "${rate.Name}" (Amount: ${rate.Amount})`,
      rate: rate
    });
  }
  
  // Check for percentage values in rate name (e.g., "30%", "5%")
  if (rate.Name && containsPercentageInName(rate.Name)) {
    issues.push({
      type: 'percentage_in_name',
      severity: 'high',
      message: `Rate name contains a percentage value (should be in Amount field): "${rate.Name}"`,
      rate: rate
    });
  }
  
  // Check for invalid/nonsensical rate names
  if (rate.Name && isInvalidRateName(rate.Name)) {
    issues.push({
      type: 'invalid_rate_name',
      severity: 'high',
      message: `Rate name doesn't make sense for a merchant rate: "${rate.Name}"`,
      rate: rate
    });
  }
  
  // NEW RULE: Flag rates with underscores in the name
  if (rate.Name && containsUnderscore(rate.Name)) {
    issues.push({
      type: 'underscore_in_name',
      severity: 'high',
      message: `Rate name contains underscore character: "${rate.Name}"`,
      rate: rate
    });
  }
  
  // NEW RULE: Flag rates with "in app" or "iOS in-app" patterns
  if (rate.Name && containsInAppRate(rate.Name)) {
    issues.push({
      type: 'in_app_rate',
      severity: 'high',
      message: `Rate name contains in-app purchase pattern: "${rate.Name}"`,
      rate: rate
    });
  }
  
  // Check for hex code in Amount
  if (rate.Amount && isHexCode(rate.Amount)) {
    issues.push({
      type: 'hex_code_rate',
      severity: 'high',
      message: `Rate amount appears to be a hex code: "${rate.Amount}"`,
      rate: rate
    });
  }
  
  // Check for hex code in Name (sometimes hex codes end up in the name field)
  if (rate.Name && isHexCode(rate.Name)) {
    issues.push({
      type: 'hex_code_name',
      severity: 'high',
      message: `Rate name appears to be a hex code: "${rate.Name}"`,
      rate: rate
    });
  }
  
  return issues;
}

/**
 * Fetch merchant data for a specific app ID to get merchant names and categories
 */
async function fetchMerchantData(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/merchant/1`;
  
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MerchantRateAuditor/1.0)'
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      // Create a mapping from merchant ID to merchant name and categories
      const merchantMap = {};
      for (const merchant of response.data) {
        if (merchant.ID) {
          // Extract category names from the Categories array
          const categories = merchant.Categories && Array.isArray(merchant.Categories)
            ? merchant.Categories.map(cat => cat.Name).filter(Boolean)
            : [];
          
          merchantMap[merchant.ID.toString()] = {
            name: merchant.Name || `Merchant ID ${merchant.ID}`,
            categories: categories
          };
        }
      }
      return merchantMap;
    }
    return {};
  } catch (error) {
    // If merchant data fetch fails, we'll continue without names
    console.warn(chalk.yellow(`⚠️  Could not fetch merchant data for App ID ${appId}: ${error.message}`));
    return {};
  }
}

/**
 * Fetch category data for a specific app ID (for reference, not currently used)
 */
async function fetchCategoryData(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/category/1`;
  
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MerchantRateAuditor/1.0)'
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      // Create a mapping from category ID to category name
      const categoryMap = {};
      for (const category of response.data) {
        if (category.ID) {
          categoryMap[category.ID.toString()] = category.Name || null;
        }
      }
      return categoryMap;
    }
    return {};
  } catch (error) {
    // If category data fetch fails, we'll continue without categories
    console.warn(chalk.yellow(`⚠️  Could not fetch categories for App ID ${appId}: ${error.message}`));
    return {};
  }
}

/**
 * Fetch merchant rate data for a specific app ID
 */
async function fetchMerchantRates(appId) {
  const url = `${CONFIG.baseUrl}/${appId}/merchant-rate/1`;
  
  try {
    console.log(chalk.blue(`📡 Fetching merchant rates for App ID ${appId}...`));
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MerchantRateAuditor/1.0)'
      }
    });
    
    if (response.data && typeof response.data === 'object') {
      console.log(chalk.green(`✅ Successfully fetched data for App ID ${appId}`));
      return response.data;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`❌ HTTP Error ${error.response.status} for App ID ${appId}: ${error.response.statusText}`));
    } else if (error.request) {
      console.error(chalk.red(`❌ Network Error: Could not fetch data for App ID ${appId}`));
    } else {
      console.error(chalk.red(`❌ Error fetching App ID ${appId}: ${error.message}`));
    }
    return null;
  }
}

/**
 * Audit merchant rates for a specific app ID
 */
async function auditAppId(appId) {
  // Fetch merchant rates and merchant data (which includes categories)
  console.log(chalk.blue(`📡 Fetching data for App ID ${appId}...`));
  const [rateData, merchantMap] = await Promise.all([
    fetchMerchantRates(appId),
    fetchMerchantData(appId)
  ]);
  
  if (merchantMap && Object.keys(merchantMap).length > 0) {
    console.log(chalk.green(`✅ Loaded ${Object.keys(merchantMap).length} merchants with categories`));
  }
  
  if (!rateData) {
    return {
      appId,
      success: false,
      totalMerchants: 0,
      totalRates: 0,
      issues: [],
      error: 'Failed to fetch data'
    };
  }
  
  const issues = [];
  let totalMerchants = 0;
  let totalRates = 0;
  
  // Iterate through all merchants (keys are merchant IDs)
  for (const [merchantId, rates] of Object.entries(rateData)) {
    if (!Array.isArray(rates)) continue;
    
    totalMerchants++;
    totalRates += rates.length;
    
    // Get merchant info from the map
    const merchantInfo = merchantMap[merchantId];
    const merchantName = merchantInfo?.name || `Merchant ID ${merchantId}`;
    const merchantCategories = merchantInfo?.categories || [];
    
    // Format categories for display (join with comma)
    const merchantCategoryDisplay = merchantCategories.length > 0 
      ? merchantCategories.join(', ') 
      : null;
    
    // Validate each rate, passing the merchant categories array
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
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate a detailed report
 */
function generateReport(results) {
  const report = {
    summary: {
      totalAppIds: results.length,
      successfulAppIds: results.filter(r => r.success).length,
      totalMerchants: results.reduce((sum, r) => sum + r.totalMerchants, 0),
      totalRates: results.reduce((sum, r) => sum + r.totalRates, 0),
      totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
      timestamp: new Date().toISOString()
    },
    results: results
  };
  
  return report;
}

/**
 * Print results to console
 */
function printResults(report) {
  console.log('\n' + chalk.bold.cyan('='.repeat(80)));
  console.log(chalk.bold.cyan('MERCHANT RATE AUDIT REPORT'));
  console.log(chalk.bold.cyan('='.repeat(80)) + '\n');
  
  const { summary, results } = report;
  
  // Summary
  console.log(chalk.bold('Summary:'));
  console.log(`  Total App IDs audited: ${summary.totalAppIds}`);
  console.log(`  Successful: ${chalk.green(summary.successfulAppIds)}`);
  console.log(`  Failed: ${chalk.red(summary.totalAppIds - summary.successfulAppIds)}`);
  console.log(`  Total Merchants: ${summary.totalMerchants}`);
  console.log(`  Total Rates: ${summary.totalRates}`);
  console.log(`  Total Issues Found: ${chalk.yellow(summary.totalIssues)}`);
  console.log(`  Timestamp: ${summary.timestamp}\n`);
  
  // Detailed results per app
  for (const result of results) {
    if (!result.success) {
      console.log(chalk.red(`\n❌ App ID ${result.appId}: Failed to fetch data`));
      continue;
    }
    
    console.log(chalk.bold(`\n📱 App ID ${result.appId}:`));
    console.log(`  Merchants: ${result.totalMerchants}`);
    console.log(`  Rates: ${result.totalRates}`);
    console.log(`  Issues: ${chalk.yellow(result.issues.length)}`);
    
    if (result.issues.length > 0) {
      console.log(chalk.yellow('\n  Issues found:'));
      for (const issueGroup of result.issues) {
        console.log(chalk.yellow(`\n    Merchant: ${issueGroup.merchantName || `ID ${issueGroup.merchantId}`}`));
        console.log(chalk.gray(`      Merchant ID: ${issueGroup.merchantId}`));
        if (issueGroup.merchantCategory) {
          console.log(chalk.gray(`      Category: ${issueGroup.merchantCategory}`));
        }
        for (const issue of issueGroup.issues) {
          const severityColor = issue.severity === 'high' ? chalk.red : chalk.yellow;
          console.log(severityColor(`      [${issue.type.toUpperCase()}] ${issue.message}`));
          console.log(`        Rate ID: ${issue.rate.ID}`);
          console.log(`        Rate Name: "${issue.rate.Name || '(empty)'}"`);
          console.log(`        Rate Amount: "${issue.rate.Amount || '(empty)'}"`);
          if (issue.rate.Kind) {
            console.log(`        Rate Kind: ${issue.rate.Kind}`);
          }
          if (issue.rate.Content) {
            const contentPreview = issue.rate.Content.length > 100 
              ? issue.rate.Content.substring(0, 100) + '...' 
              : issue.rate.Content;
            console.log(`        Content: "${contentPreview}"`);
          }
          if (issue.rate.DefaultLead) {
            console.log(`        Default Lead: "${issue.rate.DefaultLead}"`);
          }
          if (issue.rate.Currency) {
            console.log(`        Currency: ${issue.rate.Currency}`);
          }
        }
      }
    }
  }
  
  console.log('\n' + chalk.bold.cyan('='.repeat(80)) + '\n');
}

/**
 * Generate simplified export data (merchant names and reasons)
 * Deduplicates: only one example per merchant per issue type
 */
function generateSimplifiedExport(report) {
  // First, collect all issues grouped by merchant + app + issue type
  const merchantIssuesMap = new Map();
  
  for (const result of report.results) {
    if (!result.success || !result.issues) continue;
    
    for (const issueGroup of result.issues) {
      const merchantName = issueGroup.merchantName || `Merchant ID ${issueGroup.merchantId}`;
      const merchantId = issueGroup.merchantId;
      const merchantCategory = issueGroup.merchantCategory || null;
      const appId = result.appId;
      
      // Process each issue in this group
      for (const issue of issueGroup.issues) {
        const issueType = issue.type;
        const key = `${merchantId}-${appId}-${issueType}`;
        
        if (!merchantIssuesMap.has(key)) {
          // First time seeing this merchant + issue type combination
          merchantIssuesMap.set(key, {
            merchantName,
            merchantId,
            merchantCategory,
            appId,
            issueType: issue.type,
            severity: issue.severity,
            count: 1,
            // Keep first example
            example: {
              message: issue.message,
              rateName: issue.rate.Name || '(empty)',
              rateAmount: issue.rate.Amount || '(empty)'
            }
          });
        } else {
          // Already seen this combination, just increment count
          const existing = merchantIssuesMap.get(key);
          existing.count++;
        }
      }
    }
  }
  
  // Convert Map to array format
  return Array.from(merchantIssuesMap.values()).map(item => ({
    merchantName: item.merchantName,
    merchantId: item.merchantId,
    merchantCategory: item.merchantCategory,
    appId: item.appId,
    issueType: item.issueType,
    severity: item.severity,
    reason: item.example.message,
    rateName: item.example.rateName,
    rateAmount: item.example.rateAmount,
    count: item.count
  }));
}

/**
 * Export simplified data to CSV
 */
function exportToCSV(exportData, filepath) {
  if (exportData.length === 0) {
    console.log(chalk.yellow('⚠️  No data to export'));
    return;
  }
  
  // CSV header - simplified to just Merchant Name and Reason
  const headers = ['Merchant Name', 'Reason'];
  
  // Escape CSV values (handle quotes and commas)
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Build CSV content with just merchant name and reason
  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...exportData.map(row => [
      escapeCSV(row.merchantName),
      escapeCSV(row.reason)
    ].join(','))
  ];
  
  fs.writeFileSync(filepath, csvRows.join('\n'));
  console.log(chalk.green(`📊 CSV export saved to: ${filepath}`));
}

/**
 * Export simplified data to JSON
 */
function exportToJSON(exportData, filepath) {
  if (exportData.length === 0) {
    console.log(chalk.yellow('⚠️  No data to export'));
    return;
  }
  
  const exportObject = {
    exportDate: new Date().toISOString(),
    totalIssues: exportData.length,
    merchants: exportData
  };
  
  fs.writeFileSync(filepath, JSON.stringify(exportObject, null, 2));
  console.log(chalk.green(`📄 JSON export saved to: ${filepath}`));
}

/**
 * Prompt user if they want CSV export
 */
function promptForCSVExport() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(chalk.cyan('\n📊 Export as CSV as well? (yes/no): '), (answer) => {
      rl.close();
      const wantsCSV = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
      resolve(wantsCSV);
    });
  });
}

/**
 * Save report to file
 */
async function saveReport(report, skipCSVPrompt = false) {
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Generate and save only the merchant issues JSON export
  const exportData = generateSimplifiedExport(report);
  
  if (exportData.length > 0) {
    // JSON export
    const jsonFilename = `merchant-issues-${timestamp}.json`;
    const jsonFilepath = path.join(CONFIG.outputDir, jsonFilename);
    exportToJSON(exportData, jsonFilepath);
    
    // Ask if user wants CSV export (unless running non-interactively)
    let wantsCSV = false;
    if (!skipCSVPrompt && process.stdin.isTTY) {
      wantsCSV = await promptForCSVExport();
    }
    
    if (wantsCSV) {
      const csvFilename = `merchant-issues-${timestamp}.csv`;
      const csvFilepath = path.join(CONFIG.outputDir, csvFilename);
      exportToCSV(exportData, csvFilepath);
      return { json: jsonFilepath, csv: csvFilepath };
    }
    
    return { json: jsonFilepath, csv: null };
  } else {
    console.log(chalk.yellow('\n⚠️  No issues found, no file saved.'));
    return null;
  }
}

/**
 * Clear only merchant rate audit results (audit-report-*, merchant-issues-*).
 */
function clearMerchantRateResults() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    console.log(chalk.yellow('⚠️  No audit results directory found. Nothing to clear.'));
    return false;
  }
  const files = fs.readdirSync(CONFIG.outputDir);
  const toDelete = files.filter(
    (f) =>
      (f.startsWith('audit-report-') && f.endsWith('.json')) ||
      (f.startsWith('merchant-issues-') && (f.endsWith('.json') || f.endsWith('.csv')))
  );
  if (toDelete.length === 0) {
    console.log(chalk.yellow('⚠️  No merchant rate audit results to clear.'));
    return false;
  }
  let deleted = 0;
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(CONFIG.outputDir, file));
      deleted++;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not delete ${file}: ${error.message}`));
    }
  }
  console.log(chalk.green(`✅ Cleared ${deleted} merchant rate result file(s).`));
  return true;
}

/**
 * Clear only offer activation results (offer-activation-*, session, tested-merchants).
 */
function clearOfferActivationResults() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    console.log(chalk.yellow('⚠️  No audit results directory found. Nothing to clear.'));
    return false;
  }
  const files = fs.readdirSync(CONFIG.outputDir);
  const toDelete = files.filter((f) => {
    const lower = f.toLowerCase();
    return (
      (f.startsWith('offer-activation-') && (lower.endsWith('.json') || lower.endsWith('.csv'))) ||
      f === 'offer-activation-session.json' ||
      f === 'offer-activation-tested-merchants.json'
    );
  });
  if (toDelete.length === 0) {
    console.log(chalk.yellow('⚠️  No offer activation results to clear.'));
    return false;
  }
  let deleted = 0;
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(CONFIG.outputDir, file));
      deleted++;
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not delete ${file}: ${error.message}`));
    }
  }
  console.log(chalk.green(`✅ Cleared ${deleted} offer activation result file(s).`));
  return true;
}

/**
 * Clear all audit results (merchant rate + offer activation).
 */
function clearAllResults() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    console.log(chalk.yellow('⚠️  No audit results directory found. Nothing to clear.'));
    return false;
  }
  try {
    const files = fs.readdirSync(CONFIG.outputDir);
    if (files.length === 0) {
      console.log(chalk.yellow('⚠️  No audit results found. Nothing to clear.'));
      return false;
    }
    let deletedCount = 0;
    for (const file of files) {
      const filepath = path.join(CONFIG.outputDir, file);
      try {
        fs.unlinkSync(filepath);
        deletedCount++;
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Could not delete ${file}: ${error.message}`));
      }
    }
    console.log(chalk.green(`✅ Cleared ${deletedCount} audit result file(s).`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error clearing results: ${error.message}`));
    return false;
  }
}

/**
 * List all previous audit results
 */
function listPreviousAudits() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    console.log(chalk.yellow('⚠️  No audit results directory found.'));
    return [];
  }
  
  try {
    const files = fs.readdirSync(CONFIG.outputDir);
    const auditFiles = files
      .filter(file => file.startsWith('merchant-issues-') && file.endsWith('.json'))
      .map(file => {
        const filepath = path.join(CONFIG.outputDir, file);
        const stats = fs.statSync(filepath);
        const timestamp = file.match(/merchant-issues-(.+)\.json/)?.[1];
        
        // Parse timestamp: format is "2026-02-05T21-46-55-372Z"
        let date = new Date();
        if (timestamp) {
          // Convert "2026-02-05T21-46-55-372Z" to ISO format "2026-02-05T21:46:55.372Z"
          const isoString = timestamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d+)Z/, 
            (match, datePart, hour, min, rest) => {
              const sec = rest.substring(0, 2);
              const ms = rest.substring(2);
              return `${datePart}${hour}:${min}:${sec}.${ms}Z`;
            });
          date = new Date(isoString);
          if (isNaN(date.getTime())) {
            date = stats.mtime; // Fallback to file modification time
          }
        } else {
          date = stats.mtime; // Fallback to file modification time
        }
        
        try {
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          // Extract unique app IDs from merchants array
          const appIds = [...new Set(data.merchants?.map(m => m.appId) || [])];
          return {
            filename: file,
            filepath: filepath,
            timestamp: timestamp,
            date: date,
            appIds: appIds,
            totalIssues: data.totalIssues || 0,
            totalMerchants: data.merchants?.length || 0,
            totalRates: 0, // Not available in simplified export
            size: stats.size
          };
        } catch (error) {
          return {
            filename: file,
            filepath: filepath,
            timestamp: timestamp,
            date: date,
            appIds: [],
            totalIssues: 0,
            totalMerchants: 0,
            totalRates: 0,
            size: stats.size,
            error: 'Could not parse file'
          };
        }
      })
      .sort((a, b) => b.date - a.date); // Sort by date, newest first
    
    return auditFiles;
  } catch (error) {
    console.error(chalk.red(`❌ Error listing audits: ${error.message}`));
    return [];
  }
}

/**
 * Display list of previous audits
 */
function displayAuditList(audits) {
  if (audits.length === 0) {
    console.log(chalk.yellow('\n⚠️  No previous audit results found.'));
    return;
  }
  
  console.log(chalk.bold.cyan('\n📋 Previous Audit Results\n'));
  console.log(chalk.gray('─'.repeat(100)));
  
  audits.forEach((audit, index) => {
    const dateStr = audit.date.toLocaleString();
    const appIdsStr = audit.appIds.length > 0 ? audit.appIds.join(', ') : 'N/A';
    
    console.log(chalk.bold(`\n${index + 1}. ${dateStr}`));
    console.log(`   App IDs: ${chalk.cyan(appIdsStr)}`);
    const ratesInfo = audit.totalRates > 0 ? ` | Rates: ${audit.totalRates}` : '';
    console.log(`   Issues: ${chalk.yellow(audit.totalIssues)} | Merchants: ${audit.totalMerchants}${ratesInfo}`);
    console.log(`   File: ${chalk.gray(audit.filename)}`);
    if (audit.error) {
      console.log(chalk.red(`   ⚠️  ${audit.error}`));
    }
  });
  
  console.log(chalk.gray('\n' + '─'.repeat(100)));
}

/**
 * Lookup audit results by app ID(s)
 */
function lookupAuditsByAppId(appIds) {
  const audits = listPreviousAudits();
  
  if (audits.length === 0) {
    console.log(chalk.yellow('\n⚠️  No previous audit results found.'));
    return [];
  }
  
  // Find audits that contain any of the requested app IDs
  const matchingAudits = audits.filter(audit => {
    if (audit.appIds.length === 0) return false;
    return appIds.some(requestedId => audit.appIds.includes(requestedId));
  });
  
  if (matchingAudits.length === 0) {
    console.log(chalk.yellow(`\n⚠️  No audit results found for App ID(s): ${appIds.join(', ')}`));
    return [];
  }
  
  return matchingAudits;
}

/**
 * Display lookup results
 */
function displayLookupResults(matchingAudits, appIds) {
  if (matchingAudits.length === 0) return;
  
  console.log(chalk.bold.cyan(`\n🔍 Audit Results for App ID(s): ${appIds.join(', ')}\n`));
  console.log(chalk.gray('─'.repeat(100)));
  
  matchingAudits.forEach((audit, index) => {
    const dateStr = audit.date.toLocaleString();
    const matchingAppIds = audit.appIds.filter(id => appIds.includes(id));
    
    console.log(chalk.bold(`\n${index + 1}. ${dateStr}`));
    console.log(`   Matching App IDs: ${chalk.cyan(matchingAppIds.join(', '))}`);
    console.log(`   All App IDs in audit: ${chalk.gray(audit.appIds.join(', '))}`);
    const ratesInfo = audit.totalRates > 0 ? ` | Rates: ${audit.totalRates}` : '';
    console.log(`   Issues: ${chalk.yellow(audit.totalIssues)} | Merchants: ${audit.totalMerchants}${ratesInfo}`);
    console.log(`   File: ${chalk.gray(audit.filename)}`);
    console.log(`   Full path: ${chalk.gray(audit.filepath)}`);
  });
  
  console.log(chalk.gray('\n' + '─'.repeat(100)));
}

/**
 * Parse date from result filename (merchant-issues-2026-02-23T16-03-27-480Z.json or offer-activation-...).
 */
function parseDateFromResultFilename(filename) {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})T\d{2}-\d{2}-\d{2}-\d+Z/);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Load all result files (merchant rate + offer activation) for lookup.
 */
function loadAllResultFiles() {
  const entries = [];
  if (!fs.existsSync(CONFIG.outputDir)) return entries;
  const files = fs.readdirSync(CONFIG.outputDir);
  for (const file of files) {
    const filepath = path.join(CONFIG.outputDir, file);
    const date = parseDateFromResultFilename(file);
    if (file.startsWith('merchant-issues-') && file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const appIds = [...new Set((data.merchants || []).map(m => m.appId).filter(Boolean))];
        const merchants = (data.merchants || []).map(m => ({
          name: m.merchantName,
          id: m.merchantId,
          appId: m.appId,
          issueType: m.issueType,
          reason: m.reason
        }));
        entries.push({
          type: 'merchant_rate',
          filename: file,
          filepath,
          date: date || new Date(data.exportDate || 0),
          exportDate: data.exportDate,
          appIds,
          totalIssues: data.totalIssues,
          merchants
        });
      } catch (_) {}
    } else if (file.startsWith('offer-activation-') && file.endsWith('.json') && !file.includes('session') && !file.includes('tested-merchants')) {
      try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const results = data.results || [];
        const merchants = results.map(r => ({
          name: r.merchantName,
          id: r.merchantId,
          domain: r.merchantDomain,
          success: r.success,
          finalUrl: r.finalUrl
        }));
        const appIds = [];
        entries.push({
          type: 'offer_activation',
          filename: file,
          filepath,
          date: date || new Date(data.exportDate || 0),
          exportDate: data.exportDate,
          appIds,
          totalTested: data.totalTested,
          successful: data.successful,
          failed: data.failed,
          merchants
        });
      } catch (_) {}
    }
  }
  return entries.sort((a, b) => b.date - a.date);
}

/**
 * Ask a single question; returns trimmed answer.
 */
function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question), (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

/**
 * Lookup results by merchant, date, or App ID. Interactive menu.
 */
async function runLookupMenu() {
  const entries = loadAllResultFiles();
  if (entries.length === 0) {
    console.log(chalk.yellow('\n⚠️  No result files found in audit-results.'));
    return;
  }

  console.log(chalk.bold.cyan('\n🔍 Lookup Results\n'));
  console.log(chalk.gray('Filter by any combination (leave blank to skip).\n'));

  const appIdInput = await askQuestion('App ID(s), comma or space separated (or press Enter to skip): ');
  const dateInput = await askQuestion('Date (YYYY-MM-DD) or range (YYYY-MM-DD to YYYY-MM-DD) (or press Enter to skip): ');
  const merchantInput = await askQuestion('Merchant name (partial match) (or press Enter to skip): ');

  let filterAppIds = [];
  if (appIdInput) {
    filterAppIds = appIdInput.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  }
  let dateFrom = null;
  let dateTo = null;
  if (dateInput) {
    const rangeMatch = dateInput.match(/^(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
    if (rangeMatch) {
      dateFrom = new Date(rangeMatch[1]);
      dateTo = new Date(rangeMatch[2]);
    } else {
      const single = dateInput.match(/^\d{4}-\d{2}-\d{2}$/);
      if (single) {
        dateFrom = new Date(dateInput);
        dateTo = new Date(dateInput);
        dateTo.setHours(23, 59, 59, 999);
      }
    }
  }
  const merchantLower = merchantInput ? merchantInput.toLowerCase() : '';

  const matches = entries.filter((e) => {
    const dateOk = !dateFrom || (e.date >= dateFrom && e.date <= dateTo);
    const appIdOk = filterAppIds.length === 0 || e.appIds.some(id => filterAppIds.includes(id));
    const merchantOk = !merchantLower || e.merchants.some(m => (m.name || '').toLowerCase().includes(merchantLower));
    return dateOk && appIdOk && merchantOk;
  });

  if (matches.length === 0) {
    console.log(chalk.yellow('\n⚠️  No results match your filters.'));
    return;
  }

  console.log(chalk.bold.cyan(`\n📋 Matching results (${matches.length} file(s))\n`));
  console.log(chalk.gray('─'.repeat(100)));
  matches.forEach((e, i) => {
    const typeLabel = e.type === 'merchant_rate' ? 'Merchant Rate' : 'Offer Activation';
    const dateStr = e.date.toLocaleString();
    console.log(chalk.bold(`\n${i + 1}. [${typeLabel}] ${dateStr}`));
    console.log(`   File: ${chalk.gray(e.filename)}`);
    if (e.type === 'merchant_rate') {
      console.log(`   App IDs: ${chalk.cyan((e.appIds || []).join(', ') || 'N/A')} | Issues: ${chalk.yellow(e.totalIssues || 0)} | Merchants: ${(e.merchants || []).length}`);
    } else {
      console.log(`   Tested: ${e.totalTested || 0} | OK: ${chalk.green(e.successful || 0)} | Failed: ${chalk.red(e.failed || 0)}`);
    }
    if (merchantLower && e.merchants) {
      const matching = e.merchants.filter(m => (m.name || '').toLowerCase().includes(merchantLower));
      if (matching.length > 0 && matching.length <= 15) {
        console.log(chalk.gray('   Matching merchants: ' + matching.map(m => m.name).join(', ')));
      } else if (matching.length > 15) {
        console.log(chalk.gray(`   Matching merchants: ${matching.length} (e.g. ${matching.slice(0, 3).map(m => m.name).join(', ')}...)`));
      }
    }
  });
  console.log(chalk.gray('\n' + '─'.repeat(100)));
}

/**
 * Prompt user for app IDs interactively
 */
function promptForAppIds() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log(chalk.bold.cyan('\n🔍 Merchant Rate Auditor\n'));
    console.log(chalk.yellow('Enter the App IDs you want to audit (comma-separated or space-separated):'));
    console.log(chalk.gray('Example: 451, 206, 209  or  451 206 209\n'));
    
    rl.question(chalk.cyan('App IDs: '), (answer) => {
      rl.close();
      
      // Parse input - handle both comma and space separated
      const appIds = answer
        .split(/[,\s]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0)
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0);
      
      if (appIds.length === 0) {
        console.log(chalk.red('\n❌ No valid App IDs provided. Please enter numeric App IDs.\n'));
        process.exit(1);
      }
      
      resolve(appIds);
    });
  });
}

/**
 * Run full audit: merchant rate audit for App IDs, then optionally offer activation batch for same App IDs.
 */
async function runFullAudit() {
  const appIds = await promptForAppIds();
  if (!appIds || appIds.length === 0) return;
  console.log(chalk.cyan(`\nAuditing App IDs: ${appIds.join(', ')}\n`));

  // 1. Merchant rate audit
  console.log(chalk.bold.cyan('——— Part 1: Merchant Rate Audit ———\n'));
  const results = [];
  for (const appId of appIds) {
    const result = await auditAppId(appId);
    results.push(result);
  }
  const report = generateReport(results);
  printResults(report);
  await saveReport(report, false);

  // 2. Offer activation batch (optional)
  console.log(chalk.bold.cyan('\n——— Part 2: Offer Activation ———\n'));
  const runOffer = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Run offer activation for these App IDs? (yes/no): '), (answer) => {
      rl.close();
      resolve(!!(answer && (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')));
    });
  });
  if (!runOffer) {
    console.log(chalk.gray('Skipping offer activation.'));
    return;
  }
  const limitAnswer = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Max merchants per App ID (default 10): '), (a) => {
      rl.close();
      resolve((a && a.trim()) || '10');
    });
  });
  const limit = parseInt(limitAnswer, 10) || 10;
  const { results: activationResults } = await offerActivation.runOfferActivationBatchForAppIds(appIds, { limit });
  if (activationResults.length > 0) {
    offerActivation.printResultsSummary(activationResults);
    const saveRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise((resolve) => {
      saveRl.question(chalk.cyan('Save offer activation results? (yes/no): '), (answer) => {
        if (answer && (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')) {
          offerActivation.exportResults(activationResults);
          saveRl.question(chalk.cyan('Export results to CSV? (yes/no): '), (csvAnswer) => {
            saveRl.close();
            if (csvAnswer && (csvAnswer.toLowerCase() === 'yes' || csvAnswer.toLowerCase() === 'y')) {
              offerActivation.exportResultsToCSV(activationResults);
            }
            resolve();
          });
        } else {
          saveRl.close();
          resolve();
        }
      });
    });
  } else {
    console.log(chalk.yellow('No offer activation results to save.'));
  }
}

/**
 * Show main menu - Top level to choose test type
 */
function showTopLevelMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║               🔍 MERCHANT TESTING TOOL                                       ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════════════════════╝\n'));
    console.log(chalk.yellow('What do you want to test?\n'));
    console.log(chalk.white('  1) ') + chalk.bold('Merchant Rate Audit') + chalk.gray(' - Check for problematic rates in feeds'));
    console.log(chalk.white('  2) ') + chalk.bold('Offer Activation Testing') + chalk.gray(' - Test if offers work when activated'));
    console.log(chalk.white('  3) ') + chalk.bold('Lookup results') + chalk.gray(' - View results by merchant, date, or App ID'));
    console.log(chalk.white('  4) ') + chalk.bold('Run full audit') + chalk.gray(' - Merchant rate + offer activation in one run'));
    console.log(chalk.white('  5) ') + chalk.bold('Exit') + '\n');
    
    rl.question(chalk.cyan('Choice (1-5): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Show merchant rate audit menu
 */
function showMainMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log(chalk.bold.cyan('\n📊 Merchant Rate Audit\n'));
    console.log(chalk.yellow('What would you like to do?'));
    console.log(chalk.gray('  1) Run new audit'));
    console.log(chalk.gray('  2) List previous audits'));
    console.log(chalk.gray('  3) Lookup audits by App ID'));
    console.log(chalk.gray('  4) Clear merchant rate results'));
    console.log(chalk.gray('  5) Back to main menu'));
    console.log(chalk.gray('  6) Exit\n'));
    
    rl.question(chalk.cyan('Choice (1-6): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Run merchant rate audit menu loop
 */
async function runMerchantRateAuditMenu() {
  while (true) {
    const choice = await showMainMenu();
    
    switch (choice) {
      case '1':
        // Run new audit
        const appIdsToAudit = await promptForAppIds();
        console.log(chalk.cyan(`\nAuditing App IDs: ${appIdsToAudit.join(', ')}\n`));
        
        const results = [];
        for (const appId of appIdsToAudit) {
          const result = await auditAppId(appId);
          results.push(result);
        }
        
        const report = generateReport(results);
        printResults(report);
        await saveReport(report, false); // false = show CSV prompt
        break;
        
      case '2':
        // List previous audits
        const audits = listPreviousAudits();
        displayAuditList(audits);
        break;
        
      case '3':
        // Lookup by App ID
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        await new Promise((resolve) => {
          rl.question(chalk.cyan('Enter App ID(s) to lookup (comma or space separated): '), (answer) => {
            rl.close();
            
            const lookupAppIds = answer
              .split(/[,\s]+/)
              .map(id => id.trim())
              .filter(id => id.length > 0)
              .map(id => parseInt(id))
              .filter(id => !isNaN(id) && id > 0);
            
            if (lookupAppIds.length === 0) {
              console.log(chalk.red('❌ No valid App IDs provided.'));
              resolve();
              return;
            }
            
            const matchingAudits = lookupAuditsByAppId(lookupAppIds);
            displayLookupResults(matchingAudits, lookupAppIds);
            resolve();
          });
        });
        break;
        
      case '4':
        // Clear merchant rate results only
        const clearRateRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        await new Promise((resolve) => {
          clearRateRl.question(chalk.yellow('⚠️  Delete all merchant rate audit results? (yes/no): '), (answer) => {
            clearRateRl.close();
            if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
              clearMerchantRateResults();
            } else {
              console.log(chalk.gray('Cancelled.'));
            }
            resolve();
          });
        });
        break;
        
      case '5':
        // Back to main menu
        return;
        
      case '6':
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        process.exit(0);
        
      default:
        console.log(chalk.red('❌ Invalid choice. Enter 1-6.'));
        break;
    }
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Check for special commands
  if (args.includes('--clear') || args.includes('-c')) {
    console.log(chalk.bold.cyan('\n🗑️  Clear Audit Results\n'));
    const confirmed = args.includes('--yes') || args.includes('-y');
    
    if (!confirmed) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      return new Promise((resolve) => {
        rl.question(chalk.yellow('⚠️  Are you sure you want to delete all audit results? (yes/no): '), (answer) => {
          rl.close();
          if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
            clearAllResults();
            resolve();
          } else {
            console.log(chalk.gray('Cancelled.'));
            resolve();
          }
        });
      });
    } else {
      clearAllResults();
      return;
    }
  }
  
  if (args.includes('--list') || args.includes('-l')) {
    const audits = listPreviousAudits();
    displayAuditList(audits);
    return;
  }
  
  if (args.includes('--lookup') || args.includes('--find')) {
    // Extract app IDs from arguments (after --lookup or --find)
    const lookupIndex = args.findIndex(arg => arg === '--lookup' || arg === '--find');
    const appIds = args
      .slice(lookupIndex + 1)
      .map(id => parseInt(id))
      .filter(id => !isNaN(id) && id > 0);
    
    if (appIds.length === 0) {
      console.log(chalk.red('❌ Please provide App ID(s) to lookup.'));
      console.log(chalk.gray('Example: node auditor.js --lookup 451 206'));
      process.exit(1);
    }
    
    const matchingAudits = lookupAuditsByAppId(appIds);
    displayLookupResults(matchingAudits, appIds);
    return;
  }
  
  // Check for offer activation test mode
  if (args.includes('--offer') || args.includes('--activation') || args.includes('-o')) {
    await offerActivation.runOfferActivationTest();
    return;
  }
  
  // Check for direct URL test
  if (args.includes('--test-url') || args.includes('-u')) {
    const urlIndex = args.findIndex(arg => arg === '--test-url' || arg === '-u');
    const url = args[urlIndex + 1];
    
    if (!url) {
      console.log(chalk.red('❌ Please provide a URL to test.'));
      console.log(chalk.gray('Example: node auditor.js --test-url https://wild.link/e?c=...'));
      process.exit(1);
    }
    
    const result = await offerActivation.testWildlinkActivation(url);
    offerActivation.printRedirectChain(result);
    return;
  }
  
  // Check for direct domain test
  if (args.includes('--test-domain') || args.includes('-d')) {
    const domainIndex = args.findIndex(arg => arg === '--test-domain' || arg === '-d');
    const domain = args[domainIndex + 1];
    
    if (!domain) {
      console.log(chalk.red('❌ Please provide a domain to test.'));
      console.log(chalk.gray('Example: node auditor.js --test-domain bobore.com'));
      process.exit(1);
    }
    
    const result = await offerActivation.testDomain(domain);
    offerActivation.printRedirectChain(result);
    return;
  }
  
  // Check if app IDs were provided as command line arguments (for merchant rate audit)
  const cmdLineAppIds = args
    .filter(arg => !arg.startsWith('-'))
    .map(id => parseInt(id))
    .filter(id => !isNaN(id) && id > 0);
  
  if (cmdLineAppIds.length > 0) {
    // Use command line arguments if provided - run merchant rate audit
    const appIdsToAudit = cmdLineAppIds;
    console.log(chalk.bold.cyan('\n📊 Merchant Rate Auditor'));
    console.log(chalk.cyan(`Auditing App IDs: ${appIdsToAudit.join(', ')}\n`));
    
    // Audit each app ID
    const results = [];
    for (const appId of appIdsToAudit) {
      const result = await auditAppId(appId);
      results.push(result);
    }
    
    // Generate and print report
    const report = generateReport(results);
    printResults(report);
    
    // Save report to file
    await saveReport(report, false); // false = show CSV prompt
    
    // Exit with appropriate code
    const hasIssues = report.summary.totalIssues > 0;
    process.exit(hasIssues ? 1 : 0);
  } else {
    // Show interactive top-level menu
    while (true) {
      const choice = await showTopLevelMenu();
      
      switch (choice) {
        case '1':
          // Merchant Rate Audit
          await runMerchantRateAuditMenu();
          break;
          
        case '2':
          // Offer Activation Testing
          await offerActivation.runOfferActivationTest();
          break;
          
        case '3':
          // Lookup results by merchant, date, app ID
          await runLookupMenu();
          break;
          
        case '4':
          // Run full audit: merchant rate + offer activation
          await runFullAudit();
          break;
          
        case '5':
          console.log(chalk.gray('\nGoodbye! 👋\n'));
          process.exit(0);
          break;
          
        default:
          console.log(chalk.red('❌ Invalid choice. Please enter 1-5.'));
          break;
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = {
  // Merchant Rate Audit functions
  auditAppId,
  validateRate,
  isHexCode,
  containsShareASale,
  containsCommission,
  isInvalidRateName,
  containsPercentageInName,
  // Offer Activation functions (re-exported from module)
  ...offerActivation,
  isZeroRate,
  isExactlyOnlinePurchase,
  containsUnderscore,
  containsInAppRate,
  rateMatchesMerchantCategory
};

