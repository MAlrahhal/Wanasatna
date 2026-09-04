import { MatchStatus, type Prisma } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminAnswerAttemptData,
  AdminHistoryData,
  AdminMatchDetails,
  AdminMatchStatus,
  AnswerAttemptStatus,
} from '@wanasatna/shared';
import {
  ADMIN_ANSWER_ATTEMPT_PAGE_SIZE,
  ADMIN_HISTORY_PAGE_SIZE,
  ANSWER_ATTEMPT_FEATURE_STARTED_AT,
  ANSWER_ATTEMPT_STATUSES,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

function toIso(value: Date): string {
  return value.toISOString();
}

function asMatchStatus(status: MatchStatus): AdminMatchStatus {
  if (status === MatchStatus.COMPLETED) {
    return 'COMPLETED';
  }
  if (status === MatchStatus.ABORTED) {
    return 'ABORTED';
  }
  return 'ACTIVE';
}

function parsePage(raw: unknown): number {
  const page = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }
  return Math.min(page, 10_000);
}

function parseStatus(raw: unknown): MatchStatus | undefined {
  if (raw === 'ACTIVE' || raw === 'COMPLETED' || raw === 'ABORTED') {
    return raw;
  }
  return undefined;
}

function parseGameId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const gameId = raw.trim();
  if (!gameId || gameId.length > 64 || !/^[a-z0-9-]+$/i.test(gameId)) {
    return undefined;
  }
  return gameId;
}

export async function listAdminHistory(
  query: { gameId?: unknown; status?: unknown; page?: unknown },
): Promise<AdminHistoryData> {
  const page = parsePage(query.page);
  const pageSize = ADMIN_HISTORY_PAGE_SIZE;
  const gameId = parseGameId(query.gameId);
  const status = parseStatus(query.status);
  const where: Prisma.MatchWhereInput = {
    ...(gameId ? { gameId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        gameId: true,
        roomCode: true,
        status: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { participants: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    matches: rows.map((match) => ({
      id: match.id,
      gameId: match.gameId,
      roomCode: match.roomCode,
      status: asMatchStatus(match.status),
      startedAt: toIso(match.startedAt),
      endedAt: match.endedAt ? toIso(match.endedAt) : null,
      participantCount: match._count.participants,
    })),
  };
}

export async function getAdminMatchById(
  matchId: string,
): Promise<AdminActionResponse<AdminMatchDetails>> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      gameId: true,
      roomCode: true,
      status: true,
      startedAt: true,
      endedAt: true,
      roomHistoryId: true,
      _count: { select: { participants: true, answerAttempts: true } },
      participants: {
        orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
        select: {
          displayName: true,
          userId: true,
          score: true,
          rank: true,
          team: true,
          isWinner: true,
        },
      },
    },
  });

  if (!match) {
    return {
      success: false,
      error: { code: 'MATCH_NOT_FOUND', message: 'المباراة غير موجودة.' },
    };
  }

  return {
    success: true,
    data: {
      id: match.id,
      gameId: match.gameId,
      roomCode: match.roomCode,
      status: asMatchStatus(match.status),
      startedAt: toIso(match.startedAt),
      endedAt: match.endedAt ? toIso(match.endedAt) : null,
      participantCount: match._count.participants,
      answerAttemptCount: match._count.answerAttempts,
      roomHistoryId: match.roomHistoryId,
      participants: match.participants.map((participant) => ({
        displayName: participant.displayName,
        hasLinkedUser: Boolean(participant.userId),
        userId: participant.userId,
        score: participant.score,
        rank: participant.rank,
        team: participant.team,
        isWinner: participant.isWinner,
      })),
    },
  };
}

function parseAnswerStatus(raw: unknown): AnswerAttemptStatus | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  return ANSWER_ATTEMPT_STATUSES.includes(raw as AnswerAttemptStatus)
    ? (raw as AnswerAttemptStatus)
    : undefined;
}

function parseRoundIndex(raw: unknown): number | undefined {
  const value = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN;
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    return undefined;
  }
  return value;
}

function isAnswerHistoryAvailable(startedAt: Date, attemptCount: number): boolean {
  if (attemptCount > 0) {
    return true;
  }
  return startedAt.getTime() >= new Date(ANSWER_ATTEMPT_FEATURE_STARTED_AT).getTime();
}

export async function listAdminMatchAnswerAttempts(
  matchId: string,
  query: { page?: unknown; status?: unknown; roundIndex?: unknown } = {},
): Promise<AdminActionResponse<AdminAnswerAttemptData>> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, gameId: true, startedAt: true },
  });

  if (!match) {
    return {
      success: false,
      error: { code: 'MATCH_NOT_FOUND', message: 'المباراة غير موجودة.' },
    };
  }

  const page = parsePage(query.page);
  const pageSize = ADMIN_ANSWER_ATTEMPT_PAGE_SIZE;
  const status = parseAnswerStatus(query.status);
  const roundIndex = parseRoundIndex(query.roundIndex);
  const where: Prisma.AnswerAttemptWhereInput = {
    matchId,
    ...(status ? { status } : {}),
    ...(roundIndex !== undefined ? { roundIndex } : {}),
  };

  const [total, rows, loggedCount] = await Promise.all([
    prisma.answerAttempt.count({ where }),
    prisma.answerAttempt.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        submittedAt: true,
        gameId: true,
        playerDisplayName: true,
        rawAnswer: true,
        normalizedAnswer: true,
        status: true,
        rejectReason: true,
        wasCorrect: true,
        wasCounted: true,
        pointsAwarded: true,
        roundIndex: true,
        roundId: true,
        turnId: true,
        promptId: true,
        promptText: true,
        teamId: true,
      },
    }),
    prisma.answerAttempt.count({ where: { matchId } }),
  ]);

  return {
    success: true,
    data: {
      matchId: match.id,
      gameId: match.gameId,
      startedAt: toIso(match.startedAt),
      historyAvailable: isAnswerHistoryAvailable(match.startedAt, loggedCount),
      page,
      pageSize,
      total,
      attempts: rows.map((row) => ({
        id: row.id,
        submittedAt: toIso(row.submittedAt),
        gameId: row.gameId,
        playerDisplayName: row.playerDisplayName,
        rawAnswer: row.rawAnswer,
        normalizedAnswer: row.normalizedAnswer,
        status: row.status,
        rejectReason: row.rejectReason,
        wasCorrect: row.wasCorrect,
        wasCounted: row.wasCounted,
        pointsAwarded: row.pointsAwarded,
        roundIndex: row.roundIndex,
        roundId: row.roundId,
        turnId: row.turnId,
        promptId: row.promptId,
        promptText: row.promptText,
        teamId: row.teamId,
      })),
    },
  };
}
