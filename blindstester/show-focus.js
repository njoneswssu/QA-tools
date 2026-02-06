import { focusProducts } from './test-data.js';

console.log('Focus Products (excluding 144" max heights):');
console.log('='.repeat(60));

focusProducts.forEach(product => {
  console.log(`\n${product.product}:`);
  product.widthBreakpoints.forEach(bp => {
    console.log(`  Width: ${bp.width}" → Max Height: ${bp.maxHeight}"`);
  });
});

console.log('\n' + '='.repeat(60));
console.log(`Total products: ${focusProducts.length}`);
const totalBreakpoints = focusProducts.reduce((sum, p) => sum + p.widthBreakpoints.length, 0);
console.log(`Total breakpoints to test: ${totalBreakpoints}`);
console.log(`Total tests (1 random height per breakpoint): ${totalBreakpoints}`);
