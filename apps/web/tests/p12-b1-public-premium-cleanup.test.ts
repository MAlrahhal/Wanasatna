/**
 * P12-B.1 — public Premium marketing surface must be gone.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/p12-b1-public-premium-cleanup.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_ROOM_PLAYERS } from '@wanasatna/shared';
import { faqCategories, faqItems } from '../lib/public/faq-data';
import { PUBLIC_NAV_LINKS, PUBLIC_ROUTES } from '../lib/public/routes';

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

function collectSourceFiles(relativeDir: string): string[] {
  const abs = join(root, relativeDir);
  if (!existsSync(abs)) {
    return [];
  }

  const files: string[] = [];
  const stack = [abs];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current)) {
      const next = join(current, entry);
      const stat = statSync(next);
      if (stat.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) {
        files.push(next);
      }
    }
  }

  return files;
}

test('/premium route no longer exists in public route config', () => {
  assert.equal('premium' in PUBLIC_ROUTES, false);
  assert.doesNotMatch(read('lib/public/routes.ts'), /\/premium/);
  assert.equal(existsSync(join(root, 'app/(public)/premium')), false);
});

test('public nav has no Premium item', () => {
  const serialized = JSON.stringify(PUBLIC_NAV_LINKS);
  assert.equal(serialized.includes('بريميوم'), false);
  assert.equal(serialized.includes('/premium'), false);
  assert.doesNotMatch(read('components/public/public-navbar.tsx'), /بريميوم|premium/);
});

test('mobile nav has no Premium item', () => {
  const mobile = read('components/public/mobile-navigation.tsx');
  assert.match(mobile, /PUBLIC_NAV_LINKS/);
  assert.doesNotMatch(mobile, /بريميوم|premium/);
});

test('footer has no Premium link', () => {
  const footer = read('components/public/public-footer.tsx');
  assert.doesNotMatch(footer, /بريميوم|premium/);
  assert.match(footer, /PUBLIC_ROUTES\.login/);
});

test('Home has no Premium CTA/card', () => {
  const home = read('app/(public)/home-page-client.tsx');
  assert.doesNotMatch(home, /بريميوم|premium|تعرّف على|استكشف كل الألعاب|الانتقال إلى الألعاب/);
  assert.match(home, /ألعاب مميزة/);
});

test('FAQ has no Premium category', () => {
  const serialized = JSON.stringify({ faqCategories, faqItems });
  assert.equal(serialized.includes('premium'), false);
  assert.equal(serialized.includes('بريميوم'), false);
  assert.doesNotMatch(read('app/(public)/faq/page.tsx'), /بريميوم|premium/);
});

test('Login has no Premium benefit', () => {
  const login = read('app/(public)/login/login-page-client.tsx');
  const copy = read('lib/auth/copy.ts');
  assert.doesNotMatch(login, /بريميوم|premium/);
  assert.doesNotMatch(copy, /بريميوم|premium/);
  assert.match(copy, /حفظ الاسم المفضّل/);
  assert.match(copy, /الحساب اختياري/);
  assert.doesNotMatch(login, /تسجيل الدخول قيد التطوير/);
});

test('no production UI renders بريميوم or a Premium upgrade CTA', () => {
  const dirs = ['app', 'components', 'lib', 'plugins'];
  for (const dir of dirs) {
    for (const file of collectSourceFiles(dir)) {
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /بريميوم/, file);
      assert.doesNotMatch(source, /تعرّف على بريميوم/, file);
      assert.doesNotMatch(source, /احصل على/, file);
      assert.doesNotMatch(source, /ترقية/, file);
    }
  }
});

test('unrelated public routes remain', () => {
  assert.equal(PUBLIC_ROUTES.home, '/');
  assert.equal(PUBLIC_ROUTES.games, '/games');
  assert.equal(PUBLIC_ROUTES.faq, '/faq');
  assert.equal(PUBLIC_ROUTES.contact, '/contact');
  assert.equal(PUBLIC_ROUTES.login, '/login');
});

test('game cards remain available/coming-soon only', () => {
  const cards = read('components/public/game-cards.tsx');
  const lobbyCard = read('components/lobby/game-card.tsx');
  const status = read('components/public/status-badge.tsx');
  assert.match(cards, /coming-soon/);
  assert.match(lobbyCard, /coming-soon/);
  assert.doesNotMatch(status, /premium/);
  assert.doesNotMatch(cards, /premium/);
  assert.doesNotMatch(lobbyCard, /premium/);
});

test('current room cap remains 8 and GC remains 2/4', () => {
  assert.equal(MAX_ROOM_PLAYERS, 8);
  const gc = read('plugins/guessing-challenge/index.tsx');
  assert.match(gc, /minPlayers:\s*2/);
  assert.match(gc, /maxPlayers:\s*4/);
});

const total = passed + failed;
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
void total;
