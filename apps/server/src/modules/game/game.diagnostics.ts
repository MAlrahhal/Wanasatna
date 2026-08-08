import { env } from '../../config/env.js';

/**
 * Development-only structured diagnostics for the Game Shell lifecycle.
 * Silent in production.
 */
export function logGameShellDiagnostic(
  event: string,
  details: Record<string, unknown>,
): void {
  if (env.nodeEnv === 'production') {
    return;
  }

  console.log(
    `[game-shell] ${event}`,
    JSON.stringify({ ...details, at: new Date().toISOString() }),
  );
}
