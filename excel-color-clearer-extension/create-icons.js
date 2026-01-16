#!/usr/bin/env node

/**
 * Simple icon generator for Excel Color Clearer extension
 * Creates PNG icons in multiple sizes
 */

const fs = require('fs');
const path = require('path');

// SVG template for the icon
function generateSVG(size) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="128" height="128" fill="url(#grad)" rx="20"/>
  
  <!-- Excel grid -->
  <g stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="none">
    <!-- Vertical lines -->
    <line x1="32" y1="26" x2="32" y2="102"/>
    <line x1="58" y1="26" x2="58" y2="102"/>
    <line x1="84" y1="26" x2="84" y2="102"/>
    <line x1="110" y1="26" x2="110" y2="102"/>
    
    <!-- Horizontal lines -->
    <line x1="26" y1="32" x2="102" y2="32"/>
    <line x1="26" y1="58" x2="102" y2="58"/>
    <line x1="26" y1="84" x2="102" y2="84"/>
  </g>
  
  <!-- Colored cells -->
  <rect x="33" y="33" width="23" height="23" fill="#ff6b6b" opacity="0.9"/>
  <rect x="59" y="59" width="23" height="23" fill="#4ecdc4" opacity="0.9"/>
  
  <!-- Eraser/Clear icon -->
  <circle cx="90" cy="90" r="18" fill="white"/>
  <g stroke="#667eea" stroke-width="3" stroke-linecap="round">
    <line x1="84" y1="84" x2="96" y2="96"/>
    <line x1="96" y1="84" x2="84" y2="96"/>
  </g>
</svg>`;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
    const svg = generateSVG(size);
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    fs.writeFileSync(svgPath, svg);
    console.log(`✓ Created ${svgPath}`);
});

console.log('\n📦 SVG icons created successfully!');
console.log('\n📝 Next steps:');
console.log('1. Open generate-icons.html in your browser');
console.log('2. Click "Download All Icons" to get PNG versions');
console.log('3. Or use an SVG to PNG converter online');
console.log('\nAlternatively, if you have Chrome/Edge, you can:');
console.log('- Load the extension with SVG icons (some browsers support this)');
console.log('- Or convert SVGs to PNGs using online tools like:');
console.log('  • https://svgtopng.com/');
console.log('  • https://cloudconvert.com/svg-to-png');

