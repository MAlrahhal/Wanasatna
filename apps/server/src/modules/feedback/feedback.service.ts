import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { ValidCreateFeedbackInput } from './feedback.validation.js';

export type FeedbackRequestContext = {
  userAgent: string | null;
  deviceCategory: 'mobile' | 'desktop';
};

export function inferFeedbackDeviceCategory(userAgent: string | null): 'mobile' | 'desktop' {
  return userAgent && /Android|webOS|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(userAgent)
    ? 'mobile'
    : 'desktop';
}

export function normalizeFeedbackUserAgent(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : character;
    })
    .join('')
    .trim();
  return normalized ? normalized.slice(0, 500) : null;
}

export async function createFeedback(
  input: ValidCreateFeedbackInput,
  context: FeedbackRequestContext,
): Promise<{ id: string }> {
  try {
    const feedback = await prisma.feedback.create({
      data: {
        submissionId: input.submissionId,
        category: input.category,
        message: input.message,
        source: input.source,
        roomId: input.roomId ?? null,
        gameId: input.gameId ?? null,
        route: input.route ?? null,
        deviceCategory: context.deviceCategory,
        userAgent: context.userAgent,
      },
      select: { id: true },
    });
    return feedback;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.feedback.findUnique({
        where: { submissionId: input.submissionId },
        select: { id: true },
      });
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}
