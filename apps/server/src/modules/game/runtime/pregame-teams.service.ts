import type {
  GameErrorCode,
  GameActionResponse,
  GameTeamCapability,
  PregameTeamSnapshot,
  TeamId,
} from '@wanasatna/shared';
import { getGameTeamCapability, resolveTeamCapacity } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { PlayerStatus } from '@prisma/client';
import {
  clearPregameTeams,
  getPregameTeams,
  setPregameTeams,
  toPregameTeamSnapshot,
  toTeamMaps,
  type PregameTeamState,
} from './pregame-teams-store.js';

function teamError(
  code: GameErrorCode,
  message: string,
): Extract<GameActionResponse<never>, { success: false }> {
  return { success: false, error: { code, message } };
}

function buildDefaultTeams(
  roomId: string,
  gameId: string,
  mode: string,
  capacityPerTeam: number,
  eligiblePlayerIds: readonly string[],
): PregameTeamState {
  const blue: string[] = [];
  const red: string[] = [];

  // Deterministic: P0→blue0, P1→red0, P2→blue1, P3→red1
  eligiblePlayerIds.forEach((playerId, index) => {
    if (index % 2 === 0) {
      if (blue.length < capacityPerTeam) {
        blue.push(playerId);
      }
    } else if (red.length < capacityPerTeam) {
      red.push(playerId);
    }
  });

  return {
    roomId,
    gameId,
    mode,
    capacityPerTeam,
    blue,
    red,
    manuallyEdited: false,
  };
}

function pruneToEligible(state: PregameTeamState, eligible: ReadonlySet<string>): PregameTeamState {
  return {
    ...state,
    blue: state.blue.filter((id) => eligible.has(id)),
    red: state.red.filter((id) => eligible.has(id)),
  };
}

function reconcileCapacity(state: PregameTeamState, capacityPerTeam: number): PregameTeamState {
  return {
    ...state,
    capacityPerTeam,
    blue: state.blue.slice(0, capacityPerTeam),
    red: state.red.slice(0, capacityPerTeam),
  };
}

function fillDefaults(
  state: PregameTeamState,
  eligiblePlayerIds: readonly string[],
): PregameTeamState {
  const assigned = new Set([...state.blue, ...state.red]);
  const blue = [...state.blue];
  const red = [...state.red];

  for (const playerId of eligiblePlayerIds) {
    if (assigned.has(playerId)) {
      continue;
    }
    if (blue.length < state.capacityPerTeam) {
      blue.push(playerId);
      assigned.add(playerId);
      continue;
    }
    if (red.length < state.capacityPerTeam) {
      red.push(playerId);
      assigned.add(playerId);
    }
  }

  return { ...state, blue, red };
}

export async function loadEligibleLobbyPlayerIds(roomId: string): Promise<string[]> {
  const players = await prisma.player.findMany({
    where: {
      roomId,
      status: { in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] },
    },
    orderBy: { joinedAt: 'asc' },
    select: { id: true },
  });
  return players.map((player) => player.id);
}

/** Match-start eligibility follows connected-only participant lock. */
export async function loadConnectedLobbyPlayerIds(roomId: string): Promise<string[]> {
  const players = await prisma.player.findMany({
    where: {
      roomId,
      status: PlayerStatus.CONNECTED,
    },
    orderBy: { joinedAt: 'asc' },
    select: { id: true },
  });
  return players.map((player) => player.id);
}

export async function assertHost(roomId: string, playerId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });
  return room?.hostPlayerId === playerId;
}

export function clearTeamsForRoom(roomId: string): void {
  clearPregameTeams(roomId);
}

/**
 * Configure / reconcile pre-match teams for a team-capable game.
 * Host-only when called from mutation handlers; may be used internally for ensure.
 */
export function configurePregameTeams(options: {
  roomId: string;
  gameId: string;
  mode: string;
  eligiblePlayerIds: readonly string[];
  preserveManual?: boolean;
}): GameActionResponse<PregameTeamSnapshot> {
  const capability = getGameTeamCapability(options.gameId);
  if (!capability) {
    clearPregameTeams(options.roomId);
    return teamError('TEAM_NOT_SUPPORTED', 'هذه اللعبة لا تدعم توزيع الفرق.');
  }

  if (!(options.mode in capability.capacityByMode)) {
    return teamError('VALIDATION_ERROR', 'وضع اللعب غير صالح لتوزيع الفرق.');
  }

  const capacityPerTeam = resolveTeamCapacity(capability, options.mode);
  const existing = getPregameTeams(options.roomId);
  const eligibleSet = new Set(options.eligiblePlayerIds);

  let next: PregameTeamState;

  if (
    existing &&
    existing.gameId === options.gameId &&
    options.preserveManual !== false &&
    existing.manuallyEdited
  ) {
    next = reconcileCapacity(
      pruneToEligible({ ...existing, mode: options.mode, capacityPerTeam }, eligibleSet),
      capacityPerTeam,
    );
    // Mode shrink may leave players unassigned — intentional.
  } else if (existing && existing.gameId === options.gameId && existing.mode === options.mode) {
    next = fillDefaults(pruneToEligible(existing, eligibleSet), options.eligiblePlayerIds);
  } else {
    next = buildDefaultTeams(
      options.roomId,
      options.gameId,
      options.mode,
      capacityPerTeam,
      options.eligiblePlayerIds,
    );
  }

  setPregameTeams(options.roomId, next);
  return { success: true, data: toPregameTeamSnapshot(next, options.eligiblePlayerIds) };
}

/** Switch away from a team game — drop team state so it cannot affect non-team starts. */
export function clearTeamsIfGameChanged(roomId: string, nextGameId: string | null): void {
  const existing = getPregameTeams(roomId);
  if (!existing) {
    return;
  }
  if (!nextGameId || nextGameId !== existing.gameId || !getGameTeamCapability(nextGameId)) {
    clearPregameTeams(roomId);
  }
}

export function assignPlayerToTeam(options: {
  roomId: string;
  playerId: string;
  teamId: TeamId;
  eligiblePlayerIds: readonly string[];
}): GameActionResponse<PregameTeamSnapshot> {
  const state = getPregameTeams(options.roomId);
  if (!state) {
    return teamError('INVALID_TEAM_ASSIGNMENT', 'لا يوجد توزيع فرق لهذه الغرفة.');
  }

  if (!options.eligiblePlayerIds.includes(options.playerId)) {
    return teamError('PLAYER_NOT_ELIGIBLE', 'هذا اللاعب غير مؤهل للتوزيع.');
  }

  const onBlue = state.blue.includes(options.playerId);
  const onRed = state.red.includes(options.playerId);
  const alreadyOnTarget =
    (options.teamId === 'blue' && onBlue) || (options.teamId === 'red' && onRed);
  if (alreadyOnTarget) {
    return { success: true, data: toPregameTeamSnapshot(state, options.eligiblePlayerIds) };
  }

  const blue = state.blue.filter((id) => id !== options.playerId);
  const red = state.red.filter((id) => id !== options.playerId);
  const target = options.teamId === 'blue' ? blue : red;
  const other = options.teamId === 'blue' ? red : blue;
  const movingFromOtherTeam =
    (options.teamId === 'blue' && onRed) || (options.teamId === 'red' && onBlue);

  if (target.length >= state.capacityPerTeam) {
    // Deliberate UX: cross-team move into a full team swaps with the last seat.
    // Unassigned → full team still rejects with TEAM_FULL (no silent overflow).
    if (!movingFromOtherTeam || target.length === 0) {
      return teamError('TEAM_FULL', 'هذا الفريق ممتلئ.');
    }
    const displaced = target.pop()!;
    other.push(displaced);
  }

  target.push(options.playerId);

  const next: PregameTeamState = {
    ...state,
    blue: options.teamId === 'blue' ? target : blue,
    red: options.teamId === 'red' ? target : red,
    manuallyEdited: true,
  };
  setPregameTeams(options.roomId, next);
  return { success: true, data: toPregameTeamSnapshot(next, options.eligiblePlayerIds) };
}

export function randomizePregameTeams(options: {
  roomId: string;
  eligiblePlayerIds: readonly string[];
}): GameActionResponse<PregameTeamSnapshot> {
  const state = getPregameTeams(options.roomId);
  if (!state) {
    return teamError('INVALID_TEAM_ASSIGNMENT', 'لا يوجد توزيع فرق لهذه الغرفة.');
  }

  const required = state.capacityPerTeam * 2;
  if (options.eligiblePlayerIds.length < required) {
    return teamError(
      'INVALID_TEAM_ASSIGNMENT',
      `يلزم ${required} لاعبين لتوزيع الفرق عشوائيًا.`,
    );
  }

  const pool = [...options.eligiblePlayerIds].slice(0, required);
  // Fisher–Yates
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }

  const blue = pool.slice(0, state.capacityPerTeam);
  const red = pool.slice(state.capacityPerTeam, required);

  const next: PregameTeamState = {
    ...state,
    blue,
    red,
    manuallyEdited: true,
  };
  setPregameTeams(options.roomId, next);
  return { success: true, data: toPregameTeamSnapshot(next, options.eligiblePlayerIds) };
}

/** Remove a left/kicked player from teams; broadcast caller handles snapshot. */
export function removePlayerFromPregameTeams(
  roomId: string,
  playerId: string,
  eligiblePlayerIds: readonly string[],
): PregameTeamSnapshot | null {
  const state = getPregameTeams(roomId);
  if (!state) {
    return null;
  }

  if (!state.blue.includes(playerId) && !state.red.includes(playerId)) {
    return toPregameTeamSnapshot(state, eligiblePlayerIds);
  }

  const next: PregameTeamState = {
    ...state,
    blue: state.blue.filter((id) => id !== playerId),
    red: state.red.filter((id) => id !== playerId),
    manuallyEdited: true,
  };
  setPregameTeams(roomId, next);
  return toPregameTeamSnapshot(next, eligiblePlayerIds);
}

/**
 * After roster join: if never manually edited, rebuild defaults; else leave new joiners unassigned.
 */
export function syncPregameTeamsWithRoster(
  roomId: string,
  eligiblePlayerIds: readonly string[],
): PregameTeamSnapshot | null {
  const state = getPregameTeams(roomId);
  if (!state) {
    return null;
  }

  const capability = getGameTeamCapability(state.gameId);
  if (!capability) {
    clearPregameTeams(roomId);
    return null;
  }

  const eligibleSet = new Set(eligiblePlayerIds);
  let next = pruneToEligible(state, eligibleSet);

  if (!state.manuallyEdited) {
    next = buildDefaultTeams(
      roomId,
      state.gameId,
      state.mode,
      state.capacityPerTeam,
      eligiblePlayerIds,
    );
  }

  setPregameTeams(roomId, next);
  return toPregameTeamSnapshot(next, eligiblePlayerIds);
}

export function getPregameTeamSnapshot(
  roomId: string,
  eligiblePlayerIds: readonly string[],
): PregameTeamSnapshot | null {
  const state = getPregameTeams(roomId);
  if (!state) {
    return null;
  }
  return toPregameTeamSnapshot(state, eligiblePlayerIds);
}

export function validatePregameTeamsForStart(options: {
  roomId: string;
  gameId: string;
  mode: string;
  eligiblePlayerIds: readonly string[];
}): GameActionResponse<{ teamByPlayerId: Record<string, TeamId>; seatByPlayerId: Record<string, 0 | 1> }> {
  const capability = getGameTeamCapability(options.gameId);
  if (!capability) {
    return teamError('TEAM_NOT_SUPPORTED', 'هذه اللعبة لا تدعم توزيع الفرق.');
  }

  const capacity = resolveTeamCapacity(capability, options.mode);
  const required = capacity * 2;

  if (options.eligiblePlayerIds.length !== required) {
    return teamError(
      'INVALID_TEAM_ASSIGNMENT',
      `يلزم ${required} لاعبين لبدء هذه المباراة.`,
    );
  }

  let state = getPregameTeams(options.roomId);
  if (!state || state.gameId !== options.gameId || state.mode !== options.mode) {
    const configured = configurePregameTeams({
      roomId: options.roomId,
      gameId: options.gameId,
      mode: options.mode,
      eligiblePlayerIds: options.eligiblePlayerIds,
      preserveManual: false,
    });
    if (!configured.success) {
      return configured;
    }
    state = getPregameTeams(options.roomId);
  }

  if (!state) {
    return teamError('INVALID_TEAM_ASSIGNMENT', 'تعذر تجهيز توزيع الفرق.');
  }

  const eligibleSet = new Set(options.eligiblePlayerIds);
  const allAssigned = [...state.blue, ...state.red];

  if (allAssigned.length !== required) {
    return teamError('INVALID_TEAM_ASSIGNMENT', 'يجب توزيع كل اللاعبين على الفرق قبل البدء.');
  }

  if (new Set(allAssigned).size !== allAssigned.length) {
    return teamError('INVALID_TEAM_ASSIGNMENT', 'لا يمكن تكرار لاعب في أكثر من فريق.');
  }

  if (allAssigned.some((id) => !eligibleSet.has(id))) {
    return teamError('PLAYER_NOT_ELIGIBLE', 'توزيع الفرق يحتوي لاعبًا غير مؤهل.');
  }

  if (state.blue.length !== capacity || state.red.length !== capacity) {
    return teamError('INVALID_TEAM_ASSIGNMENT', 'عدد اللاعبين في كل فريق غير مكتمل.');
  }

  const maps = toTeamMaps(state);
  return { success: true, data: maps };
}

export type { GameTeamCapability };
