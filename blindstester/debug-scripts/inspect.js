import { chromium } from 'playwright';

async function inspectPage() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to configurator...');
  await page.goto('https://www.homedepot.com/custom-blinds/Configurator/Draft?draftProductId=722389', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(5000);

  console.log('\n=== PAGE INSPECTION ===\n');

  // Get all buttons
  const buttons = await page.$$('button');
  console.log(`Found ${buttons.length} buttons`);
  
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    const visible = await buttons[i].isVisible();
    if (text && text.trim() && visible) {
      console.log(`Button ${i}: "${text.trim()}"`);
    }
  }

  // Get all inputs
  const inputs = await page.$$('input');
  console.log(`\nFound ${inputs.length} inputs`);
  
  for (let i = 0; i < Math.min(inputs.length, 20); i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const placeholder = await inputs[i].getAttribute('placeholder');
    const ariaLabel = await inputs[i].getAttribute('aria-label');
    const visible = await inputs[i].isVisible();
    
    if (visible) {
      console.log(`Input ${i}: type="${type}", name="${name}", placeholder="${placeholder}", aria-label="${ariaLabel}"`);
    }
  }

  // Get all labels
  const labels = await page.$$('label');
  console.log(`\nFound ${labels.length} labels`);
  
  for (let i = 0; i < Math.min(labels.length, 20); i++) {
    const text = await labels[i].textContent();
    const visible = await labels[i].isVisible();
    if (text && text.trim() && visible) {
      console.log(`Label ${i}: "${text.trim()}"`);
    }
  }

  // Check for specific text
  const bodyText = await page.textContent('body');
  console.log('\nPage contains "Inside Mount":', bodyText.includes('Inside Mount'));
  console.log('Page contains "Outside Mount":', bodyText.includes('Outside Mount'));
  console.log('Page contains "Width":', bodyText.includes('Width'));
  console.log('Page contains "Height":', bodyText.includes('Height'));

  // Take a screenshot
  await page.screenshot({ path: 'page-screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to page-screenshot.png');

  console.log('\nKeeping browser open for 60 seconds for manual inspection...');
  await page.waitForTimeout(60000);
  
  await browser.close();
}

inspectPage();
