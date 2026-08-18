/**
 * P13-B — Admin dashboard UI contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_DASHBOARD_POLL_MS } from '@wanasatna/shared';
import { ADMIN_COPY } from '../lib/admin/copy';

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

test('16 empty states work', () => {
  const dashboard = read('components/admin/admin-dashboard-client.tsx');
  assert.equal(ADMIN_COPY.emptyRooms, 'لا توجد غرف نشطة حالياً');
  assert.match(dashboard, /ADMIN_COPY\.emptyRooms/);
  assert.match(dashboard, /ADMIN_COPY\.emptyMatches/);
  assert.match(dashboard, /ADMIN_COPY\.emptyUsers/);
  assert.match(dashboard, /liveRooms\.length === 0/);
  assert.match(dashboard, /recentMatches\.length === 0/);
});

test('17 polling does not overlap infinitely', () => {
  const dashboard = read('components/admin/admin-dashboard-client.tsx');
  assert.equal(ADMIN_DASHBOARD_POLL_MS >= 10_000, true);
  assert.equal(ADMIN_DASHBOARD_POLL_MS <= 15_000, true);
  assert.match(dashboard, /ADMIN_DASHBOARD_POLL_MS/);
  assert.match(dashboard, /inFlightRef\.current/);
  assert.match(dashboard, /document\.hidden/);
  assert.doesNotMatch(dashboard, /setInterval\([^,]+,\s*1000\s*\)/);
  assert.doesNotMatch(dashboard, /io\(|socket/);
});

test('18 API failure gives retry-safe UI', () => {
  const dashboard = read('components/admin/admin-dashboard-client.tsx');
  assert.match(dashboard, /ADMIN_COPY\.loadFailed/);
  assert.match(dashboard, /ADMIN_COPY\.retry/);
  assert.match(dashboard, /ADMIN_COPY\.refresh/);
  assert.equal(ADMIN_COPY.loadFailed.includes('تعذر'), true);
});

test('dashboard sections and lobby vs in-game copy', () => {
  const dashboard = read('components/admin/admin-dashboard-client.tsx');
  const panel = read('components/admin/admin-panel-client.tsx');
  assert.match(panel, /AdminDashboardClient/);
  assert.match(dashboard, /ADMIN_COPY\.summary/);
  assert.match(dashboard, /ADMIN_COPY\.liveRooms/);
  assert.match(dashboard, /ADMIN_COPY\.recentMatches/);
  assert.match(dashboard, /ADMIN_COPY\.games/);
  assert.match(dashboard, /ADMIN_COPY\.recentUsers/);
  assert.equal(ADMIN_COPY.lobby, 'في اللوبي');
  assert.equal(ADMIN_COPY.inGame, 'داخل لعبة');
  assert.doesNotMatch(dashboard, /kick|deleteRoom|promote|20-player|premium/i);
});

test('no Admin secrets in dashboard UI', () => {
  const files = [
    'components/admin/admin-dashboard-client.tsx',
    'lib/admin/api.ts',
    'lib/admin/format.ts',
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /passwordHash|tokenHash|reconnectToken|ADMIN_EMAILS/);
  }
  assert.match(read('lib/admin/api.ts'), /adminUrl\('\/dashboard'\)/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
