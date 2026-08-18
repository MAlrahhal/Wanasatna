/**
 * P14-C — Admin analytics UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_ANALYTICS_DEFAULT_RANGE,
  ADMIN_ANALYTICS_POLL_MS,
  ADMIN_ANALYTICS_RANGES,
} from '@wanasatna/shared';
import { PUBLIC_NAV_LINKS } from '../lib/public/routes';
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

test('31-37 analytics page, range, loading/error/empty, layout, refresh', () => {
  assert.equal(ADMIN_ROUTES.analytics, '/admin/analytics');
  assert.equal(existsSync(join(root, 'app/admin/analytics/page.tsx')), true);
  const nav = ADMIN_NAV_ITEMS.find((item) => item.id === 'analytics');
  assert.ok(nav);
  assert.equal(nav.label, 'التحليلات');
  assert.equal(nav.href, ADMIN_ROUTES.analytics);
  assert.equal(ADMIN_COPY.analyticsTitle, 'التحليلات');
  assert.equal(ADMIN_COPY.overview, 'نظرة عامة');
  assert.equal(ADMIN_COPY.gameUsage, 'استخدام الألعاب');
  assert.equal(ADMIN_COPY.activity, 'النشاط');
  assert.equal(ADMIN_COPY.participation, 'المشاركة');
  assert.equal(ADMIN_COPY.emptyPeriod, 'لا توجد بيانات في هذه الفترة');
  assert.equal(ADMIN_COPY.activeMatchRecords, 'سجلات مباريات بحالة جارية');
  assert.equal(ADMIN_ANALYTICS_DEFAULT_RANGE, '7d');
  assert.deepEqual([...ADMIN_ANALYTICS_RANGES], ['24h', '7d', '30d', 'all']);
  assert.equal(ADMIN_ANALYTICS_POLL_MS, 60_000);
  assert.equal(JSON.stringify(PUBLIC_NAV_LINKS).includes('/admin/analytics'), false);

  const page = read('components/admin/admin-analytics-client.tsx');
  assert.match(page, /ADMIN_ANALYTICS_RANGES/);
  assert.match(page, /ADMIN_COPY\.range24h/);
  assert.match(page, /ADMIN_COPY\.resolving/);
  assert.match(page, /ADMIN_COPY\.loadFailed/);
  assert.match(page, /ADMIN_COPY\.retry/);
  assert.match(page, /ADMIN_COPY\.emptyPeriod/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /lg:grid-cols-4/);
  assert.match(page, /inFlightRef\.current/);
  assert.match(page, /ADMIN_ANALYTICS_POLL_MS/);
  assert.match(page, /document\.hidden/);
  assert.match(page, /formatPercent/);
  assert.doesNotMatch(page, /recharts|chart\.js|unique users|DAU|MAU/i);
  assert.doesNotMatch(read('lib/admin/api.ts'), /passwordHash|DATABASE_URL/);
  assert.match(read('lib/admin/api.ts'), /fetchAdminAnalytics/);
  assert.match(read('components/admin/admin-shell-client.tsx'), /id === 'analytics'/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
