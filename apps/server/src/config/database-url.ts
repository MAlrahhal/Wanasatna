import 'dotenv/config';

type Environment = Readonly<Record<string, string | undefined>>;

const TEST_FILE_PATTERN = /(?:^|[\\/])tests[\\/].+\.(?:test|spec|audit)\.[cm]?[jt]s$/i;
const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const TEST_DATABASE_NAME_PATTERN = /^wanasatna(?:[_-][a-z0-9]+)*$/i;
const TEST_DATABASE_MARKER_PATTERN = /(?:^|[_-])(?:test|unit|integration|verify|ci)(?:[_-]|$)/i;

function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function databaseIdentity(value: string): string {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
    const port =
      url.port || (url.protocol === 'postgresql:' || url.protocol === 'postgres:' ? '5432' : '');
    return [
      url.protocol.toLowerCase(),
      hostname,
      port,
      decodeURIComponent(url.pathname).toLowerCase(),
    ].join('|');
  } catch {
    return value.trim().toLowerCase();
  }
}

function pointsToSameDatabase(left: string, right: string): boolean {
  return databaseIdentity(left) === databaseIdentity(right);
}

function assertIsolatedLocalTestDatabase(value: string): void {
  const isolationError = new Error(
    'TEST_DATABASE_URL must point to an explicitly isolated local PostgreSQL test database.',
  );

  try {
    const url = new URL(value);
    const databaseName = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const isPostgres = url.protocol === 'postgresql:' || url.protocol === 'postgres:';
    const isLocal = LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase());
    const hasTargetOverride = ['host', 'hostaddr', 'database', 'dbname'].some((parameter) =>
      url.searchParams.has(parameter),
    );
    const isExplicitTestDatabase =
      TEST_DATABASE_NAME_PATTERN.test(databaseName) &&
      TEST_DATABASE_MARKER_PATTERN.test(databaseName);

    if (!isPostgres || !isLocal || hasTargetOverride || !isExplicitTestDatabase) {
      throw isolationError;
    }
  } catch (error) {
    if (error === isolationError) {
      throw error;
    }
    throw isolationError;
  }
}

export function isAutomatedTestProcess(
  environment: Environment = process.env,
  argv: readonly string[] = process.argv,
): boolean {
  return (
    environment.NODE_ENV === 'test' ||
    environment.WANASATNA_TEST_MODE === '1' ||
    argv.some((argument) => TEST_FILE_PATTERN.test(argument))
  );
}

export function resolveDatabaseUrl(
  environment: Environment = process.env,
  argv: readonly string[] = process.argv,
): string | undefined {
  const databaseUrl = configured(environment.DATABASE_URL);
  if (!isAutomatedTestProcess(environment, argv)) {
    return databaseUrl;
  }

  const testDatabaseUrl = configured(environment.TEST_DATABASE_URL);
  if (!testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL is required for automated server tests. Tests never fall back to DATABASE_URL.',
    );
  }

  const protectedUrls = [databaseUrl, configured(environment.PRODUCTION_DATABASE_URL)].filter(
    (value): value is string => Boolean(value),
  );
  if (protectedUrls.some((value) => pointsToSameDatabase(testDatabaseUrl, value))) {
    throw new Error(
      'TEST_DATABASE_URL resolves to the same database as DATABASE_URL/PRODUCTION_DATABASE_URL. Use an isolated local test database.',
    );
  }

  assertIsolatedLocalTestDatabase(testDatabaseUrl);
  return testDatabaseUrl;
}
