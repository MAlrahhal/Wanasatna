import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAutomatedTestProcess, resolveDatabaseUrl } from '../src/config/database-url.js';

const developmentUrl = 'postgresql://dev:secret@dev.example.test:5432/wanasatna_dev';
const productionUrl = 'postgresql://prod:secret@ep-production.us-east-1.aws.neon.tech/neondb';
const pooledProductionUrl =
  'postgresql://other-role:other@ep-production-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const testUrl = 'postgresql://test:secret@ep-test.us-east-1.aws.neon.tech/neondb';
const testArgv = ['node', 'C:\\repo\\apps\\server\\tests\\room.unit.test.ts'];
const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(serverRoot, '..', '..');

assert.equal(
  resolveDatabaseUrl({ NODE_ENV: 'development', DATABASE_URL: developmentUrl }, []),
  developmentUrl,
);
assert.equal(isAutomatedTestProcess({ NODE_ENV: 'test' }, []), true);
assert.equal(isAutomatedTestProcess({ WANASATNA_TEST_MODE: '1' }, []), true);
assert.equal(isAutomatedTestProcess({ NODE_ENV: 'development' }, testArgv), true);

assert.throws(
  () => resolveDatabaseUrl({ NODE_ENV: 'test', DATABASE_URL: productionUrl }, []),
  /TEST_DATABASE_URL is required/,
);
assert.equal(
  resolveDatabaseUrl(
    { NODE_ENV: 'test', DATABASE_URL: productionUrl, TEST_DATABASE_URL: testUrl },
    [],
  ),
  testUrl,
);
assert.throws(
  () =>
    resolveDatabaseUrl(
      {
        NODE_ENV: 'test',
        DATABASE_URL: productionUrl,
        TEST_DATABASE_URL: pooledProductionUrl,
      },
      [],
    ),
  /same database/,
);
assert.throws(
  () =>
    resolveDatabaseUrl(
      {
        WANASATNA_TEST_MODE: '1',
        PRODUCTION_DATABASE_URL: productionUrl,
        TEST_DATABASE_URL: pooledProductionUrl,
      },
      [],
    ),
  /same database/,
);

const prismaSource = readFileSync(join(serverRoot, 'src/lib/prisma.ts'), 'utf8');
const serverProductionAudit = readFileSync(
  join(serverRoot, 'tests/production-isolation.audit.ts'),
  'utf8',
);
const webProductionAudit = readFileSync(
  join(repoRoot, 'apps/web/tests/e2e/production-isolation.audit.spec.ts'),
  'utf8',
);
assert.match(prismaSource, /resolveDatabaseUrl\(\)/);
for (const source of [serverProductionAudit, webProductionAudit]) {
  assert.match(source, /WANASATNA_PRODUCTION_WRITE_AUDIT_CONFIRM/);
  assert.match(source, /WRITE_TO_PRODUCTION/);
}
assert.doesNotMatch(serverProductionAudit, /railway\.app/);
assert.doesNotMatch(webProductionAudit, /\?\?\s*['"]https:\/\/wanasatna\.com/);

console.log('PASS test databases and live production-write audits fail closed');
