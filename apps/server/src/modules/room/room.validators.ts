import { z } from 'zod';

export const createRoomSchema = z.object({
  playerName: z
    .string()
    .trim()
    .min(2, 'Player name must be at least 2 characters')
    .max(20, 'Player name must be at most 20 characters'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export function validateCreateRoomPayload(payload: unknown):
  | { success: true; data: CreateRoomInput }
  | { success: false; error: { code: string; message: string } } {
  const result = createRoomSchema.safeParse(payload);

  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request payload';

    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
