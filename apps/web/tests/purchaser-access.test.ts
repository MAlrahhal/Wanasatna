/** Purchaser-only OTP UI and guest-isolation source contracts. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

const client = read('app/(public)/purchaser-access/purchaser-access-client.tsx');
const page = read('app/(public)/purchaser-access/page.tsx');
const api = read('lib/purchaser-access/api.ts');
const copy = read('lib/purchaser-access/copy.ts');
const authContext = read('contexts/auth-context.tsx');
const idleRefresh = read('lib/auth/refresh-idle-socket.ts');
const routes = read('lib/public/routes.ts');
const navbar = read('components/public/public-navbar.tsx');
const mobileNav = read('components/public/mobile-navigation.tsx');

test('dedicated purchaser page is no-index and absent from ordinary navigation', () => {
  assert.equal(existsSync(join(root, 'app/(public)/purchaser-access/page.tsx')), true);
  assert.match(page, /index: false/);
  assert.doesNotMatch(routes, /purchaser-access/);
  assert.doesNotMatch(`${navbar}\n${mobileNav}`, /purchaser-access|الدخول للمشترين/);
});

test('mobile-first Arabic form provides email, numeric OTP, resend, and safe feedback', () => {
  assert.match(client, /PublicField/);
  assert.match(client, /inputMode="email"/);
  assert.match(client, /inputMode="numeric"/);
  assert.match(client, /autoComplete="one-time-code"/);
  assert.match(client, /replace\(\/\\D\/g, ''\)\.slice\(0, 6\)/);
  assert.match(client, /resendSeconds/);
  assert.match(client, /role="alert"/);
  assert.match(client, /role="status"/);
  assert.match(client, /max-w-md/);
  assert.match(copy, /لا يكشف الرد/);
});

test('browser API uses only HttpOnly cookie credentials and no token storage', () => {
  assert.match(api, /credentials: 'include'/);
  assert.match(api, /\/api\/auth\/purchaser/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|bearer|authorization/i);
  assert.doesNotMatch(client, /localStorage|sessionStorage|userId|role:/);
});

test('successful OTP updates account context without touching a live RoomPlayer', () => {
  assert.match(authContext, /verifyPurchaserOtpCode/);
  assert.match(authContext, /setUser\(result\.data\.user\)/);
  assert.match(authContext, /refreshIdleRoomSocketForAccountAuth/);
  assert.match(idleRefresh, /BUSY_ROOM_STATUSES/);
  assert.match(idleRefresh, /return;/);
  assert.doesNotMatch(authContext, /leaveRoom|reconnectToken|hostPlayerId|playerId/);
});

test('page has no price, checkout, badge, or automatic paid-status claim', () => {
  const source = `${client}\n${copy}`;
  assert.doesNotMatch(source, /checkout|price|pricing|badge|اشتراك|شراء الآن|ريال/i);
  assert.match(copy, /لا يفعّل أي مزايا مدفوعة/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
