'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminRoomHistoryDetails } from '@wanasatna/shared';
import { fetchAdminRoomHistoryDetails } from '@/lib/admin/api';
import {
  ADMIN_COPY,
  ADMIN_MATCH_STATUS_LABEL,
  ADMIN_ROOM_CLOSE_REASON_LABEL,
} from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminHistoryPath, adminRoomPath } from '@/lib/admin/routes';

function triState(value: boolean | null, yes: string, no: string): string {
  return value === null ? ADMIN_COPY.unknown : value ? yes : no;
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
    <div className="space-y-8">
      <div>
        <Link href={ADMIN_ROUTES.roomHistory} className="text-sm font-semibold underline">
          {ADMIN_COPY.backToRoomHistory}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{ADMIN_COPY.roomHistoryDetails}</h1>
            <p className="mt-1 font-mono text-xl font-bold tracking-wide">{room.roomCode}</p>
            <p className="text-wanas-text-muted mt-1 font-mono text-[11px]">{room.id}</p>
          </div>
          <span
            className={
              room.isComplete
                ? 'bg-wanas-success-surface text-wanas-success-dark rounded-full px-3 py-1 text-xs font-semibold'
                : 'bg-wanas-warning-surface text-wanas-warning-dark rounded-full px-3 py-1 text-xs font-semibold'
            }
          >
            {room.isComplete ? ADMIN_COPY.completeHistory : ADMIN_COPY.partialHistory}
          </span>
        </div>
      </div>

      {!room.isComplete ? (
        <aside className="border-wanas-warning-border bg-wanas-warning-surface text-wanas-warning-dark rounded-2xl border p-4 text-sm">
          <p className="font-bold">{ADMIN_COPY.partialHistory}</p>
          <p className="mt-1">{ADMIN_COPY.partialHistoryNote}</p>
        </aside>
      ) : null}

      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">الغرفة</h2>
          {room.isCurrentlyLive ? (
            <Link href={adminRoomPath(room.liveRoomId)} className="font-semibold underline">
              {ADMIN_COPY.liveRoomLink}
            </Link>
          ) : null}
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="text-wanas-text-muted">أُنشئت</dt>
            <dd>{formatAdminDateTime(room.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.historyStarted}</dt>
            <dd>{formatAdminDateTime(room.historyStartedAt)}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.closedAt}</dt>
            <dd>
              {room.closedAt ? formatAdminDateTime(room.closedAt) : ADMIN_COPY.historicalOpen}
            </dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.closeReason}</dt>
            <dd>{room.closeReason ? ADMIN_ROOM_CLOSE_REASON_LABEL[room.closeReason] : '—'}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.originalHost}</dt>
            <dd>{room.originalHostName ?? ADMIN_COPY.unknown}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.finalHost}</dt>
            <dd>{room.currentHostName}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.capacity}</dt>
            <dd>{room.playerCap}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">القفل النهائي</dt>
            <dd>{room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">سبق قفلها</dt>
            <dd>{triState(room.wasEverLocked, 'نعم', 'لا')}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.createdByAdmin}</dt>
            <dd>{triState(room.createdByAdmin, 'نعم', 'لا')}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">الحالة</dt>
            <dd>
              {room.state === 'OPEN' ? ADMIN_COPY.historicalOpen : ADMIN_COPY.historicalClosed}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-bold">{ADMIN_COPY.hostHistory}</h2>
        {room.hostAssignments.length === 0 ? (
          <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-3 rounded-2xl border p-4 text-sm">
            {ADMIN_COPY.noHostAssignments}
          </p>
        ) : (
          <ol className="divide-wanas-border border-wanas-border bg-wanas-surface mt-3 divide-y overflow-hidden rounded-2xl border">
            {room.hostAssignments.map((assignment, index) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <p className="font-semibold">
                  {index + 1}. {assignment.displayName}
                </p>
                <time className="text-wanas-text-muted">
                  {formatAdminDateTime(assignment.assignedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">{ADMIN_COPY.participantHistory}</h2>
        {room.participants.length === 0 ? (
          <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-3 rounded-2xl border p-4 text-sm">
            {ADMIN_COPY.noParticipants}
          </p>
        ) : (
          <div className="border-wanas-border mt-3 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-3">الاسم</th>
                  <th className="px-3 py-3">{ADMIN_COPY.joinedAt}</th>
                  <th className="px-3 py-3">{ADMIN_COPY.leftAt}</th>
                  <th className="px-3 py-3">دخل كمتفرج</th>
                  <th className="px-3 py-3">كان مضيفاً</th>
                </tr>
              </thead>
              <tbody>
                {room.participants.map((participant) => (
                  <tr key={participant.id} className="border-wanas-border border-t">
                    <td className="px-3 py-3 font-semibold">{participant.displayName}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatAdminDateTime(participant.joinedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {participant.leftAt ? formatAdminDateTime(participant.leftAt) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {triState(participant.joinedAsSpectator, 'نعم', 'لا')}
                    </td>
                    <td className="px-3 py-3">{triState(participant.wasHost, 'نعم', 'لا')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">{ADMIN_COPY.roomMatches}</h2>
        {room.matches.length === 0 ? (
          <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-3 rounded-2xl border p-4 text-sm">
            {ADMIN_COPY.noRoomMatches}
          </p>
        ) : (
          <div className="border-wanas-border mt-3 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[820px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-3">اللعبة</th>
                  <th className="px-3 py-3">الحالة</th>
                  <th className="px-3 py-3">بدأت</th>
                  <th className="px-3 py-3">انتهت</th>
                  <th className="px-3 py-3">المشاركون</th>
                  <th className="px-3 py-3">النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {room.matches.map((match) => (
                  <tr key={match.id} className="border-wanas-border border-t">
                    <td className="px-3 py-3 font-semibold">
                      <Link href={adminHistoryPath(match.id)} className="underline">
                        {adminGameTitle(match.gameId)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {ADMIN_MATCH_STATUS_LABEL[match.status] ?? match.status}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatAdminDateTime(match.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {match.endedAt ? formatAdminDateTime(match.endedAt) : '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{match.participantCount}</td>
                    <td className="px-3 py-3">
                      {match.winnerDisplayNames.length
                        ? `الفائز: ${match.winnerDisplayNames.join('، ')}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
