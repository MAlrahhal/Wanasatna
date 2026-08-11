/**
 * Room Client Core V2 — Home-based browser contracts.
 * Create/Join must use real Home UI (never action=create URL commands).
 */
import { test, expect, type Page } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

async function leaveLobby(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20_000 });
}

async function readV2Session(page: Page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('wanasatna:active-room-session');
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    return {
      url: location.href,
      hasActionCreate: new URLSearchParams(location.search).get('action') === 'create',
      playerId: parsed?.playerId ?? null,
      playerName: parsed?.playerName ?? null,
      roomCode: parsed?.roomCode ?? null,
      roomId: parsed?.roomId ?? null,
      legacyResume: sessionStorage.getItem('wanasatna:active-room-resume'),
      legacyPlayerId: sessionStorage.getItem('wanasatna:playerId'),
    };
  });
}

test.describe('Room Client Core V2', () => {
  test('E2E A: محمد/خالد → Leave → خلود/عبدالله', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await enterLobbyCreate(a, 'محمد');
    await enterLobbyJoin(b, roomA, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await enterLobbyCreate(a, 'خلود');
    expect(roomB).not.toBe(roomA);
    expect((await readV2Session(a)).hasActionCreate).toBe(false);
    expect((await readV2Session(a)).playerName).toBe('خلود');
    await expect(a.getByText('محمد')).toHaveCount(0);

    await enterLobbyJoin(b, roomB, 'عبدالله');
    await waitForRoster(a, ['خلود', 'عبدالله']);
    await expect(a.getByText('خالد')).toHaveCount(0);
    expect((await readV2Session(a)).legacyResume).toBeNull();
    expect((await readV2Session(a)).legacyPlayerId).toBeNull();

    await ctxA.close();
    await ctxB.close();
  });

  test('E2E B: ten-cycle create/leave same browser', async ({ browser }) => {
    test.setTimeout(360_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();
    const names = ['ن1', 'ن2', 'ن3', 'ن4', 'ن5', 'ن6', 'ن7', 'ن8', 'ن9', 'ن10'];
    const ids: string[] = [];
    const codes: string[] = [];

    for (const name of names) {
      const code = await enterLobbyCreate(page, name);
      codes.push(code);
      const session = await readV2Session(page);
      expect(session.hasActionCreate).toBe(false);
      expect(session.playerName).toBe(name);
      ids.push(session.playerId!);
      await leaveLobby(page);
    }

    expect(new Set(ids).size).toBe(10);
    expect(new Set(codes).size).toBe(10);
    await ctx.close();
  });

  test('E2E D: refresh keeps same RoomPlayer', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();
    const code = await enterLobbyCreate(page, 'خلود');
    const before = await readV2Session(page);

    await page.reload();
    await page.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
    await expect(page.getByText('خلود').first()).toBeVisible({ timeout: 20_000 });
    const after = await readV2Session(page);
    expect(after.playerId).toBe(before.playerId);
    expect(after.roomId).toBe(before.roomId);
    expect(after.playerName).toBe('خلود');

    await ctx.close();
  });

  test('E2E E: history return to left Room does not resurrect', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();
    const code = await enterLobbyCreate(page, 'محمد');
    await leaveLobby(page);

    // Simulate browser Back / shared link to a Room the tab already left.
    await page.goto(`/lobby?code=${code}`);
    await page.waitForURL((url) => url.pathname === '/' || url.search.includes(`code=${code}`), {
      timeout: 20_000,
    });
    await page.waitForTimeout(1000);

    // Must not reconnect as محمد — redirect Home (optionally with invite code).
    expect((await readV2Session(page)).playerId).toBeNull();
    await expect(page.getByRole('button', { name: 'مغادرة الغرفة' })).toHaveCount(0);
    await expect(page.locator('#create-name, #join-name').first()).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toMatch(/action=create/);

    await ctx.close();
  });

  test('PROD BLOCKER: leave A then Create خلود must STAY on Lobby (no /?code= bounce)', async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await enterLobbyCreate(a, 'محمد');
    await enterLobbyJoin(b, roomA, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await enterLobbyCreate(a, 'خلود');
    expect(roomB).not.toBe(roomA);

    // Stabilize — must NOT bounce Home with invite prefill.
    await a.waitForTimeout(2500);
    expect(a.url()).toMatch(new RegExp(`/lobby\\?code=${roomB}$`));
    expect(a.url()).not.toMatch(/\/\?code=/);
    expect((await readV2Session(a)).hasActionCreate).toBe(false);
    expect((await readV2Session(a)).playerName).toBe('خلود');
    expect((await readV2Session(a)).roomCode).toBe(roomB);
    await expect(a.getByText('خلود').first()).toBeVisible();
    await expect(a.getByText('محمد')).toHaveCount(0);

    await enterLobbyJoin(b, roomB, 'عبدالله');
    await waitForRoster(a, ['خلود', 'عبدالله']);

    await ctxA.close();
    await ctxB.close();
  });
});
