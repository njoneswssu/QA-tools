#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const offerActivation = require('./offer-activation-auditor');

let BigQuery = null;
try {
  BigQuery = require('@google-cloud/bigquery').BigQuery;
} catch (_) {}

/**
 * Merchant Rate Auditor
 * 
 * Audits Wildlink merchant rate JSON feeds for problematic rates:
 * - Rates with "ShareASale commission" in the name
 * - Rates with hex code-like values instead of actual commission amounts
 * - Zero rates with EXACTLY "online purchase" as the name (flagged)
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
  defaultAppIds: [451, 206, 209], // Default app IDs to audit if none provided
  bigQueryProjectId: 'wildfire-1000'
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
 * Check if a rate name looks like a product name, location name, or other non-rate description
 * Examples: "gummies returning", "Artificial christmas tree", "chicago", etc.
 */
function isProductLikeName(name) {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  
  // Product names that shouldn't be in rate names
  const productNames = [
    'gummies', 'gummy',
    'vitamins', 'vitamin',
    'supplements', 'supplement',
    'pills', 'pill',
    'capsules', 'capsule',
    'tablets', 'tablet',
    'drops', 'drop',
    'sprays', 'spray',
    'creams', 'cream',
    'lotions', 'lotion',
    'oils', 'oil',
    'serums', 'serum',
    'artificial', 'christmas', 'tree', 'trees',
    'shoes', 'shoe',
    'clothing', 'clothes',
    'electronics', 'electronic',
    'furniture', 'furnishings',
    'appliances', 'appliance',
    'toys', 'toy',
    'books', 'book',
    'games', 'game'
  ];
  
  // Common location/city names (common US cities)
  const locationNames = [
    'chicago', 'new york', 'los angeles', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
    'san francisco', 'indianapolis', 'columbus', 'fort worth', 'charlotte',
    'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit',
    'nashville', 'portland', 'oklahoma city', 'las vegas', 'memphis',
    'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson',
    'fresno', 'sacramento', 'kansas city', 'mesa', 'atlanta', 'omaha',
    'raleigh', 'miami', 'long beach', 'virginia beach', 'oakland',
    'minneapolis', 'tulsa', 'cleveland', 'wichita', 'arlington',
    'london', 'paris', 'tokyo', 'sydney', 'toronto', 'mexico city',
    'miami', 'boston', 'seattle', 'portland'
  ];
  
  // Check if name is just a location name
  if (locationNames.includes(lowerTrimmed)) {
    return true;
  }
  
  // Check if name starts with a product name
  const startsWithProduct = productNames.some(product => {
    const regex = new RegExp(`^${product}\\s+`, 'i');
    return regex.test(lowerTrimmed);
  });
  
  if (startsWithProduct) {
    // If it starts with a product name, check if it's followed by rate-like words
    const rateLikeWords = ['returning', 'new', 'first', 'repeat', 'recurring', 'subscription', 'sale', 'purchase', 'transaction', 'order'];
    const hasRateLikeWord = rateLikeWords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerTrimmed);
    });
    
    // If it has a product name but also has rate-like context, it might be valid
    // But if it's just "product + returning/new", it's likely wrong
    if (hasRateLikeWord) {
      return true; // Flag it as product-like
    }
    
    // If it's just a product name or product + adjective (like "Artificial christmas tree")
    // and doesn't have clear rate context, flag it
    if (!hasRateLikeWord && trimmed.split(/\s+/).length <= 4) {
      // Check if it contains product-related words
      const hasProductWords = productNames.some(product => {
        return lowerTrimmed.includes(product);
      });
      if (hasProductWords) {
        return true;
      }
    }
  }
  
  // Check for pattern: product + returning/new (e.g., "gummies returning")
  const productWithStatus = /\b(gummies?|vitamins?|supplements?|pills?|capsules?|tablets?)\s+(returning|new|first|repeat)\b/i;
  if (productWithStatus.test(lowerTrimmed)) {
    return true;
  }
  
  // Check for product descriptions that look like product names (e.g., "Artificial christmas tree")
  // These typically don't contain rate-related words
  const rateRelatedWords = ['purchase', 'sale', 'transaction', 'order', 'signup', 'subscription', 'recurring', 'returning', 'new', 'first', 'online', 'b2b', 'b2c', 'coupon', 'verified', 'payroll', 'referral', 'affiliate'];
  const hasRateRelatedWord = rateRelatedWords.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerTrimmed);
  });
  
  // If it doesn't have any rate-related words and looks like a product description, flag it
  if (!hasRateRelatedWord) {
    // Check if it contains product-related terms
    const hasProductTerms = productNames.some(product => lowerTrimmed.includes(product));
    // Check if it's a simple noun phrase (like "Artificial christmas tree" or "chicago")
    const isSimpleNounPhrase = /^[A-Z][a-z]+(\s+[a-z]+)*$/.test(trimmed) && trimmed.split(/\s+/).length <= 4;
    
    if (hasProductTerms || (isSimpleNounPhrase && trimmed.split(/\s+/).length <= 3)) {
      return true;
    }
  }
  
  return false;
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
  
  // Flag rates with "API" in the name
  if (rate.Name && /api/i.test(rate.Name)) {
    issues.push({
      type: 'api_in_name',
      severity: 'medium',
      message: `Rate name contains "API": "${rate.Name}"`,
      rate: rate
    });
  }
  
  if (rate.Name && /wildfire/i.test(rate.Name)) {
    issues.push({
      type: 'wildfire_in_name',
      severity: 'medium',
      message: `Rate name contains "Wildfire": "${rate.Name}"`,
      rate: rate
    });
  }
  
  // Flag rates with "in app" or "iOS in-app" patterns (skip if rate amount is 0)
  if (rate.Name && containsInAppRate(rate.Name) && !isZeroRate(rate)) {
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
 * Audit merchant rates for a specific app ID.
 * @param {number} appId
 * @param {{ limitToMerchantIds?: (string|number)[] }} options - If set, only audit these merchant IDs (for full audit same-set).
 */
async function auditAppId(appId, options = {}) {
  const { limitToMerchantIds } = options;
  const allowedIds = limitToMerchantIds && limitToMerchantIds.length > 0
    ? new Set(limitToMerchantIds.map(id => String(id)))
    : null;

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
      allMerchants: [],
      error: 'Failed to fetch data'
    };
  }
  
  const issues = [];
  const allMerchants = [];
  let totalMerchants = 0;
  let totalRates = 0;
  
  // Iterate through all merchants (keys are merchant IDs)
  for (const [merchantId, rates] of Object.entries(rateData)) {
    if (!Array.isArray(rates)) continue;
    if (allowedIds && !allowedIds.has(String(merchantId))) continue;
    
    totalMerchants++;
    totalRates += rates.length;
    
    // Get merchant info from the map
    const merchantInfo = merchantMap[merchantId];
    const merchantName = merchantInfo?.name || `Merchant ID ${merchantId}`;
    allMerchants.push({ merchantId, merchantName });
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
    allMerchants,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate a detailed report
 */
function generateReport(results) {
  const totalMerchants = results.reduce((sum, r) => sum + r.totalMerchants, 0);
  const merchantsWithIssues = results.reduce((sum, r) => sum + (r.issues || []).length, 0);
  const report = {
    summary: {
      totalAppIds: results.length,
      successfulAppIds: results.filter(r => r.success).length,
      totalMerchants,
      merchantsWithNoIssues: totalMerchants - merchantsWithIssues,
      merchantsWithIssues,
      totalRates: results.reduce((sum, r) => sum + r.totalRates, 0),
      totalIssues: results.reduce((sum, r) => sum + (r.issues || []).length, 0),
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
  
  // Summary (merchant-level counts so numbers match total tested)
  console.log(chalk.bold('Summary:'));
  console.log(`  Total App IDs audited: ${summary.totalAppIds}`);
  console.log(`  Total Merchants tested: ${summary.totalMerchants}`);
  console.log(`  Merchants with no rate issues: ${chalk.green(summary.merchantsWithNoIssues)}`);
  console.log(`  Merchants with rate issues: ${chalk.yellow(summary.merchantsWithIssues)}`);
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
    if (result.allMerchants && result.allMerchants.length > 0) {
      const names = result.allMerchants.map((m) => `${m.merchantName || 'ID ' + m.merchantId} (ID ${m.merchantId})`).join(', ');
      console.log(chalk.gray(`  Selected: ${names}`));
    }
    console.log(`  Rates: ${result.totalRates}`);
    console.log(`  Issues: ${chalk.yellow((result.issues || []).length)}`);
    
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
 * Load commission data from a CSV file (e.g. BigQuery export with merchant_id, Total_Commissions).
 * Returns Map<merchantIdString, number>.
 */
function loadCommissionDataFromCSV(filepath) {
  const map = new Map();
  if (!filepath || !fs.existsSync(filepath)) return map;
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return map;
    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const midx = header.findIndex((h) => /merchant_id/i.test(h));
    const cidx = header.findIndex((h) => /total_commission|commission_amount|commission/i.test(h));
    if (midx < 0 || cidx < 0) return map;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      const merchantId = parts[midx];
      const commission = parseFloat(parts[cidx]);
      if (merchantId && !isNaN(commission)) map.set(String(merchantId), commission);
    }
  } catch (_) {}
  return map;
}

/**
 * Collect all unique merchant IDs from a rate audit report (from allMerchants and issues).
 */
function collectMerchantIdsFromReport(report) {
  const ids = new Set();
  for (const result of report.results || []) {
    if (!result.success) continue;
    for (const m of result.allMerchants || []) {
      if (m.merchantId != null) ids.add(Number(m.merchantId));
    }
    for (const issueGroup of result.issues || []) {
      if (issueGroup.merchantId != null) ids.add(Number(issueGroup.merchantId));
    }
  }
  return [...ids];
}

/**
 * Run BigQuery to fetch Total_Commissions per merchant_id for the given IDs.
 * Query matches: wildfire-1000.stephsandbox.commission_detail_view_2 + firepublic.merchant.
 * Returns Map<merchantIdString, number>. Returns empty map if BigQuery unavailable or query fails.
 */
async function fetchCommissionFromBigQuery(merchantIds) {
  if (!BigQuery || !merchantIds || merchantIds.length === 0) return new Map();
  const ids = merchantIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (ids.length === 0) return new Map();
  const inList = ids.join(', ');
  const query = `
    SELECT m.name, c.merchant_id, sum(c.commission_amount) as Total_Commissions
    FROM \`wildfire-1000.stephsandbox.commission_detail_view_2\` c
    JOIN \`wildfire-1000.firepublic.merchant\` m ON c.merchant_id = m.ID
    WHERE c.merchant_id IN (${inList})
    GROUP BY c.merchant_id, m.name
    ORDER BY sum(c.commission_amount) DESC
  `;
  try {
    const bigquery = new BigQuery({ projectId: CONFIG.bigQueryProjectId });
    const [rows] = await bigquery.query({ query });
    const map = new Map();
    for (const row of rows || []) {
      const id = row.merchant_id != null ? String(row.merchant_id) : null;
      const commission = row.Total_Commissions != null ? Number(row.Total_Commissions) : NaN;
      if (id && !isNaN(commission)) map.set(id, commission);
    }
    return map;
  } catch (err) {
    console.log(chalk.yellow('⚠️  BigQuery failed: ' + (err.message || err)));
    return new Map();
  }
}

/**
 * Fetch commission and merchant name from BigQuery for given merchant IDs.
 * Returns Array<{ merchantId, merchantName, commission }> for display.
 */
async function fetchCommissionWithNamesFromBigQuery(merchantIds) {
  if (!BigQuery || !merchantIds || merchantIds.length === 0) return [];
  const ids = merchantIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (ids.length === 0) return [];
  const inList = ids.join(', ');
  const query = `
    SELECT m.name, c.merchant_id, sum(c.commission_amount) as Total_Commissions
    FROM \`wildfire-1000.stephsandbox.commission_detail_view_2\` c
    JOIN \`wildfire-1000.firepublic.merchant\` m ON c.merchant_id = m.ID
    WHERE c.merchant_id IN (${inList})
    GROUP BY c.merchant_id, m.name
    ORDER BY sum(c.commission_amount) DESC
  `;
  try {
    const bigquery = new BigQuery({ projectId: CONFIG.bigQueryProjectId });
    const [rows] = await bigquery.query({ query });
    return (rows || []).map((row) => ({
      merchantId: row.merchant_id != null ? String(row.merchant_id) : null,
      merchantName: row.name != null ? String(row.name) : '',
      commission: row.Total_Commissions != null ? Number(row.Total_Commissions) : NaN
    })).filter((r) => r.merchantId && !isNaN(r.commission));
  } catch (err) {
    console.log(chalk.yellow('⚠️  BigQuery failed: ' + (err.message || err)));
    return [];
  }
}

/**
 * Build full list of rate-audited merchants for combined CSV: includes every tested merchant,
 * with "No issues" row for merchants that had no rate issues.
 * @param {Object} report
 * @param {Set<string>} [rateFalseNegativeKeys] - Set of "merchantId-appId-issueType" to mark as false negative.
 */
function buildRateMerchantsForCombinedReport(report, rateFalseNegativeKeys = null) {
  const issueRows = generateSimplifiedExport(report);
  const hasIssuesKey = new Set(issueRows.map((m) => `${m.merchantId}-${m.appId}`));
  const allRows = [...issueRows];
  for (const result of report.results || []) {
    if (!result.success || !result.allMerchants) continue;
    for (const m of result.allMerchants) {
      const key = `${m.merchantId}-${result.appId}`;
      if (hasIssuesKey.has(key)) continue;
      allRows.push({
        merchantName: m.merchantName || `Merchant ID ${m.merchantId}`,
        merchantId: m.merchantId,
        merchantCategory: '',
        appId: result.appId,
        issueType: 'None',
        severity: '',
        reason: 'No issues',
        rateName: '',
        rateAmount: '',
        count: 0
      });
    }
  }
  if (rateFalseNegativeKeys && rateFalseNegativeKeys.size > 0) {
    allRows.forEach((row) => {
      const key = `${row.merchantId}-${row.appId}-${row.issueType || ''}`;
      row.falseNegative = rateFalseNegativeKeys.has(key);
    });
  } else {
    allRows.forEach((row) => { row.falseNegative = false; });
  }
  return allRows;
}

/**
 * Prompt to mark rate issues as false negatives (numbered list). Returns Set of "merchantId-appId-issueType" keys.
 */
async function promptAndMarkRateFalseNegatives(report) {
  const issueRows = generateSimplifiedExport(report);
  if (issueRows.length === 0) return new Set();
  const wantMark = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Mark any rate issues as false negatives? (yes/no): '), (a) => {
      rl.close();
      resolve(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
    });
  });
  if (!wantMark) return new Set();
  console.log(chalk.yellow('\nRate issues:\n'));
  issueRows.forEach((r, i) => {
    console.log(chalk.gray(`  ${i + 1}. ${r.merchantName || r.merchantId} (ID ${r.merchantId}) — ${r.issueType}: ${(r.reason || '').toString().slice(0, 50)}...`));
  });
  console.log('');
  const answer = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Enter the numbers of issues that were false negatives (e.g. 1, 3, 5 or "all"): '), (a) => {
      rl.close();
      resolve((a && a.trim()) || '');
    });
  });
  const numbers = (answer.trim().toLowerCase() === 'all')
    ? Array.from({ length: issueRows.length }, (_, i) => i + 1)
    : answer.split(/[,\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= issueRows.length);
  const keySet = new Set();
  numbers.forEach((n) => {
    const row = issueRows[n - 1];
    keySet.add(`${row.merchantId}-${row.appId}-${row.issueType || ''}`);
  });
  if (keySet.size > 0) console.log(chalk.green(`Marked ${keySet.size} rate issue(s) as false negatives.\n`));
  return keySet;
}

/**
 * Write one CSV file with two separate sections (tables): Merchant Rate then Offer Activation.
 * Each row can have dateTested; "Dates tested" is output as a column beside Merchant Name.
 * @param {Array} rateMerchants
 * @param {Array} activationResults
 * @param {string} filepath
 * @param {{ sourceDates?: string[] }} [options] - Optional (legacy). Per-row dateTested is used for the Dates tested column.
 */
function writeFullReportCombinedCSV(rateMerchants, activationResults, filepath, options = {}) {
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const normalizeDateTested = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'object' && typeof v.toISOString === 'function') return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (!s) return '';
    if (s.includes(',')) return s.replace(/,/g, '; ');
    const isoMatch = s.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    return s;
  };
  const normalizeCell = (v) => {
    if (v == null || v === '') return '';
    return String(v).replace(/,/g, '; ');
  };
  const redirectPathFor = (r) => {
    if (!r.redirectChain || r.redirectChain.length === 0) return r.finalUrl || '';
    return r.redirectChain
      .map((hop) => `${hop.url} (${hop.statusCode} ${hop.statusText || ''})`.trim())
      .join(' → ');
  };
  const rateWithIssues = (rateMerchants || []).filter(
    (m) => m.issueType != null && String(m.issueType).trim() !== '' && String(m.issueType) !== 'None'
  );
  const rateHeaders = [
    'Dates tested',
    'Merchant Name',
    'Merchant ID',
    'App ID',
    'Merchant Category',
    'Commission',
    'Issue Type',
    'Reason or Message',
    'Rate Name',
    'Rate Amount',
    'Count',
    'False Negative'
  ];
  const activationHeaders = [
    'Dates tested',
    'Merchant Name',
    'Merchant ID',
    'App ID',
    'Domain',
    'Success',
    'False Negative',
    'Needs Investigation',
    'Test URL',
    'Final URL',
    'Redirect Path',
    'Redirect Count',
    'Issue Type',
    'Issue Message'
  ];
  const rateRows = rateWithIssues.map((m) => [
    normalizeDateTested(m.dateTested),
    m.merchantName ?? '',
    m.merchantId ?? '',
    m.appId ?? '',
    m.merchantCategory ?? '',
    m.commission !== undefined && m.commission !== null && m.commission !== '' ? m.commission : '',
    m.issueType ?? '',
    m.reason ?? '',
    m.rateName ?? '',
    m.rateAmount ?? '',
    m.count ?? '',
    m.falseNegative ? 'Yes' : ''
  ]);
  const activationRows = [];
  for (const r of activationResults || []) {
    const redirectPath = redirectPathFor(r);
    const issues = (r.issues && r.issues.length > 0)
      ? r.issues
      : (r.error ? [{ type: 'error', message: r.error }] : [{ type: '', message: '' }]);
    const issueTypes = issues.map((i) => i.type ?? '').filter(Boolean).join('; ') || (r.error ? 'error' : '');
    const issueMessages = issues.map((i) => i.message ?? '').filter(Boolean).join('; ') || (r.error ? r.error : '');
    activationRows.push([
      normalizeDateTested(r.dateTested),
      r.merchantName ?? '',
      r.merchantId ?? '',
      r.appId ?? '',
      r.merchantDomain ?? '',
      r.success ? 'Yes' : 'No',
      r.falseNegative ? 'Yes' : '',
      r.needsInvestigation ? 'Yes' : '',
      r.testUrl ?? '',
      r.finalUrl ?? '',
      redirectPath,
      r.redirectCount ?? '',
      issueTypes,
      issueMessages
    ]);
  }
  if (rateRows.length === 0 && activationRows.length === 0) {
    console.log(chalk.yellow('⚠️  No data for combined report.'));
    return;
  }

  const xlsxOnly = filepath.toLowerCase().endsWith('.xlsx');
  if (!xlsxOnly) {
    const sections = [
      [
        '[Merchant Rate]',
        rateHeaders.map(escapeCSV).join(','),
        ...rateRows.map((row) => row.map((v) => escapeCSV(normalizeCell(v))).join(','))
      ].join('\n'),
      [
        '[Offer Activation]',
        activationHeaders.map(escapeCSV).join(','),
        ...activationRows.map((row) => row.map((v) => escapeCSV(normalizeCell(v))).join(','))
      ].join('\n')
    ];
    const csvContent = sections.join('\n\n');
    fs.writeFileSync(filepath, csvContent);
    console.log(chalk.green(`📊 Full report CSV saved to: ${filepath}`));
  }

  try {
    const XLSX = require('xlsx');
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const wb = XLSX.utils.book_new();
    const rateAoa = [rateHeaders, ...rateRows];
    const activationAoa = [activationHeaders, ...activationRows];
    const wsRate = XLSX.utils.aoa_to_sheet(rateAoa);
    const wsActivation = XLSX.utils.aoa_to_sheet(activationAoa);
    XLSX.utils.book_append_sheet(wb, wsActivation, `Offer Activation ${dateStr}`);
    XLSX.utils.book_append_sheet(wb, wsRate, `Merchant Rate ${dateStr}`);
    const xlsxPath = xlsxOnly ? filepath : filepath.replace(/\.csv$/i, '.xlsx');
    XLSX.writeFile(wb, xlsxPath);
    console.log(chalk.green(`📊 Full report XLSX (2 sheets) saved to: ${xlsxPath}`));
  } catch (e) {
    console.log(chalk.yellow('⚠️  Could not write XLSX (xlsx package required): ' + (e.message || e)));
  }
}

/**
 * Export simplified data to CSV (legacy: Merchant Name + Reason only).
 */
function exportToCSV(exportData, filepath) {
  if (exportData.length === 0) {
    console.log(chalk.yellow('⚠️  No data to export'));
    return;
  }
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const headers = ['Merchant Name', 'Reason'];
  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...exportData.map(row => [escapeCSV(row.merchantName), escapeCSV(row.reason)].join(','))
  ];
  fs.writeFileSync(filepath, csvRows.join('\n'));
  console.log(chalk.green(`📊 CSV export saved to: ${filepath}`));
}

/**
 * Write merchant rate table to CSV (full columns including Commission and False Negative).
 */
function writeMerchantRateCSV(rateMerchants, filepath) {
  if (!rateMerchants || rateMerchants.length === 0) {
    console.log(chalk.yellow('⚠️  No data to export'));
    return;
  }
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const headers = [
    'Merchant Name', 'Merchant ID', 'App ID', 'Merchant Category', 'Commission',
    'Issue Type', 'Reason or Message', 'Rate Name', 'Rate Amount', 'Count', 'False Negative'
  ];
  const rows = rateMerchants.map((m) => [
    m.merchantName ?? '',
    m.merchantId ?? '',
    m.appId ?? '',
    m.merchantCategory ?? '',
    m.commission !== undefined && m.commission !== null && m.commission !== '' ? m.commission : '',
    m.issueType ?? '',
    m.reason ?? '',
    m.rateName ?? '',
    m.rateAmount ?? '',
    m.count ?? '',
    m.falseNegative ? 'Yes' : ''
  ]);
  const content = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(','))
  ].join('\n');
  fs.writeFileSync(filepath, content);
  console.log(chalk.green(`📊 Merchant rate CSV saved to: ${filepath}`));
}

/**
 * Export simplified data to JSON. Includes total audited and all audited merchants for lookup.
 */
function exportToJSON(exportData, filepath, report = null) {
  const merchantsWithIssues = [...new Set((exportData || []).map(m => `${m.merchantId}-${m.appId}`))].length;
  const exportObject = {
    exportDate: new Date().toISOString(),
    totalIssues: (exportData || []).length,
    totalMerchantsAudited: report ? report.summary.totalMerchants : null,
    merchantsWithIssues: exportData.length > 0 ? merchantsWithIssues : 0,
    merchants: exportData || [],
    allAuditedMerchants: report ? report.results.flatMap(r => r.allMerchants || []) : []
  };
  if (exportData.length === 0 && !report) {
    console.log(chalk.yellow('⚠️  No data to export'));
    return;
  }
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
 * Save report to file. Optionally fetches commission from BigQuery; CSV includes Commission column and full table.
 */
async function saveReport(report, skipCSVPrompt = false) {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportData = generateSimplifiedExport(report);

  let rateMerchants = buildRateMerchantsForCombinedReport(report, new Set());
  const merchantIds = collectMerchantIdsFromReport(report);
  if (merchantIds.length > 0 && process.stdin.isTTY) {
    const useBq = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.cyan('Fetch commission data from BigQuery? (yes/no): '), (a) => {
        rl.close();
        resolve(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
      });
    });
    if (useBq) {
      console.log(chalk.blue('Running BigQuery for commission data...'));
      const commissionMap = await fetchCommissionFromBigQuery(merchantIds);
      rateMerchants.forEach((m) => { m.commission = commissionMap.get(String(m.merchantId)); });
    }
  }
  rateMerchants.sort((a, b) => {
    const ca = a.commission != null && a.commission !== '' ? Number(a.commission) : -Infinity;
    const cb = b.commission != null && b.commission !== '' ? Number(b.commission) : -Infinity;
    if (cb !== ca) return cb - ca;
    return (b.count || 0) - (a.count || 0);
  });

  const issuesOnly = rateMerchants.filter((m) => m.issueType !== 'None');
  if (issuesOnly.length > 0) {
    let wantsCSV = false;
    if (!skipCSVPrompt && process.stdin.isTTY) {
      wantsCSV = await promptForCSVExport();
    }
    if (wantsCSV) {
      const csvFilename = `merchant-issues-${timestamp}.csv`;
      const csvFilepath = path.join(CONFIG.outputDir, csvFilename);
      writeMerchantRateCSV(issuesOnly, csvFilepath);
      return { csv: csvFilepath };
    }
  }
  return { csv: null };
}

/**
 * Clear all audit results
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
      .filter(file => file.startsWith('merchant-issues-') && (file.endsWith('.json') || file.endsWith('.csv')))
      .map(file => {
        const filepath = path.join(CONFIG.outputDir, file);
        const stats = fs.statSync(filepath);
        const timestamp = file.match(/merchant-issues-(.+)\.(?:json|csv)/)?.[1];
        let date = new Date();
        if (timestamp) {
          const isoString = timestamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d+)Z/, 
            (match, datePart, hour, min, rest) => {
              const sec = rest.substring(0, 2);
              const ms = rest.substring(2);
              return `${datePart}${hour}:${min}:${sec}.${ms}Z`;
            });
          date = new Date(isoString);
          if (isNaN(date.getTime())) date = stats.mtime;
        } else {
          date = stats.mtime;
        }
        try {
          let appIds = [];
          let totalIssues = 0;
          let merchantsWithIssues = 0;
          let totalMerchantsAudited = null;
          if (file.endsWith('.csv')) {
            const data = parseMerchantIssuesCSV(filepath);
            appIds = [...new Set((data.merchants || []).map(m => m.appId).filter(Boolean))];
            totalIssues = data.totalIssues;
            merchantsWithIssues = (data.merchants || []).length;
          } else {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            appIds = [...new Set(data.merchants?.map(m => m.appId) || [])];
            totalIssues = data.totalIssues ?? data.merchants?.length ?? 0;
            merchantsWithIssues = data.merchantsWithIssues ?? data.merchants?.length ?? 0;
            totalMerchantsAudited = data.totalMerchantsAudited ?? null;
          }
          return {
            filename: file,
            filepath: filepath,
            timestamp: timestamp,
            date: date,
            appIds: appIds,
            totalIssues,
            merchantsWithIssues,
            totalMerchantsAudited,
            totalRates: 0,
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
            merchantsWithIssues: 0,
            totalMerchantsAudited: null,
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
    const mwi = audit.merchantsWithIssues ?? audit.totalIssues;
    const auditedStr = audit.totalMerchantsAudited != null
      ? ` | Merchants with issues: ${mwi} | Total audited: ${audit.totalMerchantsAudited}`
      : ` | Merchants with issues: ${mwi}`;
    console.log(`   Issues: ${chalk.yellow(audit.totalIssues)}${auditedStr}${ratesInfo}`);
    console.log(`   File: ${chalk.gray(audit.filename)}`);
    if (audit.error) {
      console.log(chalk.red(`   ⚠️  ${audit.error}`));
    }
  });
  
  console.log(chalk.gray('\n' + '─'.repeat(100)));
}

/**
 * Load offer-activation tested merchant IDs by app ID (from offer-activation-tested-merchants.json).
 * @returns {{ [appId: string]: number[] }}
 */
function loadOfferActivationTestedMerchants() {
  const filepath = path.join(CONFIG.outputDir, 'offer-activation-tested-merchants.json');
  try {
    if (!fs.existsSync(filepath)) return {};
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (_) {
    return {};
  }
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
    const mwi = audit.merchantsWithIssues ?? audit.totalIssues;
    const auditedStr = audit.totalMerchantsAudited != null
      ? ` | Merchants with issues: ${mwi} | Total audited: ${audit.totalMerchantsAudited}`
      : ` | Merchants with issues: ${mwi}`;
    
    console.log(chalk.bold(`\n${index + 1}. ${dateStr}`));
    console.log(`   Matching App IDs: ${chalk.cyan(matchingAppIds.join(', '))}`);
    console.log(`   All App IDs in audit: ${chalk.gray(audit.appIds.join(', '))}`);
    const ratesInfo = audit.totalRates > 0 ? ` | Rates: ${audit.totalRates}` : '';
    console.log(`   Issues: ${chalk.yellow(audit.totalIssues)}${auditedStr}${ratesInfo}`);
    console.log(`   File: ${chalk.gray(audit.filename)}`);
    console.log(`   Full path: ${chalk.gray(audit.filepath)}`);
  });
  
  console.log(chalk.gray('\n' + '─'.repeat(100)));
}

/**
 * Load offer-activation result files (individual runs, not combined) for summary stats.
 */
function loadOfferActivationResultSummary() {
  const entries = [];
  if (!fs.existsSync(CONFIG.outputDir)) return entries;
  const files = fs.readdirSync(CONFIG.outputDir);
  const parseDate = (file) => {
    const m = file.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!m) return new Date(0);
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  };
  for (const file of files) {
    const filepath = path.join(CONFIG.outputDir, file);
    try {
      if (file.startsWith('offer-activation-results-') && file.endsWith('.csv')) {
        const data = parseOfferActivationResultsCSV(filepath);
        const results = data.results || [];
        entries.push({
          filename: file,
          date: parseDate(file),
          totalTested: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        });
      } else if (file.startsWith('offer-activation-') && file.endsWith('.json') && !file.includes('session') && !file.includes('tested-merchants') && !file.includes('combined')) {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        entries.push({
          filename: file,
          date: parseDate(file),
          totalTested: data.totalTested ?? (data.results || []).length,
          successful: data.successful ?? (data.results || []).filter(r => r.success).length,
          failed: data.failed ?? (data.results || []).filter(r => !r.success).length
        });
      }
    } catch (_) {}
  }
  return entries.sort((a, b) => b.date - a.date);
}

/**
 * Print offer-activation tested count and result details for given app IDs.
 */
function displayOfferActivationTestedForAppIds(appIds) {
  const tested = loadOfferActivationTestedMerchants();
  const resultRuns = loadOfferActivationResultSummary();
  if (!appIds || appIds.length === 0) return;
  console.log(chalk.bold.cyan('\n📋 Offer activation — tested list & results\n'));
  for (const appId of appIds) {
    const ids = tested[String(appId)];
    const count = Array.isArray(ids) ? ids.length : 0;
    if (count > 0) {
      console.log(`   App ID ${chalk.cyan(appId)}: ${chalk.green(count)} unique merchant(s) in tested list`);
      console.log(chalk.gray(`      (cumulative — only grows when you save batch results)`));
    } else {
      console.log(`   App ID ${chalk.cyan(appId)}: ${chalk.gray('no merchants in tested list yet')}`);
    }
  }
  if (resultRuns.length > 0) {
    const totalTested = resultRuns.reduce((s, r) => s + (r.totalTested || 0), 0);
    const totalOk = resultRuns.reduce((s, r) => s + (r.successful || 0), 0);
    const totalFail = resultRuns.reduce((s, r) => s + (r.failed || 0), 0);
    console.log(chalk.bold.cyan('\n   From saved result files:'));
    console.log(chalk.gray(`      ${resultRuns.length} run(s) — total tested: ${totalTested}, OK: ${chalk.green(totalOk)}, failed: ${totalFail > 0 ? chalk.red(totalFail) : totalFail}`));
    const latest = resultRuns[0];
    if (latest) {
      const dateStr = latest.date && latest.date.toLocaleString ? latest.date.toLocaleString() : latest.filename;
      console.log(chalk.gray(`      Latest run (${dateStr}): ${latest.totalTested} tested, ${chalk.green(latest.successful)} OK, ${latest.failed > 0 ? chalk.red(latest.failed) : latest.failed} failed`));
    }
    const offerEntries = loadAllResultFiles().filter(e => e.type === 'offer_activation');
    for (const appId of appIds) {
      const failedByMerchantId = new Map();
      for (const e of offerEntries) {
        for (const m of e.merchants || []) {
          if ((m.appId === appId || m.appId === Number(appId)) && !m.success) {
            const key = m.id != null ? String(m.id) : (m.name || '') + (m.domain || '');
            if (!failedByMerchantId.has(key)) {
              failedByMerchantId.set(key, {
                name: m.name,
                id: m.id,
                domain: m.domain,
                error: m.error,
                issues: m.issues,
                file: e.filename,
                date: e.date
              });
            }
          }
        }
      }
      const failedForApp = [...failedByMerchantId.values()];
      if (failedForApp.length > 0) {
        console.log(chalk.bold.red(`\n   Offer activation failures for App ID ${chalk.cyan(appId)}:`));
        failedForApp.forEach((f, i) => {
          console.log(chalk.red(`      ${i + 1}. ${f.name || f.id} (${f.domain || ''})`));
          if (f.error) console.log(chalk.gray(`         ${f.error}`));
          (f.issues || []).forEach(iss => console.log(chalk.yellow(`         • ${iss.message || iss.type}`)));
          console.log(chalk.gray(`         From: ${f.file}`));
        });
      }
    }
  } else {
    console.log(chalk.gray('\n   No offer-activation result files found (save results after a batch to see details).'));
  }
  console.log(chalk.gray('\n' + '─'.repeat(100)) + '\n');
}

/**
 * Load all result files (merchant rate + offer activation) for lookup by merchant name.
 */
function loadAllResultFiles() {
  const entries = [];
  if (!fs.existsSync(CONFIG.outputDir)) return entries;
  const files = fs.readdirSync(CONFIG.outputDir);
  const parseDate = (file) => {
    const m = file.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!m) return new Date(0);
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  };
  for (const file of files) {
    const filepath = path.join(CONFIG.outputDir, file);
    if (file.startsWith('merchant-issues-') && file.endsWith('.csv')) {
      try {
        const data = parseMerchantIssuesCSV(filepath);
        const appIds = [...new Set((data.merchants || []).map(m => m.appId).filter(Boolean))];
        entries.push({
          type: 'merchant_rate',
          filename: file,
          filepath,
          date: parseDate(file),
          appIds,
          totalIssues: data.totalIssues,
          totalMerchantsAudited: null,
          merchants: data.merchants || [],
          allAuditedMerchants: []
        });
      } catch (_) {}
    } else if (file.startsWith('merchant-issues-') && file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const appIds = [...new Set((data.merchants || []).map(m => m.appId).filter(Boolean))];
        entries.push({
          type: 'merchant_rate',
          filename: file,
          filepath,
          date: parseDate(file),
          appIds,
          totalIssues: data.totalIssues,
          totalMerchantsAudited: data.totalMerchantsAudited ?? null,
          merchants: data.merchants || [],
          allAuditedMerchants: data.allAuditedMerchants || []
        });
      } catch (_) {}
    } else if (file.startsWith('offer-activation-results-') && file.endsWith('.csv')) {
      try {
        const data = parseOfferActivationResultsCSV(filepath);
        const results = data.results || [];
        const appIdsFromFile = [...new Set(results.map(r => r.appId).filter(Boolean))];
        entries.push({
          type: 'offer_activation',
          filename: file,
          filepath,
          date: parseDate(file),
          appIds: appIdsFromFile,
          merchants: results.map(r => ({
            ...r,
            appId: r.appId ?? null,
            id: r.merchantId,
            name: r.merchantName,
            domain: r.merchantDomain,
            success: r.success,
            error: r.error,
            issues: r.issues
          })),
          totalTested: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        });
      } catch (_) {}
    } else if (file.startsWith('offer-activation-') && file.endsWith('.json') && !file.includes('session') && !file.includes('tested-merchants') && !file.includes('combined')) {
      try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const results = data.results || [];
        const appIdsFromFile = [...new Set(results.map(r => r.appId).filter(Boolean))];
        entries.push({
          type: 'offer_activation',
          filename: file,
          filepath,
          date: parseDate(file),
          appIds: appIdsFromFile,
          totalTested: data.totalTested,
          successful: data.successful,
          failed: data.failed,
          merchants: results.map(r => ({
            name: r.merchantName,
            id: r.merchantId,
            domain: r.merchantDomain,
            appId: r.appId,
            success: r.success,
            issues: r.issues,
            error: r.error
          }))
        });
      } catch (_) {}
    }
  }
  return entries.sort((a, b) => b.date - a.date);
}

/**
 * Lookup by merchant name: show merchant rate errors, activation issues, and when tested (even if no issues).
 */
function lookupByMerchantName(merchantQuery) {
  const entries = loadAllResultFiles();
  const q = (merchantQuery || '').toLowerCase().trim();
  if (!q) {
    console.log(chalk.yellow('No merchant name entered.'));
    return;
  }
  const rateIssues = [];
  const activationIssues = [];
  const testedNoIssues = [];
  const testedActivationOk = [];
  for (const e of entries) {
    if (e.type === 'merchant_rate') {
      const hasIssues = (e.merchants || []).some(m => (m.merchantName || m.name || '').toLowerCase().includes(q));
      const inAudited = (e.allAuditedMerchants || []).some(m => (m.merchantName || m.name || '').toLowerCase().includes(q));
      if (hasIssues) {
        for (const m of e.merchants || []) {
          if ((m.merchantName || m.name || '').toLowerCase().includes(q)) {
            rateIssues.push({
              merchantName: m.merchantName || m.name,
              merchantId: m.merchantId ?? m.id,
              appId: m.appId,
              issueType: m.issueType,
              reason: m.reason,
              file: e.filename
            });
          }
        }
      }
      if (inAudited && !hasIssues) {
        testedNoIssues.push({ date: e.date, filename: e.filename });
      }
    }
    if (e.type === 'offer_activation' && e.merchants) {
      for (const m of e.merchants) {
        const nameForMatch = (m.name || m.merchantName || '').toLowerCase();
        if (nameForMatch && nameForMatch.includes(q)) {
          if (!m.success) {
            activationIssues.push({
              merchantName: m.name || m.merchantName,
              merchantId: m.id ?? m.merchantId,
              domain: m.domain || m.merchantDomain,
              issues: m.issues,
              error: m.error,
              file: e.filename
            });
          } else {
            testedActivationOk.push({ date: e.date, filename: e.filename });
          }
        }
      }
    }
  }
  console.log(chalk.bold.cyan(`\n🔍 Merchant lookup: "${merchantQuery}"\n`));
  console.log(chalk.gray('─'.repeat(100)));
  if (rateIssues.length > 0) {
    console.log(chalk.bold.red('\n⚠️  Merchant rate issues:'));
    rateIssues.forEach((r, i) => {
      console.log(chalk.red(`  ${i + 1}. ${r.merchantName} (ID ${r.merchantId}, App ${r.appId})`));
      console.log(chalk.gray(`     ${r.reason}`));
      console.log(chalk.gray(`     From: ${r.file}`));
    });
  } else {
    console.log(chalk.green('\n✅ No merchant rate issues found for this merchant.'));
  }
  if (testedNoIssues.length > 0) {
    console.log(chalk.bold.cyan('\n📋 Merchant rate – tested (no issues):'));
    testedNoIssues.forEach((t, i) => {
      const dateStr = t.date && t.date.toLocaleString ? t.date.toLocaleString() : t.filename;
      console.log(chalk.gray(`  ${i + 1}. ${dateStr} — ${t.filename}`));
    });
  }
  if (activationIssues.length > 0) {
    console.log(chalk.bold.red('\n⚠️  Offer activation issues:'));
    activationIssues.forEach((a, i) => {
      console.log(chalk.red(`  ${i + 1}. ${a.merchantName} (${a.domain || a.merchantId})`));
      if (a.error) console.log(chalk.gray(`     ${a.error}`));
      (a.issues || []).forEach(iss => console.log(chalk.yellow(`     • ${iss.message || iss.type}`)));
      console.log(chalk.gray(`     From: ${a.file}`));
    });
  } else {
    console.log(chalk.green('\n✅ No offer activation failures found for this merchant.'));
  }
  if (testedActivationOk.length > 0) {
    console.log(chalk.bold.cyan('\n📋 Offer activation – tested (OK):'));
    testedActivationOk.forEach((t, i) => {
      const dateStr = t.date && t.date.toLocaleString ? t.date.toLocaleString() : t.filename;
      console.log(chalk.gray(`  ${i + 1}. ${dateStr} — ${t.filename}`));
    });
  }
  console.log(chalk.gray('\n' + '─'.repeat(100)) + '\n');
}

/**
 * Run lookup menu: by App ID (with offer-activation tested info) or by merchant name.
 */
async function runLookupMenu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(chalk.cyan(q), (a) => res((a || '').trim())));
  console.log(chalk.bold.cyan('\n🔍 Lookup Results\n'));
  const which = await ask('Lookup by: 1) App ID  2) Merchant name (1 or 2): ');
  if (which === '2') {
    const name = await ask('Merchant name (partial match): ');
    rl.close();
    const trimmed = (name || '').trim();
    if (/^\d+$/.test(trimmed)) {
      console.log(chalk.yellow(`\n   You entered a number. To see results for App ID ${trimmed} (including offer activation failures), using App ID lookup.\n`));
      const asAppId = parseInt(trimmed, 10);
      if (!isNaN(asAppId) && asAppId > 0) {
        displayLookupResults([asAppId]);
        displayOfferActivationTestedForAppIds([asAppId]);
        return;
      }
    }
    lookupByMerchantName(name);
    return;
  }
  if (which !== '1') {
    rl.close();
    return;
  }
  const appIdStr = await ask('App ID(s), comma or space separated: ');
  rl.close();
  const lookupAppIds = appIdStr.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  if (lookupAppIds.length === 0) {
    console.log(chalk.red('No valid App IDs provided.'));
    return;
  }
  const matchingAudits = lookupAuditsByAppId(lookupAppIds);
  displayLookupResults(matchingAudits, lookupAppIds);
  displayOfferActivationTestedForAppIds(lookupAppIds);
}

/**
 * Delete result files that contain a given App ID (in content or filename).
 */
async function deleteFilesByAppId(outDir) {
  if (!fs.existsSync(outDir)) {
    console.log(chalk.gray('No audit results folder found.'));
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(chalk.cyan(q), (a) => res((a || '').trim())));
  const appIdStr = await ask('App ID to match (files containing this App ID will be listed for deletion): ');
  rl.close();
  const appId = appIdStr.replace(/\D/g, '');
  if (!appId) {
    console.log(chalk.yellow('No App ID entered.'));
    return;
  }
  const files = fs.readdirSync(outDir).filter((f) => {
    if (f.includes('session') || f.includes('tested-merchants')) return false;
    const lower = f.toLowerCase();
    if (lower.endsWith('.json') || lower.endsWith('.csv')) {
      return (
        f.startsWith('merchant-issues-') ||
        f.startsWith('offer-activation-results-') ||
        f.startsWith('offer-activation-combined-') ||
        f.startsWith('full-audit-combined-') ||
        f.startsWith('full-report-combined-') ||
        f.startsWith('merchant-rate-combined-')
      );
    }
    return false;
  });
  const matching = [];
  for (const f of files) {
    const filepath = path.join(outDir, f);
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const hasAppId =
        content.includes('"appId":' + appId) ||
        content.includes('"appId": ' + appId) ||
        content.includes('"appIds":[' + appId) ||
        content.includes('"appIds": [' + appId) ||
        content.includes(',' + appId + ',');
      if (hasAppId) matching.push(f);
    } catch (_) {}
  }
  if (matching.length === 0) {
    console.log(chalk.gray(`No result files found containing App ID ${appId}.`));
    return;
  }
  console.log(chalk.yellow(`\nFiles containing App ID ${appId}:\n`));
  matching.forEach((f) => console.log(chalk.gray('  ' + f)));
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await new Promise((res) => {
    rl2.question(chalk.cyan('\nDelete these files? (yes/no): '), (a) => {
      rl2.close();
      res(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
    });
  });
  if (!confirm) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }
  let deleted = 0;
  for (const f of matching) {
    try {
      fs.unlinkSync(path.join(outDir, f));
      console.log(chalk.green('  Deleted: ' + f));
      deleted++;
    } catch (e) {
      console.log(chalk.red('  Failed to delete ' + f + ': ' + e.message));
    }
  }
  console.log(chalk.green(`\nDeleted ${deleted} file(s).`));
}

/**
 * Delete all result files in the output directory (keeps session and tested-merchants).
 */
async function deleteAllResultFiles(outDir) {
  if (!fs.existsSync(outDir)) {
    console.log(chalk.gray('No audit results folder found.'));
    return;
  }
  const files = fs.readdirSync(outDir).filter((f) => {
    if (f.includes('session') || f.includes('tested-merchants')) return false;
    const lower = f.toLowerCase();
    if (lower.endsWith('.json') || lower.endsWith('.csv') || lower.endsWith('.xlsx')) {
      return (
        f.startsWith('merchant-issues-') ||
        f.startsWith('offer-activation-results-') ||
        f.startsWith('offer-activation-combined-') ||
        f.startsWith('offer-activation-interrupted-') ||
        f.startsWith('full-audit-combined-') ||
        f.startsWith('full-report-combined-') ||
        f.startsWith('merchant-rate-combined-') ||
        (f.startsWith('offer-activation-') && (lower.endsWith('.json') || lower.endsWith('.csv')))
      );
    }
    return false;
  });
  if (files.length === 0) {
    console.log(chalk.gray('No result files to delete.'));
    return;
  }
  console.log(chalk.yellow(`\nThis will delete ${files.length} result file(s). Session and tested-merchants list will be kept.\n`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await new Promise((res) => {
    rl.question(chalk.cyan('Delete all result files? (yes/no): '), (a) => {
      rl.close();
      res(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
    });
  });
  if (!confirm) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }
  let deleted = 0;
  for (const f of files) {
    try {
      fs.unlinkSync(path.join(outDir, f));
      console.log(chalk.green('  Deleted: ' + f));
      deleted++;
    } catch (e) {
      console.log(chalk.red('  Failed to delete ' + f + ': ' + e.message));
    }
  }
  console.log(chalk.green(`\nDeleted ${deleted} file(s).`));
}

/**
 * File manager: combine offer activation, merchant rate, or both; delete by App ID; or delete all results.
 */
async function runFileManagerMenu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(chalk.cyan(q), (a) => res((a || '').trim())));
  console.log(chalk.bold.cyan('\n📁 File Manager\n'));
  const choice = await ask('1) Combine offer activation  2) Combine merchant rate  3) Both into one report  4) Delete files that contain an App ID  5) Delete all results  6) Combine full audits  7) Back to main menu (1-7): ');
  rl.close();
  if (choice === '7') {
    return;
  }
  const outDir = CONFIG.outputDir;
  if (choice === '4') {
    await deleteFilesByAppId(outDir);
    return;
  }
  if (choice === '5') {
    await deleteAllResultFiles(outDir);
    return;
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  async function askDeleteCombinedSources(filesToDelete) {
    if (!filesToDelete || filesToDelete.length === 0) return;
    const delRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const yes = await new Promise((res) => {
      delRl.question(chalk.cyan('Delete the individual files that were combined? (yes/no): '), (a) => {
        delRl.close();
        res(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
      });
    });
    if (yes) {
      for (const f of filesToDelete) {
        try {
          const fp = typeof f === 'string' && !path.isAbsolute(f) ? path.join(outDir, f) : f;
          if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log(chalk.green('  Deleted: ' + (typeof f === 'string' ? f : path.basename(f)))); }
        } catch (e) { console.log(chalk.red('  Failed to delete: ' + (e.message || e))); }
      }
    }
  }

  if (choice === '1') {
    const entries = loadAllResultFiles().filter(e => e.type === 'offer_activation');
    if (entries.length === 0) {
      console.log(chalk.yellow('No offer activation result files found.'));
      return;
    }
    const allResults = [];
    for (const e of entries) {
      (e.merchants || []).forEach((m) => {
        allResults.push({
          merchantName: m.merchantName || m.name,
          merchantId: m.merchantId ?? m.id,
          merchantDomain: m.merchantDomain || m.domain,
          success: m.success,
          falseNegative: m.falseNegative,
          testUrl: m.testUrl,
          finalUrl: m.finalUrl,
          redirectCount: m.redirectCount,
          issues: m.issues,
          error: m.error
        });
      });
    }
    if (allResults.length > 0) {
      offerActivation.exportResultsToCSV(allResults, `offer-activation-combined-${ts}.csv`);
      console.log(chalk.green(`Combined ${entries.length} file(s) → offer-activation-combined-${ts}.csv`));
      await askDeleteCombinedSources(entries.map((e) => e.filepath));
    }
    return;
  }
  if (choice === '2') {
    const files = fs.readdirSync(outDir).filter(f => f.startsWith('merchant-issues-') && (f.endsWith('.csv') || f.endsWith('.json')));
    if (files.length === 0) {
      console.log(chalk.yellow('No merchant rate result files found.'));
      return;
    }
    const merchantMap = new Map();
    const appIdSet = new Set();
    for (const file of files) {
      try {
        const filepath = path.join(outDir, file);
        const data = file.endsWith('.csv') ? parseMerchantIssuesCSV(filepath) : JSON.parse(fs.readFileSync(filepath, 'utf8'));
        (data.merchants || []).forEach(m => {
          appIdSet.add(m.appId);
          const key = `${m.merchantId}-${m.appId}-${m.issueType}-${(m.rateName || m.reason || '').toString().slice(0, 200)}`;
          if (merchantMap.has(key)) {
            const existing = merchantMap.get(key);
            existing.count = (existing.count || 0) + (m.count || 1);
          } else {
            merchantMap.set(key, { ...m });
          }
        });
      } catch (_) {}
    }
    const allMerchants = Array.from(merchantMap.values());
    if (allMerchants.length > 0) {
      const fCsv = path.join(outDir, `merchant-rate-combined-${ts}.csv`);
      exportToCSV(allMerchants, fCsv);
      console.log(chalk.green(`Combined ${files.length} file(s) → ${fCsv}`));
      await askDeleteCombinedSources(files);
    }
    return;
  }
  if (choice === '3') {
    const entries = loadAllResultFiles();
    const rateMerchantsList = [];
    const appIdSet = new Set();
    const activationResults = [];
    const sourceDates = [...new Set(entries.map((e) => e.filename || e.date?.toISOString?.()?.slice(0, 10) || '').filter(Boolean))];
    const dateLabel = (e) => e.filename || e.date?.toISOString?.()?.slice(0, 10) || '';
    for (const e of entries) {
      if (e.type === 'merchant_rate') {
        (e.merchants || []).forEach(m => {
          appIdSet.add(m.appId);
          const d = dateLabel(e);
          rateMerchantsList.push({ ...m, dateTested: d });
        });
      } else if (e.type === 'offer_activation' && (e.merchants || []).length > 0) {
        const d = dateLabel(e);
        (e.merchants || []).forEach((m) => {
          activationResults.push({
            merchantName: m.merchantName || m.name,
            merchantId: m.merchantId ?? m.id,
            appId: m.appId,
            dateTested: d,
            merchantDomain: m.merchantDomain || m.domain,
            success: m.success,
            falseNegative: m.falseNegative,
            testUrl: m.testUrl,
            finalUrl: m.finalUrl,
            redirectCount: m.redirectCount,
            issues: m.issues,
            error: m.error
          });
        });
      }
    }
    const fCsv = path.join(outDir, `full-report-combined-${ts}.csv`);
    writeFullReportCombinedCSV(rateMerchantsList, activationResults, fCsv, { sourceDates });
    console.log(chalk.green(`Combined report → ${fCsv} (+ XLSX)`));
    await askDeleteCombinedSources(entries.map((e) => e.filepath));
    return;
  }
  if (choice === '6') {
    const xlsxFiles = fs.readdirSync(outDir).filter(f => f.startsWith('full-audit-combined-') && f.endsWith('.xlsx'));
    if (xlsxFiles.length === 0) {
      console.log(chalk.yellow('No full-audit XLSX files found (full-audit-combined-*.xlsx).'));
      return;
    }
    try {
      const XLSX = require('xlsx');
      const allRate = [];
      const allActivation = [];
      const sourceDates = [];
      const rateHeaders = ['Merchant Name', 'Merchant ID', 'App ID', 'Merchant Category', 'Commission', 'Issue Type', 'Reason or Message', 'Rate Name', 'Rate Amount', 'Count', 'False Negative'];
      const activationHeaders = ['Merchant Name', 'Merchant ID', 'App ID', 'Domain', 'Success', 'False Negative', 'Needs Investigation', 'Test URL', 'Final URL', 'Redirect Path', 'Redirect Count', 'Issue Type', 'Issue Message'];
      for (const file of xlsxFiles) {
        const filepath = path.join(outDir, file);
        const wb = XLSX.readFile(filepath);
        const dateFromName = file.replace(/^full-audit-combined-|\.xlsx$/gi, '').replace(/T\d{2}-\d{2}-\d{2}.*$/i, '').slice(0, 10) || file;
        sourceDates.push(dateFromName);
        const sheetNames = wb.SheetNames || [];
        const rateSheet = sheetNames.find(n => /merchant\s*rate/i.test(n));
        const actSheet = sheetNames.find(n => /offer\s*activation/i.test(n));
        if (rateSheet) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[rateSheet], { header: 1, defval: '' });
          const headerRowIdx = aoa.findIndex(row => row && row[0] === 'Merchant Name');
          const dataStart = headerRowIdx >= 0 ? headerRowIdx + 1 : (aoa[0] && aoa[0][0] === 'Merchant Name' ? 1 : 3);
          const headers = headerRowIdx >= 0 ? aoa[headerRowIdx] : rateHeaders;
          for (let i = dataStart; i < aoa.length; i++) {
            const row = aoa[i];
            if (!row || !row.some(c => c !== undefined && c !== null && c !== '')) continue;
            const obj = {};
            headers.forEach((h, j) => { obj[h] = row[j]; });
            allRate.push({
              merchantName: obj['Merchant Name'],
              dateTested: dateFromName,
              merchantId: obj['Merchant ID'],
              appId: obj['App ID'],
              merchantCategory: obj['Merchant Category'],
              commission: obj['Commission'],
              issueType: obj['Issue Type'],
              reason: obj['Reason or Message'],
              rateName: obj['Rate Name'],
              rateAmount: obj['Rate Amount'],
              count: obj['Count'],
              falseNegative: /yes/i.test(String(obj['False Negative'] || ''))
            });
          }
        }
        if (actSheet) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[actSheet], { header: 1, defval: '' });
          const headerRowIdx = aoa.findIndex(row => row && row[0] === 'Merchant Name');
          const dataStart = headerRowIdx >= 0 ? headerRowIdx + 1 : 3;
          const headers = headerRowIdx >= 0 ? aoa[headerRowIdx] : activationHeaders;
          for (let i = dataStart; i < aoa.length; i++) {
            const row = aoa[i];
            if (!row || !row.some(c => c !== undefined && c !== null && c !== '')) continue;
            const obj = {};
            headers.forEach((h, j) => { obj[h] = row[j]; });
            allActivation.push({
              merchantName: obj['Merchant Name'],
              dateTested: dateFromName,
              merchantId: obj['Merchant ID'],
              appId: obj['App ID'],
              merchantDomain: obj['Domain'],
              success: /yes/i.test(String(obj['Success'] || '')),
              falseNegative: /yes/i.test(String(obj['False Negative'] || '')),
              needsInvestigation: /yes/i.test(String(obj['Needs Investigation'] || '')),
              testUrl: obj['Test URL'],
              finalUrl: obj['Final URL'],
              redirectCount: obj['Redirect Count'],
              error: obj['Issue Message']
            });
          }
        }
      }
      const fXlsx = path.join(outDir, `full-audit-combined-${ts}.xlsx`);
      writeFullReportCombinedCSV(allRate, allActivation, fXlsx, { sourceDates });
      console.log(chalk.green(`Combined ${xlsxFiles.length} full-audit file(s) → ${fXlsx}`));
      await askDeleteCombinedSources(xlsxFiles);
    } catch (err) {
      console.log(chalk.red('Failed to combine full audits: ' + (err.message || err)));
    }
    return;
  }
  console.log(chalk.gray('Cancelled.'));
}

/** Shuffle array in place and return it (Fisher–Yates). */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Prompt to mark failed activation merchants as "needs investigation". Always shown; if no failed merchants, shows a short message.
 * Sets needsInvestigation = true on selected results; used in full-audit Excel output.
 */
async function promptAndMarkNeedsInvestigation(activationResults) {
  const failed = (activationResults || []).filter((r) => !r.success);
  if (!process.stdin.isTTY) return;
  if (failed.length === 0) {
    console.log(chalk.gray('\nNo failed merchants to mark for further investigation.\n'));
    return;
  }
  console.log(chalk.yellow('\nFailed merchants (candidates for further investigation):\n'));
  failed.forEach((r, i) => {
    console.log(chalk.gray(`  ${i + 1}. ID ${r.merchantId} — ${r.merchantName || '(no name)'}`));
  });
  console.log('');
  const wantMark = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Mark any of these for further investigation? (yes/no): '), (a) => {
      rl.close();
      resolve(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
    });
  });
  if (!wantMark) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(chalk.cyan('Enter the numbers to mark (e.g. 1, 3, 5 or "all"): '), (a) => {
      rl.close();
      resolve((a && a.trim()) || '');
    });
  });
  const numbers = (answer.trim().toLowerCase() === 'all')
    ? Array.from({ length: failed.length }, (_, i) => i + 1)
    : answer.split(/[,\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= failed.length);
  if (numbers.length === 0) return;
  const indexSet = new Set(numbers);
  let marked = 0;
  failed.forEach((r, i) => {
    if (indexSet.has(i + 1)) {
      r.needsInvestigation = true;
      marked++;
    }
  });
  console.log(chalk.green(`Marked ${marked} merchant(s) for further investigation.\n`));
}

let fullAuditRecoveryState = null;
let fullAuditRecoveryListenersAttached = false;

function writeFullAuditRecoveryFile() {
  if (!fullAuditRecoveryState) return;
  const state = fullAuditRecoveryState;
  const hasReport = state.report && (state.report.results || []).length > 0;
  const hasActivation = (state.activationResults || []).length > 0;
  if (!hasReport && !hasActivation) return;
  try {
    const outDir = CONFIG.outputDir;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dateTested = new Date().toISOString().slice(0, 10);
    let rateMerchants = [];
    if (hasReport) {
      rateMerchants = buildRateMerchantsForCombinedReport(state.report, state.rateFalseNegativeKeys || new Set());
      rateMerchants = rateMerchants.filter((m) => m.issueType != null && String(m.issueType).trim() !== '' && String(m.issueType) !== 'None');
      rateMerchants.forEach((m) => {
        m.commission = (state.commissionMap && state.commissionMap.get) ? state.commissionMap.get(String(m.merchantId)) : undefined;
        m.dateTested = m.dateTested || dateTested;
      });
      rateMerchants.sort((a, b) => {
        const ca = a.commission != null && a.commission !== '' ? Number(a.commission) : -Infinity;
        const cb = b.commission != null && b.commission !== '' ? Number(b.commission) : -Infinity;
        if (cb !== ca) return cb - ca;
        return (b.count || 0) - (a.count || 0);
      });
    }
    const activationResults = (state.activationResults || []).map((r) => ({ ...r, dateTested: r.dateTested || dateTested }));
    const baseName = `full-audit-recovery-${ts}`;
    const fXlsx = path.join(outDir, `${baseName}.xlsx`);
    writeFullReportCombinedCSV(rateMerchants, activationResults, fXlsx);
    console.error(chalk.yellow(`\n⚠️  Full audit ended unexpectedly. Recovery file saved: ${fXlsx}\n`));
  } catch (err) {
    console.error(chalk.red('Failed to write recovery file: ' + (err && err.message ? err.message : String(err))));
  }
}

function removeFullAuditRecoveryListeners() {
  if (!fullAuditRecoveryListenersAttached) return;
  fullAuditRecoveryListenersAttached = false;
  process.removeListener('uncaughtException', fullAuditRecoveryOnExit);
  process.removeListener('unhandledRejection', fullAuditRecoveryOnExit);
  process.removeListener('SIGINT', fullAuditRecoveryOnSignal);
  process.removeListener('SIGTERM', fullAuditRecoveryOnSignal);
}

function fullAuditRecoveryOnExit() {
  writeFullAuditRecoveryFile();
  removeFullAuditRecoveryListeners();
  fullAuditRecoveryState = null;
  process.exit(1);
}

function fullAuditRecoveryOnSignal() {
  writeFullAuditRecoveryFile();
  removeFullAuditRecoveryListeners();
  fullAuditRecoveryState = null;
  process.exit(130);
}

/**
 * Run full audit: merchant rate then offer activation; at end show merchants with both failures as "multiple issues".
 * Prompts for App IDs, then max merchants per App ID (blank = all). Same merchant set is used for Part 1 and Part 2.
 * Does not save Part 1 alone; saves one combined Excel (XLSX) at the end if user confirms.
 * On abrupt exit (crash, SIGINT, SIGTERM), a recovery file is written to audit-results/full-audit-recovery-{timestamp}.xlsx.
 */
async function runFullAudit() {
  const appIds = await promptForAppIds();
  if (!appIds || appIds.length === 0) return;

  fullAuditRecoveryState = {
    report: null,
    activationResults: [],
    rateFalseNegativeKeys: new Set(),
    commissionMap: new Map()
  };
  if (!fullAuditRecoveryListenersAttached) {
    fullAuditRecoveryListenersAttached = true;
    process.on('uncaughtException', fullAuditRecoveryOnExit);
    process.on('unhandledRejection', fullAuditRecoveryOnExit);
    process.on('SIGINT', fullAuditRecoveryOnSignal);
    process.on('SIGTERM', fullAuditRecoveryOnSignal);
  }
  console.log(chalk.cyan('Merchants already tested (offer activation) per App ID:'));
  for (const appId of appIds) {
    const testedSet = offerActivation.loadTestedMerchants(appId);
    console.log(chalk.cyan(`  App ID ${appId}: ${testedSet.size} merchant(s) already tested`));
  }
  console.log('');
  const specificNamesAnswer = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Are you testing specific merchant names? (yes/no): '), (a) => {
      rl.close();
      resolve(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
    });
  });
  let maxMerchants = null;
  let useSpecificMerchants = false;
  let nameSet = null; // set of lowercased merchant names to match
  if (specificNamesAnswer) {
    const namesInput = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.cyan('Enter merchant names (comma-separated): '), (a) => {
        rl.close();
        resolve((a && a.trim()) || '');
      });
    });
    const names = namesInput.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.toLowerCase());
    useSpecificMerchants = names.length > 0;
    if (useSpecificMerchants) nameSet = new Set(names);
    if (useSpecificMerchants) {
      console.log(chalk.gray(`Testing only merchants matching: ${names.join(', ')}\n`));
    }
  } else {
    const maxAnswer = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.cyan('Max merchants to test per App ID (blank = all): '), (a) => {
        rl.close();
        resolve((a && a.trim()) || '');
      });
    });
    maxMerchants = maxAnswer === '' ? null : (parseInt(maxAnswer, 10) || null);
    if (maxMerchants != null) {
      console.log(chalk.gray(`Limiting to ${maxMerchants} merchants per App ID.\n`));
    } else {
      console.log(chalk.gray('No limit; testing all merchants per App ID.\n'));
    }
  }
  console.log(chalk.cyan(`Auditing App IDs: ${appIds.join(', ')}\n`));
  console.log(chalk.bold.cyan('——— Part 1: Merchant Rate Audit ———\n'));
  const merchantsByAppId = {};
  for (const appId of appIds) {
    const raw = await offerActivation.fetchMerchantData(appId);
    let withUrl = (raw || []).filter(m => m.URL || m.Domain);
    if (useSpecificMerchants && nameSet) {
      withUrl = withUrl.filter((m) => nameSet.has((m.Name || '').trim().toLowerCase()));
    } else if (maxMerchants != null) {
      withUrl = shuffleArray(withUrl).slice(0, maxMerchants);
    }
    merchantsByAppId[appId] = withUrl;
  }
  console.log(chalk.cyan('Merchants to test per App ID:'));
  for (const appId of appIds) {
    const n = (merchantsByAppId[appId] || []).length;
    console.log(chalk.cyan(`  App ID ${appId}: ${n} merchant(s)`));
  }
  let totalToTest = 0;
  let alreadyTestedInList = 0;
  for (const appId of appIds) {
    const list = merchantsByAppId[appId] || [];
    totalToTest += list.length;
    const testedSet = offerActivation.loadTestedMerchants(appId);
    list.forEach((m) => { if (testedSet.has(Number(m.ID))) alreadyTestedInList++; });
  }
  if (alreadyTestedInList > 0 && totalToTest > 0 && process.stdin.isTTY) {
    console.log(chalk.yellow(`\n  ${alreadyTestedInList} of ${totalToTest} merchants were already tested (offer activation).`));
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
      console.log(chalk.gray('Full audit cancelled.\n'));
      fullAuditRecoveryState = null;
      removeFullAuditRecoveryListeners();
      return;
    }
    if (action === 'skip') {
      for (const appId of appIds) {
        const testedSet = offerActivation.loadTestedMerchants(appId);
        merchantsByAppId[appId] = (merchantsByAppId[appId] || []).filter((m) => !testedSet.has(Number(m.ID)));
      }
      const newTotal = appIds.reduce((sum, appId) => sum + (merchantsByAppId[appId] || []).length, 0);
      if (newTotal === 0) {
        console.log(chalk.yellow('No untested merchants left. Full audit cancelled.\n'));
        fullAuditRecoveryState = null;
        removeFullAuditRecoveryListeners();
        return;
      }
      console.log(chalk.gray(`  Testing ${newTotal} untested merchant(s) only.\n`));
    } else {
      console.log(chalk.gray('  Testing all selected merchants again.\n'));
    }
  }
  console.log('');
  const results = [];
  for (const appId of appIds) {
    const merchantIds = (merchantsByAppId[appId] || []).map(m => m.ID);
    const result = await auditAppId(appId, merchantIds.length > 0 ? { limitToMerchantIds: merchantIds } : {});
    results.push(result);
  }
  const report = generateReport(results);
  if (fullAuditRecoveryState) {
    fullAuditRecoveryState.report = report;
  }
  printResults(report);
  let rateFalseNegativeKeys = new Set();
  if (report.summary && report.summary.totalIssues > 0) {
    rateFalseNegativeKeys = await promptAndMarkRateFalseNegatives(report);
  }
  if (fullAuditRecoveryState) fullAuditRecoveryState.rateFalseNegativeKeys = rateFalseNegativeKeys;
  let fullAuditCommissionMap = new Map();
  const merchantIdsForBq = collectMerchantIdsFromReport(report);
  if (merchantIdsForBq.length > 0 && process.stdin.isTTY) {
    const useBq = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.cyan('Fetch commission data from BigQuery? (yes/no): '), (a) => {
        rl.close();
        resolve(!!(a && (a.toLowerCase().trim() === 'yes' || a.toLowerCase().trim() === 'y')));
      });
    });
    if (useBq) {
      console.log(chalk.blue('Running BigQuery for commission data...'));
      fullAuditCommissionMap = await fetchCommissionFromBigQuery(merchantIdsForBq);
    }
  }
  // Do NOT save Part 1 here; save combined at the end.
  console.log(chalk.bold.cyan('\n——— Part 2: Offer Activation ———\n'));
  const runOffer = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('Run offer activation for these App IDs? (yes/no): '), (answer) => {
      rl.close();
      resolve(!!(answer && (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')));
    });
  });
  let activationResults = [];
  let byAppId = {};
  if (runOffer) {
    const batch = await offerActivation.runOfferActivationBatchForAppIds(appIds, { merchantsByAppId });
    activationResults = batch.results || [];
    byAppId = batch.byAppId || {};
    if (fullAuditRecoveryState) fullAuditRecoveryState.activationResults = activationResults;
  } else {
    console.log(chalk.gray('Skipping offer activation.'));
  }
  const rateIssueByMerchant = new Map();
  (report.results || []).forEach(appResult => {
    (appResult.issues || []).forEach(issueGroup => {
      if (issueGroup.merchantId) rateIssueByMerchant.set(String(issueGroup.merchantId), issueGroup);
    });
  });
  if (activationResults.length > 0) {
    const multipleIssues = activationResults.filter(r => !r.success && rateIssueByMerchant.has(String(r.merchantId)));
    if (multipleIssues.length > 0) {
      console.log(chalk.bold.red('\n⚠️  Merchants with MULTIPLE ISSUES (rate + activation failure):\n'));
      multipleIssues.forEach((m, i) => {
        const rateInfo = rateIssueByMerchant.get(String(m.merchantId));
        console.log(chalk.red(`  ${i + 1}. ${m.merchantName || m.merchantId} (ID ${m.merchantId})`));
        if (rateInfo) console.log(chalk.yellow(`     Rate issues: ${(rateInfo.issues || []).length} issue(s)`));
        console.log(chalk.yellow(`     Activation: failed`));
        if (m.error) console.log(chalk.gray(`     ${m.error}`));
      });
      console.log(chalk.gray('─'.repeat(100)) + '\n');
    }
    offerActivation.printResultsSummary(activationResults);
    await offerActivation.promptAndMarkFalseNegatives(activationResults);
    await promptAndMarkNeedsInvestigation(activationResults);
  }
  if (process.stdin.isTTY) {
    const commissionChoice = await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.cyan('Add commission data for the report? (1=BigQuery, 2=CSV path, Enter=skip): '), (a) => {
        rl.close();
        resolve((a && a.trim()) || '');
      });
    });
    const choice = commissionChoice.trim();
    if (choice === '1') {
      const ids = collectMerchantIdsFromReport(report);
      (activationResults || []).forEach((r) => { if (r.merchantId != null) ids.push(r.merchantId); });
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length > 0) {
        console.log(chalk.blue('Running BigQuery for commission data...'));
        fullAuditCommissionMap = await fetchCommissionFromBigQuery(uniqueIds);
      }
    } else if (choice === '2') {
      const csvPathAnswer = await new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(chalk.cyan('Path to commission data CSV: '), (a) => {
          rl.close();
          resolve((a && a.trim()) || '');
        });
      });
      if (csvPathAnswer) fullAuditCommissionMap = loadCommissionDataFromCSV(csvPathAnswer);
    }
    if (fullAuditRecoveryState) fullAuditRecoveryState.commissionMap = fullAuditCommissionMap;
  }
  const saveRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const saveAnswer = await new Promise((resolve) => {
    saveRl.question(chalk.cyan('Save full audit results (Excel)? (yes/no): '), (answer) => {
      saveRl.close();
      resolve(!!(answer && (answer.toLowerCase().trim() === 'yes' || answer.toLowerCase().trim() === 'y')));
    });
  });
  if (saveAnswer) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outDir = CONFIG.outputDir;
    let commissionMap = fullAuditCommissionMap;
    if (commissionMap.size === 0) {
      const commissionPathAnswer = await new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(chalk.cyan('Path to commission data CSV (optional): '), (a) => {
          rl.close();
          resolve((a && a.trim()) || '');
        });
      });
      commissionMap = loadCommissionDataFromCSV(commissionPathAnswer.trim());
    }
    let rateMerchants = buildRateMerchantsForCombinedReport(report, rateFalseNegativeKeys);
    rateMerchants = rateMerchants.filter((m) => m.issueType !== 'None');
    rateMerchants.forEach((m) => {
      m.commission = commissionMap.get(String(m.merchantId));
    });
    rateMerchants.sort((a, b) => {
      const ca = a.commission != null && a.commission !== '' ? Number(a.commission) : -Infinity;
      const cb = b.commission != null && b.commission !== '' ? Number(b.commission) : -Infinity;
      if (cb !== ca) return cb - ca;
      return (b.count || 0) - (a.count || 0);
    });
    const dateTested = new Date().toISOString().slice(0, 10);
    rateMerchants.forEach((m) => { m.dateTested = m.dateTested || dateTested; });
    activationResults.forEach((r) => { r.dateTested = r.dateTested || dateTested; });
    const fXlsx = path.join(outDir, `full-audit-combined-${ts}.xlsx`);
    writeFullReportCombinedCSV(rateMerchants, activationResults, fXlsx);
    console.log(chalk.green(`Full audit report → ${fXlsx}`));
      if (activationResults.length > 0 && byAppId) {
      for (const [appIdStr, list] of Object.entries(byAppId)) {
        const ids = (list || []).map(r => r.merchantId).filter(id => id != null);
        if (ids.length > 0) offerActivation.markMerchantsAsTested(Number(appIdStr), ids);
      }
      console.log(chalk.gray('Merchants marked as tested for offer activation.\n'));
    }
  }
  if (fullAuditRecoveryState) {
    fullAuditRecoveryState.commissionMap = fullAuditCommissionMap;
  }
  fullAuditRecoveryState = null;
  removeFullAuditRecoveryListeners();
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
 * Commissions menu: look up overall commission by merchant name or ID (CSV or BigQuery).
 */
async function runCommissionsMenu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(chalk.cyan(q), (a) => res((a || '').trim())));
  console.log(chalk.bold.cyan('\n💰 Commission Lookup\n'));
  const input = await ask('Merchant name or ID (partial match for name): ');
  rl.close();
  if (!input) {
    console.log(chalk.yellow('No input entered.'));
    return;
  }
  const isNumeric = /^[\d,\s]+$/.test(input);
  let merchants = [];
  if (isNumeric) {
    const ids = input.split(/[,\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) {
      console.log(chalk.yellow('No valid merchant ID(s) entered.'));
      return;
    }
    merchants = ids.map((id) => ({ merchantId: String(id), merchantName: '' }));
  } else {
    const appIdStr = await new Promise((res) => {
      const r = readline.createInterface({ input: process.stdin, output: process.stdout });
      r.question(chalk.cyan('App ID(s) to search in (comma-separated): '), (a) => {
        r.close();
        res((a || '').trim());
      });
    });
    const appIds = appIdStr.split(/[,\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    if (appIds.length === 0) {
      console.log(chalk.yellow('No valid App ID(s).'));
      return;
    }
    const q = input.toLowerCase();
    const seen = new Set();
    for (const appId of appIds) {
      try {
        const raw = await offerActivation.fetchMerchantData(appId);
        (raw || []).forEach((m) => {
          const name = (m.Name || '').trim();
          if (name.toLowerCase().includes(q) && !seen.has(m.ID)) {
            seen.add(m.ID);
            merchants.push({ merchantId: String(m.ID), merchantName: name });
          }
        });
      } catch (_) {}
    }
    if (merchants.length === 0) {
      console.log(chalk.yellow(`No merchants found matching "${input}" in the given App ID(s).`));
      return;
    }
  }
  const sourceRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const source = await new Promise((res) => {
    sourceRl.question(chalk.cyan('Get commission from: 1) CSV file path  2) BigQuery (1 or 2): '), (a) => {
      sourceRl.close();
      res((a || '').trim());
    });
  });
  const merchantIds = merchants.map((m) => Number(m.merchantId)).filter((n) => !isNaN(n) && n > 0);
  if (source === '2') {
    console.log(chalk.blue('Fetching from BigQuery...'));
    const rows = await fetchCommissionWithNamesFromBigQuery(merchantIds);
    console.log(chalk.bold.cyan('\n📊 Commission results\n'));
    console.log(chalk.gray('─'.repeat(60)));
    if (rows.length === 0) {
      console.log(chalk.yellow('No commission data found for these merchants.'));
    } else {
      rows.forEach((r, i) => {
        const name = (r.merchantName || '').trim() || `(ID ${r.merchantId})`;
        const comm = typeof r.commission === 'number' && !isNaN(r.commission) ? r.commission.toLocaleString() : '—';
        console.log(chalk.white(`  ${i + 1}. ${name}`));
        console.log(chalk.gray(`     Merchant ID: ${r.merchantId}  |  Total commission: ${comm}`));
      });
    }
    console.log(chalk.gray('─'.repeat(60)) + '\n');
    return;
  }
  if (source !== '1') {
    console.log(chalk.yellow('Invalid choice.'));
    return;
  }
  const pathRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const csvPath = await new Promise((res) => {
    pathRl.question(chalk.cyan('Path to commission CSV: '), (a) => {
      pathRl.close();
      res((a || '').trim());
    });
  });
  const commissionMap = loadCommissionDataFromCSV(csvPath);
  if (commissionMap.size === 0 && csvPath) {
    console.log(chalk.yellow('Could not load commission data from that file.'));
    return;
  }
  if (commissionMap.size === 0) {
    console.log(chalk.yellow('No CSV path provided or file empty.'));
    return;
  }
  console.log(chalk.bold.cyan('\n📊 Commission results\n'));
  console.log(chalk.gray('─'.repeat(60)));
  let found = 0;
  merchants.forEach((m, i) => {
    const commission = commissionMap.get(m.merchantId);
    const name = (m.merchantName || '').trim() || `(ID ${m.merchantId})`;
    const commStr = commission != null && commission !== '' ? Number(commission).toLocaleString() : '—';
    console.log(chalk.white(`  ${i + 1}. ${name}`));
    console.log(chalk.gray(`     Merchant ID: ${m.merchantId}  |  Total commission: ${commStr}`));
    if (commission != null && commission !== '') found++;
  });
  if (merchants.length > 0 && found === 0) console.log(chalk.yellow('  No commission data found for these merchant ID(s) in the CSV.'));
  console.log(chalk.gray('─'.repeat(60)) + '\n');
}

/**
 * Show top-level menu (first screen)
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
    console.log(chalk.yellow('What do you want to do?\n'));
    console.log(chalk.white('  0) ') + chalk.bold('File manager') + chalk.gray(' - Combine offer activation / merchant rate / or both into one report'));
    console.log(chalk.white('  1) ') + chalk.bold('Merchant Rate Audit') + chalk.gray(' - Check for problematic rates in feeds'));
    console.log(chalk.white('  2) ') + chalk.bold('Offer Activation Testing') + chalk.gray(' - Test if offers work when activated'));
    console.log(chalk.white('  3) ') + chalk.bold('Lookup results') + chalk.gray(' - By App ID (shows what\'s tested) or by merchant name'));
    console.log(chalk.white('  4) ') + chalk.bold('Run full audit') + chalk.gray(' - Merchant rate + offer activation in one run'));
    console.log(chalk.white('  5) ') + chalk.bold('Commissions') + chalk.gray(' - Look up overall commission by merchant name or ID'));
    console.log(chalk.white('  6) ') + chalk.bold('Exit') + '\n');
    rl.question(chalk.cyan('Choice (0-6): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Show main menu (Merchant Rate Audit submenu)
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
    console.log(chalk.gray('  4) Clear all audit results'));
    console.log(chalk.gray('  5) Back to main menu'));
    console.log(chalk.gray('  6) Exit\n'));
    
    rl.question(chalk.cyan('Choice (1-6): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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
  
  // Check if app IDs were provided as command line arguments
  const cmdLineAppIds = args.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
  
  if (cmdLineAppIds.length > 0) {
    // Use command line arguments if provided
    const appIdsToAudit = cmdLineAppIds;
    console.log(chalk.bold.cyan('\n🔍 Merchant Rate Auditor'));
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
        case '0':
          await runFileManagerMenu();
          break;
        case '1':
          await runMerchantRateAuditMenu();
          break;
        case '2':
          await offerActivation.runOfferActivationTest();
          break;
        case '3':
          await runLookupMenu();
          break;
        case '4':
          await runFullAudit();
          break;
        case '5':
          await runCommissionsMenu();
          break;
        case '6':
          console.log(chalk.gray('\nGoodbye! 👋\n'));
          process.exit(0);
        default:
          console.log(chalk.red('❌ Invalid choice. Please enter 0-6.'));
          break;
      }
    }
  }
}

/**
 * Merchant rate audit submenu loop (from top-level option 1).
 */
async function runMerchantRateAuditMenu() {
  while (true) {
    const choice = await showMainMenu();
    switch (choice) {
      case '1': {
        const appIdsToAudit = await promptForAppIds();
        console.log(chalk.cyan(`\nAuditing App IDs: ${appIdsToAudit.join(', ')}\n`));
        const results = [];
        for (const appId of appIdsToAudit) {
          const result = await auditAppId(appId);
          results.push(result);
        }
        const report = generateReport(results);
        printResults(report);
        await saveReport(report, false);
        break;
      }
      case '2':
        displayAuditList(listPreviousAudits());
        break;
      case '3': {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((res) => rl.question(chalk.cyan('Enter App ID(s) to lookup (comma or space separated): '), res));
        rl.close();
        const lookupAppIds = answer.split(/[,\s]+/).map(id => parseInt(id.trim(), 10)).filter(n => !isNaN(n) && n > 0);
        if (lookupAppIds.length > 0) {
          const matchingAudits = lookupAuditsByAppId(lookupAppIds);
          displayLookupResults(matchingAudits, lookupAppIds);
          displayOfferActivationTestedForAppIds(lookupAppIds);
        } else {
          console.log(chalk.red('❌ No valid App IDs provided.'));
        }
        break;
      }
      case '4': {
        const clearRl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ans = await new Promise((res) => clearRl.question(chalk.yellow('⚠️  Are you sure you want to delete all audit results? (yes/no): '), res));
        clearRl.close();
        if (ans && (ans.toLowerCase() === 'yes' || ans.toLowerCase() === 'y')) clearAllResults();
        else console.log(chalk.gray('Cancelled.'));
        break;
      }
      case '5':
        return; // Back to main menu
      case '6':
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        process.exit(0);
      default:
        console.log(chalk.red('❌ Invalid choice.'));
        break;
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
  auditAppId,
  validateRate,
  isHexCode,
  containsShareASale,
  containsCommission,
  isInvalidRateName,
  containsPercentageInName,
  isZeroRate,
  isExactlyOnlinePurchase,
  containsUnderscore,
  containsInAppRate,
  rateMatchesMerchantCategory
};

