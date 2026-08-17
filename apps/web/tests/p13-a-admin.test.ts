/**
 * P13-A — Admin panel foundation UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_NAV_LINKS, PUBLIC_ROUTES } from '../lib/public/routes';
import { ADMIN_COPY } from '../lib/admin/copy';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES } from '../lib/admin/routes';

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

const publicFiles = [
  'lib/public/routes.ts',
  'components/public/public-navbar.tsx',
  'components/public/mobile-navigation.tsx',
  'components/public/public-footer.tsx',
  'components/public/public-account-menu.tsx',
  'app/(public)/home-page-client.tsx',
  'app/(public)/login/login-page-client.tsx',
  'app/(public)/layout.tsx',
];

test('11 public site has no Admin link', () => {
  assert.equal(JSON.stringify(PUBLIC_NAV_LINKS).includes('/admin'), false);
  assert.equal(JSON.stringify(PUBLIC_ROUTES).includes('/admin'), false);
  for (const file of publicFiles) {
    assert.doesNotMatch(read(file), /\/admin/, file);
    assert.doesNotMatch(read(file), /لوحة الإدارة/, file);
  }
});

test('admin routes exist outside public layout', () => {
  assert.equal(existsSync(join(root, 'app/admin/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/admin/login/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(public)/admin')), false);
  const layout = read('app/admin/layout.tsx');
  assert.doesNotMatch(layout, /PublicNavbar|PublicFooter|PublicLayoutClient/);
  assert.equal(ADMIN_ROUTES.root, '/admin');
  assert.equal(ADMIN_ROUTES.login, '/admin/login');
});

test('admin login reuses account auth and denies USER after /api/admin/me', () => {
  const login = read('components/admin/admin-login-client.tsx');
  assert.match(login, /ADMIN_COPY\.emailLabel/);
  assert.match(login, /ADMIN_COPY\.passwordLabel/);
  assert.match(login, /login\(/);
  assert.match(login, /fetchAdminMe/);
  assert.match(login, /ADMIN_COPY\.accessDenied/);
  assert.doesNotMatch(login, /register\(/);
  assert.doesNotMatch(login, /localStorage|ADMIN_EMAILS/);
  assert.equal(ADMIN_COPY.emailLabel, 'البريد الإلكتروني');
  assert.equal(ADMIN_COPY.passwordLabel, 'كلمة المرور');
  assert.equal(ADMIN_COPY.accessDenied, 'غير مصرح لك بالدخول إلى لوحة الإدارة.');
});

test('admin panel gates on server /api/admin/me; logout returns to admin login', () => {
  const panel = read('components/admin/admin-panel-client.tsx');
  const api = read('lib/admin/api.ts');
  const auth = read('contexts/auth-context.tsx');
  assert.match(panel, /fetchAdminMe/);
  assert.match(panel, /ADMIN_ROUTES\.login/);
  assert.match(panel, /logout\(/);
  assert.match(panel, /ADMIN_COPY\.accessDenied/);
  assert.match(panel, /ADMIN_COPY\.panelTitle/);
  assert.match(api, /\/api\/admin/);
  assert.match(api, /adminUrl\('\/me'\)/);
  assert.match(api, /credentials: 'include'/);
  assert.doesNotMatch(panel, /leaveRoom|reconnectToken|passwordHash/);
  assert.doesNotMatch(api, /passwordHash|tokenHash|reconnectToken/);
  assert.match(auth, /refreshIdleRoomSocketForAccountAuth/);
  assert.doesNotMatch(auth, /leaveRoom/);
});

test('admin shell has desktop sidebar, mobile nav, placeholder sections', () => {
  const panel = read('components/admin/admin-panel-client.tsx');
  assert.match(panel, /md:flex/);
  assert.match(panel, /md:hidden/);
  assert.match(panel, /admin-mobile-nav/);
  const labels = ADMIN_NAV_ITEMS.map((item) => item.label);
  assert.deepEqual(labels, ['الرئيسية', 'الغرف', 'المستخدمون', 'الألعاب', 'السجل']);
  assert.equal(ADMIN_COPY.panelTitle, 'لوحة الإدارة');
  assert.doesNotMatch(panel, /إحصائيات|premium|20-player|playerCap/i);
});

test('no Admin secrets in admin UI sources', () => {
  const files = [
    'components/admin/admin-panel-client.tsx',
    'components/admin/admin-login-client.tsx',
    'lib/admin/api.ts',
    'app/admin/layout.tsx',
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /passwordHash|tokenHash|reconnectToken|ADMIN_EMAILS|Prisma/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
