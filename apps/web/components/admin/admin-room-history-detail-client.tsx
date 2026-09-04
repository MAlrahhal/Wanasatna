'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  AdminMatchStatus,
  AdminRoomHistoryDetails,
  AdminRoomHistoryParticipant,
  AdminRoomHistoryState,
} from '@wanasatna/shared';
import { fetchAdminRoomHistoryDetails } from '@/lib/admin/api';
import {
  ADMIN_COPY,
  ADMIN_MATCH_STATUS_LABEL,
  ADMIN_ROOM_CLOSE_REASON_LABEL,
} from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminHistoryPath, adminRoomPath } from '@/lib/admin/routes';

const numberFormatter = new Intl.NumberFormat('ar');

function formatRoomDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) {
    return '—';
  }
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return '—';
  }

  const totalMinutes = Math.floor((ended - started) / 60_000);
  if (totalMinutes === 0) {
    return 'أقل من دقيقة';
  }
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days ? `${numberFormatter.format(days)} يوم` : null,
    hours ? `${numberFormatter.format(hours)} ساعة` : null,
    minutes ? `${numberFormatter.format(minutes)} دقيقة` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' و');
}

function CoverageBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={
        complete
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2.5 py-1 text-xs font-semibold'
          : 'bg-wanas-warning-surface text-wanas-warning-dark inline-flex rounded-full px-2.5 py-1 text-xs font-semibold'
      }
    >
      {complete ? ADMIN_COPY.completeHistory : ADMIN_COPY.partialHistory}
    </span>
  );
}

function RoomStateBadge({ state }: { state: AdminRoomHistoryState }) {
  return (
    <span
      className={
        state === 'OPEN'
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2.5 py-1 text-xs font-semibold'
          : 'bg-wanas-surface-muted text-wanas-text-secondary inline-flex rounded-full px-2.5 py-1 text-xs font-semibold'
      }
    >
      {state === 'OPEN' ? ADMIN_COPY.historicalOpen : ADMIN_COPY.historicalClosed}
    </span>
  );
}

function CloseReasonBadge({ reason }: { reason: AdminRoomHistoryDetails['closeReason'] }) {
  if (!reason) {
    return <span className="text-wanas-text-muted">—</span>;
  }
  return (
    <span className="bg-wanas-surface-soft text-wanas-text-secondary inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
      {ADMIN_ROOM_CLOSE_REASON_LABEL[reason]}
    </span>
  );
}

function MatchStatusBadge({ status }: { status: AdminMatchStatus }) {
  return (
    <span
      className={
        status === 'ACTIVE'
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
          : status === 'ABORTED'
            ? 'bg-wanas-error-surface text-wanas-error inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
            : 'bg-wanas-surface-muted text-wanas-text-secondary inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
      }
    >
      {ADMIN_MATCH_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function SummaryStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-wanas-surface-soft min-w-0 rounded-xl px-3 py-2.5">
      <dt className="text-wanas-text-muted text-xs">{label}</dt>
      <dd className="text-wanas-text-primary mt-1 min-w-0 text-sm font-semibold">{children}</dd>
    </div>
  );
}

function ParticipantRoleBadges({ participant }: { participant: AdminRoomHistoryParticipant }) {
  const hasKnownRole = participant.wasHost === true || participant.joinedAsSpectator === true;
  const hasUnknownRole = participant.wasHost === null || participant.joinedAsSpectator === null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {participant.wasHost === true ? (
        <span className="bg-wanas-primary-surface text-wanas-primary-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold">
          مضيف
        </span>
      ) : null}
      {participant.joinedAsSpectator === true ? (
        <span className="bg-wanas-warning-surface text-wanas-warning-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold">
          متفرج
        </span>
      ) : null}
      {!hasKnownRole && !hasUnknownRole ? (
        <span className="bg-wanas-surface-muted text-wanas-text-muted inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
          مشارك
        </span>
      ) : null}
      {hasUnknownRole ? (
        <span className="border-wanas-border text-wanas-text-muted inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
          بيانات جزئية
        </span>
      ) : null}
    </div>
  );
}

export function AdminRoomHistoryDetailClient() {
  const params = useParams<{ historyId: string }>();
  const historyId = typeof params.historyId === 'string' ? params.historyId : '';
  const [room, setRoom] = useState<AdminRoomHistoryDetails | null>(null);
  const [error, setError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!historyId) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAdminRoomHistoryDetails(historyId);
      if (!result.ok) {
        setMissing(result.status === 404);
        setError(result.status !== 404);
        return;
      }
      setRoom(result.data);
      setMissing(false);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [historyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading && !room) {
    return <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.resolving}</p>;
  }
  if (missing) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-wanas-error text-sm font-semibold">
          {ADMIN_COPY.roomHistoryMissing}
        </p>
        <Link href={ADMIN_ROUTES.roomHistory} className="text-sm font-semibold underline">
          {ADMIN_COPY.backToRoomHistory}
        </Link>
      </div>
    );
  }
  if (error || !room) {
    return (
      <div className="border-wanas-error-border bg-wanas-error-surface space-y-3 rounded-2xl border p-4">
        <p role="alert" className="text-wanas-error text-sm font-semibold">
          {ADMIN_COPY.loadFailed}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="border-wanas-border inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-7">
      <header>
        <Link href={ADMIN_ROUTES.roomHistory} className="text-sm font-semibold underline">
          {ADMIN_COPY.backToRoomHistory}
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.roomHistoryDetails}</p>
            <h1 className="mt-1 font-mono text-3xl font-bold tracking-wider sm:text-4xl">
              {room.roomCode}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoomStateBadge state={room.state} />
            <CoverageBadge complete={room.isComplete} />
            {room.isCurrentlyLive ? (
              <Link
                href={adminRoomPath(room.liveRoomId)}
                className="border-wanas-border bg-wanas-surface inline-flex rounded-full border px-3 py-1 text-xs font-semibold underline"
              >
                {ADMIN_COPY.liveRoomLink}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {!room.isComplete ? (
        <aside className="border-wanas-warning-border bg-wanas-warning-surface text-wanas-warning-dark rounded-2xl border px-4 py-3 text-sm">
          <p className="font-bold">{ADMIN_COPY.partialHistory}</p>
          <p className="mt-1">{ADMIN_COPY.partialHistoryNote}</p>
        </aside>
      ) : null}

      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">ملخص الغرفة</h2>
          <CloseReasonBadge reason={room.closeReason} />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <SummaryStat label="أُنشئت">{formatAdminDateTime(room.createdAt)}</SummaryStat>
          <SummaryStat label={ADMIN_COPY.closedAt}>
            {room.closedAt ? formatAdminDateTime(room.closedAt) : '—'}
          </SummaryStat>
          <SummaryStat label="المدة">
            {formatRoomDuration(room.createdAt, room.closedAt)}
          </SummaryStat>
          <SummaryStat label={ADMIN_COPY.originalHost}>
            {room.originalHostName ?? ADMIN_COPY.unknown}
          </SummaryStat>
          <SummaryStat label={ADMIN_COPY.finalHost}>{room.currentHostName}</SummaryStat>
          <SummaryStat label="المشاركون">
            <span className="tabular-nums">{room.participantCount}</span>
          </SummaryStat>
          <SummaryStat label="المباريات">
            <span className="tabular-nums">{room.matchCount}</span>
          </SummaryStat>
          <SummaryStat label={ADMIN_COPY.capacity}>
            <span className="tabular-nums">{room.playerCap}</span>
          </SummaryStat>
          <SummaryStat label="حالة القفل النهائية">
            <span
              className={
                room.isLocked
                  ? 'bg-wanas-warning-surface text-wanas-warning-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
                  : 'bg-wanas-surface-muted text-wanas-text-secondary inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
              }
            >
              {room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}
            </span>
          </SummaryStat>
          <SummaryStat label={ADMIN_COPY.createdByAdmin}>
            {room.createdByAdmin === null ? ADMIN_COPY.unknown : room.createdByAdmin ? 'نعم' : 'لا'}
          </SummaryStat>
        </dl>

        <div className="border-wanas-border text-wanas-text-muted mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs">
          <p>
            {ADMIN_COPY.historyStarted}: {formatAdminDateTime(room.historyStartedAt)}
          </p>
          <p>
            سبق قفلها:{' '}
            {room.wasEverLocked === null ? ADMIN_COPY.unknown : room.wasEverLocked ? 'نعم' : 'لا'}
          </p>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{ADMIN_COPY.hostHistory}</h2>
          {room.hostAssignments.length > 1 ? (
            <p className="text-wanas-text-muted text-xs">التسلسل من اليمين إلى اليسار</p>
          ) : null}
        </div>
        {room.hostAssignments.length === 0 ? (
          <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-3 rounded-2xl border p-4 text-sm">
            {ADMIN_COPY.noHostAssignments}
          </p>
        ) : (
          <div className="border-wanas-border bg-wanas-surface mt-3 overflow-x-auto rounded-2xl border px-4 py-3">
            <ol className="flex min-w-max items-center gap-2">
              {room.hostAssignments.map((assignment, index) => (
                <li key={assignment.id} className="flex items-center gap-2">
                  <div className="bg-wanas-surface-soft min-w-48 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-wanas-primary-surface text-wanas-primary-dark inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {index + 1}
                      </span>
                      <p className="font-semibold">{assignment.displayName}</p>
                    </div>
                    <time className="text-wanas-text-muted mt-1 block ps-8 text-xs">
                      {formatAdminDateTime(assignment.assignedAt)}
                    </time>
                  </div>
                  {index < room.hostAssignments.length - 1 ? (
                    <span className="text-wanas-text-muted text-lg" aria-hidden="true">
                      ←
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{ADMIN_COPY.participantHistory}</h2>
          <p className="text-wanas-text-muted text-xs tabular-nums">
            {room.participantCount} مشارك
          </p>
        </div>
        {room.participants.length === 0 ? (
          <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-3 rounded-2xl border p-4 text-sm">
            {ADMIN_COPY.noParticipants}
          </p>
        ) : (
          <div className="border-wanas-border mt-3 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-4 py-2.5">الاسم</th>
                  <th className="px-4 py-2.5">الدور</th>
                  <th className="px-4 py-2.5">{ADMIN_COPY.joinedAt}</th>
                  <th className="px-4 py-2.5">{ADMIN_COPY.leftAt}</th>
                </tr>
              </thead>
              <tbody>
                {room.participants.map((participant) => (
                  <tr
                    key={participant.id}
                    className="border-wanas-border hover:bg-wanas-surface-soft border-t"
                  >
                    <td className="px-4 py-3 font-semibold">{participant.displayName}</td>
                    <td className="px-4 py-3">
                      <ParticipantRoleBadges participant={participant} />
                    </td>
                    <td className="text-wanas-text-secondary whitespace-nowrap px-4 py-3">
                      {formatAdminDateTime(participant.joinedAt)}
                    </td>
                    <td className="text-wanas-text-secondary whitespace-nowrap px-4 py-3">
                      {participant.leftAt ? formatAdminDateTime(participant.leftAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{ADMIN_COPY.roomMatches}</h2>
          <p className="text-wanas-text-muted text-xs tabular-nums">{room.matchCount} مباراة</p>
        </div>
        {room.matches.length === 0 ? (
          <div className="border-wanas-border bg-wanas-surface mt-3 rounded-2xl border px-4 py-8 text-center">
            <p className="text-sm font-semibold">{ADMIN_COPY.noRoomMatches}</p>
            <p className="text-wanas-text-muted mt-1 text-xs">
              ستظهر هنا المباريات المرتبطة بهذا السجل عند توفرها.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {room.matches.map((match) => (
              <article
                key={match.id}
                className="border-wanas-border bg-wanas-surface flex min-w-0 flex-col rounded-2xl border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold">{adminGameTitle(match.gameId)}</h3>
                  </div>
                  <MatchStatusBadge status={match.status} />
                </div>

                <dl className="bg-wanas-surface-soft mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl p-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-wanas-text-muted text-xs">بدأت</dt>
                    <dd className="mt-1 whitespace-nowrap">
                      {formatAdminDateTime(match.startedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-wanas-text-muted text-xs">انتهت</dt>
                    <dd className="mt-1 whitespace-nowrap">
                      {match.endedAt ? formatAdminDateTime(match.endedAt) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-wanas-text-muted text-xs">المشاركون</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{match.participantCount}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-wanas-text-muted text-xs">النتيجة</p>
                    <p className="mt-1 text-sm font-semibold">
                      {match.winnerDisplayNames.length
                        ? `الفائز: ${match.winnerDisplayNames.join('، ')}`
                        : 'لا تتوفر خلاصة نتيجة'}
                    </p>
                    <p className="text-wanas-text-muted mt-1 text-xs tabular-nums">
                      {ADMIN_COPY.answerLogCount}: {match.answerAttemptCount}
                    </p>
                  </div>
                  <Link
                    href={adminHistoryPath(match.id)}
                    className="border-wanas-border hover:bg-wanas-surface-soft inline-flex h-9 items-center rounded-xl border px-3 text-xs font-semibold"
                  >
                    فتح تفاصيل المباراة
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <details className="border-wanas-border bg-wanas-surface text-wanas-text-muted rounded-xl border px-4 py-3 text-xs">
        <summary className="text-wanas-text-secondary cursor-pointer font-semibold">
          تفاصيل تقنية
        </summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt>معرّف سجل الغرفة</dt>
          <dd className="break-all font-mono" dir="ltr">
            {room.id}
          </dd>
        </dl>
      </details>
    </div>
  );
}
