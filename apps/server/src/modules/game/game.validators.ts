import { z } from 'zod';
import type { GameActionResponse, GameErrorCode } from '@wanasatna/shared';

const initGameShellSchema = z.object({
  gameId: z.string().trim().min(1).nullable().optional(),
  countdownSeconds: z.number().int().min(1).max(30).optional(),
  gameTimerSeconds: z.number().int().min(1).max(3600).optional(),
});

const setReadySchema = z.object({
  isReady: z.boolean(),
});

const timingChallengeSettingsSchema = z
  .object({
    mode: z.enum(['guess-time', 'stop-timer']),
    rounds: z.number().int().min(1).max(10),
    minSeconds: z.number().min(1).max(60),
    maxSeconds: z.number().min(1).max(60),
  })
  .refine((value) => value.minSeconds < value.maxSeconds, {
    message: 'Minimum time must be less than maximum time.',
  });

const guessingChallengeSettingsSchema = z.object({
  mode: z.enum(['1v1', '2v2']),
});

const drawGuessSettingsSchema = z
  .object({
    drawerMode: z.enum(['random', 'fixed']),
    fixedPlayerId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.drawerMode === 'fixed' && !value.fixedPlayerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب اختيار لاعب ليكون الرسام.',
        path: ['fixedPlayerId'],
      });
    }
  });

const startFromLobbySchema = z.object({
  gameId: z.string().trim().min(1, 'Game selection is required'),
  categoryId: z.string().trim().min(1).nullable().optional(),
  timingChallenge: timingChallengeSettingsSchema.optional(),
  guessingChallenge: guessingChallengeSettingsSchema.optional(),
  drawGuess: drawGuessSettingsSchema.optional(),
});

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = Extract<GameActionResponse<never>, { success: false }>;

function validationError(message: string): ValidationFailure {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
    },
  };
}

function validatePayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): ValidationSuccess<T> | ValidationFailure {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request payload';
    return validationError(message);
  }

  return {
    success: true,
    data: result.data,
  };
}

export function validateInitGameShellPayload(payload: unknown) {
  return validatePayload(initGameShellSchema, payload ?? {});
}

export function validateSetGameShellReadyPayload(payload: unknown) {
  return validatePayload(setReadySchema, payload ?? {});
}

export function validateStartGameShellFromLobbyPayload(payload: unknown) {
  return validatePayload(startFromLobbySchema, payload ?? {});
}

export function invalidGameContextError(message: string): GameActionResponse<never> {
  return {
    success: false,
    error: {
      code: 'NOT_IN_ROOM' satisfies GameErrorCode,
      message,
    },
  };
}
