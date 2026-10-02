/**
 * Provider-independent entitlement policy, persistence query, and migration contract tests.
 * Uses injected readers only and never connects to a database.
 *
 * Run: pnpm --filter @wanasatna/server test:entitlements
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EntitlementGrantCandidate } from '../src/modules/entitlements/entitlement-policy.js';

process.env.WANASATNA_TEST_MODE = '1';
process.env.TEST_DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/wanasatna_entitlement_unit';
delete process.env.DATABASE_URL;
delete process.env.PRODUCTION_DATABASE_URL;

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(serverRoot, relativePath), 'utf8');
}

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

async function main(): Promise<void> {
  const { createPrismaEntitlementGrantReader } =
    await import('../src/modules/entitlements/entitlement.repository.js');
  const { hasActiveUserEntitlement } =
    await import('../src/modules/entitlements/entitlement.service.js');
  type Candidate = EntitlementGrantCandidate;
  type Reader = Parameters<typeof hasActiveUserEntitlement>[1];

  const entitlementKey = 'premium.access';
  const userId = 'user-1';
  const at = new Date('2026-10-01T12:00:00.000Z');

  function grant(overrides: Partial<Candidate> = {}): Candidate {
    return {
      id: 'grant-1',
      userId,
      entitlementKey,
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      expiresAt: null,
      revokedAt: null,
      ...overrides,
    };
  }

  function readerFor(grants: readonly Candidate[]): Reader {
    return {
      async findPotentiallyActive() {
        return [...grants];
      },
    };
  }

  await test('active grant authorizes its exact key for its owning user', async () => {
    assert.equal(
      await hasActiveUserEntitlement({ userId, entitlementKey, at }, readerFor([grant()])),
      true,
    );
  });

  await test('grant before its inclusive activation boundary does not authorize', async () => {
    assert.equal(
      await hasActiveUserEntitlement(
        { userId, entitlementKey, at },
        readerFor([grant({ startsAt: new Date('2026-10-01T12:00:00.001Z') })]),
      ),
      false,
    );
    assert.equal(
      await hasActiveUserEntitlement(
        { userId, entitlementKey, at },
        readerFor([grant({ startsAt: at })]),
      ),
      true,
    );
  });

  await test('expiration is exclusive and deterministic at the exact boundary', async () => {
    assert.equal(
      await hasActiveUserEntitlement(
        { userId, entitlementKey, at: new Date(at.getTime() - 1) },
        readerFor([grant({ expiresAt: at })]),
      ),
      true,
    );
    assert.equal(
      await hasActiveUserEntitlement(
        { userId, entitlementKey, at },
        readerFor([grant({ expiresAt: at })]),
      ),
      false,
    );
  });

  await test('any revoked grant is inactive', async () => {
    assert.equal(
      await hasActiveUserEntitlement(
        { userId, entitlementKey, at },
        readerFor([grant({ revokedAt: new Date('2026-09-15T00:00:00.000Z') })]),
      ),
      false,
    );
  });

  await test('one active overlapping grant wins over expired and revoked grants', async () => {
    const grants = [
      grant({ id: 'expired', expiresAt: new Date('2026-09-30T00:00:00.000Z') }),
      grant({ id: 'revoked', revokedAt: new Date('2026-09-20T00:00:00.000Z') }),
      grant({ id: 'active', startsAt: new Date('2026-09-25T00:00:00.000Z') }),
    ];
    assert.equal(
      await hasActiveUserEntitlement({ userId, entitlementKey, at }, readerFor(grants)),
      true,
    );
  });

  await test('another user or entitlement key never authorizes', async () => {
    const wrongGrants = [
      grant({ id: 'wrong-user', userId: 'user-2' }),
      grant({ id: 'wrong-key', entitlementKey: 'another.key' }),
    ];
    assert.equal(
      await hasActiveUserEntitlement({ userId, entitlementKey, at }, readerFor(wrongGrants)),
      false,
    );
  });

  await test('guest, host role, and client-provided status cannot substitute for User identity', async () => {
    let reads = 0;
    const reader: Reader = {
      async findPotentiallyActive() {
        reads += 1;
        return [grant()];
      },
    };
    const untrustedClientState = {
      userId: null,
      isHost: true,
      premium: true,
    };

    assert.equal(
      await hasActiveUserEntitlement(
        { userId: untrustedClientState.userId, entitlementKey, at },
        reader,
      ),
      false,
    );
    assert.equal(reads, 0);
  });

  await test('invalid time and malformed keys fail closed before persistence', async () => {
    let reads = 0;
    const reader: Reader = {
      async findPotentiallyActive() {
        reads += 1;
        return [grant()];
      },
    };

    await assert.rejects(
      hasActiveUserEntitlement({ userId, entitlementKey, at: new Date(Number.NaN) }, reader),
      /valid Date/,
    );
    assert.equal(
      await hasActiveUserEntitlement({ userId, entitlementKey: ' premium.access ', at }, reader),
      false,
    );
    assert.equal(reads, 0);
  });

  await test('Prisma reader applies exact identity, key, and half-open time predicates', async () => {
    let captured: unknown;
    const reader = createPrismaEntitlementGrantReader({
      entitlementGrant: {
        findMany: async (args: unknown) => {
          captured = args;
          return [];
        },
      },
    } as never);

    assert.deepEqual(await reader.findPotentiallyActive({ userId, entitlementKey, at }), []);
    assert.deepEqual(captured, {
      where: {
        userId,
        entitlementKey,
        startsAt: { lte: at },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
      },
      select: {
        id: true,
        userId: true,
        entitlementKey: true,
        startsAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  });

  await test('schema and migration are additive, constrained, and User-owned', () => {
    const schema = read('prisma/schema.prisma');
    const migration = read('prisma/migrations/20260929000000_add_entitlement_grant/migration.sql');

    assert.match(schema, /model EntitlementGrant \{/);
    assert.match(schema, /entitlementGrants\s+EntitlementGrant\[\]/);
    assert.match(schema, /@@unique\(\[source, sourceRef, entitlementKey\]\)/);
    assert.match(schema, /@@index\(\[userId, entitlementKey, startsAt\]\)/);
    assert.match(migration, /CREATE TABLE "EntitlementGrant"/);
    assert.match(migration, /"expiresAt" IS NULL OR "expiresAt" > "startsAt"/);
    assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
    for (const column of ['entitlementKey', 'source', 'sourceRef']) {
      assert.equal(migration.includes(`"${column}" !~ '^[[:space:]]'`), true);
      assert.equal(migration.includes(`"${column}" !~ '[[:space:]]$'`), true);
    }
    assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    assert.doesNotMatch(migration, /ALTER TABLE "(?:User|Player|Room|Match)"/);
  });

  await test('entitlements have no public route or socket surface', () => {
    const service = read('src/modules/entitlements/entitlement.service.ts');
    assert.doesNotMatch(service, /playerId|hostPlayerId|isHost|socket\.data/);
    assert.doesNotMatch(read('src/routes/index.ts'), /entitlement/i);
    assert.doesNotMatch(read('src/sockets/index.ts'), /entitlement/i);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

void main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
