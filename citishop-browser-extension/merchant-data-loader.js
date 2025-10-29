// Merchant Data Loader for CitiShop Browser Extension
// This script processes the citiList.txt file and creates a merchant database

const fs = require('fs');
const path = require('path');

// Path to the citiList.txt file
const CITI_LIST_PATH = path.join(__dirname, '..', 'e2e', 'citiList.txt');
const OUTPUT_PATH = path.join(__dirname, 'merchant-list.json');

/**
 * Parse the citiList.txt file and extract merchant data
 */
function parseCitiList() {
  try {
    console.log('📖 Reading citiList.txt...');
    const content = fs.readFileSync(CITI_LIST_PATH, 'utf-8');
    
    const merchants = [];
    const lines = content.split('\n');
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        continue;
      }
      
      // Look for lines with merchant data
      if (trimmedLine.includes('name:') && trimmedLine.includes('url:')) {
        try {
          // Parse lines like: { name: 'Ulta', url: 'https://www.ulta.com/' },
          // Use regex that properly handles escaped characters
          const nameMatch = trimmedLine.match(/name:\s*'((?:[^'\\]|\\.)*)'/);
          const urlMatch = trimmedLine.match(/url:\s*'((?:[^'\\]|\\.)*)'/);
          
          if (nameMatch && urlMatch) {
            // Properly handle escaped apostrophes in the name
            const rawName = nameMatch[1];
            const cleanName = rawName.replace(/\\'/g, "'").replace(/\\"/g, '"');
            
            const merchant = {
              name: cleanName,
              url: urlMatch[1],
              id: generateMerchantId(cleanName),
              source: 'citiList.txt',
              lineNumber: lineNumber
            };
            
            // Validate URL format
            if (isValidUrl(merchant.url)) {
              merchants.push(merchant);
            } else {
              console.warn(`⚠️  Invalid URL on line ${lineNumber}: ${merchant.url}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️  Error parsing line ${lineNumber}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Parsed ${merchants.length} merchants from citiList.txt`);
    return merchants;
    
  } catch (error) {
    console.error('❌ Error reading citiList.txt:', error.message);
    
    // Return sample data if file not found
    console.log('📝 Using sample merchant data...');
    return getSampleMerchants();
  }
}

/**
 * Generate a unique ID for a merchant based on their name
 */
function generateMerchantId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

/**
 * Get sample merchants if citiList.txt is not available
 */
function getSampleMerchants() {
  return [
    { name: 'Ulta', url: 'https://www.ulta.com/', id: 'ulta', source: 'sample' },
    { name: 'Best Buy', url: 'https://www.bestbuy.com/', id: 'best-buy', source: 'sample' },
    { name: 'Kohl\'s', url: 'https://www.kohls.com/', id: 'kohls', source: 'sample' },
    { name: 'Macy\'s', url: 'https://www.macys.com/', id: 'macys', source: 'sample' },
    { name: 'Sephora', url: 'https://www.sephora.com/', id: 'sephora', source: 'sample' },
    { name: 'StubHub', url: 'https://www.stubhub.com/', id: 'stubhub', source: 'sample' },
    { name: 'LL Bean', url: 'https://www.llbean.com/', id: 'll-bean', source: 'sample' },
    { name: 'Gap', url: 'https://www.gap.com/', id: 'gap', source: 'sample' },
    { name: 'Total Wine', url: 'https://www.totalwine.com/', id: 'total-wine', source: 'sample' },
    { name: 'PetSafe', url: 'https://www.petsafe.com/', id: 'petsafe', source: 'sample' },
    { name: 'PetSmart', url: 'https://www.petsmart.com/', id: 'petsmart', source: 'sample' },
    { name: 'Dick\'s', url: 'https://www.dickssportinggoods.com/', id: 'dicks', source: 'sample' },
    { name: 'TEVA', url: 'https://www.teva.com/', id: 'teva', source: 'sample' },
    { name: 'ASICS', url: 'https://www.asics.com/', id: 'asics', source: 'sample' },
    { name: 'Old Navy', url: 'https://www.oldnavy.com/', id: 'old-navy', source: 'sample' },
    { name: 'Crocs', url: 'https://www.crocs.com/', id: 'crocs', source: 'sample' },
    { name: 'Bombas', url: 'https://www.bombas.com/', id: 'bombas', source: 'sample' },
    { name: 'Saks Fifth Avenue', url: 'https://www.saksfifthavenue.com/', id: 'saks-fifth-avenue', source: 'sample' },
    { name: 'Solo Stove', url: 'https://www.solostove.com/', id: 'solo-stove', source: 'sample' },
    { name: 'KitchenAid', url: 'https://www.kitchenaid.com/', id: 'kitchenaid', source: 'sample' }
  ];
}

/**
 * Create merchant database with metadata
 */
function createMerchantDatabase(merchants) {
  const database = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    source: CITI_LIST_PATH,
    totalMerchants: merchants.length,
    merchants: merchants,
    metadata: {
      categories: extractCategories(merchants),
      domains: extractDomains(merchants),
      stats: generateStats(merchants)
    }
  };
  
  return database;
}

/**
 * Extract merchant categories (basic categorization)
 */
function extractCategories(merchants) {
  const categories = {};
  
  merchants.forEach(merchant => {
    const category = categorizeMerchant(merchant.name, merchant.url);
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(merchant.id);
  });
  
  return categories;
}

/**
 * Simple merchant categorization
 */
function categorizeMerchant(name, url) {
  const nameAndUrl = (name + ' ' + url).toLowerCase();
  
  if (nameAndUrl.includes('beauty') || nameAndUrl.includes('cosmetic') || 
      nameAndUrl.includes('sephora') || nameAndUrl.includes('ulta')) {
    return 'Beauty & Cosmetics';
  }
  
  if (nameAndUrl.includes('electronics') || nameAndUrl.includes('tech') || 
      nameAndUrl.includes('bestbuy') || nameAndUrl.includes('computer')) {
    return 'Electronics & Technology';
  }
  
  if (nameAndUrl.includes('clothing') || nameAndUrl.includes('fashion') || 
      nameAndUrl.includes('apparel') || nameAndUrl.includes('gap') || 
      nameAndUrl.includes('oldnavy') || nameAndUrl.includes('macys')) {
    return 'Fashion & Apparel';
  }
  
  if (nameAndUrl.includes('pet') || nameAndUrl.includes('animal')) {
    return 'Pet Supplies';
  }
  
  if (nameAndUrl.includes('sport') || nameAndUrl.includes('athletic') || 
      nameAndUrl.includes('outdoor') || nameAndUrl.includes('nike') || 
      nameAndUrl.includes('adidas')) {
    return 'Sports & Outdoors';
  }
  
  if (nameAndUrl.includes('home') || nameAndUrl.includes('kitchen') || 
      nameAndUrl.includes('furniture')) {
    return 'Home & Kitchen';
  }
  
  return 'General Retail';
}

/**
 * Extract unique domains
 */
function extractDomains(merchants) {
  const domains = new Set();
  
  merchants.forEach(merchant => {
    try {
      const url = new URL(merchant.url);
      domains.add(url.hostname);
    } catch (error) {
      console.warn(`⚠️  Invalid URL for ${merchant.name}: ${merchant.url}`);
    }
  });
  
  return Array.from(domains).sort();
}

/**
 * Generate database statistics
 */
function generateStats(merchants) {
  const stats = {
    totalMerchants: merchants.length,
    httpsMerchants: merchants.filter(m => m.url.startsWith('https://')).length,
    uniqueDomains: extractDomains(merchants).length,
    averageNameLength: Math.round(
      merchants.reduce((sum, m) => sum + m.name.length, 0) / merchants.length
    )
  };
  
  stats.httpsPercentage = Math.round((stats.httpsMerchants / stats.totalMerchants) * 100);
  
  return stats;
}

/**
 * Save merchant database to JSON file
 */
function saveMerchantDatabase(database) {
  try {
    const json = JSON.stringify(database, null, 2);
    fs.writeFileSync(OUTPUT_PATH, json, 'utf-8');
    console.log(`💾 Merchant database saved to: ${OUTPUT_PATH}`);
    console.log(`📊 Database contains ${database.totalMerchants} merchants`);
    console.log(`🔗 HTTPS coverage: ${database.metadata.stats.httpsPercentage}%`);
    console.log(`🌐 Unique domains: ${database.metadata.stats.uniqueDomains}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error saving merchant database:', error.message);
    return false;
  }
}

/**
 * Main execution function
 */
function main() {
  console.log('🏪 CitiShop Merchant Database Generator');
  console.log('=====================================');
  
  // Parse citiList.txt
  const merchants = parseCitiList();
  
  if (merchants.length === 0) {
    console.error('❌ No merchants found. Please check citiList.txt format.');
    process.exit(1);
  }
  
  // Create database
  const database = createMerchantDatabase(merchants);
  
  // Save to file
  const success = saveMerchantDatabase(database);
  
  if (success) {
    console.log('✅ Merchant database generation completed successfully!');
    console.log(`📁 Output file: ${OUTPUT_PATH}`);
    console.log('\n🔧 Next steps:');
    console.log('1. Include merchant-list.json in your browser extension');
    console.log('2. Load the database in your extension popup');
    console.log('3. Test merchant validation functionality');
  } else {
    console.error('❌ Database generation failed');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  parseCitiList,
  createMerchantDatabase,
  saveMerchantDatabase,
  generateMerchantId,
  isValidUrl
};
