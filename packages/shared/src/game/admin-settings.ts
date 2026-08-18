import {
  BARA_AL_SALAFA_DEFAULT_ROUNDS,
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS,
  BARA_AL_SALAFA_VOTING_DURATION_SECONDS,
} from './plugins/bara-al-salafa/types.js';
import {
  DRAW_GUESS_DEFAULT_ROUNDS,
  DRAW_GUESS_DRAW_DURATION_SECONDS,
  DRAW_GUESS_GAME_ID,
} from './plugins/draw-guess/types.js';
import {
  IMPOSTER_DRAW_DEFAULT_ROUNDS,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_TURN_SECONDS,
  IMPOSTER_DRAW_VOTING_SECONDS,
} from './plugins/imposter-draw/types.js';
import {
  TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS,
  TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
  TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
  TIMING_CHALLENGE_GAME_ID,
} from './plugins/timing-challenge/types.js';
import {
  FAST_ANSWER_DEFAULT_ROUNDS,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_QUESTION_SECONDS,
} from './plugins/fast-answer/types.js';
import {
  WHO_WROTE_IT_ANSWERING_SECONDS,
  WHO_WROTE_IT_DEFAULT_ROUNDS,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_GUESS_SECONDS,
} from './plugins/who-wrote-it/types.js';
import { JUDGE_ANSWERING_SECONDS, JUDGE_GAME_ID, JUDGE_JUDGING_SECONDS } from './plugins/judge/types.js';
import {
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_TURN_SECONDS,
} from './plugins/guessing-challenge/types.js';

/** Admin-edited Timing Challenge rooms may persist max up to 120. Host start payload stays 60. */
export const TIMING_CHALLENGE_ADMIN_MAX_SECONDS = 120;

export type AdminGameSettingKey =
  | 'questionTurnSeconds'
  | 'voteSeconds'
  | 'rounds'
  | 'drawSeconds'
  | 'drawTurnSeconds'
  | 'minSeconds'
  | 'maxSeconds'
  | 'answerSeconds'
  | 'guessSeconds'
  | 'judgeSeconds'
  | 'turnSeconds';

export type AdminGameSettingSpec = {
  key: AdminGameSettingKey;
  min: number;
  max: number;
  default: number;
  step: number;
  label: string;
};

export type GameSettingValues = Partial<Record<AdminGameSettingKey, number>>;

export type RoomGameSettings = {
  [BARA_AL_SALAFA_GAME_ID]?: GameSettingValues;
  [DRAW_GUESS_GAME_ID]?: GameSettingValues;
  [IMPOSTER_DRAW_GAME_ID]?: GameSettingValues;
  [TIMING_CHALLENGE_GAME_ID]?: GameSettingValues;
  [FAST_ANSWER_GAME_ID]?: GameSettingValues;
  [WHO_WROTE_IT_GAME_ID]?: GameSettingValues;
  [JUDGE_GAME_ID]?: GameSettingValues;
  [GUESSING_CHALLENGE_GAME_ID]?: GameSettingValues;
};

export const ADMIN_GAME_SETTING_SPECS: Record<string, readonly AdminGameSettingSpec[]> = {
  [BARA_AL_SALAFA_GAME_ID]: [
    {
      key: 'questionTurnSeconds',
      min: 30,
      max: 120,
      default: BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS,
      step: 15,
      label: 'مدة السؤال (ث)',
    },
    {
      key: 'voteSeconds',
      min: 30,
      max: 120,
      default: BARA_AL_SALAFA_VOTING_DURATION_SECONDS,
      step: 15,
      label: 'مدة التصويت (ث)',
    },
    {
      key: 'rounds',
      min: 1,
      max: 5,
      default: BARA_AL_SALAFA_DEFAULT_ROUNDS,
      step: 1,
      label: 'عدد الجولات',
    },
  ],
  [DRAW_GUESS_GAME_ID]: [
    {
      key: 'drawSeconds',
      min: 30,
      max: 120,
      default: DRAW_GUESS_DRAW_DURATION_SECONDS,
      step: 15,
      label: 'مدة الرسم (ث)',
    },
    {
      key: 'rounds',
      min: 1,
      max: 5,
      default: DRAW_GUESS_DEFAULT_ROUNDS,
      step: 1,
      label: 'عدد الجولات',
    },
  ],
  [IMPOSTER_DRAW_GAME_ID]: [
    {
      key: 'drawTurnSeconds',
      min: 10,
      max: 45,
      default: IMPOSTER_DRAW_TURN_SECONDS,
      step: 5,
      label: 'مدة دور الرسم (ث)',
    },
    {
      key: 'voteSeconds',
      min: 30,
      max: 120,
      default: IMPOSTER_DRAW_VOTING_SECONDS,
      step: 15,
      label: 'مدة التصويت (ث)',
    },
    {
      key: 'rounds',
      min: 1,
      max: 5,
      default: IMPOSTER_DRAW_DEFAULT_ROUNDS,
      step: 1,
      label: 'عدد الجولات',
    },
  ],
  [TIMING_CHALLENGE_GAME_ID]: [
    {
      key: 'minSeconds',
      min: TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS,
      max: TIMING_CHALLENGE_ADMIN_MAX_SECONDS - 1,
      default: TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
      step: 1,
      label: 'الحد الأدنى (ث)',
    },
    {
      key: 'maxSeconds',
      min: TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS + 1,
      max: TIMING_CHALLENGE_ADMIN_MAX_SECONDS,
      default: TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
      step: 1,
      label: 'الحد الأقصى (ث)',
    },
  ],
  [FAST_ANSWER_GAME_ID]: [
    {
      key: 'answerSeconds',
      min: 10,
      max: 45,
      default: FAST_ANSWER_QUESTION_SECONDS,
      step: 5,
      label: 'مدة الإجابة (ث)',
    },
    {
      key: 'rounds',
      min: 3,
      max: 10,
      default: FAST_ANSWER_DEFAULT_ROUNDS,
      step: 1,
      label: 'عدد الجولات',
    },
  ],
  [WHO_WROTE_IT_GAME_ID]: [
    {
      key: 'answerSeconds',
      min: 30,
      max: 120,
      default: WHO_WROTE_IT_ANSWERING_SECONDS,
      step: 15,
      label: 'مدة الإجابة (ث)',
    },
    {
      key: 'guessSeconds',
      min: 15,
      max: 60,
      default: WHO_WROTE_IT_GUESS_SECONDS,
      step: 5,
      label: 'مدة التخمين (ث)',
    },
    {
      key: 'rounds',
      min: 1,
      max: 5,
      default: WHO_WROTE_IT_DEFAULT_ROUNDS,
      step: 1,
      label: 'عدد الجولات',
    },
  ],
  [JUDGE_GAME_ID]: [
    {
      key: 'answerSeconds',
      min: 30,
      max: 120,
      default: JUDGE_ANSWERING_SECONDS,
      step: 15,
      label: 'مدة الإجابة (ث)',
    },
    {
      key: 'judgeSeconds',
      min: 15,
      max: 60,
      default: JUDGE_JUDGING_SECONDS,
      step: 5,
      label: 'مدة اختيار القاضي (ث)',
    },
    {
      key: 'rounds',
      min: 1,
      max: 6,
      default: 0,
      step: 1,
      label: 'عدد الجولات',
    },
  ],
  [GUESSING_CHALLENGE_GAME_ID]: [
    {
      key: 'turnSeconds',
      min: 30,
      max: 90,
      default: GUESSING_CHALLENGE_TURN_SECONDS,
      step: 15,
      label: 'مدة الدور (ث)',
    },
  ],
};

const SPEC_BY_GAME = new Map(
  Object.entries(ADMIN_GAME_SETTING_SPECS).map(([gameId, specs]) => [
    gameId,
    new Map(specs.map((spec) => [spec.key, spec])),
  ]),
);

export function isAdminConfigurableGameId(gameId: string): boolean {
  return SPEC_BY_GAME.has(gameId);
}

export function getAdminGameSettingSpec(
  gameId: string,
  key: string,
): AdminGameSettingSpec | undefined {
  return SPEC_BY_GAME.get(gameId)?.get(key as AdminGameSettingKey);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inSpecRange(spec: AdminGameSettingSpec, value: number): boolean {
  if (spec.key === 'rounds' && spec.default === 0 && value === 0) {
    return false;
  }
  return Number.isInteger(value) && value >= spec.min && value <= spec.max;
}

function readNumericRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sanitizeGameBucket(gameId: string, raw: unknown): GameSettingValues | undefined {
  const specs = SPEC_BY_GAME.get(gameId);
  const record = readNumericRecord(raw);
  if (!specs || !record) {
    return undefined;
  }

  const next: GameSettingValues = {};
  for (const spec of specs.values()) {
    const value = record[spec.key];
    if (!isFiniteNumber(value)) {
      continue;
    }
    const rounded = Math.round(value);
    if (inSpecRange(spec, rounded)) {
      next[spec.key] = rounded;
    }
  }

  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    const minSeconds = next.minSeconds;
    const maxSeconds = next.maxSeconds;
    if (minSeconds != null && maxSeconds != null && minSeconds >= maxSeconds) {
      delete next.minSeconds;
      delete next.maxSeconds;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

/** Drop unknown games/keys and out-of-range values. Safe for DB hydrate. */
export function sanitizeRoomGameSettings(raw: unknown): RoomGameSettings | null {
  const record = readNumericRecord(raw);
  if (!record) {
    return null;
  }

  const next: RoomGameSettings = {};
  for (const gameId of Object.keys(ADMIN_GAME_SETTING_SPECS)) {
    const bucket = sanitizeGameBucket(gameId, record[gameId]);
    if (bucket) {
      next[gameId as keyof RoomGameSettings] = bucket;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

export type GameSettingsPatchResult =
  | { success: true; values: GameSettingValues }
  | { success: false; error: string };

/**
 * Update path: unknown keys ignored; known out-of-range keys rejected.
 */
export function sanitizeGameSettingPatch(
  gameId: string,
  patch: unknown,
): GameSettingsPatchResult {
  if (!isAdminConfigurableGameId(gameId)) {
    return { success: false, error: 'هذه اللعبة لا تدعم إعدادات تجريبية.' };
  }

  const record = readNumericRecord(patch);
  if (!record) {
    return { success: false, error: 'إعدادات غير صالحة.' };
  }

  const specs = SPEC_BY_GAME.get(gameId)!;
  const values: GameSettingValues = {};
  let sawKnownKey = false;

  for (const [key, rawValue] of Object.entries(record)) {
    const spec = specs.get(key as AdminGameSettingKey);
    if (!spec) {
      continue;
    }
    sawKnownKey = true;
    if (!isFiniteNumber(rawValue)) {
      return { success: false, error: `قيمة غير صالحة للحقل ${spec.label}.` };
    }
    const rounded = Math.round(rawValue);
    if (spec.default === 0 && rounded === 0) {
      values[spec.key] = 0;
      continue;
    }
    if (!inSpecRange(spec, rounded)) {
      return {
        success: false,
        error: `${spec.label} يجب أن يكون بين ${spec.min} و ${spec.max}.`,
      };
    }
    values[spec.key] = rounded;
  }

  if (!sawKnownKey || Object.keys(values).length === 0) {
    return { success: false, error: 'لا توجد إعدادات معروفة للتحديث.' };
  }

  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    const minSeconds = values.minSeconds;
    const maxSeconds = values.maxSeconds;
    if (minSeconds != null && maxSeconds != null && minSeconds >= maxSeconds) {
      return { success: false, error: 'الحد الأدنى يجب أن يكون أقل من الحد الأقصى.' };
    }
  }

  return { success: true, values };
}

export function mergeGameSettingPatch(
  current: RoomGameSettings | null | undefined,
  gameId: string,
  patch: GameSettingValues,
): RoomGameSettings | null {
  const base = current ? { ...current } : {};
  const mergedBucket: GameSettingValues = { ...(base[gameId as keyof RoomGameSettings] ?? {}), ...patch };
  for (const spec of ADMIN_GAME_SETTING_SPECS[gameId] ?? []) {
    if (spec.default === 0 && mergedBucket[spec.key] === 0) {
      delete mergedBucket[spec.key];
    }
  }
  const sanitizedBucket = sanitizeGameBucket(gameId, mergedBucket);
  if (sanitizedBucket) {
    base[gameId as keyof RoomGameSettings] = sanitizedBucket;
  } else {
    delete base[gameId as keyof RoomGameSettings];
  }
  return Object.keys(base).length > 0 ? base : null;
}

export function getStoredGameSettingsForGame(
  gameId: string,
  roomSettings: RoomGameSettings | null | undefined,
): GameSettingValues {
  return roomSettings?.[gameId as keyof RoomGameSettings] ?? {};
}

/**
 * Merge sanitized Room overrides with server defaults.
 * Judge `rounds` is omitted unless an Admin override is stored (default is player count).
 */
export function resolveEffectiveGameSettings(
  gameId: string,
  roomSettings: RoomGameSettings | null | undefined,
): Record<string, number> {
  const specs = ADMIN_GAME_SETTING_SPECS[gameId];
  if (!specs) {
    return {};
  }

  const stored = getStoredGameSettingsForGame(gameId, roomSettings);
  const result: Record<string, number> = {};

  for (const spec of specs) {
    const storedValue = stored[spec.key];
    if (gameId === JUDGE_GAME_ID && spec.key === 'rounds') {
      if (typeof storedValue === 'number') {
        result.rounds = storedValue;
      }
      continue;
    }
    result[spec.key] = typeof storedValue === 'number' ? storedValue : spec.default;
  }

  return result;
}

export function settingSelectOptions(spec: AdminGameSettingSpec): number[] {
  const values: number[] = [];
  for (let value = spec.min; value <= spec.max; value += spec.step) {
    values.push(value);
  }
  if (values[values.length - 1] !== spec.max) {
    values.push(spec.max);
  }
  if (spec.default !== 0 && !values.includes(spec.default)) {
    values.push(spec.default);
    values.sort((left, right) => left - right);
  }
  return values;
}
