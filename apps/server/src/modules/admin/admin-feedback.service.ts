import type { FeedbackCategory, FeedbackSource, FeedbackStatus, Prisma } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminFeedbackData,
  AdminFeedbackDeleteData,
  AdminFeedbackItem,
  AdminFeedbackStatusUpdateData,
} from '@wanasatna/shared';
import {
  ADMIN_FEEDBACK_PAGE_SIZE,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SOURCES,
  FEEDBACK_STATUSES,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import { createAdminAuditLog } from './admin-audit.service.js';

type AdminFeedbackFilters = {
  status?: unknown;
  category?: unknown;
  source?: unknown;
  gameId?: unknown;
  page?: unknown;
};

function enumValue<T extends readonly string[]>(raw: unknown, values: T): T[number] | undefined {
  return typeof raw === 'string' && values.includes(raw) ? (raw as T[number]) : undefined;
}

function parsePage(raw: unknown): number {
  const page = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 1;
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

function parseGameId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const value = raw.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}

function toAdminFeedbackItem(row: {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  source: FeedbackSource;
  roomId: string | null;
  gameId: string | null;
  route: string | null;
  deviceCategory: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminFeedbackItem {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminFeedback(filters: AdminFeedbackFilters): Promise<AdminFeedbackData> {
  const page = parsePage(filters.page);
  const pageSize = ADMIN_FEEDBACK_PAGE_SIZE;
  const status = enumValue(filters.status, FEEDBACK_STATUSES);
  const category = enumValue(filters.category, FEEDBACK_CATEGORIES);
  const source = enumValue(filters.source, FEEDBACK_SOURCES);
  const gameId = parseGameId(filters.gameId);
  const where: Prisma.FeedbackWhereInput = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(source ? { source } : {}),
    ...(gameId ? { gameId } : {}),
  };

  const [feedback, total, allTotal, newCount, problems, suggestions] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        category: true,
        message: true,
        status: true,
        source: true,
        roomId: true,
        gameId: true,
        route: true,
        deviceCategory: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.count(),
    prisma.feedback.count({ where: { status: 'NEW' } }),
    prisma.feedback.count({ where: { category: 'PROBLEM' } }),
    prisma.feedback.count({ where: { category: 'SUGGESTION' } }),
  ]);

  return {
    feedback: feedback.map(toAdminFeedbackItem),
    stats: { total: allTotal, new: newCount, problems, suggestions },
    total,
    page,
    pageSize,
  };
}

export async function setAdminFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  actorUserId: string,
  requestId?: string,
): Promise<AdminActionResponse<AdminFeedbackStatusUpdateData>> {
  const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return {
      success: false,
      error: { code: 'FEEDBACK_NOT_FOUND', message: 'الملاحظة غير موجودة.' },
    };
  }

  const feedback = await prisma.$transaction(async (tx) => {
    const updated = await tx.feedback.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
    await createAdminAuditLog(
      {
        actorUserId,
        action: 'FEEDBACK_STATUS_SET',
        targetId: id,
        outcome: 'SUCCESS',
        requestId,
        metadata: { status },
      },
      tx,
    );
    return updated;
  });

  return {
    success: true,
    data: { id: feedback.id, status: feedback.status, updatedAt: feedback.updatedAt.toISOString() },
  };
}

export async function deleteAdminFeedback(
  id: string,
  actorUserId: string,
  requestId?: string,
): Promise<AdminActionResponse<AdminFeedbackDeleteData>> {
  const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return {
      success: false,
      error: { code: 'FEEDBACK_NOT_FOUND', message: 'الملاحظة غير موجودة.' },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.feedback.delete({ where: { id } });
    await createAdminAuditLog(
      {
        actorUserId,
        action: 'FEEDBACK_DELETE',
        targetId: id,
        outcome: 'SUCCESS',
        requestId,
      },
      tx,
    );
  });

  return { success: true, data: { id } };
}
