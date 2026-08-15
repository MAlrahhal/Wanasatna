import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'p6-b-visual');
mkdirSync(outDir, { recursive: true });
const report = [];

async function inspect(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const header = document.querySelector('header');
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const buttons = [...document.querySelectorAll('button')].filter(visible);
    const chatVisible = buttons.filter((b) => {
      const t = `${b.getAttribute('aria-label') || ''} ${(b.textContent || '').trim()}`;
      return t.includes('الدردشة');
    }).length;
    const ranking = buttons.filter((b) => (b.getAttribute('aria-label') || b.textContent || '').includes('الترتيب'));
    const room = buttons.filter((b) => (b.getAttribute('aria-label') || b.textContent || '').includes('إدارة الغرفة'));
    const canvas = document.querySelector('canvas');
    const sticky = [...document.querySelectorAll('button')].find((b) => {
      const t = (b.textContent || '').trim();
      return visible(b) && (t === 'إرسال' || t === 'إرسال الإجابة' || t === 'تأكيد الاختيار');
    });
    return {
      overflow: html.scrollWidth > html.clientWidth + 1,
      scrollW: html.scrollWidth,
      clientW: html.clientWidth,
      headerH: header && visible(header) ? Math.round(header.getBoundingClientRect().height) : null,
      chatVisible,
      rankingVisible: ranking.length,
      rankingH: ranking[0] ? Math.round(ranking[0].getBoundingClientRect().height) : null,
      roomVisible: room.length,
      roomH: room[0] ? Math.round(room[0].getBoundingClientRect().height) : null,
      canvasH: canvas ? Math.round(canvas.getBoundingClientRect().height) : null,
      touchAction: canvas ? getComputedStyle(canvas).touchAction : null,
      stickyCta: sticky ? (sticky.textContent || '').trim() : null,
      stickyFixed: Boolean(sticky?.closest('.fixed, [class*="fixed"]')),
    };
  });
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  const m = await inspect(page);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  const entry = { name, viewport: `${page.viewportSize()?.width}x${page.viewportSize()?.height}`, url: page.url(), ...m };
  report.push(entry);
  return m;
}

async function shotLocator(page, locator, name) {
  await page.waitForTimeout(250);
  if (await locator.isVisible().catch(() => false)) {
    await locator.screenshot({ path: join(outDir, `${name}.png`) });
    report.push({ name, kind: 'locator' });
  } else {
    report.push({ name, kind: 'locator-missing' });
  }
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const preview = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  await preview.goto('http://localhost:3000/dev/bara-al-salafa', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await preview.waitForTimeout(600);

  const phases = [
    ['Countdown', 'العد التنازلي قبل بدء الجولة', 'preview-countdown-390'],
    ['Role Reveal', 'كشف الدور', 'preview-role-390'],
    ['Voting', 'مرحلة التصويت', 'preview-voting-390'],
    ['Round Results', 'نتائج الجولة', 'preview-round-390'],
    ['Match Results', 'النتائج النهائية', 'preview-match-390'],
  ];
  for (const [label, aria, name] of phases) {
    await preview.getByRole('button', { name: label, exact: true }).click();
    await preview.waitForTimeout(300);
    await shotLocator(preview, preview.locator(`[aria-label="${aria}"]`), name);
  }

  await preview.setViewportSize({ width: 320, height: 700 });
  await preview.getByRole('button', { name: 'Voting', exact: true }).click();
  await preview.waitForTimeout(300);
  await shotLocator(preview, preview.locator('[aria-label="مرحلة التصويت"]'), 'preview-voting-320');
  await preview.getByRole('button', { name: 'Match Results', exact: true }).click();
  await preview.waitForTimeout(300);
  await shotLocator(preview, preview.locator('[aria-label="النتائج النهائية"]'), 'preview-match-320');

  await preview.setViewportSize({ width: 430, height: 932 });
  await preview.getByRole('button', { name: 'Round Results', exact: true }).click();
  await preview.waitForTimeout(300);
  await shotLocator(preview, preview.locator('[aria-label="نتائج الجولة"]'), 'preview-round-430');
  await preview.close();

  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  host.setDefaultTimeout(30000);
  guest.setDefaultTimeout(30000);

  await host.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await host.waitForTimeout(500);
  await host.locator('#create-name').fill('مضيف');
  await host.getByRole('button', { name: 'إنشاء غرفة' }).click();
  await host.waitForURL(/\/lobby\?code=\d+/, { timeout: 30000 });
  const code = new URL(host.url()).searchParams.get('code');

  await guest.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await guest.waitForTimeout(400);
  await guest.locator('#join-name').fill('ضيف');
  await guest.locator('#join-code').fill(code ?? '');
  await guest.getByRole('button', { name: 'دخول الغرفة' }).click();
  await guest.waitForURL(/\/lobby/, { timeout: 30000 });
  await host.waitForTimeout(800);

  await host.getByRole('button', { name: 'ارسم وخمن' }).click();
  await host.waitForTimeout(400);
  await host.locator('[data-lobby-sticky-start]').getByRole('button', { name: 'بدء اللعبة' }).click();
  await host.waitForURL('**/game**', { timeout: 30000 });
  await guest.waitForURL('**/game**', { timeout: 30000 });
  await host.waitForTimeout(2500);

  await shot(host, 'draw-host-390');
  await shot(guest, 'draw-guest-390');

  const rankingBtn = host.getByRole('button', { name: 'الترتيب' });
  if (await rankingBtn.isVisible().catch(() => false)) {
    await rankingBtn.click();
    await host.waitForTimeout(300);
    await shot(host, 'leaderboard-sheet-390');
    const close = host.getByRole('button', { name: 'إغلاق' });
    if (await close.isVisible().catch(() => false)) await close.click();
  }

  const roomBtn = host.getByRole('button', { name: 'إدارة الغرفة' });
  if (await roomBtn.isVisible().catch(() => false)) {
    await roomBtn.click();
    await host.waitForTimeout(300);
    await shot(host, 'room-mgmt-390');
    const closeRoom = host.getByRole('button', { name: 'إغلاق' }).last();
    if (await closeRoom.isVisible().catch(() => false)) await closeRoom.click();
  }

  await host.setViewportSize({ width: 320, height: 700 });
  await host.waitForTimeout(400);
  await shot(host, 'draw-host-320');

  await host.setViewportSize({ width: 430, height: 932 });
  await host.waitForTimeout(400);
  await shot(host, 'draw-host-430');

  await host.setViewportSize({ width: 844, height: 390 });
  await host.waitForTimeout(400);
  await shot(host, 'draw-host-landscape');

  await host.setViewportSize({ width: 1366, height: 768 });
  await host.waitForTimeout(500);
  await shot(host, 'draw-host-desktop');

  await host.setViewportSize({ width: 390, height: 844 });
  const leave = host.getByRole('button', { name: 'إنهاء اللعبة' });
  if (await roomBtn.isVisible().catch(() => false)) {
    await roomBtn.click();
    await host.waitForTimeout(200);
  }
  if (await leave.isVisible().catch(() => false)) {
    await leave.click();
    const confirm = host.getByRole('button', { name: 'إنهاء اللعبة' }).last();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await host.waitForURL(/\/lobby/, { timeout: 30000 });
    await guest.waitForURL(/\/lobby/, { timeout: 30000 });
    await host.waitForTimeout(800);
    await host.getByRole('button', { name: 'أسرع إجابة' }).click();
    await host.waitForTimeout(300);
    await host.locator('[data-lobby-sticky-start]').getByRole('button', { name: 'بدء اللعبة' }).click();
    await host.waitForURL('**/game**', { timeout: 30000 });
    await guest.waitForURL('**/game**', { timeout: 30000 });
    await host.waitForTimeout(4000);
    await shot(host, 'fast-answer-390');
    await shot(guest, 'fast-answer-guest-390');
    await host.setViewportSize({ width: 844, height: 390 });
    await host.waitForTimeout(400);
    await shot(host, 'fast-answer-landscape');
  } else {
    report.push({ name: 'fast-answer-skipped', reason: 'could not end draw-guess' });
  }

  await hostCtx.close();
  await guestCtx.close();
} catch (error) {
  report.push({ name: 'script-error', message: error instanceof Error ? error.message : String(error) });
  console.error(error);
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
