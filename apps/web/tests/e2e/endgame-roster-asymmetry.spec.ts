import { test, expect } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

test.describe('P3 blocker — End Game roster asymmetry', () => {
  test('host and guest keep identical lobby roster after end game', async ({ browser }) => {
    test.setTimeout(180_000);

    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const guestCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    const hostLogs: string[] = [];
    host.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[room-entry]') ||
        text.includes('[room-sync]') ||
        text.includes('[p3-endgame-roster]')
      ) {
        hostLogs.push(text);
      }
    });

    const roomCode = await enterLobbyCreate(host, 'محمد');
    await enterLobbyJoin(guest, roomCode, 'خالد');
    await waitForRoster(host, ['محمد', 'خالد']);
    await waitForRoster(guest, ['محمد', 'خالد']);

    await host.getByRole('button', { name: 'ارسم وخمن' }).click();
    await expect(host.getByText('✓ مختارة')).toBeVisible();
    await host.getByRole('button', { name: 'بدء اللعبة' }).click();
    await Promise.all([
      host.waitForURL('**/game**', { timeout: 30_000 }),
      guest.waitForURL('**/game**', { timeout: 30_000 }),
    ]);

    await host.getByRole('button', { name: 'إدارة الغرفة' }).click();
    await host.getByRole('button', { name: 'إنهاء اللعبة' }).click();
    await host.getByRole('button', { name: 'إنهاء اللعبة' }).last().click();

    await Promise.all([
      host.waitForURL(new RegExp(`/lobby\\?code=${roomCode}`), { timeout: 30_000 }),
      guest.waitForURL(new RegExp(`/lobby\\?code=${roomCode}`), { timeout: 30_000 }),
    ]);

    // Allow remount reconnect/sync to settle.
    await host.waitForTimeout(2500);

    const hostCountText = await host
      .locator('section')
      .filter({ hasText: 'اللاعبون' })
      .locator('p')
      .first()
      .textContent();
    const guestCountText = await guest
      .locator('section')
      .filter({ hasText: 'اللاعبون' })
      .locator('p')
      .first()
      .textContent();

    // eslint-disable-next-line no-console
    console.log('POST-END', { hostCountText, guestCountText, hostLogs });

    await waitForRoster(host, ['محمد', 'خالد']);
    await waitForRoster(guest, ['محمد', 'خالد']);
    expect(hostCountText ?? '').toMatch(/^2\s*\//);
    expect(guestCountText ?? '').toMatch(/^2\s*\//);

    await hostCtx.close();
    await guestCtx.close();
  });
});
