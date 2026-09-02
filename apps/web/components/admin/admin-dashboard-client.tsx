'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminDashboardData, AdminLiveRoom, AdminRecentMatch } from '@wanasatna/shared';
import { ADMIN_DASHBOARD_POLL_MS } from '@wanasatna/shared';
import { fetchAdminDashboard } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_MATCH_STATUS_LABEL } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { AdminAnalyticsClient } from '@/components/admin/admin-analytics-client';

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-wanas-border bg-wanas-surface p-4">
      <p className="text-xs font-semibold text-wanas-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-wanas-text-primary">{value}</p>
    </div>
  );
}

function RoomActivity({ room }: { room: AdminLiveRoom }) {
  if (room.activity !== 'IN_GAME') {
    return <span>{ADMIN_COPY.lobby}</span>;
  }

  const game = adminGameTitle(room.gameId);
  return (
    <span>
      {ADMIN_COPY.inGame}
      {game !== '—' ? ` · ${game}` : ''}
    </span>
  );
}

function MatchWinners({ match }: { match: AdminRecentMatch }) {
  if (match.winnerDisplayNames.length === 0) {
    return <span className="text-wanas-text-muted">—</span>;
  }

  return <span>{match.winnerDisplayNames.join('، ')}</span>;
}

export function AdminDashboardClient() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      const result = await fetchAdminDashboard();
      if (!result.ok) {
        setError(true);
        return;
      }

      setData(result.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async poll
    void load();

    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current) {
        return;
      }
      void load();
    }, ADMIN_DASHBOARD_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const summary = data?.summary;
  const lockedRooms = data?.liveRooms.filter((room) => room.isLocked).length ?? 0;

  return (
    <div className="mt-8 space-y-10">
      <section>
        <AdminAnalyticsClient embedded />
      </section>

      {loading && !data ? (
        <p className="text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>
      ) : null}

      {error && !data ? (
        <div className="space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
          <p role="alert" className="text-sm font-semibold text-wanas-error">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}

      {data && summary ? (
        <>
          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface px-4 py-3">
              <p role="alert" className="text-sm font-semibold text-wanas-error">
                {ADMIN_COPY.loadFailed}
              </p>
              <button
                type="button"
                onClick={() => {
                  void load();
                }}
                className="text-sm font-semibold text-wanas-text-primary underline"
              >
                {ADMIN_COPY.retry}
              </button>
            </div>
          ) : null}

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.summary}</h2>
                <p className="mt-1 text-xs text-wanas-text-muted">
                  لقطة تشغيلية مباشرة، وليست ضمن السلاسل التاريخية.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void load();
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold text-wanas-text-primary hover:bg-wanas-surface-soft"
              >
                {ADMIN_COPY.refresh}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <SummaryCard label={ADMIN_COPY.currentRooms} value={summary.currentRooms} />
              <SummaryCard label={ADMIN_COPY.connectedPlayers} value={summary.connectedPlayers} />
              <SummaryCard label={ADMIN_COPY.spectators} value={summary.spectators} />
              <SummaryCard label={ADMIN_COPY.locked} value={lockedRooms} />
              <SummaryCard label={ADMIN_COPY.roomsWithLiveGame} value={summary.roomsWithLiveGame} />
              <SummaryCard label={ADMIN_COPY.currentSeats} value={summary.currentSeats} />
            </div>
          </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.liveRooms}</h2>
        {data.liveRooms.length === 0 ? (
          <p className="rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
            {ADMIN_COPY.emptyRooms}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-wanas-border md:block">
              <table className="w-full min-w-[720px] text-right text-sm">
                <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">الرمز</th>
                    <th className="px-3 py-2 font-semibold">المضيف</th>
                    <th className="px-3 py-2 font-semibold">الحالة</th>
                    <th className="px-3 py-2 font-semibold">لاعبون</th>
                    <th className="px-3 py-2 font-semibold">متصل</th>
                    <th className="px-3 py-2 font-semibold">منقطع</th>
                    <th className="px-3 py-2 font-semibold">متفرج</th>
                    <th className="px-3 py-2 font-semibold">أُنشئت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.liveRooms.map((room) => (
                    <tr key={room.id} className="border-t border-wanas-border">
                      <td className="px-3 py-2 font-semibold">{room.code}</td>
                      <td className="px-3 py-2">{room.hostDisplayName}</td>
                      <td className="px-3 py-2">
                        <RoomActivity room={room} />
                        <span className="mt-0.5 block text-xs text-wanas-text-muted">
                          {room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}
                        </span>
                      </td>
                      <td className="px-3 py-2">{room.playerCount}</td>
                      <td className="px-3 py-2">{room.connectedCount}</td>
                      <td className="px-3 py-2">{room.disconnectedCount}</td>
                      <td className="px-3 py-2">{room.spectatorCount}</td>
                      <td className="px-3 py-2">{formatAdminDateTime(room.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {data.liveRooms.map((room) => (
                <article
                  key={room.id}
                  className="rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
                >
                  <p className="font-bold">{room.code}</p>
                  <p className="mt-1 text-wanas-text-secondary">{room.hostDisplayName}</p>
                  <p className="mt-2">
                    <RoomActivity room={room} />
                  </p>
                  <p className="mt-2 text-wanas-text-muted">
                    {room.playerCount} لاعب · {room.connectedCount} متصل · {room.disconnectedCount}{' '}
                    منقطع · {room.spectatorCount} متفرج
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.recentMatches}</h2>
        {data.recentMatches.length === 0 ? (
          <p className="rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
            {ADMIN_COPY.emptyMatches}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-wanas-border">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">اللعبة</th>
                  <th className="px-3 py-2 font-semibold">الغرفة</th>
                  <th className="px-3 py-2 font-semibold">الحالة</th>
                  <th className="px-3 py-2 font-semibold">لاعبون</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.winners}</th>
                  <th className="px-3 py-2 font-semibold">البداية</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMatches.map((match) => (
                  <tr key={match.id} className="border-t border-wanas-border">
                    <td className="px-3 py-2">{adminGameTitle(match.gameId)}</td>
                    <td className="px-3 py-2 font-semibold">{match.roomCode}</td>
                    <td className="px-3 py-2">
                      {ADMIN_MATCH_STATUS_LABEL[match.status] ?? match.status}
                    </td>
                    <td className="px-3 py-2">{match.participantCount}</td>
                    <td className="px-3 py-2">
                      <MatchWinners match={match} />
                    </td>
                    <td className="px-3 py-2">{formatAdminDateTime(match.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.games}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.gameUsage.map((usage) => (
            <article
              key={usage.gameId}
              className="rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
            >
              <p className="font-bold text-wanas-text-primary">{adminGameTitle(usage.gameId)}</p>
              <p className="mt-2 text-wanas-text-secondary">
                {ADMIN_COPY.completed}: {usage.completedCount}
              </p>
              <p className="text-wanas-text-secondary">
                {ADMIN_COPY.aborted}: {usage.abortedCount}
              </p>
              <p className="mt-1 font-semibold">
                {ADMIN_COPY.total}: {usage.totalCount}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.recentUsers}</h2>
        {data.recentUsers.length === 0 ? (
          <p className="rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
            {ADMIN_COPY.emptyUsers}
          </p>
        ) : (
          <ul className="divide-y divide-wanas-border overflow-hidden rounded-2xl border border-wanas-border bg-wanas-surface">
            {data.recentUsers.map((user) => (
              <li key={user.id} className="px-4 py-3 text-sm">
                <p className="font-semibold text-wanas-text-primary">{user.preferredDisplayName}</p>
                <p className="text-wanas-text-muted">{user.email}</p>
                <p className="mt-1 text-xs text-wanas-text-secondary">
                  {user.role} · {formatAdminDateTime(user.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      ) : null}
    </div>
  );
}
