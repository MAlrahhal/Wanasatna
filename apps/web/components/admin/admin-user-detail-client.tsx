'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminUserDetails } from '@wanasatna/shared';
import { fetchAdminUser } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_MATCH_STATUS_LABEL, ADMIN_ROLE_LABEL } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminHistoryPath } from '@/lib/admin/routes';

export function AdminUserDetailClient() {
  const params = useParams<{ userId: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [error, setError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAdminUser(userId);
      if (!result.ok) {
        setMissing(result.status === 404);
        setError(result.status !== 404);
        return;
      }
      setUser(result.data);
      setError(false);
      setMissing(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !user) {
    return <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>;
  }

  if (missing) {
    return <p className="mt-8 text-sm text-wanas-error">{ADMIN_COPY.userMissing}</p>;
  }

  if (error || !user) {
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
      <Link href={ADMIN_ROUTES.users} className="text-sm font-semibold underline">
        {ADMIN_COPY.backToUsers}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{ADMIN_COPY.userDetails}</h1>
      <div className="mt-6 space-y-2 rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm">
        <p className="text-lg font-bold">{user.preferredDisplayName}</p>
        <p>{user.email}</p>
        <p>{ADMIN_ROLE_LABEL[user.role] ?? user.role}</p>
        <p>
          {ADMIN_COPY.accountCreated}: {formatAdminDateTime(user.createdAt)}
        </p>
        <p>
          {ADMIN_COPY.matchCount}: {user.matchCount}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-bold">{ADMIN_COPY.recentMatches}</h2>
      {user.matches.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
          {ADMIN_COPY.emptyUserMatches}
        </p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-wanas-border md:block">
            <table className="w-full min-w-[800px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">اللعبة</th>
                  <th className="px-3 py-2 font-semibold">الرمز</th>
                  <th className="px-3 py-2 font-semibold">الحالة</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.historicalName}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.score}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.rank}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.team}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.winner}</th>
                  <th className="px-3 py-2 font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {user.matches.map((match) => (
                  <tr key={match.matchId} className="border-t border-wanas-border">
                    <td className="px-3 py-2">
                      <Link href={adminHistoryPath(match.matchId)} className="underline">
                        {adminGameTitle(match.gameId)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{match.roomCode}</td>
                    <td className="px-3 py-2">{ADMIN_MATCH_STATUS_LABEL[match.status] ?? match.status}</td>
                    <td className="px-3 py-2">{match.displayName}</td>
                    <td className="px-3 py-2">{match.score ?? '—'}</td>
                    <td className="px-3 py-2">{match.rank ?? '—'}</td>
                    <td className="px-3 py-2">{match.team ?? '—'}</td>
                    <td className="px-3 py-2">
                      {match.isWinner === true ? 'نعم' : match.isWinner === false ? 'لا' : '—'}
                    </td>
                    <td className="px-3 py-2">{formatAdminDateTime(match.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {user.matches.map((match) => (
              <Link
                key={match.matchId}
                href={adminHistoryPath(match.matchId)}
                className="block rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
              >
                <p className="font-bold">{adminGameTitle(match.gameId)}</p>
                <p className="mt-1">
                  {match.roomCode} · {ADMIN_MATCH_STATUS_LABEL[match.status]}
                </p>
                <p className="mt-1">
                  {ADMIN_COPY.historicalName}: {match.displayName}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
