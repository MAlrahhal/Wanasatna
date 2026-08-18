'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminMatchDetails } from '@wanasatna/shared';
import { fetchAdminMatch } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_MATCH_STATUS_LABEL } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminUserPath } from '@/lib/admin/routes';

export function AdminMatchDetailClient() {
  const params = useParams<{ matchId: string }>();
  const matchId = typeof params.matchId === 'string' ? params.matchId : '';
  const [match, setMatch] = useState<AdminMatchDetails | null>(null);
  const [error, setError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!matchId) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAdminMatch(matchId);
      if (!result.ok) {
        setMissing(result.status === 404);
        setError(result.status !== 404);
        return;
      }
      setMatch(result.data);
      setError(false);
      setMissing(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !match) {
    return <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>;
  }

  if (missing) {
    return <p className="mt-8 text-sm text-wanas-error">{ADMIN_COPY.matchMissing}</p>;
  }

  if (error || !match) {
    return (
      <div className="mt-8 space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
        <p role="alert" className="text-sm font-semibold text-wanas-error">
          {ADMIN_COPY.loadFailed}
        </p>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.retry}
        </button>
      </div>
    );
  }

  return (
    <div>
      <Link href={ADMIN_ROUTES.history} className="text-sm font-semibold underline">
        {ADMIN_COPY.backToHistory}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{ADMIN_COPY.matchDetails}</h1>
      <div className="mt-6 space-y-3 rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm">
        <p className="text-lg font-bold">{adminGameTitle(match.gameId)}</p>
        <p className="font-mono tracking-wide">{match.roomCode}</p>
        <p>
          <span
            className={
              match.status === 'ACTIVE'
                ? 'inline-flex rounded-full bg-wanas-success-surface px-2 py-0.5 text-xs font-semibold text-wanas-success-dark'
                : match.status === 'ABORTED'
                  ? 'inline-flex rounded-full bg-wanas-error-surface px-2 py-0.5 text-xs font-semibold text-wanas-error'
                  : 'inline-flex rounded-full bg-wanas-surface-muted px-2 py-0.5 text-xs font-semibold text-wanas-text-secondary'
            }
          >
            {ADMIN_MATCH_STATUS_LABEL[match.status] ?? match.status}
          </span>
        </p>
        {match.status === 'ACTIVE' ? (
          <p className="text-wanas-text-muted">{ADMIN_COPY.activeMatchNote}</p>
        ) : null}
        <p>
          {formatAdminDateTime(match.startedAt)}
          {match.endedAt ? ` — ${formatAdminDateTime(match.endedAt)}` : ''}
        </p>
        <p>
          {ADMIN_COPY.players}: {match.participantCount}
        </p>
        <p className="font-mono text-[11px] text-wanas-text-muted">{match.id}</p>
      </div>

      <h2 className="mt-8 text-lg font-bold">{ADMIN_COPY.players}</h2>
      {match.participants.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
          {ADMIN_COPY.emptyUserMatches}
        </p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-wanas-border md:block">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.historicalName}</th>
                  <th className="px-3 py-2 font-semibold">الحساب</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.score}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.rank}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.team}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.winner}</th>
                </tr>
              </thead>
              <tbody>
                {match.participants.map((participant, index) => (
                  <tr key={`${participant.displayName}-${index}`} className="border-t border-wanas-border">
                    <td className="px-3 py-2 font-semibold">{participant.displayName}</td>
                    <td className="px-3 py-2">
                      {participant.hasLinkedUser && participant.userId ? (
                        <Link href={adminUserPath(participant.userId)} className="underline">
                          {ADMIN_COPY.linkedAccount}
                        </Link>
                      ) : (
                        ADMIN_COPY.guestParticipant
                      )}
                    </td>
                    <td className="px-3 py-2">{participant.score ?? '—'}</td>
                    <td className="px-3 py-2">{participant.rank ?? '—'}</td>
                    <td className="px-3 py-2">{participant.team ?? '—'}</td>
                    <td className="px-3 py-2">
                      {participant.isWinner === true ? 'نعم' : participant.isWinner === false ? 'لا' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {match.participants.map((participant, index) => (
              <div
                key={`${participant.displayName}-${index}`}
                className="rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
              >
                <p className="font-bold">{participant.displayName}</p>
                {participant.hasLinkedUser && participant.userId ? (
                  <Link href={adminUserPath(participant.userId)} className="mt-1 inline-block underline">
                    {ADMIN_COPY.linkedAccount}
                  </Link>
                ) : (
                  <p className="mt-1 text-wanas-text-muted">{ADMIN_COPY.guestParticipant}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
