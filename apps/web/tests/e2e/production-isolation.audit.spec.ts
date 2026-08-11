/**
 * Playwright against REAL production (wanasatna.com).
 * Diagnoses browser-layer divergence only — no local server.
 */
import { test, expect, type Page } from '@playwright/test';

const WEB_ORIGIN = process.env.WANASATNA_PROD_WEB_URL ?? 'https://wanasatna.com';

type SocketTrace = {
  type: 'emit' | 'ack' | 'connect' | 'error' | 'snapshot';
  event?: string;
  payload?: unknown;
  success?: boolean;
  errorCode?: string;
  at: number;
};

async function installSocketTrace(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __wanasAudit?: SocketTrace[] }).__wanasAudit = [];
    const push = (entry: Omit<SocketTrace, 'at'>) => {
      (window as unknown as { __wanasAudit: SocketTrace[] }).__wanasAudit.push({
        ...entry,
        at: Date.now(),
      });
    };

    const wrap = () => {
      const proto = (window as unknown as { io?: unknown }).io;
      // Hook after socket.io-client loads via page evaluate on lobby.
    };
    void wrap;

    // Capture console room-entry diagnostics if present.
    const originalInfo = console.info.bind(console);
    console.info = (...args: unknown[]) => {
      const first = String(args[0] ?? '');
      if (first.includes('[room-entry]') || first.includes('[create-room]') || first.includes('[room-sync]')) {
        push({ type: 'emit', event: 'console', payload: args.map(String) });
      }
      originalInfo(...args);
    };
  });
}

async function createViaHome(page: Page, name: string): Promise<{ code: string; traces: string[] }> {
  await page.goto(WEB_ORIGIN + '/');
  const section = page.locator('#start-play');
  await section.locator('#create-name').fill(name);

  const inputValue = await section.locator('#create-name').inputValue();
  const traces = [`ui-input=${inputValue}`];

  await section.getByRole('button', { name: 'إنشاء غرفة' }).click();
  await page.waitForURL(/\/lobby\?code=\d+/, { timeout: 45_000 });
  const code = new URL(page.url()).searchParams.get('code');
  if (!code) throw new Error('missing room code');
  traces.push(`url=${page.url()}`);
  traces.push(`sessionName=${await page.evaluate(() => sessionStorage.getItem('wanasatna:playerName'))}`);
  traces.push(
    `resume=${await page.evaluate(() => sessionStorage.getItem('wanasatna:active-room-resume'))}`,
  );
  traces.push(
    `legacyReconnectKeys=${await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('wanasatna:reconnect:')).join(','),
    )}`,
  );
  return { code, traces };
}

async function joinViaHome(page: Page, code: string, name: string): Promise<{ ok: boolean; errorText: string | null; traces: string[] }> {
  await page.goto(WEB_ORIGIN + '/');
  const section = page.locator('#start-play');
  await section.locator('#join-name').fill(name);
  await section.locator('#join-code').fill(code);
  const traces = [
    `ui-name=${await section.locator('#join-name').inputValue()}`,
    `ui-code=${await section.locator('#join-code').inputValue()}`,
  ];
  await section.getByRole('button', { name: 'انضم الآن' }).click();

  try {
    await page.waitForURL(new RegExp(`/lobby\\?code=${code}`), { timeout: 45_000 });
    traces.push(`url=${page.url()}`);
    traces.push(`sessionName=${await page.evaluate(() => sessionStorage.getItem('wanasatna:playerName'))}`);
    return { ok: true, errorText: null, traces };
  } catch {
    const errorText =
      (await page.getByText(/تعذر|غير موجودة|الغرفة/).first().textContent().catch(() => null)) ??
      (await page.locator('[class*="error"], [role="alert"]').first().textContent().catch(() => null));
    traces.push(`url=${page.url()}`);
    traces.push(`errorText=${errorText}`);
    return { ok: false, errorText, traces };
  }
}

async function leaveLobby(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 30_000 });
}

test.describe('Production browser isolation', () => {
  test('exact محمد→خلود / خالد→عبدالله on wanasatna.com', async ({ browser }) => {
    test.setTimeout(300_000);

    const ctxA = await browser.newContext({ locale: 'ar-SA' });
    const ctxB = await browser.newContext({ locale: 'ar-SA' });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await installSocketTrace(a);
    await installSocketTrace(b);

    // Capture websocket frames for create/join ACKs.
    const aFrames: string[] = [];
    a.on('websocket', (ws) => {
      aFrames.push(`WS ${ws.url()}`);
      ws.on('framereceived', (frame) => {
        const payload = String(frame.payload);
        if (payload.includes('create-room') || payload.includes('join-room') || payload.includes('خلود') || payload.includes('محمد')) {
          aFrames.push(`RX ${payload.slice(0, 500)}`);
        }
      });
      ws.on('framesent', (frame) => {
        const payload = String(frame.payload);
        if (payload.includes('create-room') || payload.includes('join-room') || payload.includes('خلود') || payload.includes('محمد')) {
          aFrames.push(`TX ${payload.slice(0, 500)}`);
        }
      });
    });

    const createdA = await createViaHome(a, 'محمد');
    // eslint-disable-next-line no-console
    console.log('[prod-browser] create محمد', createdA);
    await expect(a.getByText('محمد').first()).toBeVisible({ timeout: 20_000 });

    const joined = await joinViaHome(b, createdA.code, 'خالد');
    // eslint-disable-next-line no-console
    console.log('[prod-browser] join خالد', joined);
    expect(joined.ok).toBe(true);
    await expect(a.getByText('خالد').first()).toBeVisible({ timeout: 20_000 });

    await leaveLobby(b);
    await leaveLobby(a);

    const createdB = await createViaHome(a, 'خلود');
    // eslint-disable-next-line no-console
    console.log('[prod-browser] create خلود', createdB);
    // eslint-disable-next-line no-console
    console.log('[prod-browser] socket frames A', aFrames);

    const visibleKholoud = await a.getByText('خلود').count();
    const visibleMohammed = await a.getByText('محمد').count();
    const sessionName = await a.evaluate(() => sessionStorage.getItem('wanasatna:playerName'));
    // eslint-disable-next-line no-console
    console.log('[prod-browser] after create خلود UI', {
      code: createdB.code,
      visibleKholoud,
      visibleMohammed,
      sessionName,
      url: a.url(),
    });

    const joinAbdullah = await joinViaHome(b, createdB.code, 'عبدالله');
    // eslint-disable-next-line no-console
    console.log('[prod-browser] join عبدالله', joinAbdullah);

    // Soft asserts for audit report — still fail the test if contract broken.
    expect(sessionName).toBe('خلود');
    expect(visibleMohammed).toBe(0);
    expect(visibleKholoud).toBeGreaterThan(0);
    expect(joinAbdullah.ok).toBe(true);

    await ctxA.close();
    await ctxB.close();
  });
});
