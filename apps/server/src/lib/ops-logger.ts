const FORBIDDEN_META_KEY =
  /password|cookie|token|hash|email|database|secret|authorization|reconnect|drawing|stroke|canonical|answer|content|error.*message|raw.*error/i;

function sanitizeString(value: string): string {
  if (/postgres(ql)?:\/\//i.test(value) || /DATABASE_URL/i.test(value)) {
    return '[redacted]';
  }
  return value.length > 200 ? `${value.slice(0, 200)}…` : value;
}

function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) {
    return {};
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEY.test(key)) {
      continue;
    }
    if (typeof value === 'string') {
      safe[key] = sanitizeString(value);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      safe[key] = value;
      continue;
    }
  }
  return safe;
}

function write(
  level: 'info' | 'warn' | 'error',
  event: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    ...sanitizeMeta(meta),
  });

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}

export const opsLogger = {
  info(event: string, message: string, meta?: Record<string, unknown>): void {
    write('info', event, message, meta);
  },
  warn(event: string, message: string, meta?: Record<string, unknown>): void {
    write('warn', event, message, meta);
  },
  error(event: string, message: string, meta?: Record<string, unknown>): void {
    write('error', event, message, meta);
  },
};

export function sanitizeErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  return typeof error;
}

export function sanitizeKnownErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}
