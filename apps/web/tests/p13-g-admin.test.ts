/**
 * P13-G — Admin Users + Match History UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_COPY, ADMIN_MATCH_STATUS_LABEL } from '../lib/admin/copy';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES, adminHistoryPath, adminUserPath } from '../lib/admin/routes';

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

test('23 /admin/users is a real Admin view', () => {
  assert.equal(ADMIN_ROUTES.users, '/admin/users');
  assert.equal(adminUserPath('abc'), '/admin/users/abc');
  assert.equal(existsSync(join(root, 'app/admin/users/page.tsx')), true);
  const usersNav = ADMIN_NAV_ITEMS.find((item) => item.id === 'users');
  assert.ok(usersNav);
  assert.equal(usersNav.placeholder, false);
  assert.equal(usersNav.href, ADMIN_ROUTES.users);
  const list = read('components/admin/admin-users-client.tsx');
  assert.match(list, /fetchAdminUsers/);
  assert.match(list, /ADMIN_COPY\.emptyUsers/);
  assert.match(list, /md:hidden/);
  assert.match(list, /md:block/);
  assert.match(list, /ADMIN_COPY\.previousPage/);
  assert.match(list, /ADMIN_COPY\.searchCta/);
});

test('24 /admin/users/[userId] read-only detail', () => {
  assert.equal(existsSync(join(root, 'app/admin/users/[userId]/page.tsx')), true);
  const detail = read('components/admin/admin-user-detail-client.tsx');
  assert.match(detail, /fetchAdminUser/);
  assert.match(detail, /ADMIN_COPY\.historicalName/);
  assert.match(detail, /ADMIN_COPY\.emptyUserMatches/);
  assert.match(detail, /md:hidden/);
  assert.doesNotMatch(detail, /passwordHash|ban|promote|deleteUser|PATCH/);
});

test('25 /admin/history is a real Admin view', () => {
  assert.equal(ADMIN_ROUTES.history, '/admin/history');
  assert.equal(adminHistoryPath('m1'), '/admin/history/m1');
  assert.equal(existsSync(join(root, 'app/admin/history/page.tsx')), true);
  const historyNav = ADMIN_NAV_ITEMS.find((item) => item.id === 'log');
  assert.ok(historyNav);
  assert.equal(historyNav.placeholder, false);
  assert.equal(historyNav.href, ADMIN_ROUTES.history);
  const list = read('components/admin/admin-history-client.tsx');
  assert.match(list, /fetchAdminHistory/);
  assert.match(list, /ADMIN_COPY\.emptyHistory/);
  assert.match(list, /ADMIN_COPY\.allGames/);
  assert.match(list, /value="ACTIVE"/);
  assert.match(list, /md:hidden/);
  assert.match(list, /ADMIN_COPY\.activeMatchNote/);
});

test('26 /admin/history/[matchId] participants and linked user nav', () => {
  assert.equal(existsSync(join(root, 'app/admin/history/[matchId]/page.tsx')), true);
  const detail = read('components/admin/admin-match-detail-client.tsx');
  assert.match(detail, /fetchAdminMatch/);
  assert.match(detail, /adminUserPath\(participant\.userId\)/);
  assert.match(detail, /ADMIN_COPY\.guestParticipant/);
  assert.match(detail, /ADMIN_COPY\.linkedAccount/);
  assert.match(detail, /ADMIN_COPY\.activeMatchNote/);
  assert.match(detail, /md:hidden/);
  assert.doesNotMatch(detail, /getGameShell|pluginState|GameShell/);
  assert.equal(ADMIN_MATCH_STATUS_LABEL.ACTIVE, 'جارية');
});

test('27-28 mobile stacked cards, empty/loading/error copy', () => {
  assert.equal(ADMIN_COPY.emptyUsers, 'لا يوجد مستخدمون بعد');
  assert.equal(ADMIN_COPY.emptyHistory, 'لا توجد مباريات في السجل');
  assert.equal(ADMIN_COPY.activeMatchNote, 'سجل المباراة الجارية لا يمثل حالة اللعب الحية.');
  const api = read('lib/admin/api.ts');
  assert.match(api, /fetchAdminUsers/);
  assert.match(api, /fetchAdminHistory/);
  assert.doesNotMatch(api, /passwordHash|tokenHash|reconnectToken|AuthSession/);
  const shell = read('components/admin/admin-shell-client.tsx');
  assert.match(shell, /id === 'users'/);
  assert.match(shell, /id === 'log'/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
