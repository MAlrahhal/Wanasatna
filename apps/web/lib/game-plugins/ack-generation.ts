/**
 * Drops stale plugin SYNC acknowledgements so a slower older request cannot
 * overwrite a newer authoritative view after PHASE_CHANGED.
 *
 * Transient failures (RATE_LIMITED) must not occupy "latest generation" and
 * discard an in-flight successful view.
 */
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';

export class AckGenerationGate {
  private seq = 0;

  next(): number {
    this.seq += 1;
    return this.seq;
  }

  invalidate(): void {
    this.seq += 1;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.seq;
  }

  /** Drop a current transient result so an older in-flight success can still apply. */
  abandonIfCurrent(requestId: number): void {
    if (this.seq === requestId) {
      this.seq = requestId - 1;
    }
  }
}

export function isRateLimitedPluginSyncResult(result: {
  view: unknown;
  errorMessage: string | null;
}): boolean {
  if (result.view != null || !result.errorMessage) {
    return false;
  }

  return (
    result.errorMessage === SYSTEM_COPY.rateLimited ||
    result.errorMessage === getGameShellErrorMessage('CONNECTION_FAILED')
  );
}

export async function runLatestAck<T>(
  gate: AckGenerationGate,
  work: () => Promise<T>,
  isTransient?: (result: T) => boolean,
): Promise<T | undefined> {
  const requestId = gate.next();
  const result = await work();

  if (isTransient?.(result)) {
    if (!gate.isCurrent(requestId)) {
      return undefined;
    }

    gate.abandonIfCurrent(requestId);
    return result;
  }

  if (!gate.isCurrent(requestId)) {
    return undefined;
  }

  return result;
}
