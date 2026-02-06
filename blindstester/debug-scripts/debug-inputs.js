import { chromium } from 'playwright';

async function debugInputs() {
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
  
  console.log('\n=== ALL INPUTS AFTER MOUNT SELECTION ===');
  const allInputs = await page.$$('input');
  for (let i = 0; i < allInputs.length; i++) {
    const type = await allInputs[i].getAttribute('type');
    const name = await allInputs[i].getAttribute('name');
    const id = await allInputs[i].getAttribute('id');
    const placeholder = await allInputs[i].getAttribute('placeholder');
    const value = await allInputs[i].inputValue();
    const visible = await allInputs[i].isVisible();
    
    console.log(`\nInput ${i}:`);
    console.log(`  Type: ${type}`);
    console.log(`  Name: ${name}`);
    console.log(`  ID: ${id}`);
    console.log(`  Placeholder: ${placeholder}`);
    console.log(`  Value: ${value}`);
    console.log(`  Visible: ${visible}`);
  }
  
  console.log('\n=== VISIBLE TEXT INPUTS ===');
  const textInputs = await page.$$('input[type="text"]');
  let count = 0;
  for (const input of textInputs) {
    const visible = await input.isVisible();
    if (visible) {
      count++;
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      console.log(`Visible text input: name="${name}", id="${id}"`);
    }
  }
  console.log(`\nTotal visible text inputs: ${count}`);
  
  console.log('\n=== VISIBLE NUMBER INPUTS ===');
  const numberInputs = await page.$$('input[type="number"]');
  let numCount = 0;
  for (const input of numberInputs) {
    const visible = await input.isVisible();
    if (visible) {
      numCount++;
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      console.log(`Visible number input: name="${name}", id="${id}"`);
    }
  }
  console.log(`\nTotal visible number inputs: ${numCount}`);
  
  console.log('\n\nKeeping browser open for 60 seconds...');
  await page.waitForTimeout(60000);
  
  await browser.close();
}

debugInputs();
