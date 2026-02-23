// Grid data extracted from the image
// The header shows "Width To:" breakpoints
// The value in each column is the max height for widths UP TO that column's width
// When testing at width-2, we look at that column to get the max height

// Example: For 1% Catalina testing at 112" (114" breakpoint):
// Column 114" shows 96" → max height for widths up to 114" is 96"

export const testData = [
  {
    product: "3% Catalina",
    widthBreakpoints: [
      { width: 114, maxHeight: 132 },
      { width: 120, maxHeight: 90 },
      { width: 126, maxHeight: 54 }
    ]
  },
  {
    product: "5% Catalina",
    widthBreakpoints: [
      { width: 114, maxHeight: 132 },
      { width: 120, maxHeight: 90 },
      { width: 126, maxHeight: 54 }
    ]
  },
  {
    product: "1% Catalina",
    widthBreakpoints: [
      { width: 114, maxHeight: 96 },
      { width: 120, maxHeight: 72 },
      { width: 126, maxHeight: 48 }
    ]
  },
  {
    product: "10% Solapur",
    widthBreakpoints: [
      { width: 114, maxHeight: 96 },
      { width: 120, maxHeight: 72 },
      { width: 126, maxHeight: 48 }
    ]
  },
  {
    product: "3% Malibu",
    widthBreakpoints: [
      { width: 108, maxHeight: 132 },
      { width: 114, maxHeight: 90 },
      { width: 120, maxHeight: 60 },
      { width: 126, maxHeight: 36 }
    ]
  },
  {
    product: "5% Key West",
    widthBreakpoints: [
      { width: 108, maxHeight: 132 },
      { width: 114, maxHeight: 90 },
      { width: 120, maxHeight: 60 },
      { width: 126, maxHeight: 36 }
    ]
  },
  {
    product: "5% Solapur",
    widthBreakpoints: [
      { width: 108, maxHeight: 132 },
      { width: 114, maxHeight: 90 },
      { width: 120, maxHeight: 60 },
      { width: 126, maxHeight: 36 }
    ]
  },
  {
    product: "5% Sonoma",
    widthBreakpoints: [
      { width: 108, maxHeight: 132 },
      { width: 114, maxHeight: 90 },
      { width: 120, maxHeight: 60 },
      { width: 126, maxHeight: 36 }
    ]
  },
  {
    product: "3% Acadia",
    widthBreakpoints: [
      { width: 108, maxHeight: 132 },
      { width: 114, maxHeight: 90 },
      { width: 120, maxHeight: 60 }
    ]
  },
  {
    product: "5% Acadia",
    widthBreakpoints: [
      { width: 108, maxHeight: 132 },
      { width: 114, maxHeight: 90 },
      { width: 120, maxHeight: 60 }
    ]
  },
  {
    product: "1% Solapur",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 },
      { width: 120, maxHeight: 54 },
      { width: 126, maxHeight: 36 }
    ]
  },
  {
    product: "3% Solapur",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 },
      { width: 120, maxHeight: 54 },
      { width: 126, maxHeight: 36 }
    ]
  },
  {
    product: "5% Newport",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 },
      { width: 120, maxHeight: 54 }
    ]
  },
  {
    product: "3% Barcelona",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 }
    ]
  },
  {
    product: "3% Providence",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 }
    ]
  },
  {
    product: "3% Revival",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 }
    ]
  },
  {
    product: "3% Shangrila",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 }
    ]
  },
  {
    product: "3% Stonewash",
    widthBreakpoints: [
      { width: 108, maxHeight: 114 },
      { width: 114, maxHeight: 78 }
    ]
  },
  {
    product: "1% Newport",
    widthBreakpoints: [
      { width: 108, maxHeight: 102 },
      { width: 114, maxHeight: 72 },
      { width: 120, maxHeight: 48 }
    ]
  },
  {
    product: "3% Newport",
    widthBreakpoints: [
      { width: 108, maxHeight: 102 },
      { width: 114, maxHeight: 72 },
      { width: 120, maxHeight: 48 }
    ]
  }
];

// Focus on products where max height < 144" at some breakpoints
// AND filter out the 144" breakpoints themselves
export const focusProducts = testData
  .filter(product => 
    product.widthBreakpoints.some(bp => bp.maxHeight < 144)
  )
  .map(product => ({
    ...product,
    widthBreakpoints: product.widthBreakpoints.filter(bp => bp.maxHeight < 144)
  }));
