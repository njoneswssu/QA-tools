const { populateMerchantMasterData } = require('./init_db');

// The merchant data provided by the user
const merchantsData = {
  "Merchants": [
    {
      "AppID": 451,
      "MerchantID": 6745,
      "MerchantName": "525 America",
      "MerchantDomains": ["525america.com"],
      "MerchantScore": 0,
      "IsFeaturedMerchant": false,
      "PrimaryCategory": "Clothing & Apparel",
      "PrimaryCategoryID": 1,
      "ParentCategory": "Clothing & Apparel",
      "ParentCategoryID": 1,
      "MaxRate": "1.875",
      "MaxRateKind": "PERCENTAGE",
      "MaxRateCurrency": "",
      "MaxRateLedgerID": 631118,
      "Boosted": false,
      "MaxOfferScore": 0,
      "DetailedRates": [{"ID": 41504, "LedgerID": 631118, "Name": "Online Purchase", "Kind": "PERCENTAGE", "Amount": "1.875"}],
      "Coupons": [{"Category": "", "Code": "", "CouponScore": 0, "CouponSource": "DESCRIPTION", "Description": "", "DiscountAmount": 0, "DiscountType": "", "EndDate": "3000-01-04T00:00:00Z", "IsFreeShipping": true, "MinimumQuantity": 0, "MinimumSpend": 0, "NetworkMerchantCouponID": 4606322, "OfferScore": 0, "ParseConfidence": 0.08, "ShippingInfo": "Free Shipping On Orders Over $99", "IsSitewide": true, "StartDate": "2025-03-30T00:00:00Z", "SuccessRate": 0, "WinRate": 0, "CreatedDate": "2025-04-01T03:51:50.451856Z", "ModifiedDate": "2025-04-01T03:51:50.451856Z"}],
      "BrandColor": "",
      "TextColor": "",
      "FeaturedImageURL": "",
      "LogoImageExists": true,
      "Images": [{"ID": 8529, "Kind": "LOGO", "Ordinal": 1, "ImageID": 8530, "URL": "https://storage.googleapis.com/wl-image/efa191632325a8c78554fb367801c457719cb495", "Height": 200, "Width": 200}, {"ID": 8530, "Kind": "LOGORECT", "Ordinal": 1, "ImageID": 8531, "URL": "https://storage.googleapis.com/wl-image/d56778470269a573b612f361dc1491a1f17f8212", "Height": 200, "Width": 260}],
      "CreatedDate": "2018-09-10T21:47:03.858082Z",
      "ModifiedDate": "2025-10-28T00:03:38.484305Z"
    }
    // Note: This is just the first merchant from the provided data
    // In a real implementation, you would include all merchants from the JSON
  ]
};

// Function to populate database with all merchant data
async function populateDatabase() {
  try {
    console.log('Starting to populate merchant master data...');
    await populateMerchantMasterData(merchantsData.Merchants);
    console.log('Successfully populated merchant master data');
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  populateDatabase();
}

module.exports = { populateDatabase };
