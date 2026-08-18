/**
 * P12-B.4 — public login/register UX + saved display name.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/p12-b4-auth-ux.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_COPY } from '../lib/auth/copy';
import { presentAuthError } from '../lib/auth/error-messages';
import { nextPrefillDisplayName } from '../lib/auth/prefill-display-name';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const login = read('app/(public)/login/login-page-client.tsx');
const api = read('lib/auth/api.ts');
const authContext = read('contexts/auth-context.tsx');
const navbar = read('components/public/public-navbar.tsx');
const mobile = read('components/public/mobile-navigation.tsx');
const accountMenu = read('components/public/public-account-menu.tsx');
const home = read('app/(public)/home-page-client.tsx');
const hook = read('lib/public/use-room-actions.ts');
const layout = read('components/public/public-layout-client.tsx');
const providers = read('components/app-providers.tsx');
const faq = read('lib/public/faq-data.ts');
const copy = read('lib/auth/copy.ts');

test('1-4 Guest: login control, /login route, Home name starts empty, Create/Join unchanged', () => {
  assert.match(accountMenu, /AUTH_COPY\.loginTitle/);
  assert.match(navbar, /PublicAuthNavControl/);
  assert.match(mobile, /PublicAuthNavControl/);
  assert.equal(existsSync(join(root, 'app/(public)/login/page.tsx')), true);
  assert.match(home, /useRoomActions/);
  assert.match(hook, /useState\(''\)/);
  assert.match(hook, /manager\.create\(trimmedName\)/);
  assert.match(hook, /manager\.enterFromJoinForm\(trimmedCode, trimmedName\)/);
  assert.match(home, /بدون تسجيل/);
});

test('5-10 Login: fields, invalid credentials, loading reset, auth update, Home nav, no double submit', () => {
  assert.match(login, /mode === 'login'|AuthMode = 'login' \| 'register'/);
  assert.match(login, /AUTH_COPY\.emailLabel/);
  assert.match(login, /AUTH_COPY\.passwordLabel/);
  assert.match(login, /autoComplete="email"/);
  assert.match(login, /autoComplete=\{mode === 'register' \? 'new-password' : 'current-password'\}/);
  assert.match(login, /presentAuthError/);
  assert.equal(AUTH_COPY.invalidCredentials, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  assert.equal(
    presentAuthError({ code: 'INVALID_CREDENTIALS', message: 'hidden' }),
    AUTH_COPY.invalidCredentials,
  );
  assert.match(login, /setIsSubmitting\(false\)/);
  assert.match(login, /if \(isSubmitting \|\| status !== 'ready' \|\| user\)/);
  assert.match(login, /disabled=\{isSubmitting \|\| !showForm\}/);
  assert.match(authContext, /setUser\(result\.data\.user\)/);
  assert.match(login, /router\.replace\(PUBLIC_ROUTES\.home\)/);
  assert.doesNotMatch(login, /create-room|join-room|manager\.create/);
});

test('11-16 Register: fields, Arabic name, duplicate email, immediate auth, no client role, Home nav', () => {
  assert.match(login, /AUTH_COPY\.nameLabel/);
  assert.match(login, /AUTH_COPY\.registerTitle/);
  assert.match(login, /autoComplete="name"/);
  assert.match(login, /preferredDisplayName/);
  assert.doesNotMatch(login, /latinOnly|English only|\/[A-Za-z]\{2,20\}\//);
  assert.equal(AUTH_COPY.emailTaken, 'هذا البريد الإلكتروني مستخدم بالفعل.');
  assert.equal(
    presentAuthError({ code: 'EMAIL_TAKEN', message: 'EMAIL_TAKEN' }),
    AUTH_COPY.emailTaken,
  );
  assert.match(authContext, /registerAccount\(input\)/);
  assert.match(api, /JSON\.stringify\(\{[\s\S]*email: input\.email[\s\S]*preferredDisplayName: input\.preferredDisplayName/);
  assert.doesNotMatch(api, /role:/);
  assert.doesNotMatch(login, /role:/);
  assert.equal(existsSync(join(root, 'app/(public)/register')), false);
});

test('17-21 Authenticated navbar/mobile: name, logout only, no Premium/Admin', () => {
  assert.match(accountMenu, /preferredDisplayName=\{user\.preferredDisplayName\}/);
  assert.match(accountMenu, /AUTH_COPY\.logout/);
  assert.match(mobile, /variant="mobile"/);
  assert.match(navbar, /variant="desktop"/);
  const ui = `${navbar}\n${mobile}\n${accountMenu}\n${login}`;
  assert.doesNotMatch(ui, /بريميوم|premium|ADMIN|لوحة التحكم|الملف الشخصي|الإعدادات|الفوترة/i);
  assert.doesNotMatch(accountMenu, /user\.role/);
  assert.match(accountMenu, /truncate/);
  assert.match(accountMenu, /onAfterLogout/);
  assert.match(accountMenu, /end-0/);
});

test('22-28 Saved name: prefill, guest skip, editable nickname, no profile mutation, late /me, Create/Join use field', () => {
  assert.equal(
    nextPrefillDisplayName({
      currentName: '',
      hasUserEditedName: false,
      preferredDisplayName: 'محمد',
    }),
    'محمد',
  );
  assert.equal(
    nextPrefillDisplayName({
      currentName: '',
      hasUserEditedName: false,
      preferredDisplayName: null,
    }),
    null,
  );
  assert.equal(
    nextPrefillDisplayName({
      currentName: 'عبدالله',
      hasUserEditedName: true,
      preferredDisplayName: 'محمد',
    }),
    null,
  );
  assert.equal(
    nextPrefillDisplayName({
      currentName: '',
      hasUserEditedName: true,
      preferredDisplayName: 'محمد',
    }),
    null,
  );
  assert.match(hook, /nextPrefillDisplayName/);
  assert.match(hook, /nameEditedRef\.current = true/);
  assert.match(hook, /useOptionalAuth/);
  assert.doesNotMatch(home, /fetchAuthMe|\/api\/auth/);
  assert.doesNotMatch(hook, /registerAccount|updateUser|PATCH/);
  assert.match(hook, /manager\.create\(trimmedName\)/);
  assert.match(hook, /manager\.enterFromJoinForm\(trimmedCode, trimmedName\)/);
  assert.match(hook, /const trimmedName = playerName\.trim\(\)/);
  assert.doesNotMatch(hook, /userId|&name=|action=create/);
});

test('29-33 Logout: guest state, server revoke, Room/reconnect/Leave untouched', () => {
  assert.match(authContext, /await logoutAccount\(\)/);
  assert.match(authContext, /setUser\(null\)/);
  assert.match(api, /authUrl\('\/logout'\)/);
  assert.match(api, /credentials: 'include'/);
  assert.doesNotMatch(authContext, /leaveRoom|removeRoomReconnectCredential|purgeLegacy|sessionStorage|disconnect/);
  assert.doesNotMatch(api, /sessionStorage|localStorage|leaveRoom|reconnect|ACTIVE_ROOM/);
  assert.match(authContext, /do not Leave, clear Room session, or drop reconnect claims/);
});

test('34-37 Failure/reload: expired → Guest, /me failure does not blank Home, refresh prefill, /login redirect without loop', () => {
  assert.match(api, /return body\.success \? body\.data\.user : null/);
  assert.match(api, /catch \{\s*return null;/);
  assert.match(authContext, /setUser\(null\)/);
  assert.match(authContext, /setStatus\('ready'\)/);
  assert.doesNotMatch(home, /status === 'loading'/);
  assert.doesNotMatch(home, /جاري التحقق من الحساب/);
  assert.match(providers, /AuthProvider/);
  assert.doesNotMatch(layout, /AuthProvider/);
  assert.match(login, /if \(status === 'ready' && user\)/);
  assert.match(login, /router\.replace\(PUBLIC_ROUTES\.home\)/);
  assert.match(hook, /auth\?\.user\?\.preferredDisplayName/);
});

test('auth HTTP uses cookie credentials and never stores tokens', () => {
  assert.match(api, /credentials: 'include'/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|jwt|bearer/i);
  assert.doesNotMatch(authContext, /localStorage|sessionStorage|jwt/i);
  assert.doesNotMatch(login, /localStorage|sessionStorage|jwt/i);
});

test('auth error copy is Arabic and never raw codes', () => {
  assert.equal(presentAuthError({ code: 'RATE_LIMITED', message: 'RATE_LIMITED' }), AUTH_COPY.rateLimited);
  assert.equal(
    presentAuthError({ code: 'INTERNAL_ERROR', message: AUTH_COPY.connectionFailed }),
    AUTH_COPY.connectionFailed,
  );
  assert.equal(
    presentAuthError({ code: 'INTERNAL_ERROR', message: 'Prisma explode' }),
    AUTH_COPY.genericError,
  );
  assert.equal(
    presentAuthError({ code: 'VALIDATION_ERROR', message: AUTH_COPY.invalidEmail }),
    AUTH_COPY.invalidEmail,
  );
  assert.doesNotMatch(login, /error\.code/);
  assert.match(copy, /INVALID_CREDENTIALS|invalidCredentials/);
});

test('FAQ states play does not require an account', () => {
  assert.match(faq, /ما تحتاج حساب عشان تلعب/);
  assert.doesNotMatch(faq, /فائدة تسجيل الدخول|احفظ اسمك وخله جاهز/);
  assert.doesNotMatch(faq, /بريميوم|إحصائيات|سجل المباريات|ألعاب حصرية/i);
});

test('no profile/settings/admin/premium/register routes; Create/Join still omit account ids', () => {
  assert.equal(existsSync(join(root, 'app/(public)/account')), false);
  assert.equal(existsSync(join(root, 'app/(public)/profile')), false);
  assert.equal(existsSync(join(root, 'app/(public)/settings')), false);
  assert.equal(existsSync(join(root, 'app/(public)/register')), false);
  assert.doesNotMatch(authContext, /RoomProvider|useRoom\(/);
  assert.doesNotMatch(providers, /RoomProvider/);
  assert.doesNotMatch(hook, /userId:|&name=|action=create/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
