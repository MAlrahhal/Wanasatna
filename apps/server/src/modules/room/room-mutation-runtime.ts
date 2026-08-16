import {
  createRoom,
  handlePlayerDisconnect,
  joinRoom,
  leaveRoom,
  reconnectPlayer,
  syncBoundRoomSession,
} from './room.service.js';
import {
  bindSocketToRoomSession,
  clearSocketSession,
} from './room.socket.utils.js';
import { broadcastRoomPlayersSnapshot, loadActiveRoomPlayers } from './room.utils.js';
import { announcePermanentPlayerRemoval } from './services/disconnected-player-expiry.service.js';
import { onRoomRosterJoined } from '../game/runtime/pregame-teams-room-hooks.js';

export const roomMutationRuntime = {
  createRoom,
  joinRoom,
  leaveRoom,
  reconnectPlayer,
  syncBoundRoomSession,
  handlePlayerDisconnect,
  bindSocketToRoomSession,
  clearSocketSession,
  broadcastRoomPlayersSnapshot,
  loadActiveRoomPlayers,
  announcePermanentPlayerRemoval,
  onRoomRosterJoined,
};

export function restoreRoomMutationRuntimeForTests(): void {
  roomMutationRuntime.createRoom = createRoom;
  roomMutationRuntime.joinRoom = joinRoom;
  roomMutationRuntime.leaveRoom = leaveRoom;
  roomMutationRuntime.reconnectPlayer = reconnectPlayer;
  roomMutationRuntime.syncBoundRoomSession = syncBoundRoomSession;
  roomMutationRuntime.handlePlayerDisconnect = handlePlayerDisconnect;
  roomMutationRuntime.bindSocketToRoomSession = bindSocketToRoomSession;
  roomMutationRuntime.clearSocketSession = clearSocketSession;
  roomMutationRuntime.broadcastRoomPlayersSnapshot = broadcastRoomPlayersSnapshot;
  roomMutationRuntime.loadActiveRoomPlayers = loadActiveRoomPlayers;
  roomMutationRuntime.announcePermanentPlayerRemoval = announcePermanentPlayerRemoval;
  roomMutationRuntime.onRoomRosterJoined = onRoomRosterJoined;
}
