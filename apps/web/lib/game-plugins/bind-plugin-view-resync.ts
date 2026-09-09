import type { Socket } from 'socket.io-client';
import { GAME_SHELL_STATE_EVENT } from '@wanasatna/shared';

export type PluginResyncSocket = Pick<Socket, 'on' | 'off'>;

/** One token refill at 2/s is 500ms; wait just past that before a bounded retry. */
export const PLUGIN_SYNC_RATE_LIMIT_RETRY_MS = 600;
export const PLUGIN_SYNC_RATE_LIMIT_MAX_RETRIES = 2;

export type PluginSyncOutcome = void | 'rate-limited' | undefined;

export type PluginViewSyncFn = () => PluginSyncOutcome | Promise<PluginSyncOutcome>;

/**
 * Plugin views recover from PHASE_CHANGED (empty payload → re-SYNC) and from
 * GAME_SHELL_STATE (reconnect / bound ROOM_SYNC). Mount also SYNCs once.
 *
 * Multiple recovery signals share at most one in-flight SYNC plus one follow-up.
 */
export function bindPluginViewResync(
  socket: PluginResyncSocket,
  phaseChangedEvent: string,
  syncView: PluginViewSyncFn,
  options?: {
    onPhaseChanged?: () => void;
    extraBind?: () => () => void;
    rateLimitRetryMs?: number;
    maxRateLimitRetries?: number;
  },
): () => void {
  const rateLimitRetryMs = options?.rateLimitRetryMs ?? PLUGIN_SYNC_RATE_LIMIT_RETRY_MS;
  const maxRateLimitRetries = options?.maxRateLimitRetries ?? PLUGIN_SYNC_RATE_LIMIT_MAX_RETRIES;

  let disposed = false;
  let inFlight = false;
  let pending = false;
  let rateLimitRetries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetryTimer = () => {
    if (!retryTimer) {
      return;
    }
    clearTimeout(retryTimer);
    retryTimer = null;
  };

  const requestSync = () => {
    if (disposed) {
      return;
    }

    if (inFlight) {
      pending = true;
      return;
    }

    if (retryTimer) {
      pending = true;
      return;
    }

    inFlight = true;
    pending = false;

    void Promise.resolve()
      .then(() => syncView())
      .then(
        (outcome) => {
          finish(outcome === 'rate-limited' ? 'rate-limited' : 'ok');
        },
        () => {
          finish('ok');
        },
      );
  };

  const scheduleRateLimitRetry = () => {
    if (rateLimitRetries >= maxRateLimitRetries) {
      return;
    }

    rateLimitRetries += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      requestSync();
    }, rateLimitRetryMs);
  };

  const finish = (outcome: 'ok' | 'rate-limited') => {
    inFlight = false;

    if (disposed) {
      return;
    }

    if (outcome === 'ok') {
      rateLimitRetries = 0;
      if (pending) {
        pending = false;
        requestSync();
      }
      return;
    }

    scheduleRateLimitRetry();
  };

  const onPhaseChanged = () => {
    options?.onPhaseChanged?.();
    requestSync();
  };
  const onShellState = () => {
    requestSync();
  };

  socket.on(phaseChangedEvent, onPhaseChanged);
  socket.on(GAME_SHELL_STATE_EVENT, onShellState);
  const extraOff = options?.extraBind?.();
  requestSync();

  return () => {
    disposed = true;
    pending = false;
    clearRetryTimer();
    socket.off(phaseChangedEvent, onPhaseChanged);
    socket.off(GAME_SHELL_STATE_EVENT, onShellState);
    extraOff?.();
  };
}
