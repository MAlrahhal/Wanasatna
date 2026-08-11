# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: production-isolation.audit.spec.ts >> Production browser isolation >> exact محمد→خلود / خالد→عبدالله on wanasatna.com
- Location: tests\e2e\production-isolation.audit.spec.ts:103:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 45000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "https://wanasatnaweb-production.up.railway.app/lobby?action=create&name=%D9%85%D8%AD%D9%85%D8%AF"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e5]:
      - link "و وناستنا" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]:
          - generic [ref=e8]: و
          - generic [ref=e9]: وناستنا
      - navigation "التنقل الرئيسي" [ref=e10]:
        - link "الرئيسية" [ref=e11] [cursor=pointer]:
          - /url: /
        - link "الألعاب" [ref=e12] [cursor=pointer]:
          - /url: /games
        - link "الأسئلة الشائعة" [ref=e13] [cursor=pointer]:
          - /url: /faq
        - link "تواصل معنا" [ref=e14] [cursor=pointer]:
          - /url: /contact
        - link "بريميوم" [ref=e15] [cursor=pointer]:
          - /url: /premium
      - generic [ref=e19]:
        - link "تسجيل الدخول" [ref=e20] [cursor=pointer]:
          - /url: /login
        - link "إنشاء غرفة" [ref=e21] [cursor=pointer]:
          - /url: /#start-play
    - generic [ref=e24]:
      - generic [ref=e25]: "!"
      - heading "تعذر الدخول إلى الغرفة" [level=1] [ref=e27]
      - paragraph [ref=e28]: تعذر الاتصال بالخادم. تأكد أن الخادم يعمل ثم حاول مرة أخرى.
      - link "العودة للرئيسية" [ref=e30] [cursor=pointer]:
        - /url: /
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]: و
            - generic [ref=e37]: وناستنا
          - paragraph [ref=e38]: منصة ألعاب جماعية عربية — العب مع أصدقائك مباشرة من المتصفح بدون تسجيل.
        - navigation "روابط تذييل وناستنا" [ref=e39]:
          - link "الرئيسية" [ref=e40] [cursor=pointer]:
            - /url: /
          - link "الألعاب" [ref=e41] [cursor=pointer]:
            - /url: /games
          - link "الأسئلة الشائعة" [ref=e42] [cursor=pointer]:
            - /url: /faq
          - link "تواصل معنا" [ref=e43] [cursor=pointer]:
            - /url: /contact
          - link "بريميوم" [ref=e44] [cursor=pointer]:
            - /url: /premium
          - link "تسجيل الدخول" [ref=e45] [cursor=pointer]:
            - /url: /login
          - link "سياسة الخصوصية" [ref=e46] [cursor=pointer]:
            - /url: "#"
          - link "الشروط والأحكام" [ref=e47] [cursor=pointer]:
            - /url: "#"
      - paragraph [ref=e48]: © 2026 وناستنا. جميع الحقوق محفوظة.
  - alert [ref=e49]: Wanasatna
```

# Test source

```ts
  1   | /**
  2   |  * Playwright against REAL production (wanasatna.com).
  3   |  * Diagnoses browser-layer divergence only — no local server.
  4   |  */
  5   | import { test, expect, type Page } from '@playwright/test';
  6   | 
  7   | const WEB_ORIGIN = process.env.WANASATNA_PROD_WEB_URL ?? 'https://wanasatna.com';
  8   | 
  9   | type SocketTrace = {
  10  |   type: 'emit' | 'ack' | 'connect' | 'error' | 'snapshot';
  11  |   event?: string;
  12  |   payload?: unknown;
  13  |   success?: boolean;
  14  |   errorCode?: string;
  15  |   at: number;
  16  | };
  17  | 
  18  | async function installSocketTrace(page: Page): Promise<void> {
  19  |   await page.addInitScript(() => {
  20  |     (window as unknown as { __wanasAudit?: SocketTrace[] }).__wanasAudit = [];
  21  |     const push = (entry: Omit<SocketTrace, 'at'>) => {
  22  |       (window as unknown as { __wanasAudit: SocketTrace[] }).__wanasAudit.push({
  23  |         ...entry,
  24  |         at: Date.now(),
  25  |       });
  26  |     };
  27  | 
  28  |     const wrap = () => {
  29  |       const proto = (window as unknown as { io?: unknown }).io;
  30  |       // Hook after socket.io-client loads via page evaluate on lobby.
  31  |     };
  32  |     void wrap;
  33  | 
  34  |     // Capture console room-entry diagnostics if present.
  35  |     const originalInfo = console.info.bind(console);
  36  |     console.info = (...args: unknown[]) => {
  37  |       const first = String(args[0] ?? '');
  38  |       if (first.includes('[room-entry]') || first.includes('[create-room]') || first.includes('[room-sync]')) {
  39  |         push({ type: 'emit', event: 'console', payload: args.map(String) });
  40  |       }
  41  |       originalInfo(...args);
  42  |     };
  43  |   });
  44  | }
  45  | 
  46  | async function createViaHome(page: Page, name: string): Promise<{ code: string; traces: string[] }> {
  47  |   await page.goto(WEB_ORIGIN + '/');
  48  |   const section = page.locator('#start-play');
  49  |   await section.locator('#create-name').fill(name);
  50  | 
  51  |   const inputValue = await section.locator('#create-name').inputValue();
  52  |   const traces = [`ui-input=${inputValue}`];
  53  | 
  54  |   await section.getByRole('button', { name: 'إنشاء غرفة' }).click();
> 55  |   await page.waitForURL(/\/lobby\?code=\d+/, { timeout: 45_000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 45000ms exceeded.
  56  |   const code = new URL(page.url()).searchParams.get('code');
  57  |   if (!code) throw new Error('missing room code');
  58  |   traces.push(`url=${page.url()}`);
  59  |   traces.push(`sessionName=${await page.evaluate(() => sessionStorage.getItem('wanasatna:playerName'))}`);
  60  |   traces.push(
  61  |     `resume=${await page.evaluate(() => sessionStorage.getItem('wanasatna:active-room-resume'))}`,
  62  |   );
  63  |   traces.push(
  64  |     `legacyReconnectKeys=${await page.evaluate(() =>
  65  |       Object.keys(localStorage).filter((k) => k.startsWith('wanasatna:reconnect:')).join(','),
  66  |     )}`,
  67  |   );
  68  |   return { code, traces };
  69  | }
  70  | 
  71  | async function joinViaHome(page: Page, code: string, name: string): Promise<{ ok: boolean; errorText: string | null; traces: string[] }> {
  72  |   await page.goto(WEB_ORIGIN + '/');
  73  |   const section = page.locator('#start-play');
  74  |   await section.locator('#join-name').fill(name);
  75  |   await section.locator('#join-code').fill(code);
  76  |   const traces = [
  77  |     `ui-name=${await section.locator('#join-name').inputValue()}`,
  78  |     `ui-code=${await section.locator('#join-code').inputValue()}`,
  79  |   ];
  80  |   await section.getByRole('button', { name: 'انضم الآن' }).click();
  81  | 
  82  |   try {
  83  |     await page.waitForURL(new RegExp(`/lobby\\?code=${code}`), { timeout: 45_000 });
  84  |     traces.push(`url=${page.url()}`);
  85  |     traces.push(`sessionName=${await page.evaluate(() => sessionStorage.getItem('wanasatna:playerName'))}`);
  86  |     return { ok: true, errorText: null, traces };
  87  |   } catch {
  88  |     const errorText =
  89  |       (await page.getByText(/تعذر|غير موجودة|الغرفة/).first().textContent().catch(() => null)) ??
  90  |       (await page.locator('[class*="error"], [role="alert"]').first().textContent().catch(() => null));
  91  |     traces.push(`url=${page.url()}`);
  92  |     traces.push(`errorText=${errorText}`);
  93  |     return { ok: false, errorText, traces };
  94  |   }
  95  | }
  96  | 
  97  | async function leaveLobby(page: Page): Promise<void> {
  98  |   await page.getByRole('button', { name: 'مغادرة الغرفة' }).first().click();
  99  |   await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 30_000 });
  100 | }
  101 | 
  102 | test.describe('Production browser isolation', () => {
  103 |   test('exact محمد→خلود / خالد→عبدالله on wanasatna.com', async ({ browser }) => {
  104 |     test.setTimeout(300_000);
  105 | 
  106 |     const ctxA = await browser.newContext({ locale: 'ar-SA' });
  107 |     const ctxB = await browser.newContext({ locale: 'ar-SA' });
  108 |     const a = await ctxA.newPage();
  109 |     const b = await ctxB.newPage();
  110 |     await installSocketTrace(a);
  111 |     await installSocketTrace(b);
  112 | 
  113 |     // Capture websocket frames for create/join ACKs.
  114 |     const aFrames: string[] = [];
  115 |     a.on('websocket', (ws) => {
  116 |       aFrames.push(`WS ${ws.url()}`);
  117 |       ws.on('framereceived', (frame) => {
  118 |         const payload = String(frame.payload);
  119 |         if (payload.includes('create-room') || payload.includes('join-room') || payload.includes('خلود') || payload.includes('محمد')) {
  120 |           aFrames.push(`RX ${payload.slice(0, 500)}`);
  121 |         }
  122 |       });
  123 |       ws.on('framesent', (frame) => {
  124 |         const payload = String(frame.payload);
  125 |         if (payload.includes('create-room') || payload.includes('join-room') || payload.includes('خلود') || payload.includes('محمد')) {
  126 |           aFrames.push(`TX ${payload.slice(0, 500)}`);
  127 |         }
  128 |       });
  129 |     });
  130 | 
  131 |     const createdA = await createViaHome(a, 'محمد');
  132 |     // eslint-disable-next-line no-console
  133 |     console.log('[prod-browser] create محمد', createdA);
  134 |     await expect(a.getByText('محمد').first()).toBeVisible({ timeout: 20_000 });
  135 | 
  136 |     const joined = await joinViaHome(b, createdA.code, 'خالد');
  137 |     // eslint-disable-next-line no-console
  138 |     console.log('[prod-browser] join خالد', joined);
  139 |     expect(joined.ok).toBe(true);
  140 |     await expect(a.getByText('خالد').first()).toBeVisible({ timeout: 20_000 });
  141 | 
  142 |     await leaveLobby(b);
  143 |     await leaveLobby(a);
  144 | 
  145 |     const createdB = await createViaHome(a, 'خلود');
  146 |     // eslint-disable-next-line no-console
  147 |     console.log('[prod-browser] create خلود', createdB);
  148 |     // eslint-disable-next-line no-console
  149 |     console.log('[prod-browser] socket frames A', aFrames);
  150 | 
  151 |     const visibleKholoud = await a.getByText('خلود').count();
  152 |     const visibleMohammed = await a.getByText('محمد').count();
  153 |     const sessionName = await a.evaluate(() => sessionStorage.getItem('wanasatna:playerName'));
  154 |     // eslint-disable-next-line no-console
  155 |     console.log('[prod-browser] after create خلود UI', {
```