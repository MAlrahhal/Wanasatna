/**
 * Home → Lobby runtime continuity + first-attempt Create/Join contracts.
 * Proves soft navigation (same runtimeId) vs hard refresh (new runtimeId).
 */
import { test, expect, type Page } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

type ContinuityProbe = {
  runtimeId: string | null;
  socketId: string | null;
  managerId: string | null;
  reconnectCount: number;
  playerId: string | null;
  roomCode: string | null;
  url: string;
};

async function readContinuity(page: Page): Promise<ContinuityProbe> {
  return page.evaluate(() => {
    const g = globalThis as typeof globalThis & {
      __wanasatna_runtime_id__?: string;
      __wanasatna_reconnect_emit_count__?: number;
      __wanasatna_manager_instance_id__?: string;
      __wanasatna_room_socket_v2__?: { id?: string } | null;
    };
    const raw = sessionStorage.getItem('wanasatna:active-room-session');
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    return {
      runtimeId: g.__wanasatna_runtime_id__ ?? null,
      socketId: g.__wanasatna_room_socket_v2__?.id ?? null,
      managerId: g.__wanasatna_manager_instance_id__ ?? null,
      reconnectCount: g.__wanasatna_reconnect_emit_count__ ?? 0,
      playerId: parsed?.playerId ?? null,
      roomCode: parsed?.roomCode ?? null,
      url: location.href,
    };
  });
}

async function resetReconnectCount(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as typeof globalThis & { __wanasatna_reconnect_emit_count__?: number }).__wanasatna_reconnect_emit_count__ = 0;
  });
}

async function leaveLobby(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20_000 });
}

async function createFromHomeStay(page: Page, playerName: string): Promise<string> {
  await page.goto('/');
  await page.waitForSelector('#start-play');
  // Ensure runtime probe is minted on Home before Create.
  await page.evaluate(() => {
    const g = globalThis as typeof globalThis & { __wanasatna_runtime_id__?: string };
    if (!g.__wanasatna_runtime_id__) {
      g.__wanasatna_runtime_id__ = crypto.randomUUID();
    }
  });
  await resetReconnectCount(page);
  const before = await readContinuity(page);
  expect(before.runtimeId).toBeTruthy();

  const section = page.locator('#start-play');
  await section.locator('#create-name').fill(playerName);
  await section.getByRole('button', { name: 'إنشاء غرفة' }).click();
  await page.waitForURL(/\/lobby\?code=\d+/, { timeout: 30_000 });

  // Must not bounce Home with invite prefill.
  await page.waitForTimeout(1500);
  expect(page.url()).toMatch(/\/lobby\?code=\d+/);
  expect(page.url()).not.toMatch(/\/\?code=/);

  const after = await readContinuity(page);
  expect(after.runtimeId, 'Home→Lobby must preserve runtimeId (soft nav)').toBe(before.runtimeId);
  expect(after.runtimeId).toBeTruthy();
  expect(after.socketId).toBeTruthy();
  expect(after.reconnectCount, 'fresh Create must emit 0 room reconnects').toBe(0);
  expect(after.playerId).toBeTruthy();
  expect(after.roomCode).toBeTruthy();

  const continuity = await page.evaluate(() => {
    const log =
      (
        globalThis as typeof globalThis & {
          __wanasatna_lifecycle__?: Array<{
            event: string;
            socketId: string | null;
            runtimeId: string;
          }>;
        }
      ).__wanasatna_lifecycle__ ?? [];
    const created = [...log].reverse().find((e) => e.event === 'CREATE_SUCCESS');
    const lobby = [...log]
      .reverse()
      .find((e) => e.event === 'LOBBY_REUSE_LIVE' || e.event === 'RESUME_SKIPPED_LIVE');
    return {
      createSocket: created?.socketId ?? null,
      createRuntime: created?.runtimeId ?? null,
      lobbySocket: lobby?.socketId ?? null,
      lobbyRuntime: lobby?.runtimeId ?? null,
    };
  });

  expect(continuity.createRuntime).toBe(before.runtimeId);
  if (continuity.lobbyRuntime) {
    expect(continuity.lobbyRuntime).toBe(continuity.createRuntime);
  }
  if (continuity.createSocket && continuity.lobbySocket) {
    expect(continuity.lobbySocket).toBe(continuity.createSocket);
  }

  await expect(page.getByText(playerName).first()).toBeVisible({ timeout: 20_000 });
  return after.roomCode!;
}

test.describe('Home→Lobby continuity', () => {
  test('TEST A: ten Creates succeed first attempt with runtime continuity', async ({ browser }) => {
    test.setTimeout(360_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    for (let i = 1; i <= 10; i += 1) {
      const code = await createFromHomeStay(page, `ن${i}`);
      expect(code).toMatch(/^\d{6}$/);
      await leaveLobby(page);
    }

    await ctx.close();
  });

  test('TEST B: Join succeeds first attempt with 0 reconnects', async ({ browser }) => {
    test.setTimeout(240_000);
    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const guestCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    for (let i = 0; i < 3; i += 1) {
      const code = await createFromHomeStay(host, `مضيف${i}`);

      await guest.goto('/');
      await guest.waitForSelector('#start-play');
      await guest.evaluate(() => {
        const g = globalThis as typeof globalThis & { __wanasatna_runtime_id__?: string };
        if (!g.__wanasatna_runtime_id__) {
          g.__wanasatna_runtime_id__ = crypto.randomUUID();
        }
      });
      await resetReconnectCount(guest);
      const before = await readContinuity(guest);
      expect(before.runtimeId).toBeTruthy();
      const section = guest.locator('#start-play');
      await section.locator('#join-name').fill(`ضيف${i}`);
      await section.locator('#join-code').fill(code);
      await section.getByRole('button', { name: 'انضم الآن' }).click();
      await guest.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
      await guest.waitForTimeout(1500);
      expect(guest.url()).toMatch(new RegExp(`/lobby\\?code=${code}$`));
      expect(guest.url()).not.toMatch(/\/\?code=/);

      const after = await readContinuity(guest);
      expect(after.runtimeId).toBe(before.runtimeId);
      expect(after.reconnectCount).toBe(0);
      await expect(guest.getByText(`ضيف${i}`).first()).toBeVisible({ timeout: 20_000 });

      await leaveLobby(guest);
      await leaveLobby(host);
    }

    await hostCtx.close();
    await guestCtx.close();
  });

  test('TEST C: محمد/خالد → خلود/عبدالله first attempt', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await createFromHomeStay(a, 'محمد');
    await enterLobbyJoin(b, roomA, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await leaveLobby(b);
    await leaveLobby(a);

    const roomB = await createFromHomeStay(a, 'خلود');
    expect(roomB).not.toBe(roomA);
    await expect(a.getByText('محمد')).toHaveCount(0);

    await b.goto('/');
    await b.waitForSelector('#start-play');
    await b.evaluate(() => {
      const g = globalThis as typeof globalThis & { __wanasatna_runtime_id__?: string };
      if (!g.__wanasatna_runtime_id__) {
        g.__wanasatna_runtime_id__ = crypto.randomUUID();
      }
    });
    await resetReconnectCount(b);
    const beforeJoin = await readContinuity(b);
    expect(beforeJoin.runtimeId).toBeTruthy();
    const section = b.locator('#start-play');
    await section.locator('#join-name').fill('عبدالله');
    await section.locator('#join-code').fill(roomB);
    await section.getByRole('button', { name: 'انضم الآن' }).click();
    await b.waitForURL(new RegExp(`/lobby\\?code=${roomB}$`), { timeout: 30_000 });
    await b.waitForTimeout(1500);
    expect(b.url()).toMatch(new RegExp(`/lobby\\?code=${roomB}$`));
    const afterJoin = await readContinuity(b);
    expect(afterJoin.runtimeId).toBe(beforeJoin.runtimeId);
    expect(afterJoin.reconnectCount).toBe(0);

    await waitForRoster(a, ['خلود', 'عبدالله']);

    await ctxA.close();
    await ctxB.close();
  });

  test('TEST D: hard refresh changes runtimeId and reconnects exactly once', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    const code = await createFromHomeStay(page, 'خلود');
    const before = await readContinuity(page);
    await resetReconnectCount(page);

    await page.reload();
    await page.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
    await expect(page.getByText('خلود').first()).toBeVisible({ timeout: 20_000 });

    const after = await readContinuity(page);
    expect(after.runtimeId, 'hard refresh must mint a new runtimeId').not.toBe(before.runtimeId);
    expect(after.runtimeId).toBeTruthy();
    expect(after.playerId).toBe(before.playerId);
    expect(after.roomCode).toBe(code);
    expect(after.reconnectCount, 'hard refresh must emit exactly 1 reconnect').toBe(1);

    await ctx.close();
  });

  test('Fresh Create lifecycle log shows soft-nav reuse', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    await createFromHomeStay(page, 'استقرار');
    const probe = await readContinuity(page);
    expect(probe.reconnectCount).toBe(0);
    expect(probe.url).toMatch(/\/lobby\?code=/);

    await ctx.close();
  });
});
