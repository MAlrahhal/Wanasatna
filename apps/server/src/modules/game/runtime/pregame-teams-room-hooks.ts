import type { Server } from 'socket.io';
import { TEAM_SNAPSHOT_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../game.service.js';
import { cleanupGameShellRuntime } from '../game.lifecycle.js';
import { handleGuessingChallengePermanentLeave } from '../plugins/guessing-challenge/match-lifecycle.js';
import { handleJudgePermanentLeave } from '../plugins/judge/match-lifecycle.js';
import { cleanupPluginMatchState } from './cleanup-plugin-match.js';
import { clearPlayerRecoveryForTeardown } from './player-recovery.js';
import {
  clearTeamsForRoom,
  loadEligibleLobbyPlayerIds,
  removePlayerFromPregameTeams,
  syncPregameTeamsWithRoster,
} from './pregame-teams.service.js';
import { clearMarathonState, markMarathonPlayerDeparted } from '../../marathon/marathon.runtime.js';

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
    clearMarathonState(roomId);
    clearTeamsForRoom(roomId);
    return;
  }

  handleJudgePermanentLeave(io, roomId, playerId);
  handleGuessingChallengePermanentLeave(io, roomId, playerId);
  markMarathonPlayerDeparted(roomId, playerId);

  const eligible = await loadEligibleLobbyPlayerIds(roomId);
  const snapshot = removePlayerFromPregameTeams(roomId, playerId, eligible);
  if (snapshot) {
    io.to(getRoomChannel(roomId)).emit(TEAM_SNAPSHOT_EVENT, snapshot);
  }
}

export function onRoomDeleted(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  clearPlayerRecoveryForTeardown(io, roomId);

  if (shell) {
    cleanupGameShellRuntime(roomId);
    cleanupPluginMatchState(roomId, shell.gameId);
    deleteGameShell(roomId);
  }

  clearTeamsForRoom(roomId);
  clearMarathonState(roomId);
}
