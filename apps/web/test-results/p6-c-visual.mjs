import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p6-c-visual');
mkdirSync(outDir, { recursive: true });
const report = [];

async function inspect(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const scene = document.querySelector(
      '[data-testid="gc-real3d-scene"], [data-testid="gc-first-person-scene"], [data-testid="harness-scene"]',
    );
    const canvas = document.querySelector('canvas');
    const shell = document.querySelector('.gc-real3d-canvas-shell');
    const yellow = document.querySelector('[data-testid="gc-yellow-card"]');
    const red = document.querySelector('[data-testid="gc-red-card"]');
    const panel = document.querySelector('[data-testid="gc-special-cards-panel"]');
    const turn = document.querySelector('[data-testid="gc-turn-indicator"]');
    const recenter = document.querySelector('[data-testid="gc-recenter-camera"]');
    const sticky = document.querySelector('.fixed.inset-x-0.bottom-0');
    return {
      overflow: html.scrollWidth > html.clientWidth + 1,
      scrollW: html.scrollWidth,
      clientW: html.clientWidth,
      sceneH: scene ? Math.round(scene.getBoundingClientRect().height) : null,
      canvasH: canvas ? Math.round(canvas.getBoundingClientRect().height) : null,
      canvasW: canvas ? Math.round(canvas.getBoundingClientRect().width) : null,
      shellH: shell ? Math.round(shell.getBoundingClientRect().height) : null,
      touchAction: canvas ? getComputedStyle(canvas).touchAction : null,
      panelPointer: panel ? getComputedStyle(panel).pointerEvents : null,
      yellowH: yellow ? Math.round(yellow.getBoundingClientRect().height) : null,
      redH: red ? Math.round(red.getBoundingClientRect().height) : null,
      turnVisible: Boolean(turn && turn.getBoundingClientRect().height > 0),
      recenterH: recenter ? Math.round(recenter.getBoundingClientRect().height) : null,
      stickyVisible: Boolean(sticky && getComputedStyle(sticky).display !== 'none'),
    };
  });
}

async function waitForScene(page) {
  await page.waitForTimeout(400);
  const canvas = page.locator('canvas').first();
  if (await canvas.count()) {
    await canvas.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1400);
  } else {
    await page.waitForTimeout(600);
  }
}

async function shot(page, name) {
  const m = await inspect(page);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  report.push({ name, viewport: `${page.viewportSize()?.width}x${page.viewportSize()?.height}`, ...m });
}

async function load(page, width, height, path, name, after) {
  await page.setViewportSize({ width, height });
  await page.goto(`http://localhost:3000${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await waitForScene(page);
  if (after) await after(page);
  await shot(page, name);
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: 'ar-SA',
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(30000);

  await load(page, 390, 844, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-390');
  await load(page, 320, 700, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-320');
  await load(page, 360, 800, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-360');
  await load(page, 375, 812, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-375');
  await load(page, 430, 932, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-430');
  await load(page, 844, 390, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-landscape');
  await load(page, 1366, 768, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-desktop-1366');
  await load(page, 1536, 864, '/dev/guessing-challenge-scene?mode=1v1', 'gc-1v1-desktop-1536');

  await load(page, 390, 844, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=0', 'gc-2v2-blue0-390');
  await load(
    page,
    390,
    844,
    '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=0&look=right',
    'gc-2v2-blue0-teammate-390',
  );
  await load(page, 390, 844, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=1', 'gc-2v2-blue1-390');
  await load(
    page,
    390,
    844,
    '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=1&look=left',
    'gc-2v2-blue1-teammate-390',
  );
  await load(page, 390, 844, '/dev/guessing-challenge-scene?mode=2v2&team=red&seat=0', 'gc-2v2-red0-390');
  await load(page, 390, 844, '/dev/guessing-challenge-scene?mode=2v2&team=red&seat=1', 'gc-2v2-red1-390');
  await load(page, 320, 700, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=0', 'gc-2v2-320');
  await load(page, 430, 932, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=0', 'gc-2v2-430');

  await load(page, 1366, 768, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=0', 'gc-2v2-blue0-desktop-1366');
  await load(page, 1366, 768, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=1', 'gc-2v2-blue1-desktop-1366');
  await load(page, 1366, 768, '/dev/guessing-challenge-scene?mode=2v2&team=red&seat=0', 'gc-2v2-red0-desktop-1366');
  await load(page, 1366, 768, '/dev/guessing-challenge-scene?mode=2v2&team=red&seat=1', 'gc-2v2-red1-desktop-1366');
  await load(page, 1536, 864, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=0', 'gc-2v2-blue0-desktop-1536');
  await load(page, 1536, 864, '/dev/guessing-challenge-scene?mode=2v2&team=blue&seat=1', 'gc-2v2-blue1-desktop-1536');
  await load(page, 1536, 864, '/dev/guessing-challenge-scene?mode=2v2&team=red&seat=0', 'gc-2v2-red0-desktop-1536');
  await load(page, 1536, 864, '/dev/guessing-challenge-scene?mode=2v2&team=red&seat=1', 'gc-2v2-red1-desktop-1536');

  await load(
    page,
    390,
    844,
    '/dev/guessing-challenge-scene?mode=2v2&approval=1',
    'gc-approval-banner-390',
  );
  await load(
    page,
    390,
    844,
    '/dev/guessing-challenge-scene?mode=2v2&approval=1',
    'gc-approval-dialog-390',
    async (p) => {
      const review = p.getByTestId('gc-review-card-request');
      if (await review.isVisible().catch(() => false)) await review.click();
      await p.waitForTimeout(300);
    },
  );
  await load(
    page,
    320,
    700,
    '/dev/guessing-challenge-scene?mode=2v2&approval=1',
    'gc-approval-dialog-320',
    async (p) => {
      const review = p.getByTestId('gc-review-card-request');
      if (await review.isVisible().catch(() => false)) await review.click();
      await p.waitForTimeout(300);
    },
  );

  await load(
    page,
    390,
    844,
    '/dev/guessing-challenge-scene?panel=playing&mode=1v1',
    'gc-guess-form-390',
    async (p) => {
      const open = p.getByTestId('gc-open-guess');
      if (await open.isVisible().catch(() => false)) await open.click();
      await p.waitForTimeout(400);
    },
  );
  await load(
    page,
    320,
    700,
    '/dev/guessing-challenge-scene?panel=playing&mode=1v1',
    'gc-guess-form-320',
    async (p) => {
      const open = p.getByTestId('gc-open-guess');
      if (await open.isVisible().catch(() => false)) await open.click();
      await p.waitForTimeout(400);
    },
  );
  await load(page, 390, 844, '/dev/guessing-challenge-scene?panel=results&mode=1v1', 'gc-round-results-390');
  await load(page, 320, 700, '/dev/guessing-challenge-scene?panel=results&mode=1v1', 'gc-round-results-320');
  await load(page, 390, 844, '/dev/guessing-challenge-scene?panel=final&mode=1v1', 'gc-final-results-390');
  await load(page, 320, 700, '/dev/guessing-challenge-scene?panel=final&mode=1v1', 'gc-final-results-320');
  await load(page, 390, 844, '/dev/guessing-challenge-scene?panel=spectator&mode=1v1', 'gc-spectator-390');

  await load(page, 390, 844, '/', 'reg-home-390');
  await load(page, 390, 844, '/?code=123456', 'reg-invite-390');
  await load(page, 390, 844, '/dev/ui', 'reg-ui-390');
  await load(page, 390, 844, '/dev/bara-al-salafa', 'reg-bara-390');

  await page.close();
} catch (error) {
  report.push({ name: 'script-error', message: error instanceof Error ? error.message : String(error) });
  console.error(error);
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
