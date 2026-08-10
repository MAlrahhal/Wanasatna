import type { Server } from 'socket.io';
import { TEAM_SNAPSHOT_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../room/room.utils.js';
import {
  clearTeamsForRoom,
  loadEligibleLobbyPlayerIds,
  removePlayerFromPregameTeams,
  syncPregameTeamsWithRoster,
} from '../runtime/pregame-teams.service.js';

/** Call after join so lobby team state tracks the roster. */
export async function onRoomRosterJoined(io: Server, roomId: string): Promise<void> {
  const eligible = await loadEligibleLobbyPlayerIds(roomId);
  const snapshot = syncPregameTeamsWithRoster(roomId, eligible);
  if (snapshot) {
    io.to(getRoomChannel(roomId)).emit(TEAM_SNAPSHOT_EVENT, snapshot);
  }
}

/** Call after leave/kick. */
export async function onRoomPlayerRemoved(
  io: Server,
  roomId: string,
  playerId: string,
  roomDeleted: boolean,
): Promise<void> {
  if (roomDeleted) {
    clearTeamsForRoom(roomId);
    return;
  }

  const eligible = await loadEligibleLobbyPlayerIds(roomId);
  const snapshot = removePlayerFromPregameTeams(roomId, playerId, eligible);
  if (snapshot) {
    io.to(getRoomChannel(roomId)).emit(TEAM_SNAPSHOT_EVENT, snapshot);
  }
}

export function onRoomDeleted(roomId: string): void {
  clearTeamsForRoom(roomId);
}
