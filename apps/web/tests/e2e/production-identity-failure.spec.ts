import { test, expect, type Page } from '@playwright/test';

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

async function dumpStorage(page: Page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('wanasatna:active-room-session');
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    return {
      url: location.href,
      session: {
        playerId: parsed?.playerId ?? null,
        playerName: parsed?.playerName ?? null,
        roomCode: parsed?.roomCode ?? null,
      },
      localReconnectKeys: Object.keys(localStorage).filter((k) =>
        k.startsWith('wanasatna:reconnect:'),
      ),
    };
  });
}

test.describe('Production identity failure reproduction', () => {
  test('A: محمد leave → create خلود must not show محمد', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    const roomA = await createViaHome(a, 'محمد');
    await joinViaHome(b, roomA, 'خالد');
    await expect(a.getByText('خالد').first()).toBeVisible();

    await leaveLobby(b);
    await leaveLobby(a);

    // eslint-disable-next-line no-console
    console.log('[repro] after both leave', {
      a: await dumpStorage(a),
      b: await dumpStorage(b),
    });

    const roomB = await createViaHome(a, 'خلود');
    const dumpA = await dumpStorage(a);
    // eslint-disable-next-line no-console
    console.log('[repro] after create خلود', { roomA, roomB, dumpA });

    await expect(a.getByText('خلود').first()).toBeVisible();
    await expect(a.getByText('محمد')).toHaveCount(0);
    expect(dumpA.session.playerName).toBe('خلود');
    expect(roomB).not.toBe(roomA);

    await joinViaHome(b, roomB, 'عبدالله');
    await expect(a.getByText('عبدالله').first()).toBeVisible();
    await expect(b.getByText('خلود').first()).toBeVisible();
    await expect(a.getByText('محمد')).toHaveCount(0);
    await expect(b.getByText('خالد')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });
});
