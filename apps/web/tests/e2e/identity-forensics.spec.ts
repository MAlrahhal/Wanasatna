import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { enterLobbyCreate, enterLobbyJoin, waitForRoster } from './helpers';

type IdentityDump = {
  url: string;
  session: {
    playerId: string | null;
    roomId: string | null;
    playerName: string | null;
    roomCode: string | null;
  };
  reconnectKeys: string[];
  reconnectForUrlCode: {
    playerId: string | null;
    roomCode: string | null;
    roomId: string | null;
  } | null;
  lobbyCodeText: string | null;
  playerNames: string[];
};

async function dumpIdentity(page: Page): Promise<IdentityDump> {
  return page.evaluate(() => {
    const url = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const session = {
      playerId: sessionStorage.getItem('wanasatna:playerId'),
      roomId: sessionStorage.getItem('wanasatna:roomId'),
      playerName: sessionStorage.getItem('wanasatna:playerName'),
      roomCode: sessionStorage.getItem('wanasatna:roomCode'),
    };

    const reconnectKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key === 'wanasatna:active-room-resume' || key?.startsWith('wanasatna:reconnect:')) {
        reconnectKeys.push(key);
      }
    }

    let reconnectForUrlCode: IdentityDump['reconnectForUrlCode'] = null;
    if (code) {
      const raw = sessionStorage.getItem('wanasatna:active-room-resume');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            playerId?: string;
            roomCode?: string;
            roomId?: string;
          };
          if (parsed.roomCode === code) {
            reconnectForUrlCode = {
              playerId: parsed.playerId ?? null,
              roomCode: parsed.roomCode ?? null,
              roomId: parsed.roomId ?? null,
            };
          }
        } catch {
          reconnectForUrlCode = null;
        }
      }
    }

    const lobbyCodeText =
      document.querySelector('[class*="font-mono"]')?.textContent?.trim() ?? null;

    const playerNames = Array.from(
      document.querySelectorAll('[class*="truncate"], p, span'),
    )
      .map((el) => (el.textContent ?? '').trim())
      .filter((text) => text.length >= 2 && text.length <= 20);

    return {
      url,
      session,
      reconnectKeys,
      reconnectForUrlCode,
      lobbyCodeText,
      playerNames,
    };
  });
}

async function leaveRoom(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20_000 });
}

test.describe('Identity forensics — cross-room leakage', () => {
  test('H: HostA / HostB / PlayerX must not mix Room A into Room B', async ({ browser }) => {
    test.setTimeout(240_000);

    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const ctxX = await browser.newContext({ locale: 'ar-SA' });
    const hostA = await ctxA.newPage();
    const hostB = await ctxB.newPage();
    const playerX = await ctxX.newPage();

    const roomA = await enterLobbyCreate(hostA, 'HostA');
    await enterLobbyJoin(playerX, roomA, 'Khaled');
    await waitForRoster(hostA, ['HostA', 'Khaled']);
    await waitForRoster(playerX, ['HostA', 'Khaled']);

    const dumpA1 = await dumpIdentity(playerX);
    // eslint-disable-next-line no-console
    console.log('[identity-forensics] X in Room A', dumpA1);

    expect(dumpA1.session.roomCode).toBe(roomA);
    expect(dumpA1.session.playerName).toBe('Khaled');
    expect(dumpA1.reconnectKeys).toContain('wanasatna:active-room-resume');
    expect(dumpA1.reconnectForUrlCode?.roomCode).toBe(roomA);

    // Explicit leave Room A
    await leaveRoom(playerX);

    const dumpAfterLeave = await dumpIdentity(playerX);
    // eslint-disable-next-line no-console
    console.log('[identity-forensics] X after leave A', dumpAfterLeave);

    expect(dumpAfterLeave.session.playerId).toBeNull();
    expect(dumpAfterLeave.session.roomCode).toBeNull();
    expect(dumpAfterLeave.reconnectKeys).not.toContain('wanasatna:active-room-resume');
    expect(dumpAfterLeave.reconnectForUrlCode).toBeNull();

    const roomB = await enterLobbyCreate(hostB, 'HostB');
    await enterLobbyJoin(playerX, roomB, 'Abdullah');
    await waitForRoster(hostB, ['HostB', 'Abdullah']);
    await waitForRoster(playerX, ['HostB', 'Abdullah']);

    const dumpX = await dumpIdentity(playerX);
    const dumpHostA = await dumpIdentity(hostA);
    const dumpHostB = await dumpIdentity(hostB);

    // eslint-disable-next-line no-console
    console.log('[identity-forensics] FINAL', { dumpX, dumpHostA, dumpHostB });

    expect(dumpX.session.roomCode).toBe(roomB);
    expect(dumpX.session.playerName).toBe('Abdullah');
    expect(dumpX.session.playerId).not.toBe(dumpA1.session.playerId);
    expect(dumpX.session.roomCode).not.toBe(roomA);

    // X must not show HostA
    await expect(playerX.getByText('HostA')).toHaveCount(0);
    await expect(playerX.getByText('HostB').first()).toBeVisible();
    await expect(playerX.getByText('Abdullah').first()).toBeVisible();

    // Host A must not show Abdullah/X new identity
    await expect(hostA.getByText('Abdullah')).toHaveCount(0);
    await expect(hostA.getByText('Khaled')).toHaveCount(0);

    // Host B sees Abdullah
    await expect(hostB.getByText('Abdullah').first()).toBeVisible();
    await expect(hostB.getByText('HostA')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
    await ctxX.close();
  });

  test('LEAK PROBE: URL code=B while session still Room A (no leave)', async ({ browser }) => {
    test.setTimeout(180_000);

    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const ctxX = await browser.newContext({ locale: 'ar-SA' });
    const hostA = await ctxA.newPage();
    const hostB = await ctxB.newPage();
    const playerX = await ctxX.newPage();

    const roomA = await enterLobbyCreate(hostA, 'HostA');
    await enterLobbyJoin(playerX, roomA, 'Khaled');
    await waitForRoster(playerX, ['HostA', 'Khaled']);

    const roomB = await enterLobbyCreate(hostB, 'HostB');

    // Navigate to Room B invite WITHOUT leaving and WITHOUT typed name.
    await playerX.goto(`/lobby?code=${roomB}`);
    await playerX.waitForTimeout(2500);

    const dump = await dumpIdentity(playerX);
    const hostADump = await dumpIdentity(hostA);
    // eslint-disable-next-line no-console
    console.log('[identity-forensics] LEAK PROBE dump', { dump, hostADump });

    // Fixed contract: Room A identity must not survive. Code-only B without a
    // B credential cannot silently reconnect to A or join B namelessly.
    expect(dump.session.roomCode).not.toBe(roomA);
    expect(dump.session.playerName).not.toBe('Khaled');
    expect(dump.reconnectForUrlCode?.roomCode === roomA).toBeFalsy();
    await expect(hostA.getByText('Khaled')).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
    await ctxX.close();
  });

  test('B→C sequential leave uses fresh names', async ({ browser }) => {
    test.setTimeout(240_000);
    const hostCtx = await browser.newContext({ locale: 'ar-SA' });
    const xCtx = await browser.newContext({ locale: 'ar-SA' });
    const host = await hostCtx.newPage();
    const x = await xCtx.newPage();

    const roomA = await enterLobbyCreate(host, 'Host');
    await enterLobbyJoin(x, roomA, 'Khaled');
    const idA = (await dumpIdentity(x)).session.playerId;
    await leaveRoom(x);

    // Host still in A; create B in new host context
    const host2Ctx = await browser.newContext({ locale: 'ar-SA' });
    const host2 = await host2Ctx.newPage();
    const roomB = await enterLobbyCreate(host2, 'Host2');
    await enterLobbyJoin(x, roomB, 'Abdullah');
    const dumpB = await dumpIdentity(x);
    expect(dumpB.session.playerName).toBe('Abdullah');
    expect(dumpB.session.playerId).not.toBe(idA);
    expect(dumpB.session.roomCode).toBe(roomB);
    await leaveRoom(x);

    const host3Ctx = await browser.newContext({ locale: 'ar-SA' });
    const host3 = await host3Ctx.newPage();
    const roomC = await enterLobbyCreate(host3, 'Host3');
    await enterLobbyJoin(x, roomC, 'Sara');
    const dumpC = await dumpIdentity(x);
    expect(dumpC.session.playerName).toBe('Sara');
    expect(dumpC.session.playerId).not.toBe(dumpB.session.playerId);
    expect(dumpC.session.roomCode).toBe(roomC);

    await hostCtx.close();
    await host2Ctx.close();
    await host3Ctx.close();
    await xCtx.close();
  });
});
