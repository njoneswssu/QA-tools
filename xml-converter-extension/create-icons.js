// Simple script to create placeholder icons using Node.js
// Run: node create-icons.js

const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon
function createSVGIcon(size) {
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">XML</text>
</svg>`;
}

// Note: This creates SVG files. For PNG, use the generate-icons.html file in a browser
const sizes = [16, 32, 48, 128];

console.log('Creating SVG icons...');
sizes.forEach(size => {
    const svg = createSVGIcon(size);
    const filename = path.join(iconsDir, `icon${size}.svg`);
    fs.writeFileSync(filename, svg);
    console.log(`Created ${filename}`);
});

console.log('\nNote: These are SVG files. For PNG icons:');
console.log('1. Open generate-icons.html in your browser');
console.log('2. Click "Generate Icons"');
console.log('3. Click "Download All Icons"');
console.log('4. Save the PNG files to the icons/ folder');

