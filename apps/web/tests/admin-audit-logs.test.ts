/**
 * Admin audit logs UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_AUDIT_ACTIONS, ADMIN_AUDIT_PAGE_SIZE } from '@wanasatna/shared';
import { PUBLIC_NAV_LINKS } from '../lib/public/routes';
import {
  ADMIN_AUDIT_ACTION_LABEL,
  ADMIN_COPY,
} from '../lib/admin/copy';
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

test('audit logs route and navigation', () => {
  assert.equal(ADMIN_ROUTES.auditLogs, '/admin/audit-logs');
  assert.equal(existsSync(join(root, 'app/admin/audit-logs/page.tsx')), true);
  const nav = ADMIN_NAV_ITEMS.find((item) => item.id === 'auditLogs');
  assert.ok(nav);
  assert.equal(nav.label, 'سجل التدقيق');
  assert.equal(nav.href, ADMIN_ROUTES.auditLogs);
  assert.equal(ADMIN_COPY.auditLogsTitle, 'سجل التدقيق');
  assert.equal(ADMIN_COPY.emptyAuditLogs, 'لا توجد سجلات تدقيق');
  assert.equal(ADMIN_COPY.unknownAction, 'إجراء غير معروف');
  assert.equal(JSON.stringify(PUBLIC_NAV_LINKS).includes('/admin/audit-logs'), false);
  const roomHistoryIndex = ADMIN_NAV_ITEMS.findIndex((item) => item.id === 'roomHistory');
  const matchLogIndex = ADMIN_NAV_ITEMS.findIndex((item) => item.id === 'log');
  const auditIndex = ADMIN_NAV_ITEMS.findIndex((item) => item.id === 'auditLogs');
  assert.ok(auditIndex > roomHistoryIndex);
  assert.ok(auditIndex === matchLogIndex + 1);
});

test('client uses authenticated audit API with server pagination only', () => {
  const client = read('components/admin/admin-audit-logs-client.tsx');
  const api = read('lib/admin/api.ts');
  assert.equal(ADMIN_AUDIT_PAGE_SIZE, 50);
  assert.match(client, /fetchAdminAuditLogs/);
  assert.match(client, /useSearchParams/);
  assert.match(client, /ADMIN_COPY\.previousPage/);
  assert.match(client, /ADMIN_COPY\.nextPage/);
  assert.match(client, /ADMIN_COPY\.emptyAuditLogs/);
  assert.match(client, /ADMIN_COPY\.unknownAction/);
  assert.match(client, /formatAdminDateTime/);
  assert.match(client, /lg:hidden/);
  assert.doesNotMatch(client, /setInterval|ADMIN_DASHBOARD_POLL_MS|recharts/i);
  assert.match(api, /adminUrl\(`\/audit\$\{suffix\}`\)/);
  assert.match(api, /credentials: 'include'/);
  assert.match(api, /params\.set\('page'/);
  assert.doesNotMatch(api, /passwordHash|tokenHash|reconnectToken|encryptedSecret|ADMIN_EMAILS/);
  assert.doesNotMatch(client, /passwordHash|tokenHash|encryptedSecret|ipAddress|spectate/i);
});

test('known actions have Arabic labels; unknown actions fall back', () => {
  for (const action of ADMIN_AUDIT_ACTIONS) {
    assert.equal(typeof ADMIN_AUDIT_ACTION_LABEL[action], 'string');
    assert.ok(ADMIN_AUDIT_ACTION_LABEL[action].length > 0);
  }
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.ROOM_LOCK, 'قفل غرفة');
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.ROOM_UNLOCK, 'فتح غرفة');
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.ROOM_KICK, 'طرد لاعب');
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.ROOM_FORCE_CLOSE, 'إغلاق غرفة');
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.GAME_AVAILABILITY_SET, 'إعدادات لعبة');
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.ROLE_PROMOTED, 'تغيير صلاحيات');
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.NOT_A_REAL_ACTION, undefined);
  const client = read('components/admin/admin-audit-logs-client.tsx');
  assert.match(client, /ADMIN_AUDIT_ACTION_LABEL\[action\] \?\? ADMIN_COPY\.unknownAction/);
});

test('timezone uses existing admin formatter with Riyadh', () => {
  const format = read('lib/admin/format.ts');
  assert.match(format, /timeZone: 'Asia\/Riyadh'/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
