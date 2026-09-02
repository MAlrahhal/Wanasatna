'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ADMIN_DASHBOARD_POLL_MS,
  type AdminLiveRoom,
  type AdminRoomsData,
} from '@wanasatna/shared';
import { fetchAdminRooms } from '@/lib/admin/api';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { adminRoomPath, adminRoomSpectatePath } from '@/lib/admin/routes';

function pageFromQuery(value: string | null): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function RoomActivity({ room }: { room: AdminLiveRoom }) {
  const game = adminGameTitle(room.gameId);
  if (room.activity !== 'IN_GAME') {
    return <span>{ADMIN_COPY.lobby}</span>;
  }
  return <span>{game === '—' ? ADMIN_COPY.inGame : `${ADMIN_COPY.inGame} · ${game}`}</span>;
}

function RoomStatusBadge({ room }: { room: AdminLiveRoom }) {
  return (
    <span
      className={
        room.status === 'PLAYING'
          ? 'bg-wanas-success-surface text-wanas-success-dark inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
          : 'bg-wanas-surface-muted text-wanas-text-secondary inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
      }
    >
      {room.status === 'PLAYING' ? ADMIN_COPY.inGame : ADMIN_COPY.lobby}
    </span>
  );
}

export function AdminRoomsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const locked = searchParams.get('locked') ?? '';
  const page = pageFromQuery(searchParams.get('page'));
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftLocked, setDraftLocked] = useState(locked);
  const [data, setData] = useState<AdminRoomsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraftQuery(query);
      setDraftLocked(locked);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [locked, query]);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    try {
      const result = await fetchAdminRooms({
        q: query || undefined,
        locked: locked || undefined,
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
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [locked, page, query]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden && !inFlightRef.current) {
        void load();
      }
    }, ADMIN_DASHBOARD_POLL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  function navigate(nextPage: number, nextQuery = query, nextLocked = locked) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) {
      params.set('q', nextQuery.trim());
    }
    if (nextLocked === 'true' || nextLocked === 'false') {
      params.set('locked', nextLocked);
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    const suffix = params.toString();
    router.push(suffix ? `${pathname}?${suffix}` : pathname);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-wanas-text-primary text-2xl font-bold">{ADMIN_COPY.roomsTitle}</h1>
          {data ? (
            <p className="text-wanas-text-muted mt-1 text-sm">{data.total} غرفة نشطة</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="border-wanas-border inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>

      <form
        className="border-wanas-border bg-wanas-surface mt-6 grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(1, draftQuery, draftLocked);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.searchLabel}</span>
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="رمز الغرفة أو اسم اللاعب"
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{ADMIN_COPY.lockState}</span>
          <select
            value={draftLocked}
            onChange={(event) => setDraftLocked(event.target.value)}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3"
          >
            <option value="">{ADMIN_COPY.allLockStates}</option>
            <option value="true">{ADMIN_COPY.locked}</option>
            <option value="false">{ADMIN_COPY.open}</option>
          </select>
        </label>
        <button
          type="submit"
          className="border-wanas-border inline-flex h-11 items-center justify-center self-end rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.searchCta}
        </button>
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
          {ADMIN_COPY.emptyRooms}
        </p>
      ) : null}

      {data && data.rooms.length > 0 ? (
        <>
          <div className="border-wanas-border mt-8 hidden overflow-x-auto rounded-2xl border md:block">
            <table className="w-full min-w-[1080px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">الرمز</th>
                  <th className="px-3 py-3 font-semibold">{ADMIN_COPY.host}</th>
                  <th className="px-3 py-3 font-semibold">الحالة</th>
                  <th className="px-3 py-3 font-semibold">اللعبة الحالية</th>
                  <th className="px-3 py-3 font-semibold">{ADMIN_COPY.capacity}</th>
                  <th className="px-3 py-3 font-semibold">الحضور</th>
                  <th className="px-3 py-3 font-semibold">القفل</th>
                  <th className="px-3 py-3 font-semibold">أُنشئت</th>
                  <th className="px-3 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room) => (
                  <tr key={room.id} className="border-wanas-border border-t">
                    <td className="px-3 py-3 font-semibold">
                      <Link href={adminRoomPath(room.id)} className="font-mono underline">
                        {room.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{room.hostDisplayName}</td>
                    <td className="px-3 py-3">
                      <RoomStatusBadge room={room} />
                    </td>
                    <td className="px-3 py-3">
                      <RoomActivity room={room} />
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {room.playerCount} / {room.playerCap}
                    </td>
                    <td className="text-wanas-text-secondary px-3 py-3">
                      {room.connectedCount} {ADMIN_COPY.connected} · {room.disconnectedCount}{' '}
                      {ADMIN_COPY.disconnected} · {room.spectatorCount} {ADMIN_COPY.spectators}
                    </td>
                    <td className="px-3 py-3">
                      {room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}
                    </td>
                    <td className="text-wanas-text-secondary whitespace-nowrap px-3 py-3">
                      {formatAdminDateTime(room.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Link href={adminRoomSpectatePath(room.id)} className="font-semibold underline">
                        {ADMIN_COPY.spectateLive}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 space-y-3 md:hidden">
            {data.rooms.map((room) => (
              <article
                key={room.id}
                className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-lg font-bold">{room.code}</p>
                  <RoomStatusBadge room={room} />
                </div>
                <p className="mt-2 font-semibold">{room.hostDisplayName}</p>
                <p className="text-wanas-text-muted mt-1">
                  <RoomActivity room={room} />
                </p>
                <p className="text-wanas-text-secondary mt-2">
                  {room.playerCount} / {room.playerCap} ·{' '}
                  {room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href={adminRoomPath(room.id)} className="font-semibold underline">
                    {ADMIN_COPY.openRoom}
                  </Link>
                  <Link href={adminRoomSpectatePath(room.id)} className="font-semibold underline">
                    {ADMIN_COPY.spectateLive}
                  </Link>
                </div>
              </article>
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
