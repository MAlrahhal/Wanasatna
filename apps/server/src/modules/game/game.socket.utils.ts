import type { Socket } from 'socket.io';
import type { GameActionResponse } from '@wanasatna/shared';
import { invalidGameContextError } from './game.validators.js';

export function sendGameResponse<T>(
  callback: ((response: GameActionResponse<T>) => void) | undefined,
  response: GameActionResponse<T>,
): void {
  if (typeof callback === 'function') {
    callback(response);
  }
}

export function sendGameInternalError<T>(
  callback: ((response: GameActionResponse<T>) => void) | undefined,
): void {
  sendGameResponse(callback, {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  });
}

export function getGameSocketContext(socket: Socket): GameActionResponse<never> | null {
  const { playerId, roomId } = socket.data;

  if (!playerId || !roomId) {
    return invalidGameContextError('You are not currently in a room.');
  }

  return null;
}
