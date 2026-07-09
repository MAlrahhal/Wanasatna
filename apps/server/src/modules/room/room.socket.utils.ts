import type { Socket } from 'socket.io';
import type { RoomActionResponse } from './room.types.js';
import { getPlayerChannel, getRoomChannel } from './room.utils.js';
import { invalidContextError } from './room.validators.js';

export function sendResponse<T>(
  callback: ((response: RoomActionResponse<T>) => void) | undefined,
  response: RoomActionResponse<T>,
): void {
  if (typeof callback === 'function') {
    callback(response);
  }
}

export function sendInternalError<T>(
  callback: ((response: RoomActionResponse<T>) => void) | undefined,
): void {
  sendResponse(callback, {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  });
}

export function getSocketContext(socket: Socket): RoomActionResponse<never> | null {
  const { playerId, roomId } = socket.data;

  if (!playerId || !roomId) {
    return invalidContextError('You are not currently in a room.');
  }

  return null;
}

export async function bindSocketToRoomSession(
  socket: Socket,
  roomId: string,
  playerId: string,
): Promise<void> {
  if (socket.data.roomId && socket.data.roomId !== roomId) {
    await socket.leave(getRoomChannel(socket.data.roomId));
  }

  if (socket.data.playerId && socket.data.playerId !== playerId) {
    await socket.leave(getPlayerChannel(socket.data.playerId));
  }

  socket.data.playerId = playerId;
  socket.data.roomId = roomId;

  await socket.join(getRoomChannel(roomId));
  await socket.join(getPlayerChannel(playerId));
}

export async function clearSocketSession(socket: Socket): Promise<void> {
  const { playerId, roomId } = socket.data;

  if (roomId) {
    await socket.leave(getRoomChannel(roomId));
  }

  if (playerId) {
    await socket.leave(getPlayerChannel(playerId));
  }

  socket.data.playerId = undefined;
  socket.data.roomId = undefined;
}
