import { z } from 'zod';
import type { RoomActionResponse, RoomErrorCode } from '@wanasatna/shared';
import {
  MAX_ROOM_CHAT_CONTENT_LENGTH,
  playerNameContainsForbiddenChars,
  textContainsForbiddenChars,
} from '@wanasatna/shared';

const playerNameSchema = z
  .string()
  .trim()
  .min(2, 'Player name must be at least 2 characters')
  .max(20, 'Player name must be at most 20 characters')
  .refine((name) => !playerNameContainsForbiddenChars(name), {
    message: 'Player name contains invalid characters',
  });

const playerIdSchema = z.string().trim().min(1, 'Player ID is required');

export const createRoomSchema = z.object({
  playerName: playerNameSchema,
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Room code must be exactly 6 digits'),
  playerName: playerNameSchema,
});

export const kickPlayerSchema = z.object({
  playerId: playerIdSchema,
});

export const reconnectSchema = z.object({
  playerId: playerIdSchema,
  reconnectToken: z.string().trim().min(16, 'Reconnect token is required'),
  roomCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Room code must be exactly 6 digits')
    .optional(),
  roomId: z.string().trim().min(1, 'Room ID is required').optional(),
});

const sendRoomChatSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(MAX_ROOM_CHAT_CONTENT_LENGTH, 'Message must be at most 300 characters')
    .refine((content) => !textContainsForbiddenChars(content), {
      message: 'Message contains invalid characters',
    }),
});

const updateRoomGameSettingsSchema = z
  .object({
    gameId: z.string().trim().min(1, 'Game selection is required'),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type KickPlayerInput = z.infer<typeof kickPlayerSchema>;
export type ReconnectInput = z.infer<typeof reconnectSchema>;
export type SendRoomChatInput = z.infer<typeof sendRoomChatSchema>;

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; error: { code: RoomErrorCode; message: string } };

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

export function validateCreateRoomPayload(payload: unknown) {
  return validatePayload(createRoomSchema, payload);
}

export function validateJoinRoomPayload(payload: unknown) {
  return validatePayload(joinRoomSchema, payload);
}

export function validateKickPlayerPayload(payload: unknown) {
  return validatePayload(kickPlayerSchema, payload);
}

export function validateReconnectPayload(payload: unknown) {
  return validatePayload(reconnectSchema, payload);
}

export function validateSendRoomChatPayload(payload: unknown) {
  return validatePayload(sendRoomChatSchema, payload);
}

export function validateUpdateRoomGameSettingsPayload(payload: unknown):
  | { success: true; data: { gameId: string; settings: Record<string, unknown> } }
  | ValidationFailure {
  const result = updateRoomGameSettingsSchema.safeParse(payload ?? {});
  if (!result.success) {
    return validationError(result.error.issues[0]?.message ?? 'Invalid request payload');
  }

  const { gameId, settings, ...rest } = result.data;
  return {
    success: true,
    data: {
      gameId,
      settings: { ...rest, ...(settings ?? {}) },
    },
  };
}

export function invalidContextError(message: string): RoomActionResponse<never> {
  return validationError(message);
}
