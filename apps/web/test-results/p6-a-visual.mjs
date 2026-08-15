import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p6-a-visual');
mkdirSync(outDir, { recursive: true });
const report = [];

async function inspect(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const vw = html.clientWidth;
    const overflowing = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2 && (r.left < -2 || r.right > vw + 2);
      })
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 90),
        left: Math.round(el.getBoundingClientRect().left),
        right: Math.round(el.getBoundingClientRect().right),
      }));

    const visibleButtons = [...document.querySelectorAll('button')].filter((b) => {
      const r = b.getBoundingClientRect();
      const style = getComputedStyle(b);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });

    const hamburgers = visibleButtons.filter((b) => {
      const label = b.getAttribute('aria-label') || '';
      const text = (b.textContent || '').trim();
      return label.includes('القائمة') || text === '☰';
    });

    const tabLabels = ['الألعاب', 'اللاعبون', 'الدردشة'];
    const tabs = visibleButtons
      .map((b) => (b.textContent || '').trim())
      .filter((t) => tabLabels.includes(t));

    const cards = visibleButtons.filter((b) => b.getAttribute('aria-pressed') !== null);
    const catalogCols = (() => {
      if (cards.length < 2) return null;
      const y0 = Math.round(cards[0].getBoundingClientRect().y);
      return cards.filter((c) => Math.abs(Math.round(c.getBoundingClientRect().y) - y0) < 8).length;
    })();

    const sticky = document.querySelector('[data-lobby-sticky-start]');
    const stickyVisible = Boolean(
      sticky &&
        getComputedStyle(sticky).display !== 'none' &&
        sticky.getBoundingClientRect().height > 0,
    );

    const footer = document.querySelector('footer');
    const footerVisible = Boolean(
      footer &&
        getComputedStyle(footer).display !== 'none' &&
        footer.getBoundingClientRect().height > 4,
    );

    const header = document.querySelector('header');
    const desktopCols = document.querySelector('.xl\\:grid-cols-\\[minmax\\(220px\\,260px\\)_minmax\\(0\\,1fr\\)_minmax\\(168px\\,200px\\)\\]');

    return {
      scrollW: html.scrollWidth,
      clientW: html.clientWidth,
      overflow: html.scrollWidth > html.clientWidth + 1,
      overflowing,
      hamburgerCount: hamburgers.length,
      hamburgerLabels: hamburgers.map((b) => b.getAttribute('aria-label')),
      footerVisible,
      tabs,
      catalogCols,
      stickyVisible,
      headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
      waitingHost: Boolean([...document.querySelectorAll('*')].find((el) => el.textContent === 'بانتظار المضيف لبدء اللعبة.')),
      startCta: visibleButtons.some((b) => (b.textContent || '').includes('بدء اللعبة')),
      desktopGridPresent: Boolean(desktopCols),
    };
  });
}

async function shot(page, name) {
  await page.waitForTimeout(350);
  const m = await inspect(page);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  report.push({ name, viewport: `${page.viewportSize()?.width}x${page.viewportSize()?.height}`, url: page.url(), ...m });
  return m;
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [w, h] of [
    [320, 700],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'ar-SA' });
    page.setDefaultTimeout(25000);
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(600);
    await shot(page, `home-${w}`);
    await page.close();
  }

  for (const [w, h] of [
    [320, 700],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'ar-SA' });
    await page.goto('http://localhost:3000/?code=123456', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(500);
    await shot(page, `invite-${w}`);
    await page.close();
  }

  const host = await browser.newPage({ viewport: { width: 320, height: 700 }, locale: 'ar-SA' });
  host.setDefaultTimeout(30000);
  await host.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await host.waitForTimeout(600);
  await host.locator('#create-name').fill('مضيف');
  await host.getByRole('button', { name: 'إنشاء غرفة' }).click();
  await host.waitForURL(/\/lobby\?code=\d+/, { timeout: 30000 });
  await host.waitForTimeout(1000);
  const code = new URL(host.url()).searchParams.get('code');
  await shot(host, 'lobby-games-320');

  await host.getByRole('button', { name: /قائمة الغرفة/ }).click();
  await host.waitForTimeout(250);
  await shot(host, 'lobby-menu-320');

  await host.getByRole('button', { name: 'مغادرة الغرفة' }).click();
  await host.waitForTimeout(250);
  await shot(host, 'lobby-leave-320');
  await host.getByRole('button', { name: 'إلغاء' }).click();
  const closeMenu = host.getByRole('button', { name: 'إغلاق قائمة الغرفة' });
  if (await closeMenu.isVisible().catch(() => false)) {
    await closeMenu.click();
  }

  await host.getByRole('button', { name: 'اللاعبون' }).click();
  await host.waitForTimeout(250);
  await shot(host, 'lobby-players-320');

  await host.getByRole('button', { name: 'الألعاب' }).click();
  await host.setViewportSize({ width: 390, height: 844 });
  await host.waitForTimeout(400);
  await shot(host, 'lobby-games-390');

  await host.getByRole('button', { name: /قائمة الغرفة/ }).click();
  await host.waitForTimeout(250);
  await shot(host, 'lobby-menu-390');
  await host.getByRole('button', { name: 'مغادرة الغرفة' }).click();
  await host.waitForTimeout(250);
  await shot(host, 'lobby-leave-390');
  await host.getByRole('button', { name: 'إلغاء' }).click();
  if (await host.getByRole('button', { name: 'إغلاق قائمة الغرفة' }).isVisible().catch(() => false)) {
    await host.getByRole('button', { name: 'إغلاق قائمة الغرفة' }).click();
  }

  await host.getByRole('button', { name: 'اللاعبون' }).click();
  await host.waitForTimeout(250);
  await shot(host, 'lobby-players-390');

  await host.getByRole('button', { name: 'الألعاب' }).click();
  await host.setViewportSize({ width: 430, height: 932 });
  await host.waitForTimeout(400);
  await shot(host, 'lobby-games-430');

  const guest = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  await guest.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await guest.waitForTimeout(500);
  await guest.locator('#join-name').fill('ضيف');
  await guest.locator('#join-code').fill(code ?? '');
  await guest.getByRole('button', { name: 'دخول الغرفة' }).click();
  await guest.waitForURL(/\/lobby/, { timeout: 30000 });
  await guest.waitForTimeout(1000);
  await shot(guest, 'lobby-nonhost-390');
  await guest.close();

  await host.setViewportSize({ width: 1366, height: 768 });
  await host.waitForTimeout(500);
  await shot(host, 'lobby-desktop-1366');
  await host.close();
} catch (error) {
  report.push({ name: 'script-error', message: error instanceof Error ? error.message : String(error) });
  console.error(error);
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
