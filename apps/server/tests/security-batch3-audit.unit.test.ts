/**
 * Focused admin audit tests for pre-launch security hardening Batch 3.
 * Uses a capture-only audit client and never connects to a database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_AUDIT_ACTIONS } from '@wanasatna/shared';

process.env.WANASATNA_TEST_MODE = '1';
process.env.TEST_DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/wanasatna_audit_unit';
delete process.env.DATABASE_URL;
delete process.env.PRODUCTION_DATABASE_URL;

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

function captureClient(rows: Array<Record<string, unknown>>) {
  return {
    adminAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
      },
    },
  } as never;
}

function read(relativePath: string): string {
  return readFileSync(join(serverRoot, relativePath), 'utf8');
}

async function main(): Promise<void> {
  const { createAdminAuditLog } = await import('../src/modules/admin/admin-audit.service.js');
  const { prisma } = await import('../src/lib/prisma.js');

  await test('audit metadata uses a per-action allowlist', async () => {
    const rows: Array<Record<string, unknown>> = [];
    await createAdminAuditLog(
      {
        actorUserId: 'admin-1',
        action: 'MFA_LOGIN_FAILURE',
        targetId: 'admin-1',
        outcome: 'FAILURE',
        metadata: {
          method: 'TOTP',
          reason: 'INVALID_CODE',
          password: 'must-not-persist',
          totpCode: '123456',
          secret: 'must-not-persist',
          cookie: 'must-not-persist',
          rawIp: '203.0.113.5',
          requestBody: { anything: true },
        },
      },
      captureClient(rows),
    );

    assert.deepEqual(rows[0]?.metadata, {
      method: 'TOTP',
      reason: 'INVALID_CODE',
    });
  });

  await test('action policy derives target type and retains only bounded safe fields', async () => {
    const rows: Array<Record<string, unknown>> = [];
    await createAdminAuditLog(
      {
        actorUserId: 'admin-1',
        action: 'ROOM_KICK',
        targetId: 'room-1',
        outcome: 'SUCCESS',
        requestId: 'request-1',
        metadata: { playerId: 'player-1', roomDeleted: false, roomCode: 'ABCD12' },
      },
      captureClient(rows),
    );

    assert.equal(rows[0]?.targetType, 'ROOM');
    assert.deepEqual(rows[0]?.metadata, { playerId: 'player-1', roomDeleted: false });
    assert.equal(JSON.stringify(rows[0]).includes('ABCD12'), false);
  });

  await test('every required Batch 3 audit action is accepted by the central writer', async () => {
    const rows: Array<Record<string, unknown>> = [];
    const client = captureClient(rows);
    for (const action of ADMIN_AUDIT_ACTIONS) {
      await createAdminAuditLog({ action, outcome: 'SUCCESS' }, client);
    }
    assert.deepEqual(
      rows.map((row) => row.action),
      [...ADMIN_AUDIT_ACTIONS],
    );
  });

  await test('unknown audit actions and outcomes fail closed at runtime', async () => {
    const client = captureClient([]);
    await assert.rejects(
      createAdminAuditLog({ action: 'UNKNOWN_ACTION' as never, outcome: 'SUCCESS' }, client),
      /Invalid stored admin audit action/,
    );
    await assert.rejects(
      createAdminAuditLog({ action: 'ROLE_PROMOTED', outcome: 'UNKNOWN_OUTCOME' as never }, client),
      /Invalid stored admin audit outcome/,
    );
  });

  await test('audit API and privileged integrations use the intended enforcement modes', () => {
    const routes = read('src/modules/admin/admin.routes.ts');
    const audit = read('src/modules/admin/admin-audit.service.ts');
    const promotion = read('src/modules/admin/promote-existing-user.ts');
    const availability = read('src/modules/game/game-availability.service.ts');
    const rooms = read('src/modules/admin/admin-rooms.service.ts');

    assert.match(routes, /get\('\/audit', requireAdmin/);
    assert.match(audit, /ADMIN_AUDIT_PAGE_SIZE/);
    assert.match(promotion, /\$transaction[\s\S]*ROLE_PROMOTED/);
    assert.match(availability, /\$transaction[\s\S]*GAME_AVAILABILITY_SET/);
    assert.match(rooms, /createAdminAuditLogBestEffort/);
    assert.doesNotMatch(rooms, /select:\s*\{\s*code:\s*true\s*\}/);
  });

  await prisma.$disconnect().catch(() => undefined);

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
