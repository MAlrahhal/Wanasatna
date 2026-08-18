'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PLAYABLE_GAME_IDS, type AdminHistoryData } from '@wanasatna/shared';
import { fetchAdminHistory } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_MATCH_STATUS_LABEL } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { adminHistoryPath } from '@/lib/admin/routes';

export function AdminHistoryClient() {
  const [gameId, setGameId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminHistoryData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminHistory({
        gameId: gameId || undefined,
        status: status || undefined,
        page,
      });
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
  }, [gameId, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.historyTitle}</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.games}</span>
          <select
            value={gameId}
            onChange={(event) => {
              setPage(1);
              setGameId(event.target.value);
            }}
            className="h-11 rounded-xl border border-wanas-border bg-wanas-surface px-3"
          >
            <option value="">{ADMIN_COPY.allGames}</option>
            {PLAYABLE_GAME_IDS.map((id) => (
              <option key={id} value={id}>
                {adminGameTitle(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span>الحالة</span>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-11 rounded-xl border border-wanas-border bg-wanas-surface px-3"
          >
            <option value="">{ADMIN_COPY.allStatuses}</option>
            <option value="ACTIVE">{ADMIN_MATCH_STATUS_LABEL.ACTIVE}</option>
            <option value="COMPLETED">{ADMIN_MATCH_STATUS_LABEL.COMPLETED}</option>
            <option value="ABORTED">{ADMIN_MATCH_STATUS_LABEL.ABORTED}</option>
          </select>
        </label>
      </div>

      {loading && !data ? (
        <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>
      ) : null}

      {error && !data ? (
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
      ) : null}

      {data && data.matches.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
          {ADMIN_COPY.emptyHistory}
        </p>
      ) : null}

      {data && data.matches.length > 0 ? (
        <>
          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-wanas-border md:block">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">اللعبة</th>
                  <th className="px-3 py-2 font-semibold">الرمز</th>
                  <th className="px-3 py-2 font-semibold">الحالة</th>
                  <th className="px-3 py-2 font-semibold">اللاعبون</th>
                  <th className="px-3 py-2 font-semibold">بدأت</th>
                  <th className="px-3 py-2 font-semibold">انتهت</th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((match) => (
                  <tr key={match.id} className="border-t border-wanas-border">
                    <td className="px-3 py-2 font-semibold">
                      <Link href={adminHistoryPath(match.id)} className="underline">
                        {adminGameTitle(match.gameId)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{match.roomCode}</td>
                    <td className="px-3 py-2">
                      {ADMIN_MATCH_STATUS_LABEL[match.status] ?? match.status}
                      {match.status === 'ACTIVE' ? (
                        <span className="mt-0.5 block text-xs text-wanas-text-muted">
                          {ADMIN_COPY.activeMatchNote}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{match.participantCount}</td>
                    <td className="px-3 py-2">{formatAdminDateTime(match.startedAt)}</td>
                    <td className="px-3 py-2">
                      {match.endedAt ? formatAdminDateTime(match.endedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 space-y-3 md:hidden">
            {data.matches.map((match) => (
              <Link
                key={match.id}
                href={adminHistoryPath(match.id)}
                className="block rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
              >
                <p className="font-bold">{adminGameTitle(match.gameId)}</p>
                <p className="mt-1">
                  {match.roomCode} · {ADMIN_MATCH_STATUS_LABEL[match.status]}
                </p>
                {match.status === 'ACTIVE' ? (
                  <p className="mt-1 text-xs text-wanas-text-muted">{ADMIN_COPY.activeMatchNote}</p>
                ) : null}
                <p className="mt-1 text-wanas-text-muted">
                  {match.participantCount} {ADMIN_COPY.players}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-wanas-text-muted">
              {ADMIN_COPY.pageLabel} {data.page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="inline-flex h-10 items-center rounded-xl border border-wanas-border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.previousPage}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                className="inline-flex h-10 items-center rounded-xl border border-wanas-border px-3 disabled:opacity-40"
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
