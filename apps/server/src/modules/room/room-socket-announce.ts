import type { Server } from 'socket.io';
import {
  ADMIN_ROOM_CLOSED_MESSAGE,
  PLAYER_KICKED_EVENT,
  ROOM_CLOSED_EVENT,
  ROOM_UPDATED_EVENT,
  type RoomUpdatedPayload,
} from '@wanasatna/shared';
import { evaluatePlayerRecovery } from '../game/runtime/player-recovery.js';
import { onRoomDeleted, onRoomPlayerRemoved } from '../game/runtime/pregame-teams-room-hooks.js';
import { broadcastRoomPlayersSnapshot, getPlayerChannel, getRoomChannel } from './room.utils.js';
import { clearPlayerAvatarId, clearRoomPlayerAvatars } from './player-avatar.store.js';

export async function announceKickedPlayer(
  io: Server,
  roomId: string,
  kickedPlayerId: string,
  roomDeleted: boolean,
): Promise<void> {
  clearPlayerAvatarId(kickedPlayerId);
  const roomChannel = getRoomChannel(roomId);
  const kickedPlayerChannel = getPlayerChannel(kickedPlayerId);

  io.to(kickedPlayerChannel).emit(PLAYER_KICKED_EVENT, {
    roomId,
    playerId: kickedPlayerId,
  });

  const kickedSockets = await io.in(kickedPlayerChannel).fetchSockets();

  for (const kickedSocket of kickedSockets) {
    await kickedSocket.leave(roomChannel);
    await kickedSocket.leave(kickedPlayerChannel);
    kickedSocket.data.playerId = undefined;
    kickedSocket.data.roomId = undefined;
  }

  if (!roomDeleted) {
    await broadcastRoomPlayersSnapshot(io, roomId);
    await onRoomPlayerRemoved(io, roomId, kickedPlayerId, false);
    await evaluatePlayerRecovery(io, roomId);
    return;
  }

  clearRoomPlayerAvatars(roomId);
  onRoomDeleted(io, roomId);
}

export function emitRoomLockedState(io: Server, payload: RoomUpdatedPayload): void {
  io.to(getRoomChannel(payload.roomId)).emit(ROOM_UPDATED_EVENT, payload);
}

export async function announceAdminRoomClosed(io: Server, roomId: string): Promise<void> {
  const roomChannel = getRoomChannel(roomId);

  io.to(roomChannel).emit(ROOM_CLOSED_EVENT, {
    roomId,
    message: ADMIN_ROOM_CLOSED_MESSAGE,
  });

  const sockets = await io.in(roomChannel).fetchSockets();

  for (const socket of sockets) {
    await socket.leave(roomChannel);
    if (socket.data.playerId) {
      await socket.leave(getPlayerChannel(socket.data.playerId));
    }
    socket.data.playerId = undefined;
    socket.data.roomId = undefined;
  }

  clearRoomPlayerAvatars(roomId);
  onRoomDeleted(io, roomId);
}
