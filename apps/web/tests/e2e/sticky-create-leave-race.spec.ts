/**
 * Sticky create URL + leave/reconnect race browser contract.
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
  await page.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
}

async function leaveLobby(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20_000 });
}

async function readIdentity(page: Page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('wanasatna:active-room-session');
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    return {
      url: location.href,
      playerId: parsed?.playerId ?? null,
      playerName: parsed?.playerName ?? null,
      roomCode: parsed?.roomCode ?? null,
      roomId: parsed?.roomId ?? null,
      hasActionCreate: new URLSearchParams(location.search).get('action') === 'create',
      hasNameParam: new URLSearchParams(location.search).has('name'),
    };
  });
}

test.describe('Sticky create URL + leave race', () => {
  test('A: Create خلود → canonical URL → refresh same Room', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    const code = await createViaHome(page, 'خلود');
    await expect.poll(async () => (await readIdentity(page)).hasActionCreate).toBe(false);
    await expect.poll(async () => (await readIdentity(page)).hasNameParam).toBe(false);
    const before = await readIdentity(page);
    expect(before.playerName).toBe('خلود');
    expect(before.url).toContain(`code=${code}`);

    await page.reload();
    await page.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
    const after = await readIdentity(page);
    expect(after.hasActionCreate).toBe(false);
    expect(after.playerId).toBe(before.playerId);
    expect(after.roomId).toBe(before.roomId);
    expect(after.playerName).toBe('خلود');
    await expect(page.getByText('خلود').first()).toBeVisible();

    await ctx.close();
  });

  test('B+D: محمد leave → خلود; خالد leave → عبدالله', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await createViaHome(a, 'محمد');
    await joinViaHome(b, roomA, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await createViaHome(a, 'خلود');
    expect(roomB).not.toBe(roomA);
    await expect.poll(async () => (await readIdentity(a)).hasActionCreate).toBe(false);
    expect((await readIdentity(a)).playerName).toBe('خلود');
    await expect(a.getByText('محمد')).toHaveCount(0);

    await joinViaHome(b, roomB, 'عبدالله');
    await waitForRoster(a, ['خلود', 'عبدالله']);
    await expect(a.getByText('خالد')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });

  test('C: join leave join fresh playerId', async ({ browser }) => {
    test.setTimeout(240_000);
    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const guestCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const roomA = await createViaHome(host, 'HostA');
    await joinViaHome(guest, roomA, 'خالد');
    const idA = (await readIdentity(guest)).playerId;
    await leaveLobby(guest);
    await leaveLobby(host);

    const roomB = await createViaHome(host, 'HostB');
    await joinViaHome(guest, roomB, 'عبدالله');
    const idB = (await readIdentity(guest)).playerId;
    expect(idB).not.toBe(idA);
    expect((await readIdentity(guest)).playerName).toBe('عبدالله');

    await hostCtx.close();
    await guestCtx.close();
  });

  test('E: A→B→C identities', async ({ browser }) => {
    test.setTimeout(300_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const names = [
      ['محمد', 'خالد'],
      ['خلود', 'عبدالله'],
      ['سارة', 'يوسف'],
    ] as const;
    const codes: string[] = [];
    const hostIds: string[] = [];

    for (const [hostName, guestName] of names) {
      const code = await createViaHome(a, hostName);
      codes.push(code);
      hostIds.push((await readIdentity(a)).playerId!);
      await joinViaHome(b, code, guestName);
      await waitForRoster(a, [hostName, guestName]);
      await leaveLobby(b);
      await leaveLobby(a);
    }

    expect(new Set(codes).size).toBe(3);
    expect(new Set(hostIds).size).toBe(3);
    await ctxA.close();
    await ctxB.close();
  });

  test('I: 5-cycle create/leave identity stress', async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();
    const names = ['محمد', 'خلود', 'أحمد', 'سارة', 'نورة'];
    const ids: string[] = [];

    for (const name of names) {
      await createViaHome(page, name);
      await expect.poll(async () => (await readIdentity(page)).hasActionCreate).toBe(false);
      const id = (await readIdentity(page)).playerId!;
      ids.push(id);
      expect((await readIdentity(page)).playerName).toBe(name);
      await leaveLobby(page);
    }

    expect(new Set(ids).size).toBe(5);
    await ctx.close();
  });

  test('H: delayed old-room session cannot overwrite new room UI', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    const roomA = await enterLobbyCreate(page, 'محمد');
    await leaveLobby(page);
    const roomB = await enterLobbyCreate(page, 'خلود');
    expect(roomB).not.toBe(roomA);

    await page.evaluate((oldCode) => {
      const raw = sessionStorage.getItem('wanasatna:active-room-session');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      parsed.playerName = 'محمد';
      parsed.roomCode = oldCode;
      sessionStorage.setItem('wanasatna:active-room-session', JSON.stringify(parsed));
    }, roomA);

    await expect(page.getByText('خلود').first()).toBeVisible();
    await expect.poll(async () => new URL(page.url()).searchParams.get('action')).toBeNull();
    expect(new URL(page.url()).searchParams.get('code')).toBe(roomB);

    await ctx.close();
  });

  test('F: End Game → Lobby preserves Room; Game A → End → Game B', async ({ browser }) => {
    test.setTimeout(300_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const room = await createViaHome(a, 'محمد');
    await joinViaHome(b, room, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await a.getByRole('button', { name: 'تحدي التوقيت' }).click();
    await expect(a.getByText('✓ مختارة')).toBeVisible({ timeout: 10_000 });
    await a.getByRole('button', { name: 'بدء اللعبة' }).click();
    await a.waitForURL('**/game**', { timeout: 30_000 });
    await b.waitForURL('**/game**', { timeout: 30_000 });

    await a.getByRole('button', { name: 'إدارة الغرفة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).last().click();
    await a.waitForURL(new RegExp(`/lobby\\?code=${room}$`), { timeout: 30_000 });
    await b.waitForURL(new RegExp(`/lobby\\?code=${room}$`), { timeout: 30_000 });
    await waitForRoster(a, ['محمد', 'خالد']);
    expect((await readIdentity(a)).hasActionCreate).toBe(false);

    await a.getByRole('button', { name: 'تحدي التخمين' }).click();
    await expect(a.getByText('✓ مختارة')).toBeVisible({ timeout: 10_000 });
    await a.getByRole('button', { name: 'بدء اللعبة' }).click();
    await a.waitForURL('**/game**', { timeout: 30_000 });
    await b.waitForURL('**/game**', { timeout: 30_000 });

    await ctxA.close();
    await ctxB.close();
  });

  test('G: End Game → Leave → new Room', async ({ browser }) => {
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

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await createViaHome(a, 'خلود');
    expect(roomB).not.toBe(roomA);
    await joinViaHome(b, roomB, 'عبدالله');
    await waitForRoster(a, ['خلود', 'عبدالله']);
    await expect(a.getByText('محمد')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });

  test('true disconnect still reconnects same identity', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();
    const code = await createViaHome(page, 'خلود');
    const before = await readIdentity(page);

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.waitForTimeout(1500);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    await expect(page.getByText('خلود').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
    const after = await readIdentity(page);
    expect(after.playerId).toBe(before.playerId);
    expect(after.roomId).toBe(before.roomId);
    expect(after.hasActionCreate).toBe(false);

    await ctx.close();
  });
});
