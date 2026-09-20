import type { Server } from 'socket.io';
import type { GuessingChallengeMatchState } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getGuessingChallengeRoomMode } from './mode-store.js';
import { startGuessingChallengePhaseTimerIfNeeded } from './phase-timer.js';
import {
  createMatchState,
  requiredPlayerCountForMode,
  resolveGuessingChallengeMode,
} from './state.js';
import { getGuessingChallengeState, setGuessingChallengeState } from './store.js';
import { getPregameTeams, toTeamMaps } from '../../runtime/pregame-teams-store.js';
import { validatePregameTeamsForStart } from '../../runtime/pregame-teams.service.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureGuessingChallengeMatchState(
  roomId: string,
): GuessingChallengeMatchState | null {
  const existing = getGuessingChallengeState(roomId);
  const shell = getGameShellByRoomId(roomId);

  if (existing) {
    return shell && pluginParticipantsMatchShell(shell, existing.playerIds) ? existing : null;
  }

  if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);
  const roomMode = getGuessingChallengeRoomMode(roomId);
  const mode = resolveGuessingChallengeMode(content.settings, roomMode);
  const expected = requiredPlayerCountForMode(mode);
  const pregame = getPregameTeams(roomId);
  const assignedPlayers = pregame
    ? matchPlayers.filter(
        (player) => pregame.blue.includes(player.id) || pregame.red.includes(player.id),
      )
    : matchPlayers;

  if (
    assignedPlayers.length !== expected ||
    !assignedPlayers.some((player) => player.isConnected)
  ) {
    return null;
  }

  const playerIds = assignedPlayers.map((player) => player.id);
  const teamValidation = validatePregameTeamsForStart({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode,
    eligiblePlayerIds: playerIds,
  });

  if (!teamValidation.success) {
    return null;
  }

  const teamAssignment = pregame ? toTeamMaps(pregame) : teamValidation.data;
  const match = createMatchState(roomId, assignedPlayers, content.settings, mode, teamAssignment);
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) {
    return null;
  }
  setGuessingChallengeState(roomId, match);
  return match;
}

export function ensureGuessingChallengeMatchStateWithTimer(
  io: Server,
  roomId: string,
): GuessingChallengeMatchState | null {
  const match = ensureGuessingChallengeMatchState(roomId);

  if (match) {
    startGuessingChallengePhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
