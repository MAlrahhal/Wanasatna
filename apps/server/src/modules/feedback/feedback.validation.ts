import { z } from 'zod';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_MESSAGE_MIN_LENGTH,
  FEEDBACK_SOURCES,
  isPlayableGameId,
} from '@wanasatna/shared';

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

function containsDisallowedControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  });
}

export const createFeedbackSchema = z
  .object({
    category: z.enum(FEEDBACK_CATEGORIES),
    message: z
      .string()
      .trim()
      .min(FEEDBACK_MESSAGE_MIN_LENGTH)
      .max(FEEDBACK_MESSAGE_MAX_LENGTH)
      .refine((value) => !containsDisallowedControlCharacter(value)),
    source: z.enum(FEEDBACK_SOURCES),
    roomId: identifierSchema.optional(),
    gameId: identifierSchema.refine(isPlayableGameId).optional(),
    route: z
      .string()
      .trim()
      .max(200)
      .regex(/^\/(?!\/)[^?#]*$/)
      .optional(),
    submissionId: z.string().uuid(),
  })
  .strict();

export type ValidCreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
