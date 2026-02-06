import { chromium } from 'playwright';

async function debugDimensions() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating...');
  await page.goto('https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(5000);
  
  console.log('\nSelecting Inside Mount...');
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = await button.textContent();
    if (text && text.includes('Inside Mount')) {
      await button.click();
      await page.waitForTimeout(3000);
      console.log('Clicked Inside Mount');
      break;
    }
  }
  
  console.log('\n=== LOOKING FOR DIMENSION CONTROLS ===\n');
  
  // Look for labels with "Width" or "Height"
  const labels = await page.$$('label');
  for (const label of labels) {
    const text = await label.textContent();
    if (text && (text.toLowerCase().includes('width') || text.toLowerCase().includes('height') || text.includes('Inches'))) {
      const htmlFor = await label.getAttribute('for');
      const visible = await label.isVisible();
      console.log(`Label: "${text.trim()}" (for="${htmlFor}", visible=${visible})`);
    }
  }
  
  // Look for any element with width/height in ID or class
  console.log('\n=== Elements with width/height in attributes ===\n');
  const allElements = await page.$$('[id*="width" i], [id*="height" i], [class*="width" i], [class*="height" i], [name*="width" i], [name*="height" i]');
  for (const el of allElements) {
    const tagName = await el.evaluate(e => e.tagName);
    const id = await el.getAttribute('id');
    const className = await el.getAttribute('class');
    const name = await el.getAttribute('name');
    const visible = await el.isVisible();
    if (visible) {
      console.log(`${tagName}: id="${id}", class="${className}", name="${name}"`);
    }
  }
  
  // Look for select dropdowns (might be using dropdowns for dimensions)
  console.log('\n=== SELECT elements ===\n');
  const selects = await page.$$('select');
  for (const select of selects) {
    const name = await select.getAttribute('name');
    const id = await select.getAttribute('id');
    const visible = await select.isVisible();
    if (visible) {
      console.log(`Select: name="${name}", id="${id}"`);
    }
  }
  
  console.log('\n\nKeeping browser open for 90 seconds for manual inspection...');
  console.log('Look for the width and height input fields manually in the browser!');
  await page.waitForTimeout(90000);
  
  await browser.close();
}

debugDimensions();
