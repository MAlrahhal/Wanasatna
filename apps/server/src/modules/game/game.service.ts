import { randomUUID } from 'node:crypto';
import { PlayerStatus } from '@prisma/client';
import {
  DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS,
  DEFAULT_GAME_SHELL_TIMER_SECONDS,
  GAME_DISABLED_MESSAGE,
  type GameActionResponse,
  type GameErrorCode,
  type GamePhase,
  type GameShellPlayer,
  type GameShellState,
  type InitGameShellPayload,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import { abortPersistedMatch, beginPersistedMatch } from '../match/match-history.service.js';
import { hydrateRoomGameSettings } from '../room/room-game-settings.store.js';
import { resolveGameEnabledForStart } from './game-availability.service.js';
import { validateGameStart } from './runtime/validate-game-start.js';

export type GameShellRecord = GameShellState;

const shellsByRoomId = new Map<string, GameShellRecord>();

export function getGameShellByRoomId(roomId: string): GameShellRecord | null {
  return shellsByRoomId.get(roomId) ?? null;
}

export function countLiveGameShells(): number {
  return shellsByRoomId.size;
}

export function deleteGameShell(roomId: string): void {
  shellsByRoomId.delete(roomId);
}

/** Test-only: install an in-memory shell without Prisma. */
export function replaceGameShellForTests(shell: GameShellRecord): void {
  saveShell(shell);
}

export function gameServiceError(
  code: GameErrorCode,
  message: string,
): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code, message },
  };
}

const GAME_AVAILABILITY_UNVERIFIED_MESSAGE = 'تعذر بدء اللعبة حالياً. حاول مرة أخرى.';

async function rejectIfGameDisabled(
  gameId: string | null | undefined,
): Promise<Extract<GameActionResponse<never>, { success: false }> | null> {
  if (!gameId) {
    return null;
  }

  const availability = await resolveGameEnabledForStart(gameId);
  if (!availability.ok) {
    return gameServiceError('INTERNAL_ERROR', GAME_AVAILABILITY_UNVERIFIED_MESSAGE);
  }
  if (!availability.enabled) {
    return gameServiceError('GAME_DISABLED', GAME_DISABLED_MESSAGE);
  }
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertPhase(
  shell: GameShellRecord,
  allowedPhases: GamePhase[],
  message: string,
): Extract<GameActionResponse<never>, { success: false }> | null {
  if (!allowedPhases.includes(shell.phase)) {
    return gameServiceError('INVALID_PHASE', message);
  }

  return null;
}

async function loadRoomPlayers(roomId: string, hostPlayerId: string): Promise<GameShellPlayer[]> {
  const players = await prisma.player.findMany({
    where: {
      roomId,
      status: {
        in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED],
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return players.map((player) => ({
    id: player.id,
    name: player.name,
    isHost: player.id === hostPlayerId,
    isConnected: player.status === PlayerStatus.CONNECTED,
    isReady: false,
    isSpectator: player.isSpectator,
  }));
}

function withUpdatedPlayers(
  shell: GameShellRecord,
  players: GameShellPlayer[],
): GameShellRecord {
  const readySet = new Set(shell.readyPlayerIds);

  return {
    ...shell,
    players: players.map((player) => ({
      ...player,
      isReady: readySet.has(player.id),
    })),
    updatedAt: nowIso(),
  };
}

function saveShell(shell: GameShellRecord): GameShellRecord {
  shellsByRoomId.set(shell.roomId, shell);
  return shell;
}

function lockMatchParticipantIds(players: GameShellPlayer[]): string[] {
  return players
    .filter((player) => player.isConnected && !player.isSpectator)
    .map((player) => player.id);
}

async function persistLockedMatch(shell: GameShellRecord): Promise<void> {
  if (!shell.gameId || !shell.matchParticipantIds?.length) {
    return;
  }

  await beginPersistedMatch({
    roomId: shell.roomId,
    gameId: shell.gameId,
    participantPlayerIds: shell.matchParticipantIds,
    displayNameByPlayerId: Object.fromEntries(
      shell.players.map((player) => [player.id, player.name]),
    ),
  });
}

async function assertHost(
  roomId: string,
  playerId: string,
): Promise<
  | { success: true; hostPlayerId: string }
  | Extract<GameActionResponse<never>, { success: false }>
> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });

  if (!room) {
    return gameServiceError('NOT_IN_ROOM', 'Room not found.');
  }

  if (room.hostPlayerId !== playerId) {
    return gameServiceError('NOT_HOST', 'Only the host can perform this action.');
  }

  return { success: true, hostPlayerId: room.hostPlayerId };
}

export async function initGameShell(
  roomId: string,
  playerId: string,
  payload: InitGameShellPayload,
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const hostCheck = await assertHost(roomId, playerId);

  if (!hostCheck.success) {
    return hostCheck;
  }

  if (shellsByRoomId.has(roomId)) {
    return gameServiceError('SHELL_ALREADY_EXISTS', 'A game shell already exists for this room.');
  }

  const disabled = await rejectIfGameDisabled(payload.gameId);
  if (disabled) {
    return disabled;
  }

  const players = await loadRoomPlayers(roomId, hostCheck.hostPlayerId);

  if (!players.some((player) => player.id === playerId)) {
    return gameServiceError('PLAYER_NOT_FOUND', 'Player not found in room.');
  }

  const shell: GameShellRecord = {
    shellId: randomUUID(),
    roomId,
    gameId: payload.gameId ?? null,
    phase: 'WAITING',
    hostPlayerId: hostCheck.hostPlayerId,
    players,
    readyPlayerIds: [],
    countdownSeconds: payload.countdownSeconds ?? DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS,
    countdownRemainingSeconds: null,
    gameTimerSeconds: payload.gameTimerSeconds ?? DEFAULT_GAME_SHELL_TIMER_SECONDS,
    gameTimerRemainingSeconds: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: nowIso(),
    matchParticipantIds: null,
  };

  return {
    success: true,
    data: { state: saveShell(shell) },
  };
}

export async function syncGameShell(
  roomId: string,
): Promise<GameActionResponse<{ state: GameShellState | null }>> {
  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return {
      success: true,
      data: { state: null },
    };
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });

  const hostPlayerId = room?.hostPlayerId ?? shell.hostPlayerId;
  const players = await loadRoomPlayers(roomId, hostPlayerId);

  // Re-read after awaits. Lobby wait / countdown may have advanced (or aborted)
  // the shell while players were loading. Writing the pre-await snapshot would
  // regress COUNTDOWN/PLAYING back to WAITING and stall the match start UI.
  const currentShell = getGameShellByRoomId(roomId);

  if (!currentShell) {
    return {
      success: true,
      data: { state: null },
    };
  }

  const effectiveHostPlayerId = room?.hostPlayerId ?? currentShell.hostPlayerId;

  return {
    success: true,
    data: {
      state: saveShell(
        withUpdatedPlayers(
          {
            ...currentShell,
            hostPlayerId: effectiveHostPlayerId,
            players: players.map((player) => ({
              ...player,
              isHost: player.id === effectiveHostPlayerId,
            })),
          },
          players,
        ),
      ),
    },
  };
}

export async function setGameShellReady(
  roomId: string,
  playerId: string,
  isReady: boolean,
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  const phaseError = assertPhase(shell, ['WAITING'], 'Ready status can only change while waiting.');
  if (phaseError) {
    return phaseError;
  }

  const playerExists = shell.players.some((player) => player.id === playerId);

  if (!playerExists) {
    return gameServiceError('PLAYER_NOT_FOUND', 'Player not found in game shell.');
  }

  const readyPlayerIds = isReady
    ? [...new Set([...shell.readyPlayerIds, playerId])]
    : shell.readyPlayerIds.filter((id) => id !== playerId);

  const nextShell = saveShell({
    ...shell,
    readyPlayerIds,
    players: shell.players.map((player) => ({
      ...player,
      isReady: readyPlayerIds.includes(player.id),
    })),
    updatedAt: nowIso(),
  });

  return {
    success: true,
    data: { state: nextShell },
  };
}

export async function startGameShellCountdown(
  roomId: string,
  playerId: string,
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const hostCheck = await assertHost(roomId, playerId);
  if (!hostCheck.success) {
    return hostCheck;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  const phaseError = assertPhase(shell, ['WAITING'], 'Countdown can only start from the waiting phase.');
  if (phaseError) {
    return phaseError;
  }

  if (!shell.gameId) {
    return gameServiceError('GAME_NOT_SELECTED', 'A game must be selected before starting.');
  }

  const players = await loadRoomPlayers(roomId, hostCheck.hostPlayerId);

  const currentShell = getGameShellByRoomId(roomId);

  if (!currentShell || currentShell.shellId !== shell.shellId) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  if (currentShell.phase === 'COUNTDOWN' || currentShell.phase === 'PLAYING') {
    return {
      success: true,
      data: { state: currentShell },
    };
  }

  if (currentShell.phase !== 'WAITING') {
    return gameServiceError('INVALID_PHASE', 'Countdown can only start from the waiting phase.');
  }

  const syncedShell = withUpdatedPlayers(
    {
      ...currentShell,
      hostPlayerId: hostCheck.hostPlayerId,
      players,
    },
    players,
  );

  const nextShell = saveShell({
    ...syncedShell,
    phase: 'COUNTDOWN',
    matchParticipantIds: lockMatchParticipantIds(players),
    countdownRemainingSeconds: currentShell.countdownSeconds,
    updatedAt: nowIso(),
  });

  await persistLockedMatch(nextShell);

  return {
    success: true,
    data: { state: nextShell },
  };
}

export async function advanceShellToCountdownFromLobby(
  roomId: string,
  expectedShellId: string,
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  if (shell.shellId !== expectedShellId) {
    return gameServiceError('INVALID_PHASE', 'Game shell is no longer active for this room.');
  }

  if (shell.phase === 'FINISHED') {
    return gameServiceError('INVALID_PHASE', 'Game shell has already finished.');
  }

  if (shell.phase !== 'WAITING') {
    if (shell.phase === 'COUNTDOWN' || shell.phase === 'PLAYING') {
      return {
        success: true,
        data: { state: shell },
      };
    }

    return gameServiceError('INVALID_PHASE', 'Countdown can only start from the waiting phase.');
  }

  if (!shell.gameId) {
    return gameServiceError('GAME_NOT_SELECTED', 'A game must be selected before starting.');
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });
  const hostPlayerId = room?.hostPlayerId ?? shell.hostPlayerId;
  const players = await loadRoomPlayers(roomId, hostPlayerId);

  // Re-check after the async reads: the shell may have been aborted or
  // replaced (e.g. host ended the game) while player data was loading.
  const currentShell = getGameShellByRoomId(roomId);

  if (!currentShell || currentShell.shellId !== expectedShellId) {
    return gameServiceError('INVALID_PHASE', 'Game shell is no longer active for this room.');
  }

  if (currentShell.phase !== 'WAITING') {
    if (currentShell.phase === 'COUNTDOWN' || currentShell.phase === 'PLAYING') {
      return {
        success: true,
        data: { state: currentShell },
      };
    }

    return gameServiceError('INVALID_PHASE', 'Countdown can only start from the waiting phase.');
  }

  const syncedShell = withUpdatedPlayers(
    {
      ...currentShell,
      hostPlayerId,
      players,
    },
    players,
  );

  const nextShell = saveShell({
    ...syncedShell,
    phase: 'COUNTDOWN',
    matchParticipantIds: lockMatchParticipantIds(players),
    countdownRemainingSeconds: syncedShell.countdownSeconds,
    updatedAt: nowIso(),
  });

  await persistLockedMatch(nextShell);

  return {
    success: true,
    data: { state: nextShell },
  };
}

export async function cancelGameShellCountdown(
  roomId: string,
  playerId: string,
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const hostCheck = await assertHost(roomId, playerId);
  if (!hostCheck.success) {
    return hostCheck;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  const phaseError = assertPhase(shell, ['COUNTDOWN'], 'Countdown can only be cancelled during countdown.');
  if (phaseError) {
    return phaseError;
  }

  const nextShell = saveShell({
    ...shell,
    phase: 'WAITING',
    matchParticipantIds: null,
    countdownRemainingSeconds: null,
    updatedAt: nowIso(),
  });

  await abortPersistedMatch(roomId);

  return {
    success: true,
    data: { state: nextShell },
  };
}

export function applyCountdownTick(roomId: string): GameShellRecord | null {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'COUNTDOWN' || shell.countdownRemainingSeconds === null) {
    return null;
  }

  const remaining = shell.countdownRemainingSeconds - 1;

  if (remaining > 0) {
    return saveShell({
      ...shell,
      countdownRemainingSeconds: remaining,
      updatedAt: nowIso(),
    });
  }

  return saveShell({
    ...shell,
    phase: 'PLAYING',
    countdownRemainingSeconds: 0,
    gameTimerRemainingSeconds: shell.gameTimerSeconds,
    startedAt: shell.startedAt ?? nowIso(),
    updatedAt: nowIso(),
  });
}

export function applyGameTimerTick(roomId: string): GameShellRecord | null {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING' || shell.gameTimerRemainingSeconds === null) {
    return null;
  }

  const remaining = shell.gameTimerRemainingSeconds - 1;

  if (remaining > 0) {
    return saveShell({
      ...shell,
      gameTimerRemainingSeconds: remaining,
      updatedAt: nowIso(),
    });
  }

  return saveShell({
    ...shell,
    phase: 'FINISHED',
    gameTimerRemainingSeconds: 0,
    finishedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export function finishGameShellForRoom(roomId: string): GameShellRecord | null {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    return null;
  }

  return saveShell({
    ...shell,
    phase: 'FINISHED',
    gameTimerRemainingSeconds: 0,
    finishedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function requestAbortGameShellByHost(
  roomId: string,
  playerId: string,
): Promise<GameActionResponse<{ path: '/lobby' }>> {
  const hostCheck = await assertHost(roomId, playerId);
  if (!hostCheck.success) {
    return hostCheck;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  const phaseError = assertPhase(
    shell,
    ['WAITING', 'COUNTDOWN', 'PLAYING'],
    'The game can only be ended before it has finished.',
  );
  if (phaseError) {
    return phaseError;
  }

  return {
    success: true,
    data: { path: '/lobby' },
  };
}

export async function resetGameShell(
  roomId: string,
  playerId: string,
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const hostCheck = await assertHost(roomId, playerId);
  if (!hostCheck.success) {
    return hostCheck;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  const phaseError = assertPhase(shell, ['FINISHED'], 'The shell can only be reset after finishing.');
  if (phaseError) {
    return phaseError;
  }

  const players = await loadRoomPlayers(roomId, shell.hostPlayerId);

  const nextShell = saveShell({
    ...shell,
    phase: 'WAITING',
    players,
    readyPlayerIds: [],
    matchParticipantIds: null,
    countdownRemainingSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: nowIso(),
  });

  return {
    success: true,
    data: { state: nextShell },
  };
}

export async function startGameShellFromLobby(
  roomId: string,
  playerId: string,
  gameId: string,
  options?: { skipSettingsHydration?: boolean },
): Promise<GameActionResponse<{ state: GameShellState }>> {
  const hostCheck = await assertHost(roomId, playerId);

  if (!hostCheck.success) {
    return hostCheck;
  }

  const players = await loadRoomPlayers(roomId, hostCheck.hostPlayerId);
  const startValidationError = validateGameStart(gameId, roomId, hostCheck.hostPlayerId, players);

  if (startValidationError) {
    return startValidationError;
  }

  const disabled = await rejectIfGameDisabled(gameId);
  if (disabled) {
    return disabled;
  }

  if (!options?.skipSettingsHydration) {
    await hydrateRoomGameSettings(roomId);
  }

  const initResponse = await initGameShell(roomId, playerId, { gameId });

  if (!initResponse.success) {
    return initResponse;
  }

  return initResponse;
}

export async function returnGameShellToLobby(
  roomId: string,
  playerId: string,
): Promise<GameActionResponse<{ path: '/lobby' }>> {
  const hostCheck = await assertHost(roomId, playerId);

  if (!hostCheck.success) {
    return hostCheck;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return gameServiceError('SHELL_NOT_FOUND', 'Game shell not found.');
  }

  const phaseError = assertPhase(
    shell,
    ['FINISHED'],
    'Players can only return to the lobby after the game finishes.',
  );

  if (phaseError) {
    return phaseError;
  }

  deleteGameShell(roomId);

  return {
    success: true,
    data: { path: '/lobby' },
  };
}
