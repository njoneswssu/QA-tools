// Example configuration template
// Copy this file and customize it for your test scenario

export const config = {
  // Descriptive name for this configuration
  name: "My Custom Blinds Test",
  
  // Configurator URL with draftProductId
  url: "https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=YOUR_PRODUCT_ID",
  
  // Optional: Reference grid image (place in configs/grids/)
  gridImage: "grids/my-grid.png",
  
  // Test data - extract from your grid
  testData: [
    {
      // Product name as it appears in the configurator
      // Must match color swatch alt text (reversed: "Fabric 3%" not "3% Fabric")
      product: "3% Fabric Name",
      
      // Width breakpoints where max height changes
      // Only include widths where maxHeight < 144"
      widthBreakpoints: [
        { width: 114, maxHeight: 132 },  // Test at 112" width, max height is 132"
        { width: 120, maxHeight: 90 },   // Test at 118" width, max height is 90"
        { width: 126, maxHeight: 54 }    // Test at 124" width, max height is 54"
      ]
    },
    {
      product: "1% Fabric Name",
      widthBreakpoints: [
        { width: 114, maxHeight: 96 },
        { width: 120, maxHeight: 72 }
      ]
    }
    // Add more products...
  ]
};

/* 
HOW TO USE:

1. Save this file as: configs/my-test-config.js
2. Add your grid image to: configs/grids/my-grid.png
3. Update the URL with your draftProductId
4. Extract test data from your grid
5. Run: node index.js --config configs/my-test-config.js

EXTRACTING GRID DATA:

If your grid looks like:
┌──────────────┬──────┬──────┬──────┬──────┐
│ Product      │ 108" │ 114" │ 120" │ 126" │
├──────────────┼──────┼──────┼──────┼──────┤
│ 3% FabricA   │ 144  │ 132  │ 90   │ 54   │
│ 1% FabricB   │ 144  │ 96   │ 72   │ 48   │
└──────────────┴──────┴──────┴──────┴──────┘

Becomes:
{
  product: "3% FabricA",
  widthBreakpoints: [
    { width: 114, maxHeight: 132 },  // Skip 108" (144)
    { width: 120, maxHeight: 90 },
    { width: 126, maxHeight: 54 }
  ]
}

IMPORTANT:
- Product names must match color swatch alt text EXACTLY
- Format is usually "FabricName Percentage%" (reversed from test data name)
- Only include breakpoints where maxHeight < 144"
- Test will run at width-2 (e.g., test 112" for 114" breakpoint)
*/
