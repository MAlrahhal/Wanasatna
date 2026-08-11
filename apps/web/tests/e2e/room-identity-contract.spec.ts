/**
 * Browser suite A–J: ephemeral room-scoped RoomPlayer identity contract.
 */
import { test, expect, type Page } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

async function createViaHome(page: Page, name: string): Promise<string> {
  await page.goto('/');
  const section = page.locator('#start-play');
  await section.locator('#create-name').fill(name);
  await section.getByRole('button', { name: 'إنشاء غرفة' }).click();
  await page.waitForURL(/\/lobby\?code=\d+/, { timeout: 30_000 });
  const code = new URL(page.url()).searchParams.get('code');
  if (!code) throw new Error('missing room code');
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  return code;
}

async function joinViaHome(page: Page, code: string, name: string): Promise<void> {
  await page.goto('/');
  const section = page.locator('#start-play');
  await section.locator('#join-name').fill(name);
  await section.locator('#join-code').fill(code);
  await section.getByRole('button', { name: 'انضم الآن' }).click();
  await page.waitForURL(new RegExp(`/lobby\\?code=${code}`), { timeout: 30_000 });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
}

async function leaveLobby(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20_000 });
}

async function readSession(page: Page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('wanasatna:active-room-session');
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    return {
      playerId: parsed?.playerId ?? null,
      playerName: parsed?.playerName ?? null,
      roomCode: parsed?.roomCode ?? null,
      resume: raw,
      legacyKeys: Object.keys(localStorage).filter((k) => k.startsWith('wanasatna:reconnect:')),
    };
  });
}

async function seedLegacyLocalStorage(page: Page, roomCode: string) {
  await page.goto('/');
  await page.evaluate((code) => {
    localStorage.setItem(
      `wanasatna:reconnect:${code}`,
      JSON.stringify({
        playerId: 'legacy-player',
        roomId: 'legacy-room',
        roomCode: code,
        reconnectToken: 'legacy-token',
      }),
    );
    sessionStorage.setItem('wanasatna:playerId', 'legacy-player');
    sessionStorage.setItem('wanasatna:roomId', 'legacy-room');
    sessionStorage.setItem('wanasatna:playerName', 'محمد');
    sessionStorage.setItem('wanasatna:roomCode', code);
  }, roomCode);
}

test.describe('Room identity contract (browser A–J)', () => {
  test('A: exact production failure — محمد leave → خلود create → عبدالله join', async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await createViaHome(a, 'محمد');
    await joinViaHome(b, roomA, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);
    await waitForRoster(b, ['محمد', 'خالد']);

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await createViaHome(a, 'خلود');
    expect(roomB).not.toBe(roomA);
    await expect(a.getByText('خلود').first()).toBeVisible();
    await expect(a.getByText('محمد')).toHaveCount(0);
    expect((await readSession(a)).playerName).toBe('خلود');
    expect((await readSession(a)).legacyKeys).toEqual([]);

    await joinViaHome(b, roomB, 'عبدالله');
    await waitForRoster(a, ['خلود', 'عبدالله']);
    await waitForRoster(b, ['خلود', 'عبدالله']);
    await expect(a.getByText('محمد')).toHaveCount(0);
    await expect(a.getByText('خالد')).toHaveCount(0);
    await expect(b.getByText('محمد')).toHaveCount(0);
    await expect(b.getByText('خالد')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });

  test('B+C: A→B→C then refresh preserves Room C identity', async ({ browser }) => {
    test.setTimeout(300_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await createViaHome(a, 'محمد');
    await joinViaHome(b, roomA, 'خالد');
    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await createViaHome(a, 'خلود');
    await joinViaHome(b, roomB, 'عبدالله');
    await leaveLobby(b);
    await leaveLobby(a);

    const roomC = await createViaHome(a, 'سارة');
    await joinViaHome(b, roomC, 'يوسف');
    await waitForRoster(a, ['سارة', 'يوسف']);
    expect(roomC).not.toBe(roomA);
    expect(roomC).not.toBe(roomB);

    const before = await readSession(b);
    await b.reload();
    await pageWaitLobby(b, roomC);
    await expect(b.getByText('يوسف').first()).toBeVisible({ timeout: 20_000 });
    const after = await readSession(b);
    expect(after.playerId).toBe(before.playerId);
    expect(after.playerName).toBe('يوسف');
    expect(after.roomCode).toBe(roomC);
    await waitForRoster(a, ['سارة', 'يوسف']);

    await ctxA.close();
    await ctxB.close();
  });

  test('D: create-after-leave typed host names', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    const codes: string[] = [];
    const names = ['محمد', 'خلود', 'أحمد'];
    const ids: string[] = [];

    for (const name of names) {
      const code = await createViaHome(page, name);
      codes.push(code);
      const session = await readSession(page);
      expect(session.playerName).toBe(name);
      ids.push(session.playerId!);
      await leaveLobby(page);
    }

    expect(new Set(codes).size).toBe(3);
    expect(new Set(ids).size).toBe(3);
    await ctx.close();
  });

  test('E: join-after-leave typed guest names', async ({ browser }) => {
    test.setTimeout(240_000);
    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const guestCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const names = ['خالد', 'عبدالله', 'يوسف'];
    const ids: string[] = [];

    for (const name of names) {
      const code = await createViaHome(host, `Host-${name}`);
      await joinViaHome(guest, code, name);
      const session = await readSession(guest);
      expect(session.playerName).toBe(name);
      ids.push(session.playerId!);
      await leaveLobby(guest);
      await leaveLobby(host);
    }

    expect(new Set(ids).size).toBe(3);
    await hostCtx.close();
    await guestCtx.close();
  });

  test('F+G: End Game preserves roster; Game A → End → Game B; then new Room', async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await createViaHome(a, 'محمد');
    await joinViaHome(b, roomA, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await a.getByRole('button', { name: 'تحدي التوقيت' }).click();
    await expect(a.getByText('✓ مختارة')).toBeVisible({ timeout: 10_000 });
    await a.getByRole('button', { name: 'بدء اللعبة' }).click();
    await a.waitForURL('**/game**', { timeout: 30_000 });
    await b.waitForURL('**/game**', { timeout: 30_000 });

    await a.getByRole('button', { name: 'إدارة الغرفة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).last().click();
    await a.waitForURL(/\/lobby\?code=/, { timeout: 30_000 });
    await b.waitForURL(/\/lobby\?code=/, { timeout: 30_000 });
    await waitForRoster(a, ['محمد', 'خالد']);
    await waitForRoster(b, ['محمد', 'خالد']);

    await a.getByRole('button', { name: 'تحدي التخمين' }).click();
    await expect(a.getByText('✓ مختارة')).toBeVisible({ timeout: 10_000 });
    await a.getByRole('button', { name: 'بدء اللعبة' }).click();
    await a.waitForURL('**/game**', { timeout: 30_000 });
    await b.waitForURL('**/game**', { timeout: 30_000 });

    await a.getByRole('button', { name: 'إدارة الغرفة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).last().click();
    await a.waitForURL(/\/lobby\?code=/, { timeout: 30_000 });
    await waitForRoster(a, ['محمد', 'خالد']);

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await createViaHome(a, 'خلود');
    await joinViaHome(b, roomB, 'عبدالله');
    await waitForRoster(a, ['خلود', 'عبدالله']);
    await expect(a.getByText('محمد')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });

  test('H: same-room refresh reconnects same RoomPlayer', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();
    const code = await createViaHome(page, 'سارة');
    const before = await readSession(page);

    await page.reload();
    await pageWaitLobby(page, code);
    const after = await readSession(page);
    expect(after.playerId).toBe(before.playerId);
    expect(after.playerName).toBe('سارة');
    await expect(page.getByText('سارة').first()).toBeVisible();
    await ctx.close();
  });

  test('I: legacy localStorage cannot resurrect RoomPlayer', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    await seedLegacyLocalStorage(page, '111111');
    const room = await createViaHome(page, 'خلود');
    expect(room).not.toBe('111111');
    const session = await readSession(page);
    expect(session.playerName).toBe('خلود');
    expect(session.playerId).not.toBe('legacy-player');
    expect(session.legacyKeys).toEqual([]);

    await leaveLobby(page);

    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const code = await createViaHome(host, 'Host');
    await seedLegacyLocalStorage(page, code);
    await joinViaHome(page, code, 'عبدالله');
    const joined = await readSession(page);
    expect(joined.playerName).toBe('عبدالله');
    expect(joined.playerId).not.toBe('legacy-player');
    expect(joined.legacyKeys).toEqual([]);

    await ctx.close();
    await hostCtx.close();
  });

  test('J: entry generation ignores stale Room A after Room B create', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    const roomA = await enterLobbyCreate(page, 'محمد');
    await leaveLobby(page);

    const roomB = await enterLobbyCreate(page, 'خلود');
    expect(roomB).not.toBe(roomA);
    await expect(page.getByText('خلود').first()).toBeVisible();

    // Poison display name mid-session — Room code/id remain authoritative for resume.
    await page.evaluate(() => {
      const raw = sessionStorage.getItem('wanasatna:active-room-session');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      parsed.playerName = 'محمد';
      sessionStorage.setItem('wanasatna:active-room-session', JSON.stringify(parsed));
    });

    // UI authority remains Room B until a scoped payload applies.
    await expect(page.getByText('خلود').first()).toBeVisible();
    const codeInUrl = new URL(page.url()).searchParams.get('code');
    expect(codeInUrl).toBe(roomB);

    await page.reload();
    await pageWaitLobby(page, roomB);
    await expect(page.getByText('خلود').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('محمد')).toHaveCount(0);

    await ctx.close();
  });
});

async function pageWaitLobby(page: Page, code: string): Promise<void> {
  await page.waitForURL(new RegExp(`/lobby\\?code=${code}`), { timeout: 30_000 });
}
