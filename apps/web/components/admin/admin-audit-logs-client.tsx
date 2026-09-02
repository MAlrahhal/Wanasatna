'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminAuditData, AdminAuditEntry } from '@wanasatna/shared';
import { fetchAdminAuditLogs } from '@/lib/admin/api';
import {
  ADMIN_AUDIT_ACTION_LABEL,
  ADMIN_AUDIT_METADATA_LABEL,
  ADMIN_COPY,
} from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { adminRoomPath, adminUserPath } from '@/lib/admin/routes';

function pageFromQuery(value: string | null): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function actionLabel(action: string): string {
  return ADMIN_AUDIT_ACTION_LABEL[action] ?? ADMIN_COPY.unknownAction;
}

function targetTypeLabel(type: string | null): string | null {
  if (type === 'USER') return ADMIN_COPY.auditTargetUser;
  if (type === 'GAME') return ADMIN_COPY.auditTargetGame;
  if (type === 'ROOM') return ADMIN_COPY.auditTargetRoom;
  return type;
}

function formatMetadataValue(value: string | number | boolean | null): string {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  return String(value);
}

function OutcomeBadge({ outcome }: { outcome: AdminAuditEntry['outcome'] }) {
  const success = outcome === 'SUCCESS';
  return (
    <span
      className={
        success
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
          : 'bg-wanas-error-surface text-wanas-error inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
      }
    >
      {success ? ADMIN_COPY.auditOutcomeSuccess : ADMIN_COPY.auditOutcomeFailure}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className="bg-wanas-surface-soft text-wanas-text-secondary inline-flex max-w-52 rounded-full px-2.5 py-1 text-xs font-semibold leading-5">
      {actionLabel(action)}
    </span>
  );
}

function ActorCell({ actorUserId }: { actorUserId: string | null }) {
  if (!actorUserId) {
    return <span className="text-wanas-text-muted">—</span>;
  }
  return (
    <Link href={adminUserPath(actorUserId)} className="break-all font-mono text-xs underline">
      {actorUserId}
    </Link>
  );
}

function TargetCell({ entry }: { entry: AdminAuditEntry }) {
  const typeLabel = targetTypeLabel(entry.targetType);
  if (!typeLabel && !entry.targetId) {
    return <span className="text-wanas-text-muted">—</span>;
  }

  let identity: string | null = entry.targetId;
  if (entry.targetType === 'GAME' && entry.targetId) {
    identity = adminGameTitle(entry.targetId);
  }

  const linked =
    entry.targetType === 'USER' && entry.targetId ? (
      <Link href={adminUserPath(entry.targetId)} className="break-all font-mono text-xs underline">
        {entry.targetId}
      </Link>
    ) : entry.targetType === 'ROOM' && entry.targetId ? (
      <Link href={adminRoomPath(entry.targetId)} className="break-all font-mono text-xs underline">
        {entry.targetId}
      </Link>
    ) : identity ? (
      <span className="break-all font-mono text-xs">{identity}</span>
    ) : null;

  return (
    <div>
      {typeLabel ? <p className="text-xs font-semibold">{typeLabel}</p> : null}
      {linked ? <div className={typeLabel ? 'mt-1' : undefined}>{linked}</div> : null}
    </div>
  );
}

function AuditDetails({ entry }: { entry: AdminAuditEntry }) {
  const metadataEntries = entry.metadata ? Object.entries(entry.metadata) : [];
  if (metadataEntries.length === 0 && !entry.requestId) {
    return <span className="text-wanas-text-muted">—</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold underline">
        {ADMIN_COPY.auditDetails}
      </summary>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-wanas-text-muted">{ADMIN_COPY.auditAction}</dt>
          <dd className="font-mono">{entry.action}</dd>
        </div>
        {entry.requestId ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-wanas-text-muted">{ADMIN_COPY.auditRequestId}</dt>
            <dd className="break-all font-mono">{entry.requestId}</dd>
          </div>
        ) : null}
        {metadataEntries.map(([key, value]) => (
          <div key={key} className="flex flex-wrap gap-x-2">
            <dt className="text-wanas-text-muted">{ADMIN_AUDIT_METADATA_LABEL[key] ?? key}</dt>
            <dd className="break-all font-mono">{formatMetadataValue(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function AdminAuditLogsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFromQuery(searchParams.get('page'));
  const [data, setData] = useState<AdminAuditData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams();
      if (nextPage > 1) {
        params.set('page', String(nextPage));
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      router.push(`${pathname}${suffix}`);
    },
    [pathname, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminAuditLogs(page);
      if (!result.ok) {
        setError(true);
        return;
      }
      setData(result.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.auditLogsTitle}</h1>
      <p className="mt-1 text-xs text-wanas-text-muted">الأوقات بتوقيت السعودية (Asia/Riyadh).</p>

      {loading && !data ? (
        <p className="text-wanas-text-muted mt-8 text-sm">{ADMIN_COPY.resolving}</p>
      ) : null}

      {error && !data ? (
        <div className="border-wanas-error-border bg-wanas-error-surface mt-6 space-y-3 rounded-2xl border p-4">
          <p role="alert" className="text-wanas-error text-sm font-semibold">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="border-wanas-border bg-wanas-surface inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}

      {error && data ? (
        <div className="border-wanas-error-border bg-wanas-error-surface mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
          <p role="alert" className="text-wanas-error text-sm font-semibold">
            {ADMIN_COPY.loadFailed}
          </p>
          <button type="button" onClick={() => void load()} className="text-sm font-semibold underline">
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}

      {data && data.entries.length === 0 ? (
        <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-8 rounded-2xl border px-4 py-6 text-sm">
          {ADMIN_COPY.emptyAuditLogs}
        </p>
      ) : null}

      {data && data.entries.length > 0 ? (
        <>
          <div className="border-wanas-border mt-6 hidden overflow-x-auto rounded-2xl border lg:block">
            <table className="w-full min-w-[960px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.auditTime}</th>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.auditActor}</th>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.auditAction}</th>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.auditTarget}</th>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.auditOutcome}</th>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.auditDetails}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id} className="border-wanas-border border-t align-top">
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatAdminDateTime(entry.occurredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <ActorCell actorUserId={entry.actorUserId} />
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-4 py-3">
                      <TargetCell entry={entry} />
                    </td>
                    <td className="px-4 py-3">
                      <OutcomeBadge outcome={entry.outcome} />
                    </td>
                    <td className="px-4 py-3">
                      <AuditDetails entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 lg:hidden">
            {data.entries.map((entry) => (
              <article
                key={entry.id}
                className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-wanas-text-muted text-xs">
                    {formatAdminDateTime(entry.occurredAt)}
                  </p>
                  <OutcomeBadge outcome={entry.outcome} />
                </div>
                <div className="mt-3">
                  <ActionBadge action={entry.action} />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-wanas-text-muted text-xs">{ADMIN_COPY.auditActor}</p>
                    <div className="mt-1">
                      <ActorCell actorUserId={entry.actorUserId} />
                    </div>
                  </div>
                  <div>
                    <p className="text-wanas-text-muted text-xs">{ADMIN_COPY.auditTarget}</p>
                    <div className="mt-1">
                      <TargetCell entry={entry} />
                    </div>
                  </div>
                </div>
                <div className="border-wanas-border mt-3 border-t pt-3">
                  <AuditDetails entry={entry} />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-wanas-text-muted">
              {ADMIN_COPY.pageLabel} {data.page} / {totalPages} · {data.total} سجل
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => navigate(Math.max(1, page - 1))}
                className="border-wanas-border inline-flex h-10 items-center rounded-xl border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.previousPage}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => navigate(page + 1)}
                className="border-wanas-border inline-flex h-10 items-center rounded-xl border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.nextPage}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
