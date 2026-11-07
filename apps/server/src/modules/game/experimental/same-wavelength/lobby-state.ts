import { Prisma } from '@prisma/client';
import type {
  GameShellPlayer,
  SameWavelengthAssignment,
  SameWavelengthLobbyView,
  SameWavelengthMode,
  SameWavelengthSettings,
} from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_CLUE_SECONDS,
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_GUESS_SECONDS,
  SAME_WAVELENGTH_INDIVIDUAL_ROUNDS,
  SAME_WAVELENGTH_MIN_PLAYERS,
  SAME_WAVELENGTH_TEAM_MIN_PLAYERS,
  SAME_WAVELENGTH_TEAM_ROUNDS,
} from '@wanasatna/shared';

const PERSISTED_SETTINGS_KEY = '__sameWavelengthSettings';

export type SameWavelengthLobbyState = {
  settings: SameWavelengthSettings;
  assignments: Record<string, SameWavelengthAssignment>;
};

const statesByRoomId = new Map<string, SameWavelengthLobbyState>();

function settingsForMode(mode: SameWavelengthMode): SameWavelengthSettings {
  return {
    mode,
    roundCount: mode === 'team' ? SAME_WAVELENGTH_TEAM_ROUNDS : SAME_WAVELENGTH_INDIVIDUAL_ROUNDS,
    clueSeconds: SAME_WAVELENGTH_CLUE_SECONDS,
    guessingSeconds: SAME_WAVELENGTH_GUESS_SECONDS,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateSameWavelengthSettings(
  payload: unknown,
): { success: true; data: SameWavelengthSettings } | { success: false; error: string } {
  if (!isRecord(payload) || Object.keys(payload).length !== 1 || !('mode' in payload)) {
    return { success: false, error: 'إعدادات على نفس الموجة غير صالحة.' };
  }
  if (payload.mode !== 'individual' && payload.mode !== 'team') {
    return { success: false, error: 'وضع اللعب غير صالح.' };
  }
  return { success: true, data: settingsForMode(payload.mode) };
}

export function readPersistedSameWavelengthSettings(gameSettings: unknown): SameWavelengthSettings {
  if (!isRecord(gameSettings)) return settingsForMode('individual');
  const stored = gameSettings[PERSISTED_SETTINGS_KEY];
  if (!isRecord(stored) || (stored.mode !== 'individual' && stored.mode !== 'team')) {
    return settingsForMode('individual');
  }
  return settingsForMode(stored.mode);
}

export function persistSameWavelengthSettings(
  gameSettings: unknown,
  settings: SameWavelengthSettings,
): Prisma.InputJsonObject {
  const base = isRecord(gameSettings) ? { ...gameSettings } : {};
  return {
    ...base,
    [PERSISTED_SETTINGS_KEY]: { mode: settings.mode },
  } as Prisma.InputJsonObject;
}

export function getSameWavelengthLobbyState(roomId: string): SameWavelengthLobbyState {
  const current = statesByRoomId.get(roomId);
  if (current) return current;
  const created = { settings: settingsForMode('individual'), assignments: {} };
  statesByRoomId.set(roomId, created);
  return created;
}

export function hydrateSameWavelengthLobbyState(roomId: string, gameSettings: unknown): void {
  const current = getSameWavelengthLobbyState(roomId);
  statesByRoomId.set(roomId, {
    ...current,
    settings: readPersistedSameWavelengthSettings(gameSettings),
  });
}

export function setSameWavelengthLobbySettings(
  roomId: string,
  settings: SameWavelengthSettings,
): void {
  const current = getSameWavelengthLobbyState(roomId);
  statesByRoomId.set(roomId, { ...current, settings: { ...settings } });
}

export function assignSameWavelengthPlayer(
  roomId: string,
  playerId: string,
  payload: unknown,
): { success: true } | { success: false; error: string } {
  if (!isRecord(payload) || Object.keys(payload).length !== 2) {
    return { success: false, error: 'اختيار الفريق والدور غير صالح.' };
  }
  if (
    (payload.team !== 'red' && payload.team !== 'blue') ||
    (payload.role !== 'clue-giver' && payload.role !== 'guesser')
  ) {
    return { success: false, error: 'اختيار الفريق والدور غير صالح.' };
  }
  const current = getSameWavelengthLobbyState(roomId);
  if (current.settings.mode !== 'team') {
    return { success: false, error: 'اختيار الفرق متاح في وضع الفرق فقط.' };
  }
  if (payload.role === 'clue-giver') {
    const occupied = Object.entries(current.assignments).some(
      ([candidateId, assignment]) =>
        candidateId !== playerId &&
        assignment.team === payload.team &&
        assignment.role === 'clue-giver',
    );
    if (occupied) return { success: false, error: 'يوجد ملمّح لهذا الفريق بالفعل.' };
  }
  statesByRoomId.set(roomId, {
    ...current,
    assignments: {
      ...current.assignments,
      [playerId]: { team: payload.team, role: payload.role },
    },
  });
  return { success: true };
}

export function reconcileSameWavelengthLobbyRoster(
  roomId: string,
  players: readonly GameShellPlayer[],
): SameWavelengthLobbyState {
  const current = getSameWavelengthLobbyState(roomId);
  const present = new Set(players.map((player) => player.id));
  const assignments = Object.fromEntries(
    Object.entries(current.assignments).filter(([playerId]) => present.has(playerId)),
  );
  const next = { ...current, assignments };
  statesByRoomId.set(roomId, next);
  return next;
}

export function validateSameWavelengthTeamRoster(input: {
  assignments: Record<string, SameWavelengthAssignment>;
  eligiblePlayerIds: readonly string[];
}): { success: true; participantPlayerIds: string[] } | { success: false; error: string } {
  const eligible = new Set(input.eligiblePlayerIds);
  const participants = Object.keys(input.assignments).filter((id) => eligible.has(id));
  if (participants.length < SAME_WAVELENGTH_TEAM_MIN_PLAYERS) {
    return { success: false, error: 'يحتاج وضع الفرق إلى أربعة لاعبين موزعين على الأقل.' };
  }
  for (const team of ['red', 'blue'] as const) {
    const teamAssignments = participants
      .map((id) => input.assignments[id]!)
      .filter((assignment) => assignment.team === team);
    if (teamAssignments.filter((assignment) => assignment.role === 'clue-giver').length !== 1) {
      return {
        success: false,
        error: `يجب أن يضم الفريق ${team === 'red' ? 'الأحمر' : 'الأزرق'} ملمّحًا واحدًا.`,
      };
    }
    if (!teamAssignments.some((assignment) => assignment.role === 'guesser')) {
      return {
        success: false,
        error: `يحتاج الفريق ${team === 'red' ? 'الأحمر' : 'الأزرق'} إلى مخمّن واحد على الأقل.`,
      };
    }
  }
  return { success: true, participantPlayerIds: participants };
}

export function resolveSameWavelengthParticipants(
  roomId: string,
  players: readonly GameShellPlayer[],
): readonly string[] | null {
  const lobby = reconcileSameWavelengthLobbyRoster(roomId, players);
  const eligible = players
    .filter((player) => player.isConnected && !player.isSpectator)
    .map((player) => player.id);
  if (lobby.settings.mode === 'individual') {
    return eligible.length >= SAME_WAVELENGTH_MIN_PLAYERS ? eligible : null;
  }
  const validation = validateSameWavelengthTeamRoster({
    assignments: lobby.assignments,
    eligiblePlayerIds: eligible,
  });
  return validation.success ? validation.participantPlayerIds : null;
}

export function buildSameWavelengthLobbyView(input: {
  roomId: string;
  players: readonly GameShellPlayer[];
  selfPlayerId: string;
  canAdminister: boolean;
}): SameWavelengthLobbyView {
  const state = reconcileSameWavelengthLobbyRoster(input.roomId, input.players);
  const eligible = input.players
    .filter((player) => player.isConnected && !player.isSpectator)
    .map((player) => player.id);
  const teamValidation = validateSameWavelengthTeamRoster({
    assignments: state.assignments,
    eligiblePlayerIds: eligible,
  });
  const canStart =
    state.settings.mode === 'individual'
      ? eligible.length >= SAME_WAVELENGTH_MIN_PLAYERS
      : teamValidation.success;
  return {
    gameId: SAME_WAVELENGTH_GAME_ID,
    settings: { ...state.settings },
    roster: input.players.map((player) => ({
      playerId: player.id,
      name: player.name,
      isConnected: player.isConnected,
      assignment: state.assignments[player.id] ?? null,
    })),
    selfPlayerId: input.selfPlayerId,
    canEditSettings: input.canAdminister,
    canStart,
    validationMessage: canStart
      ? null
      : state.settings.mode === 'individual'
        ? 'يحتاج الوضع الفردي إلى ثلاثة لاعبين متصلين على الأقل.'
        : teamValidation.success
          ? null
          : teamValidation.error,
  };
}

export function clearSameWavelengthLobbyState(roomId: string): void {
  statesByRoomId.delete(roomId);
}

export function clearAllSameWavelengthLobbyStatesForTests(): void {
  statesByRoomId.clear();
}
