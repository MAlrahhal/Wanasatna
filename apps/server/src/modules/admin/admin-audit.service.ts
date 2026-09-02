import type { Prisma } from '@prisma/client';
import type {
  AdminAuditAction,
  AdminAuditData,
  AdminAuditMetadata,
  AdminAuditMetadataValue,
  AdminAuditOutcome,
} from '@wanasatna/shared';
import { ADMIN_AUDIT_ACTIONS, ADMIN_AUDIT_PAGE_SIZE } from '@wanasatna/shared';
import { opsLogger, sanitizeErrorName, sanitizeKnownErrorCode } from '../../lib/ops-logger.js';
import { prisma } from '../../lib/prisma.js';

const MAX_AUDIT_ID_LENGTH = 128;
const MAX_REQUEST_ID_LENGTH = 128;

const AUDIT_POLICIES: Record<
  AdminAuditAction,
  {
    targetType: 'USER' | 'GAME' | 'ROOM';
    metadata: Readonly<Record<string, (value: unknown) => AdminAuditMetadataValue | undefined>>;
  }
> = {
  ROLE_PROMOTED: { targetType: 'USER', metadata: {} },
  MFA_ENROLLMENT_STARTED: {
    targetType: 'USER',
    metadata: {
      source: allowCliSource,
      keyVersion: allowPositiveInteger,
    },
  },
  MFA_ENABLED: {
    targetType: 'USER',
    metadata: {
      source: allowCliSource,
      keyVersion: allowPositiveInteger,
      recoveryCodeCount: allowPositiveInteger,
    },
  },
  MFA_LOGIN_SUCCESS: {
    targetType: 'USER',
    metadata: { method: allowMfaMethod },
  },
  MFA_LOGIN_FAILURE: {
    targetType: 'USER',
    metadata: {
      method: allowMfaMethod,
      reason: allowMfaFailureReason,
    },
  },
  MFA_RECOVERY_USED: {
    targetType: 'USER',
    metadata: { method: allowMfaMethod },
  },
  GAME_AVAILABILITY_SET: {
    targetType: 'GAME',
    metadata: { isEnabled: allowBoolean },
  },
  ROOM_LOCK: {
    targetType: 'ROOM',
    metadata: { isLocked: allowBoolean },
  },
  ROOM_UNLOCK: {
    targetType: 'ROOM',
    metadata: { isLocked: allowBoolean },
  },
  ROOM_KICK: {
    targetType: 'ROOM',
    metadata: {
      playerId: allowIdentifier,
      roomDeleted: allowBoolean,
    },
  },
  ROOM_FORCE_CLOSE: {
    targetType: 'ROOM',
    metadata: { alreadyClosed: allowBoolean },
  },
  ROOM_SPECTATE: {
    targetType: 'ROOM',
    metadata: {},
  },
};

type AuditClient = Pick<Prisma.TransactionClient, 'adminAuditLog'>;

export type CreateAdminAuditLogInput = {
  actorUserId?: string | null;
  action: AdminAuditAction;
  targetId?: string | null;
  outcome: AdminAuditOutcome;
  requestId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
};

function allowBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function allowPositiveInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function allowIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length < 1 || value.length > MAX_AUDIT_ID_LENGTH) {
    return undefined;
  }
  return value;
}

function allowMfaMethod(value: unknown): string | undefined {
  return value === 'TOTP' || value === 'RECOVERY_CODE' ? value : undefined;
}

function allowCliSource(value: unknown): string | undefined {
  return value === 'CLI' ? value : undefined;
}

function allowMfaFailureReason(value: unknown): string | undefined {
  return value === 'INVALID' ||
    value === 'INVALID_CODE' ||
    value === 'MFA_NOT_ENABLED' ||
    value === 'EXPIRED' ||
    value === 'ATTEMPT_LIMIT' ||
    value === 'REPLAYED' ||
    value === 'REPLAYED_CODE' ||
    value === 'RATE_LIMITED'
    ? value
    : undefined;
}

function requireIdentifier(
  value: string | null | undefined,
  field: 'actor' | 'target',
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value.length < 1 || value.length > MAX_AUDIT_ID_LENGTH) {
    throw new Error(`Invalid admin audit ${field} identifier.`);
  }
  return value;
}

function normalizeRequestId(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_REQUEST_ID_LENGTH) {
    return null;
  }
  return value;
}

function allowlistedMetadata(
  action: AdminAuditAction,
  metadata: Readonly<Record<string, unknown>> | null | undefined,
): AdminAuditMetadata | null {
  if (!metadata) {
    return null;
  }

  const safe: AdminAuditMetadata = {};
  for (const [key, validator] of Object.entries(AUDIT_POLICIES[action].metadata)) {
    const value = validator(metadata[key]);
    if (value !== undefined) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

function readStoredMetadata(
  action: AdminAuditAction,
  value: Prisma.JsonValue | null,
): AdminAuditMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return allowlistedMetadata(action, value as Record<string, unknown>);
}

function parsePage(raw: unknown): number {
  const page = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }
  return Math.min(page, 10_000);
}

function asAdminAuditAction(value: string): AdminAuditAction {
  if ((ADMIN_AUDIT_ACTIONS as readonly string[]).includes(value)) {
    return value as AdminAuditAction;
  }
  throw new Error('Invalid stored admin audit action.');
}

function asAdminAuditOutcome(value: string): AdminAuditOutcome {
  if (value === 'SUCCESS' || value === 'FAILURE') {
    return value;
  }
  throw new Error('Invalid stored admin audit outcome.');
}

export async function createAdminAuditLog(
  input: CreateAdminAuditLogInput,
  client: AuditClient = prisma,
): Promise<void> {
  const action = asAdminAuditAction(input.action);
  const outcome = asAdminAuditOutcome(input.outcome);
  const policy = AUDIT_POLICIES[action];
  const actorUserId = requireIdentifier(input.actorUserId, 'actor');
  const targetId = requireIdentifier(input.targetId, 'target');
  const metadata = allowlistedMetadata(action, input.metadata);

  await client.adminAuditLog.create({
    data: {
      actorUserId,
      action,
      targetType: targetId ? policy.targetType : null,
      targetId,
      outcome,
      requestId: normalizeRequestId(input.requestId),
      ...(metadata ? { metadata } : {}),
    },
  });
}

export async function createAdminAuditLogBestEffort(
  input: CreateAdminAuditLogInput,
): Promise<void> {
  try {
    await createAdminAuditLog(input);
  } catch (error) {
    opsLogger.warn('admin-audit-write-failed', 'تعذر حفظ سجل تدقيق إداري.', {
      action: input.action,
      outcome: input.outcome,
      requestId: normalizeRequestId(input.requestId) ?? undefined,
      errorName: sanitizeErrorName(error),
      errorCode: sanitizeKnownErrorCode(error),
    });
  }
}

export async function listAdminAuditLogs(query: { page?: unknown }): Promise<AdminAuditData> {
  const page = parsePage(query.page);
  const pageSize = ADMIN_AUDIT_PAGE_SIZE;
  const where = {
    action: { in: [...ADMIN_AUDIT_ACTIONS] },
    outcome: { in: ['SUCCESS', 'FAILURE'] },
  };
  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        occurredAt: true,
        actorUserId: true,
        action: true,
        targetType: true,
        targetId: true,
        outcome: true,
        requestId: true,
        metadata: true,
      },
    }),
  ]);

  return {
    entries: rows.map((row) => {
      const action = asAdminAuditAction(row.action);
      return {
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        actorUserId: row.actorUserId,
        action,
        targetType: row.targetType,
        targetId: row.targetId,
        outcome: asAdminAuditOutcome(row.outcome),
        requestId: row.requestId,
        metadata: readStoredMetadata(action, row.metadata),
      };
    }),
    total,
    page,
    pageSize,
  };
}
