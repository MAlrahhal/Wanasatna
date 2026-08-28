import 'dotenv/config';

type Environment = Readonly<Record<string, string | undefined>>;

const TEST_FILE_PATTERN = /(?:^|[\\/])tests[\\/].+\.(?:test|spec|audit)\.[cm]?[jt]s$/i;

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
      'TEST_DATABASE_URL resolves to the same database as DATABASE_URL/PRODUCTION_DATABASE_URL. Use an isolated test database or Neon test branch.',
    );
  }

  return testDatabaseUrl;
}
