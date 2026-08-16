import type { GameActionResponse } from '@wanasatna/shared';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';

export function isGameActionResponse<T>(value: unknown): value is GameActionResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

/** Socket.IO ACK callback is (err, value); some transports put the payload first. */
export function pickAckResponse<T>(
  error: unknown,
  response: unknown,
  isValid: (value: unknown) => value is T,
): T | undefined {
  if (isValid(response)) {
    return response;
  }

  if (isValid(error)) {
    return error;
  }

  return undefined;
}

export function resolveGameAck<T>(error: unknown, response: unknown): GameActionResponse<T> {
  const resolved = pickAckResponse(error, response, isGameActionResponse<T>);

  if (!resolved) {
    return {
      success: false,
      error: {
        code: 'CONNECTION_FAILED',
        message: getGameShellErrorMessage('CONNECTION_FAILED'),
      },
    };
  }

  return resolved;
}

export function localizePluginAck<T>(response: GameActionResponse<T>): GameActionResponse<T> {
  if (response.success) {
    return response;
  }

  return {
    success: false,
    error: {
      code: response.error.code,
      message: getGameShellErrorMessage(response.error.code, response.error.message),
    },
  };
}
