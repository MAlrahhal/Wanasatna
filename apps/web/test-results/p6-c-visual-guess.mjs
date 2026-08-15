import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p6-c-visual');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ar-SA', deviceScaleFactor: 1 });
page.setDefaultTimeout(30000);

async function shot(width, height, name) {
  await page.setViewportSize({ width, height });
  await page.goto('http://localhost:3000/dev/guessing-challenge-scene?panel=playing&mode=1v1', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(1600);
  const open = page.getByTestId('gc-open-guess');
  if (await open.isVisible().catch(() => false)) await open.click();
  await page.waitForTimeout(400);
  const primary = await page.getByTestId('gc-primary-actions').count();
  const sticky = await page.getByRole('button', { name: 'تأكيد التخمين' }).count();
  console.log(name, { primary, sticky, overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) });
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
}

await shot(390, 844, 'gc-guess-form-390');
await shot(320, 700, 'gc-guess-form-320');
await browser.close();
