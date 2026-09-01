'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  PLAYABLE_GAME_IDS,
  type AdminRoomHistoryData,
  type AdminRoomHistoryListItem,
  type AdminRoomHistoryState,
} from '@wanasatna/shared';
import { fetchAdminRoomHistory, type AdminRoomHistoryQuery } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_ROOM_CLOSE_REASON_LABEL } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { adminRoomHistoryPath } from '@/lib/admin/routes';

const FILTER_KEYS = [
  'roomCode',
  'participant',
  'host',
  'gameId',
  'createdFrom',
  'createdTo',
  'state',
] as const;

function pageFromQuery(value: string | null): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function CoverageBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={
        complete
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
          : 'bg-wanas-warning-surface text-wanas-warning-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
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
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
          : 'bg-wanas-surface-muted text-wanas-text-secondary inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
      }
    >
      {state === 'OPEN' ? ADMIN_COPY.historicalOpen : ADMIN_COPY.historicalClosed}
    </span>
  );
}

function CloseReasonBadge({ reason }: { reason: AdminRoomHistoryListItem['closeReason'] }) {
  if (!reason) {
    return <span className="text-wanas-text-muted">—</span>;
  }
  return (
    <span className="bg-wanas-surface-soft text-wanas-text-secondary inline-flex max-w-52 rounded-full px-2.5 py-1 text-xs font-semibold leading-5">
      {ADMIN_ROOM_CLOSE_REASON_LABEL[reason]}
    </span>
  );
}

export function AdminRoomHistoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFromQuery(searchParams.get('page'));
  const serializedFilters = FILTER_KEYS.map((key) => `${key}=${searchParams.get(key) ?? ''}`).join(
    '&',
  );
  const activeFilters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? '']),
  ) as Record<(typeof FILTER_KEYS)[number], string>;
  const [draft, setDraft] = useState(activeFilters);
  const [data, setData] = useState<AdminRoomHistoryData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraft(
        Object.fromEntries(
          FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? '']),
        ) as typeof draft,
      );
    }, 0);
    return () => window.clearTimeout(timer);
    // serializedFilters is the stable representation used for browser back/forward updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query: AdminRoomHistoryQuery = { page };
      for (const key of FILTER_KEYS) {
        const value = searchParams.get(key);
        if (value) {
          query[key] = value;
        }
      }
      const result = await fetchAdminRoomHistory(query);
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
  }, [page, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function navigate(nextPage: number, filters: typeof draft = activeFilters) {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = filters[key]?.trim();
      if (value) {
        params.set(key, value);
      }
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    const suffix = params.toString();
    router.push(suffix ? `${pathname}?${suffix}` : pathname);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-[1680px]">
      <div>
        <h1 className="text-wanas-text-primary text-2xl font-bold">
          {ADMIN_COPY.roomHistoryTitle}
        </h1>
        <p className="text-wanas-text-muted mt-2 max-w-3xl text-sm">
          دورة حياة الغرفة وكل المشاركين والمباريات المرتبطة بها. يبقى سجل المباريات منفصلاً لكل
          جلسة لعب.
        </p>
      </div>

      <form
        className="border-wanas-border bg-wanas-surface mt-6 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(1, draft);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.roomCodeSearch}</span>
          <input
            value={draft.roomCode}
            onChange={(event) => setDraft((value) => ({ ...value, roomCode: event.target.value }))}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.participantSearch}</span>
          <input
            value={draft.participant}
            onChange={(event) =>
              setDraft((value) => ({ ...value, participant: event.target.value }))
            }
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.hostSearch}</span>
          <input
            value={draft.host}
            onChange={(event) => setDraft((value) => ({ ...value, host: event.target.value }))}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.games}</span>
          <select
            value={draft.gameId}
            onChange={(event) => setDraft((value) => ({ ...value, gameId: event.target.value }))}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          >
            <option value="">{ADMIN_COPY.allGames}</option>
            {PLAYABLE_GAME_IDS.map((gameId) => (
              <option key={gameId} value={gameId}>
                {adminGameTitle(gameId)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.createdFrom}</span>
          <input
            type="date"
            value={draft.createdFrom}
            onChange={(event) =>
              setDraft((value) => ({ ...value, createdFrom: event.target.value }))
            }
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.createdTo}</span>
          <input
            type="date"
            value={draft.createdTo}
            onChange={(event) => setDraft((value) => ({ ...value, createdTo: event.target.value }))}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>الحالة التاريخية</span>
          <select
            value={draft.state}
            onChange={(event) => setDraft((value) => ({ ...value, state: event.target.value }))}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          >
            <option value="">{ADMIN_COPY.allRoomStates}</option>
            <option value="OPEN">{ADMIN_COPY.historicalOpen}</option>
            <option value="CLOSED">{ADMIN_COPY.historicalClosed}</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="border-wanas-border inline-flex h-11 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.searchCta}
          </button>
          <button
            type="button"
            onClick={() => {
              const empty = Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])) as typeof draft;
              setDraft(empty);
              navigate(1, empty);
            }}
            className="border-wanas-border inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.clearFilters}
          </button>
        </div>
      </form>

      {loading && !data ? (
        <p className="text-wanas-text-muted mt-8 text-sm">{ADMIN_COPY.resolving}</p>
      ) : null}
      {error ? (
        <div className="border-wanas-error-border bg-wanas-error-surface mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
          <p role="alert" className="text-wanas-error text-sm font-semibold">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-semibold underline"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}
      {data && data.rooms.length === 0 ? (
        <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-8 rounded-2xl border px-4 py-6 text-sm">
          {ADMIN_COPY.emptyRoomHistory}
        </p>
      ) : null}

      {data && data.rooms.length > 0 ? (
        <>
          <div className="border-wanas-border mt-8 hidden overflow-x-auto rounded-2xl border lg:block">
            <table className="w-full min-w-[1120px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">الغرفة</th>
                  <th className="px-4 py-3 font-semibold">المضيفون</th>
                  <th className="px-4 py-3 font-semibold">دورة الحياة</th>
                  <th className="px-4 py-3 font-semibold">{ADMIN_COPY.closeReason}</th>
                  <th className="px-4 py-3 text-center font-semibold">المشاركون</th>
                  <th className="px-4 py-3 text-center font-semibold">المباريات</th>
                  <th className="px-4 py-3 font-semibold">السعة والقفل</th>
                  <th className="px-4 py-3 font-semibold">التغطية</th>
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room) => (
                  <tr
                    key={room.id}
                    className="border-wanas-border hover:bg-wanas-surface-soft border-t align-top"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={adminRoomHistoryPath(room.id)}
                        className="font-mono text-base font-bold tracking-wide underline"
                      >
                        {room.roomCode}
                      </Link>
                      <div className="mt-2">
                        <RoomStateBadge state={room.state} />
                      </div>
                    </td>
                    <td className="min-w-48 px-4 py-3">
                      <p className="font-semibold">{room.originalHostName ?? ADMIN_COPY.unknown}</p>
                      <p className="text-wanas-text-muted mt-1 text-xs">← {room.currentHostName}</p>
                    </td>
                    <td className="min-w-48 px-4 py-3">
                      <p className="whitespace-nowrap">{formatAdminDateTime(room.createdAt)}</p>
                      <p className="text-wanas-text-muted mt-1 whitespace-nowrap text-xs">
                        {room.closedAt ? formatAdminDateTime(room.closedAt) : 'لم تُغلق'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <CloseReasonBadge reason={room.closeReason} />
                    </td>
                    <td className="px-4 py-3 text-center text-base font-semibold tabular-nums">
                      {room.participantCount}
                    </td>
                    <td className="px-4 py-3 text-center text-base font-semibold tabular-nums">
                      {room.matchCount}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums">{room.playerCap}</p>
                      <p className="text-wanas-text-muted mt-1 text-xs">
                        {room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <CoverageBadge complete={room.isComplete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 space-y-3 lg:hidden">
            {data.rooms.map((room) => (
              <Link
                key={room.id}
                href={adminRoomHistoryPath(room.id)}
                className="border-wanas-border bg-wanas-surface block rounded-2xl border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-lg font-bold">{room.roomCode}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <RoomStateBadge state={room.state} />
                    <CoverageBadge complete={room.isComplete} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-wanas-text-muted text-xs">المضيفون</p>
                    <p className="mt-1 font-semibold">
                      {room.originalHostName ?? ADMIN_COPY.unknown} ← {room.currentHostName}
                    </p>
                  </div>
                  <div>
                    <p className="text-wanas-text-muted text-xs">أُنشئت</p>
                    <p className="mt-1">{formatAdminDateTime(room.createdAt)}</p>
                  </div>
                </div>
                <div className="text-wanas-text-muted border-wanas-border mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs">
                  <span>{room.participantCount} مشارك</span>
                  <span>{room.matchCount} مباراة</span>
                  <span>السعة {room.playerCap}</span>
                  <span>{room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}</span>
                </div>
                {room.closeReason ? (
                  <div className="mt-3">
                    <CloseReasonBadge reason={room.closeReason} />
                  </div>
                ) : null}
              </Link>
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
