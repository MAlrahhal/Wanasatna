import type {
  GameShellPlayer,
  SecretAgentsAssignment,
  SecretAgentsLobbyView,
  SecretAgentsRole,
  SecretAgentsSettings,
  SecretAgentsTeam,
} from '@wanasatna/shared';
import {
  SECRET_AGENTS_BONUS_SECONDS_MAX,
  SECRET_AGENTS_BONUS_SECONDS_MIN,
  SECRET_AGENTS_CLUE_SECONDS_MAX,
  SECRET_AGENTS_CLUE_SECONDS_MIN,
  SECRET_AGENTS_DEFAULT_SETTINGS,
  SECRET_AGENTS_MAX_PLAYERS,
  SECRET_AGENTS_MIN_PLAYERS,
  SECRET_AGENTS_OPERATIVE_SECONDS_MAX,
  SECRET_AGENTS_OPERATIVE_SECONDS_MIN,
} from '@wanasatna/shared';

export type SecretAgentsLobbyState = {
  settings: SecretAgentsSettings;
  assignments: Record<string, SecretAgentsAssignment>;
};

const statesByRoomId = new Map<string, SecretAgentsLobbyState>();

export function getSecretAgentsLobbyState(roomId: string): SecretAgentsLobbyState {
  const existing = statesByRoomId.get(roomId);
  if (existing) return existing;
  const created = {
    settings: { ...SECRET_AGENTS_DEFAULT_SETTINGS },
    assignments: {},
  };
  statesByRoomId.set(roomId, created);
  return created;
}

export function clearSecretAgentsLobbyState(roomId: string): void {
  statesByRoomId.delete(roomId);
}

export function clearAllSecretAgentsLobbyStatesForTests(): void {
  statesByRoomId.clear();
}

function isTeam(value: unknown): value is SecretAgentsTeam {
  return value === 'red' || value === 'blue';
}

function isRole(value: unknown): value is SecretAgentsRole {
  return value === 'spymaster' || value === 'operative';
}

export function assignSecretAgentsLobbyPlayer(
  roomId: string,
  playerId: string,
  payload: unknown,
): { success: true; state: SecretAgentsLobbyState } | { success: false; error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: 'اختيار الفريق والدور غير صالح.' };
  }
  const record = payload as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== 'team' && key !== 'role') ||
    !isTeam(record.team) ||
    !isRole(record.role)
  ) {
    return { success: false, error: 'اختيار الفريق والدور غير صالح.' };
  }

  const current = getSecretAgentsLobbyState(roomId);
  const alreadyAssigned = Boolean(current.assignments[playerId]);
  if (!alreadyAssigned && Object.keys(current.assignments).length >= SECRET_AGENTS_MAX_PLAYERS) {
    return { success: false, error: 'اكتمل الحد الأقصى لمشاركي المباراة.' };
  }

  const state: SecretAgentsLobbyState = {
    ...current,
    assignments: {
      ...current.assignments,
      [playerId]: { team: record.team, role: record.role, locked: false },
    },
  };
  statesByRoomId.set(roomId, state);
  return { success: true, state };
}

export function reconcileSecretAgentsLobbyRoster(
  roomId: string,
  players: readonly GameShellPlayer[],
): SecretAgentsLobbyState {
  const current = getSecretAgentsLobbyState(roomId);
  const present = new Set(players.map((player) => player.id));
  const assignments = Object.fromEntries(
    Object.entries(current.assignments).filter(([playerId]) => present.has(playerId)),
  );
  if (Object.keys(assignments).length === Object.keys(current.assignments).length) return current;
  const state = { ...current, assignments };
  statesByRoomId.set(roomId, state);
  return state;
}

export function randomizeSecretAgentsLobbyAssignments(
  roomId: string,
  playerIds: readonly string[],
  random: () => number = Math.random,
): SecretAgentsLobbyState {
  const ids = [...new Set(playerIds)].slice(0, SECRET_AGENTS_MAX_PLAYERS);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  }
  const assignments: Record<string, SecretAgentsAssignment> = {};
  const seeds: Array<[SecretAgentsTeam, SecretAgentsRole]> = [
    ['red', 'spymaster'],
    ['red', 'operative'],
    ['blue', 'spymaster'],
    ['blue', 'operative'],
  ];
  ids.forEach((playerId, index) => {
    const seeded = seeds[index];
    assignments[playerId] = seeded
      ? { team: seeded[0], role: seeded[1], locked: false }
      : {
          team: index % 2 === 0 ? 'red' : 'blue',
          role: random() < 0.2 ? 'spymaster' : 'operative',
          locked: false,
        };
  });
  const state = { ...getSecretAgentsLobbyState(roomId), assignments };
  statesByRoomId.set(roomId, state);
  return state;
}

function integerWithin(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

export function updateSecretAgentsLobbySettings(
  roomId: string,
  payload: unknown,
): { success: true; state: SecretAgentsLobbyState } | { success: false; error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: 'إعدادات المؤقت غير صالحة.' };
  }
  const input = payload as Record<string, unknown>;
  const allowed = new Set([
    'clueTimerEnabled',
    'clueSeconds',
    'operativeTimerEnabled',
    'operativeSeconds',
    'correctGuessBonusSeconds',
  ]);
  if (Object.keys(input).length === 0 || Object.keys(input).some((key) => !allowed.has(key))) {
    return { success: false, error: 'تحتوي الإعدادات على حقل غير معروف.' };
  }

  const current = getSecretAgentsLobbyState(roomId);
  const next = { ...current.settings };
  if ('clueTimerEnabled' in input) {
    if (typeof input.clueTimerEnabled !== 'boolean')
      return { success: false, error: 'حالة مؤقت القائد غير صالحة.' };
    next.clueTimerEnabled = input.clueTimerEnabled;
  }
  if ('operativeTimerEnabled' in input) {
    if (typeof input.operativeTimerEnabled !== 'boolean')
      return { success: false, error: 'حالة مؤقت المخمّنين غير صالحة.' };
    next.operativeTimerEnabled = input.operativeTimerEnabled;
  }
  if ('clueSeconds' in input) {
    if (
      !integerWithin(
        input.clueSeconds,
        SECRET_AGENTS_CLUE_SECONDS_MIN,
        SECRET_AGENTS_CLUE_SECONDS_MAX,
      )
    ) {
      return { success: false, error: 'مدة القائد خارج النطاق المسموح.' };
    }
    next.clueSeconds = input.clueSeconds;
  }
  if ('operativeSeconds' in input) {
    if (
      !integerWithin(
        input.operativeSeconds,
        SECRET_AGENTS_OPERATIVE_SECONDS_MIN,
        SECRET_AGENTS_OPERATIVE_SECONDS_MAX,
      )
    ) {
      return { success: false, error: 'مدة المخمّنين خارج النطاق المسموح.' };
    }
    next.operativeSeconds = input.operativeSeconds;
  }
  if ('correctGuessBonusSeconds' in input) {
    if (
      !integerWithin(
        input.correctGuessBonusSeconds,
        SECRET_AGENTS_BONUS_SECONDS_MIN,
        SECRET_AGENTS_BONUS_SECONDS_MAX,
      )
    ) {
      return { success: false, error: 'مكافأة التخمين الصحيح خارج النطاق المسموح.' };
    }
    next.correctGuessBonusSeconds = input.correctGuessBonusSeconds;
  }

  const state = { ...current, settings: next };
  statesByRoomId.set(roomId, state);
  return { success: true, state };
}

export function validateSecretAgentsRoster(input: {
  assignments: Record<string, SecretAgentsAssignment>;
  eligiblePlayerIds: readonly string[];
}): { success: true; participantPlayerIds: string[] } | { success: false; error: string } {
  const eligible = new Set(input.eligiblePlayerIds);
  const participantPlayerIds = Object.keys(input.assignments).filter((playerId) =>
    eligible.has(playerId),
  );
  if (participantPlayerIds.length < SECRET_AGENTS_MIN_PLAYERS) {
    return { success: false, error: 'تحتاج اللعبة إلى أربعة مشاركين معيّنين على الأقل.' };
  }
  if (participantPlayerIds.length > SECRET_AGENTS_MAX_PLAYERS) {
    return { success: false, error: 'الحد الأقصى لمشاركي اللعبة هو 15.' };
  }
  if (Object.keys(input.assignments).some((playerId) => !eligible.has(playerId))) {
    return { success: false, error: 'يجب أن يكون جميع المشاركين المعيّنين متصلين عند البدء.' };
  }

  for (const team of ['red', 'blue'] as const) {
    const roles = participantPlayerIds
      .map((playerId) => input.assignments[playerId])
      .filter((assignment) => assignment?.team === team)
      .map((assignment) => assignment!.role);
    if (!roles.includes('spymaster') || !roles.includes('operative')) {
      return {
        success: false,
        error: `يحتاج الفريق ${team === 'red' ? 'الأحمر' : 'الأزرق'} إلى قائد ومخمّن واحد على الأقل.`,
      };
    }
  }
  return { success: true, participantPlayerIds };
}

export function buildSecretAgentsLobbyView(input: {
  roomId: string;
  players: readonly GameShellPlayer[];
  selfPlayerId: string;
  canAdminister: boolean;
}): SecretAgentsLobbyView {
  const state = reconcileSecretAgentsLobbyRoster(input.roomId, input.players);
  const validation = validateSecretAgentsRoster({
    assignments: state.assignments,
    eligiblePlayerIds: input.players
      .filter((player) => player.isConnected)
      .map((player) => player.id),
  });
  return {
    gameId: 'secret-agents',
    settings: state.settings,
    roster: input.players.map((player) => ({
      playerId: player.id,
      name: player.name,
      isConnected: player.isConnected,
      assignment: state.assignments[player.id] ?? null,
    })),
    selfPlayerId: input.selfPlayerId,
    canEditSettings: input.canAdminister,
    canRandomize: input.canAdminister,
    canStart: validation.success,
    validationMessage: validation.success ? null : validation.error,
  };
}
