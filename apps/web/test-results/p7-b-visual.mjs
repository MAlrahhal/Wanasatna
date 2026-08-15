import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p7-b-visual');
mkdirSync(outDir, { recursive: true });
const report = [];

async function inspect(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const header = document.querySelector('header');
    const audio = document.querySelector('[data-testid="game-audio-control"]');
    const panel = document.querySelector('[data-testid="game-audio-panel"]');
    const volume = document.querySelector('[data-testid="game-audio-volume"]');
    const mute = document.querySelector('[data-testid="game-audio-mute-toggle"]');
    const r = audio?.getBoundingClientRect();
    const headerR = header?.getBoundingClientRect();
    return {
      overflow: html.scrollWidth > html.clientWidth + 1,
      scrollW: html.scrollWidth,
      clientW: html.clientWidth,
      headerH: headerR ? Math.round(headerR.height) : null,
      audioVisible: Boolean(audio && r && r.width > 0 && r.height > 0),
      audioW: r ? Math.round(r.width) : null,
      audioH: r ? Math.round(r.height) : null,
      audioLabel: audio?.getAttribute('aria-label') || null,
      muted: audio?.getAttribute('data-muted') || null,
      panelOpen: Boolean(panel),
      volumePresent: Boolean(volume),
      mutePresent: Boolean(mute),
    };
  });
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  const m = await inspect(page);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  report.push({ name, viewport: `${page.viewportSize()?.width}x${page.viewportSize()?.height}`, url: page.url(), ...m });
  return m;
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  const page = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  page.setDefaultTimeout(30000);
  guest.setDefaultTimeout(30000);

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#create-name').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#create-name').fill('مضيف');
  await page
    .locator('#create-name')
    .locator('xpath=ancestor::article[1]')
    .getByRole('button', { name: 'إنشاء غرفة' })
    .click();
  await page.waitForURL(/\/lobby\?code=\d+/, { timeout: 30000, waitUntil: 'domcontentloaded' });
  const code = new URL(page.url()).searchParams.get('code');
  await page.waitForTimeout(800);
  await shot(page, 'lobby-390');
  await page.getByTestId('game-audio-control').first().click();
  await page.waitForTimeout(200);
  await shot(page, 'lobby-390-panel');
  await page.getByTestId('game-audio-mute-toggle').click();
  await page.waitForTimeout(150);
  await shot(page, 'lobby-390-muted');
  await page.getByTestId('game-audio-volume').fill('80');
  await page.waitForTimeout(150);
  await shot(page, 'lobby-390-volume');

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(400);
  await shot(page, 'lobby-desktop');
  await page.getByTestId('game-audio-control').last().click();
  await page.waitForTimeout(200);
  await shot(page, 'lobby-desktop-panel');

  await guest.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await guest.waitForTimeout(600);
  await guest.locator('#join-name').fill('ضيف');
  await guest.locator('#join-code').fill(code ?? '');
  await guest.getByRole('button', { name: 'دخول الغرفة' }).click();
  await guest.waitForURL(/\/lobby/, { timeout: 30000, waitUntil: 'domcontentloaded' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'ارسم وخمن' }).click();
  await page.waitForTimeout(400);
  await page.locator('[data-lobby-sticky-start]').getByRole('button', { name: 'بدء اللعبة' }).click();
  await page.waitForURL('**/game**', { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, 'game-390');
  await page.getByTestId('game-audio-control').first().click();
  await page.waitForTimeout(200);
  await shot(page, 'game-390-panel');

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(400);
  await shot(page, 'game-desktop');

  await hostCtx.close();
  await guestCtx.close();
} catch (error) {
  report.push({ name: 'script-error', message: error instanceof Error ? error.message : String(error) });
  console.error(error);
  try {
    await page.screenshot({ path: join(outDir, 'error-host.png'), fullPage: true });
    await guest.screenshot({ path: join(outDir, 'error-guest.png'), fullPage: true });
  } catch {
    // ignore
  }
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
