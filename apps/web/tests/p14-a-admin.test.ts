/**
 * P14-A — Admin system page UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_SYSTEM_POLL_MS } from '@wanasatna/shared';
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

test('16-17 /admin/system polls without overlap; mobile cards', () => {
  assert.equal(ADMIN_ROUTES.system, '/admin/system');
  assert.equal(existsSync(join(root, 'app/admin/system/page.tsx')), true);
  const nav = ADMIN_NAV_ITEMS.find((item) => item.id === 'system');
  assert.ok(nav);
  assert.equal(nav.placeholder, false);
  assert.equal(nav.href, ADMIN_ROUTES.system);
  assert.equal(nav.label, 'حالة النظام');
  assert.equal(ADMIN_COPY.systemTitle, 'حالة النظام');
  assert.equal(ADMIN_SYSTEM_POLL_MS >= 20_000, true);
  assert.equal(ADMIN_SYSTEM_POLL_MS <= 30_000, true);
  const page = read('components/admin/admin-system-client.tsx');
  assert.match(page, /ADMIN_SYSTEM_POLL_MS/);
  assert.match(page, /inFlightRef\.current/);
  assert.match(page, /document\.hidden/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /ADMIN_COPY\.serverStatus/);
  assert.match(page, /ADMIN_COPY\.databaseStatus/);
  assert.match(page, /ADMIN_COPY\.liveGames/);
  assert.match(page, /ADMIN_COPY\.recordedActiveMatches/);
  assert.doesNotMatch(page, /chart|recharts|analytics/i);
  assert.doesNotMatch(read('lib/admin/api.ts'), /passwordHash|DATABASE_URL/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
