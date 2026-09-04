import { AnswerAttemptStatus, AnswerRejectReason } from '@prisma/client';
import { opsLogger, sanitizeErrorName } from '../../../lib/ops-logger.js';
import { prisma } from '../../../lib/prisma.js';

export { AnswerAttemptStatus, AnswerRejectReason };

export const ANSWER_ATTEMPT_MAX_STORED_LENGTH = 200;
export const ANSWER_ATTEMPT_RETENTION_DAYS = 30;
export const ANSWER_ATTEMPT_PURGE_BATCH_SIZE = 500;

export type AnswerLogContext = {
  matchId: string;
  roomHistoryId: string;
  gameId: string;
};

export type RecordAnswerAttemptInput = {
  roomId: string;
  gameId: string;
  playerId: string;
  playerDisplayName: string;
  rawAnswer: string;
  normalizedAnswer: string | null;
  status: AnswerAttemptStatus;
  rejectReason?: AnswerRejectReason | null;
  wasCorrect: boolean | null;
  wasCounted: boolean;
  pointsAwarded?: number;
  roundIndex?: number | null;
  roundId?: string | null;
  turnId?: string | null;
  promptId?: string | null;
  promptText: string;
  teamId?: string | null;
};

const contextByRoomId = new Map<string, AnswerLogContext>();

export function rememberAnswerLogContext(roomId: string, context: AnswerLogContext): void {
  contextByRoomId.set(roomId, context);
}

export function clearAnswerLogContext(roomId: string): void {
  contextByRoomId.delete(roomId);
}

export function getAnswerLogContext(roomId: string): AnswerLogContext | null {
  return contextByRoomId.get(roomId) ?? null;
}

export function clipAnswerLogText(value: string): string {
  if (value.length <= ANSWER_ATTEMPT_MAX_STORED_LENGTH) {
    return value;
  }
  return value.slice(0, ANSWER_ATTEMPT_MAX_STORED_LENGTH);
}

function answerAttemptRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - ANSWER_ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function purgeExpiredAnswerAttempts(now: Date = new Date()): Promise<number> {
  const cutoff = answerAttemptRetentionCutoff(now);
  let deleted = 0;

  for (;;) {
    const rows = await prisma.answerAttempt.findMany({
      where: { submittedAt: { lte: cutoff } },
      select: { id: true },
      orderBy: { submittedAt: 'asc' },
      take: ANSWER_ATTEMPT_PURGE_BATCH_SIZE,
    });

    if (rows.length === 0) {
      break;
    }

    const result = await prisma.answerAttempt.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    deleted += result.count;

    if (rows.length < ANSWER_ATTEMPT_PURGE_BATCH_SIZE) {
      break;
    }
  }

  return deleted;
}

export async function recordAnswerAttempt(input: RecordAnswerAttemptInput): Promise<void> {
  const context = contextByRoomId.get(input.roomId);
  if (!context || context.gameId !== input.gameId) {
    return;
  }

  try {
    await prisma.answerAttempt.create({
      data: {
        roomHistoryId: context.roomHistoryId,
        matchId: context.matchId,
        gameId: input.gameId,
        livePlayerId: input.playerId,
        playerDisplayName: clipAnswerLogText(input.playerDisplayName || 'لاعب'),
        rawAnswer: clipAnswerLogText(input.rawAnswer),
        normalizedAnswer:
          input.normalizedAnswer === null ? null : clipAnswerLogText(input.normalizedAnswer),
        status: input.status,
        rejectReason: input.rejectReason ?? null,
        wasCorrect: input.wasCorrect,
        wasCounted: input.wasCounted,
        pointsAwarded: input.pointsAwarded ?? 0,
        roundIndex: input.roundIndex ?? null,
        roundId: input.roundId ?? null,
        turnId: input.turnId ?? null,
        promptId: input.promptId ?? null,
        promptText: clipAnswerLogText(input.promptText),
        teamId: input.teamId ?? null,
      },
    });
  } catch (error) {
    opsLogger.error('answer-attempt-write-failed', 'تعذر حفظ سجل الإجابة.', {
      stage: 'create-failed',
      roomId: input.roomId,
      gameId: input.gameId,
      errorName: sanitizeErrorName(error),
    });
  }
}
