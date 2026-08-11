import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4321', { waitUntil: 'networkidle' });

// Full page screenshot
await page.screenshot({ path: 'screenshot-full.png', fullPage: true });

// Hero only
await page.screenshot({ path: 'screenshot-hero.png' });

// Scroll to work section
await page.evaluate(() => document.querySelector('#work')?.scrollIntoView());
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshot-work.png' });

// Scroll to stack
await page.evaluate(() => document.querySelector('#stack')?.scrollIntoView());
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshot-stack.png' });

await browser.close();
console.log('Screenshots saved');
