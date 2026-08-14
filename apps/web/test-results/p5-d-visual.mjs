import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p5-d-visual');
mkdirSync(outDir, { recursive: true });
const notes = [];

async function capture(browser, { url, width, height, name, after }) {
  const page = await browser.newPage({
    viewport: { width, height },
    locale: 'ar-SA',
  });
  page.setDefaultTimeout(20000);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  if (after) {
    await after(page);
    await page.waitForTimeout(400);
  }
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  const cta = await page.locator('button:visible').first().boundingBox().catch(() => null);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  notes.push({ name, overflowX, ctaY: cta ? Math.round(cta.y) : null, viewport: `${width}x${height}` });
  await page.close();
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  await capture(browser, {
    url: 'http://localhost:3000/',
    width: 1366,
    height: 768,
    name: 'home-1366',
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/ui#game-components',
    width: 1366,
    height: 768,
    name: 'ui-game-1366',
    after: async (page) => {
      await page.locator('#game-components').scrollIntoViewIfNeeded();
    },
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/ui#buttons',
    width: 1536,
    height: 864,
    name: 'ui-buttons-1536',
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    width: 1366,
    height: 768,
    name: 'bara-role-1366',
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    width: 1536,
    height: 864,
    name: 'bara-round-1536',
    after: async (page) => {
      await page.getByRole('button', { name: 'Round Results' }).click();
    },
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    width: 1366,
    height: 768,
    name: 'bara-final-1366',
    after: async (page) => {
      await page.getByRole('button', { name: 'Match Results' }).click();
    },
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    width: 1366,
    height: 768,
    name: 'bara-countdown-1366',
    after: async (page) => {
      await page.getByRole('button', { name: 'Countdown' }).click();
    },
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/guessing-challenge-scene',
    width: 1366,
    height: 768,
    name: 'guessing-scene-1366',
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    width: 390,
    height: 844,
    name: 'bara-mobile-390',
    after: async (page) => {
      await page.getByRole('button', { name: 'Round Results' }).click();
    },
  });
  await capture(browser, {
    url: 'http://localhost:3000/',
    width: 390,
    height: 844,
    name: 'home-mobile-390',
  });
  await capture(browser, {
    url: 'http://localhost:3000/dev/ui#buttons',
    width: 390,
    height: 844,
    name: 'ui-buttons-390',
  });
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'notes.json'), JSON.stringify(notes, null, 2));
console.log(JSON.stringify(notes, null, 2));
