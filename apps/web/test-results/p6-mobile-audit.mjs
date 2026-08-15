import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p6-mobile-audit');
mkdirSync(outDir, { recursive: true });
const report = [];

async function metrics(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const overflowX = html.scrollWidth > html.clientWidth + 2;
    const tiny = [...document.querySelectorAll('button, a, input, textarea, [role="button"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const label = (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0, 40);
        return {
          label,
          w: Math.round(r.width),
          h: Math.round(r.height),
          y: Math.round(r.y),
        };
      })
      .filter((t) => t.w > 0 && t.h > 0 && (t.h < 40 || t.w < 40))
      .slice(0, 12);
    const header = document.querySelector('header');
    const headerH = header ? Math.round(header.getBoundingClientRect().height) : null;
    return {
      overflowX,
      scrollW: html.scrollWidth,
      clientW: html.clientWidth,
      headerH,
      tiny,
    };
  });
}

async function shot(browser, { url, w, h, name, after }) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'ar-SA' });
  page.setDefaultTimeout(25000);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);
  if (after) {
    await after(page);
    await page.waitForTimeout(500);
  }
  const m = await metrics(page);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  report.push({ name, viewport: `${w}x${h}`, ...m });
  await page.close();
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [w, h] of [
    [320, 700],
    [360, 800],
    [375, 812],
    [390, 844],
    [430, 932],
  ]) {
    await shot(browser, { url: 'http://localhost:3000/', w, h, name: `home-${w}` });
  }

  await shot(browser, {
    url: 'http://localhost:3000/?code=123456',
    w: 390,
    h: 844,
    name: 'invite-390',
  });
  await shot(browser, {
    url: 'http://localhost:3000/?code=123456',
    w: 320,
    h: 700,
    name: 'invite-320',
  });

  await shot(browser, {
    url: 'http://localhost:3000/',
    w: 390,
    h: 844,
    name: 'home-menu-390',
    after: async (page) => {
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/ui#dialogs',
    w: 390,
    h: 844,
    name: 'ui-dialogs-390',
    after: async (page) => {
      await page.locator('#dialogs').scrollIntoViewIfNeeded();
      const open = page.getByRole('button', { name: /فتح|Open|تحذير|Warning/i }).first();
      if (await open.count()) {
        await open.click().catch(() => {});
      }
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    w: 390,
    h: 844,
    name: 'bara-role-390',
    after: async (page) => {
      const mobile = page.getByText('Desktop/mobile width');
      if (await mobile.count()) {
        await page.locator('input[type="checkbox"]').first().check().catch(() => {});
      }
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    w: 320,
    h: 700,
    name: 'bara-round-320',
    after: async (page) => {
      await page.getByRole('button', { name: 'Round Results' }).click();
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    w: 390,
    h: 844,
    name: 'bara-vote-390',
    after: async (page) => {
      await page.getByRole('button', { name: 'Voting' }).click();
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/bara-al-salafa',
    w: 430,
    h: 932,
    name: 'bara-final-430',
    after: async (page) => {
      await page.getByRole('button', { name: 'Match Results' }).click();
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/guessing-challenge-scene',
    w: 390,
    h: 844,
    name: 'gc-1v1-390',
  });
  await shot(browser, {
    url: 'http://localhost:3000/dev/guessing-challenge-scene',
    w: 320,
    h: 700,
    name: 'gc-320',
  });
  await shot(browser, {
    url: 'http://localhost:3000/dev/guessing-challenge-scene',
    w: 390,
    h: 844,
    name: 'gc-2v2-390',
    after: async (page) => {
      const btn = page.getByRole('button', { name: '2v2' });
      if (await btn.count()) await btn.click();
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/dev/ui#game-components',
    w: 390,
    h: 844,
    name: 'ui-game-390',
    after: async (page) => {
      await page.locator('#game-components').scrollIntoViewIfNeeded();
    },
  });

  await shot(browser, {
    url: 'http://localhost:3000/',
    w: 844,
    h: 390,
    name: 'home-landscape',
  });
  await shot(browser, {
    url: 'http://localhost:3000/dev/guessing-challenge-scene',
    w: 844,
    h: 390,
    name: 'gc-landscape',
  });

  const lobbyPage = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  await lobbyPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await lobbyPage.waitForTimeout(600);
  await lobbyPage.locator('#create-name').fill('تدقيق');
  await lobbyPage.getByRole('button', { name: 'إنشاء غرفة' }).click();
  await lobbyPage.waitForURL(/\/lobby/, { timeout: 20000 }).catch(() => null);
  await lobbyPage.waitForTimeout(1200);
  const lobbyM = await metrics(lobbyPage);
  await lobbyPage.screenshot({ path: join(outDir, 'lobby-host-games-390.png'), fullPage: false });
  report.push({ name: 'lobby-host-games-390', viewport: '390x844', url: lobbyPage.url(), ...lobbyM });

  await lobbyPage.getByRole('button', { name: 'اللاعبون' }).click();
  await lobbyPage.waitForTimeout(300);
  await lobbyPage.screenshot({ path: join(outDir, 'lobby-host-players-390.png'), fullPage: false });
  report.push({ name: 'lobby-host-players-390', viewport: '390x844', ...(await metrics(lobbyPage)) });

  await lobbyPage.getByRole('button', { name: 'الدردشة' }).click();
  await lobbyPage.waitForTimeout(300);
  await lobbyPage.screenshot({ path: join(outDir, 'lobby-host-chat-390.png'), fullPage: false });
  report.push({ name: 'lobby-host-chat-390', viewport: '390x844', ...(await metrics(lobbyPage)) });

  await lobbyPage.getByRole('button', { name: 'الألعاب' }).click();
  await lobbyPage.waitForTimeout(200);
  await lobbyPage.setViewportSize({ width: 320, height: 700 });
  await lobbyPage.waitForTimeout(300);
  await lobbyPage.screenshot({ path: join(outDir, 'lobby-host-games-320.png'), fullPage: false });
  report.push({ name: 'lobby-host-games-320', viewport: '320x700', ...(await metrics(lobbyPage)) });

  await lobbyPage.setViewportSize({ width: 430, height: 932 });
  await lobbyPage.waitForTimeout(300);
  await lobbyPage.screenshot({ path: join(outDir, 'lobby-host-games-430.png'), fullPage: false });
  report.push({ name: 'lobby-host-games-430', viewport: '430x932', ...(await metrics(lobbyPage)) });

  await lobbyPage.setViewportSize({ width: 390, height: 844 });
  const menu = lobbyPage.getByRole('button', { name: /قائمة الغرفة/ });
  if (await menu.count()) {
    await menu.click();
    await lobbyPage.waitForTimeout(200);
  }
  await lobbyPage.getByRole('button', { name: 'مغادرة الغرفة' }).click();
  await lobbyPage.waitForTimeout(300);
  await lobbyPage.screenshot({ path: join(outDir, 'lobby-leave-dialog-390.png'), fullPage: false });
  report.push({ name: 'lobby-leave-dialog-390', viewport: '390x844', ...(await metrics(lobbyPage)) });
  await lobbyPage.close();
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
