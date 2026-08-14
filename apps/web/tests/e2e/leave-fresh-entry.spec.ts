/**
 * Explicit Leave must produce the same Room-clean Home state as a manual refresh,
 * without reloading: URL `/`, no ActiveRoomSession, no invite prefill of the left room.
 */
import { test, expect, type Page } from '@playwright/test';
import { confirmLeaveRoom, enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

async function leaveLobby(page: Page): Promise<void> {
  await confirmLeaveRoom(page);
  await page.waitForFunction(() => sessionStorage.getItem('wanasatna:active-room-session') === null, null, {
    timeout: 20_000,
  });
  await page.waitForURL(
    (url) => (url.pathname === '/' || url.pathname === '') && !url.searchParams.has('code'),
    { timeout: 20_000 },
  );
}

async function assertCleanHomeAfterLeave(page: Page, leftCode: string): Promise<void> {
  await expect.poll(async () => {
    const u = new URL(page.url());
    return `${u.pathname}${u.search}`;
  }).toBe('/');

  expect(page.url()).not.toContain(`code=${leftCode}`);
  expect(page.url()).not.toMatch(/[?&]code=/);

  const state = await page.evaluate(() => {
    const raw = sessionStorage.getItem('wanasatna:active-room-session');
    const join =
      (document.querySelector('#join-code') as HTMLInputElement | null)?.value ??
      (document.querySelector('input[name="join-code"]') as HTMLInputElement | null)?.value ??
      '';
    return { raw, join };
  });

  expect(state.raw).toBeNull();
  expect(state.join.replace(/\D/g, '')).not.toBe(leftCode);
  expect(state.join.trim()).toBe('');
}

test.describe('Leave fresh-entry reset', () => {
  test('محمد/خالد Leave → clean `/` → خلود/عبدالله first attempt (no refresh)', async ({
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

    await assertCleanHomeAfterLeave(a, roomA);
    await assertCleanHomeAfterLeave(b, roomA);

    // No refresh button — Create/Join must work first attempt after Leave.
    const sectionA = a.locator('#start-play');
    await sectionA.locator('#create-name').fill('خلود');
    await sectionA.getByRole('button', { name: 'إنشاء غرفة' }).click();
    await a.waitForURL(
      (url) => {
        const code = url.searchParams.get('code');
        return url.pathname === '/lobby' && !!code && code !== roomA;
      },
      { timeout: 30_000 },
    );
    await a.waitForTimeout(2500);
    expect(a.url()).toMatch(/\/lobby\?code=\d+/);
    expect(a.url()).not.toMatch(/\/\?code=/);
    const roomB = new URL(a.url()).searchParams.get('code')!;
    expect(roomB).toMatch(/^\d{6}$/);
    expect(roomB).not.toBe(roomA);
    await expect(a.getByText('خلود').first()).toBeVisible({ timeout: 20_000 });

    const sectionB = b.locator('#start-play');
    await sectionB.locator('#join-name').fill('عبدالله');
    await sectionB.locator('#join-code').fill(roomB);
    await sectionB.getByRole('button', { name: 'دخول الغرفة' }).click();
    await b.waitForURL(new RegExp(`/lobby\\?code=${roomB}$`), { timeout: 30_000 });
    await b.waitForTimeout(1500);
    expect(b.url()).toMatch(new RegExp(`/lobby\\?code=${roomB}$`));
    await waitForRoster(a, ['خلود', 'عبدالله']);

    await ctxA.close();
    await ctxB.close();
  });

  test('Invite /?code= is join-only; Create from clean Home opens NEW lobby', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    await page.goto('/?code=721153');
    await page.waitForSelector('#start-play');
    await expect(page.locator('#join-code')).toHaveValue('721153');
    await expect(page.locator('#join-code')).toHaveAttribute('readonly', '');
    await expect(page.locator('#create-name')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إنشاء غرفة' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'دخول الغرفة' })).toBeVisible();

    const code = await enterLobbyCreate(page, 'مضيف');
    expect(code).not.toBe('721153');
    expect(page.url()).not.toContain('721153');
    await expect(page.getByText('مضيف').first()).toBeVisible({ timeout: 20_000 });

    await ctx.close();
  });

  test('External invite /?code=VALID still prefills and Join works', async ({ browser }) => {
    test.setTimeout(180_000);
    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const guestCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const code = await enterLobbyCreate(host, 'مضيف');

    await guest.goto(`/?code=${code}`);
    await guest.waitForSelector('#start-play');
    await expect(guest.locator('#join-code')).toHaveValue(code);
    await expect(guest.locator('#join-code')).toHaveAttribute('readonly', '');
    await expect(guest.locator('#create-name')).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'إنشاء غرفة' })).toHaveCount(0);
    await expect(guest.getByText('ألعاب مميزة')).toHaveCount(0);

    const section = guest.locator('#start-play');
    await section.locator('#join-name').fill('ضيف');
    await section.getByRole('button', { name: 'دخول الغرفة' }).click();
    await guest.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
    await waitForRoster(host, ['مضيف', 'ضيف']);

    await hostCtx.close();
    await guestCtx.close();
  });

  test('Leave after invite Join does not prefill left room', async ({ browser }) => {
    test.setTimeout(180_000);
    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const guestCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const code = await enterLobbyCreate(host, 'مضيف');
    await guest.goto(`/?code=${code}`);
    await guest.waitForSelector('#start-play');
    const section = guest.locator('#start-play');
    await section.locator('#join-name').fill('ضيف');
    await section.getByRole('button', { name: 'دخول الغرفة' }).click();
    await guest.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });

    await leaveLobby(guest);
    await assertCleanHomeAfterLeave(guest, code);

    await hostCtx.close();
    await guestCtx.close();
  });

  test('Active-room hard refresh still restores same player', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ar-SA' });
    const page = await ctx.newPage();

    const code = await enterLobbyCreate(page, 'خلود');
    const before = await page.evaluate(() => {
      const raw = sessionStorage.getItem('wanasatna:active-room-session');
      return raw ? (JSON.parse(raw) as { playerId: string }).playerId : null;
    });

    await page.reload();
    await page.waitForURL(new RegExp(`/lobby\\?code=${code}$`), { timeout: 30_000 });
    await expect(page.getByText('خلود').first()).toBeVisible({ timeout: 20_000 });

    const after = await page.evaluate(() => {
      const raw = sessionStorage.getItem('wanasatna:active-room-session');
      return raw ? (JSON.parse(raw) as { playerId: string }).playerId : null;
    });
    expect(after).toBe(before);

    await ctx.close();
  });

  test('Three rapid cycles without refresh', async ({ browser }) => {
    test.setTimeout(360_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const cycles: Array<[string, string]> = [
      ['محمد', 'خالد'],
      ['خلود', 'عبدالله'],
      ['سارة', 'يوسف'],
    ];

    for (const [hostName, guestName] of cycles) {
      const code = await enterLobbyCreate(a, hostName);
      await enterLobbyJoin(b, code, guestName);
      await waitForRoster(a, [hostName, guestName]);

      await leaveLobby(b);
      await leaveLobby(a);
      await assertCleanHomeAfterLeave(a, code);
      await assertCleanHomeAfterLeave(b, code);
    }

    await ctxA.close();
    await ctxB.close();
  });

  test('Game A → End → Game B preserved (End ≠ Leave)', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const code = await enterLobbyCreate(a, 'محمد');
    await enterLobbyJoin(b, code, 'خالد');
    await waitForRoster(a, ['محمد', 'خالد']);

    await a.getByRole('button', { name: 'تحدي التوقيت' }).click();
    await expect(a.getByText('✓ مختارة')).toBeVisible({ timeout: 10_000 });
    await a.getByRole('button', { name: 'بدء اللعبة' }).click();
    await a.waitForURL('**/game**', { timeout: 30_000 });
    await b.waitForURL('**/game**', { timeout: 30_000 });

    await a.getByRole('button', { name: 'إدارة الغرفة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).click();
    await a.getByRole('button', { name: 'إنهاء اللعبة' }).last().click();
    await a.waitForURL(new RegExp(`/lobby\\?code=${code}`), { timeout: 30_000 });
    await b.waitForURL(new RegExp(`/lobby\\?code=${code}`), { timeout: 30_000 });
    await waitForRoster(a, ['محمد', 'خالد']);

    // Still in the same Room — End Game must not act like Leave.
    expect(a.url()).toMatch(new RegExp(`/lobby\\?code=${code}`));
    expect(
      await a.evaluate(() => sessionStorage.getItem('wanasatna:active-room-session') !== null),
    ).toBe(true);

    await a.getByRole('button', { name: 'تحدي التخمين' }).click();
    await expect(a.getByText('✓ مختارة')).toBeVisible({ timeout: 10_000 });
    await a.getByRole('button', { name: 'بدء اللعبة' }).click();
    await a.waitForURL('**/game**', { timeout: 30_000 });
    await b.waitForURL('**/game**', { timeout: 30_000 });
    await expect(a).toHaveURL(/\/game/);

    await ctxA.close();
    await ctxB.close();
  });
});
