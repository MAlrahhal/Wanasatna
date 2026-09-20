import type { Server } from 'socket.io';
import { GUESSING_CHALLENGE_GAME_ID, TEAM_SNAPSHOT_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../room/room.utils.js';
import {
  deleteGameShell,
  getGameShellByRoomId,
  removePrePlayingMatchParticipant,
  syncGameShell,
} from '../game.service.js';
import { cleanupGameShellRuntime } from '../game.lifecycle.js';
import { broadcastGameShellState } from '../game.timer.js';
import { handleGuessingChallengePermanentLeave } from '../plugins/guessing-challenge/match-lifecycle.js';
import { getGuessingChallengeRoomMode } from '../plugins/guessing-challenge/mode-store.js';
import { handleJudgePermanentLeave } from '../plugins/judge/match-lifecycle.js';
import { cleanupPluginMatchState } from './cleanup-plugin-match.js';
import { clearPlayerRecoveryForTeardown } from './player-recovery.js';
import { clearRoomContentHistory } from './room-content-history.js';
import {
  clearTeamsForRoom,
  loadEligibleLobbyPlayerIds,
  removePlayerFromPregameTeams,
  syncPregameTeamsWithRoster,
  validatePregameTeamsForStart,
} from './pregame-teams.service.js';
import { clearMarathonState, markMarathonPlayerDeparted } from '../../marathon/marathon.runtime.js';
import { cancelRoomDisconnectedPlayerExpiryTimers } from '../../room/services/disconnected-player-expiry-timers.js';
import { abortActiveMatch } from './abort-active-match.js';
import { getGamePluginDefinition } from './plugin-registry.js';
import { reconcileActivePersistedMatchParticipants } from '../../match/match-history.service.js';

/** Call after join so lobby team state tracks the roster. */
export async function onRoomRosterJoined(io: Server, roomId: string): Promise<void> {
  const eligible = await loadEligibleLobbyPlayerIds(roomId);
  const snapshot = syncPregameTeamsWithRoster(roomId, eligible);
  if (snapshot) {
    io.to(getRoomChannel(roomId)).emit(TEAM_SNAPSHOT_EVENT, snapshot);
  }

  const shell = getGameShellByRoomId(roomId);
  if (shell && (shell.phase === 'PLAYING' || shell.phase === 'COUNTDOWN')) {
    const synced = await syncGameShell(roomId);
    if (synced.success && synced.data.state) {
      broadcastGameShellState(io, synced.data.state);
    }
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

  const prePlayingShell = removePrePlayingMatchParticipant(roomId, playerId);

  handleJudgePermanentLeave(io, roomId, playerId);
  handleGuessingChallengePermanentLeave(io, roomId, playerId);
  markMarathonPlayerDeparted(roomId, playerId);

  const eligible = await loadEligibleLobbyPlayerIds(roomId);
  const snapshot = removePlayerFromPregameTeams(roomId, playerId, eligible);
  if (snapshot) {
    io.to(getRoomChannel(roomId)).emit(TEAM_SNAPSHOT_EVENT, snapshot);
  }

  if (!prePlayingShell) {
    return;
  }

  const minimumPlayers = prePlayingShell.gameId
    ? getGamePluginDefinition(prePlayingShell.gameId)?.minPlayers
    : undefined;
  const participantPlayerIds = prePlayingShell.matchParticipantIds ?? [];
  const guessingChallengeTeams =
    prePlayingShell.gameId === GUESSING_CHALLENGE_GAME_ID
      ? validatePregameTeamsForStart({
          roomId,
          gameId: GUESSING_CHALLENGE_GAME_ID,
          mode: getGuessingChallengeRoomMode(roomId) ?? '1v1',
          eligiblePlayerIds: participantPlayerIds,
        })
      : null;

  if (
    (minimumPlayers !== undefined && participantPlayerIds.length < minimumPlayers) ||
    (guessingChallengeTeams !== null && !guessingChallengeTeams.success)
  ) {
    await abortActiveMatch(io, roomId, 'insufficient_players');
    return;
  }

  await reconcileActivePersistedMatchParticipants(roomId, participantPlayerIds);
  broadcastGameShellState(io, prePlayingShell);
}

export function onRoomDeleted(io: Server, roomId: string): void {
  cancelRoomDisconnectedPlayerExpiryTimers(roomId);
  const shell = getGameShellByRoomId(roomId);
  clearPlayerRecoveryForTeardown(io, roomId);

  if (shell) {
    cleanupGameShellRuntime(roomId);
    cleanupPluginMatchState(roomId, shell.gameId);
    deleteGameShell(roomId);
  }

  clearTeamsForRoom(roomId);
  clearMarathonState(roomId);
  clearRoomContentHistory(roomId);
}
