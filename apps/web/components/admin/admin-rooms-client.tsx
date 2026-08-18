'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ADMIN_DASHBOARD_POLL_MS, type AdminRoomDetails } from '@wanasatna/shared';
import { fetchAdminRooms } from '@/lib/admin/api';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { adminRoomPath } from '@/lib/admin/routes';

function RoomActivity({ room }: { room: AdminRoomDetails }) {
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

export function AdminRoomsClient() {
  const [rooms, setRooms] = useState<AdminRoomDetails[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      const result = await fetchAdminRooms();
      if (!result.ok) {
        setError(true);
        return;
      }

      setRooms(result.data.rooms);
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

  if (loading && rooms.length === 0) {
    return <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>;
  }

  if (error && rooms.length === 0) {
    return (
      <div className="mt-8 space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
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
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.roomsTitle}</h1>
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

      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface px-4 py-3">
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

      {rooms.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
          {ADMIN_COPY.emptyRooms}
        </p>
      ) : (
        <>
          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-wanas-border md:block">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">الرمز</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.host}</th>
                  <th className="px-3 py-2 font-semibold">الحالة</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.capacity}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.connected}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.disconnected}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.spectators}</th>
                  <th className="px-3 py-2 font-semibold">أُنشئت</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t border-wanas-border">
                    <td className="px-3 py-2 font-semibold">
                      <Link
                        href={adminRoomPath(room.id)}
                        className="underline decoration-wanas-border underline-offset-4 hover:text-wanas-accent"
                      >
                        {room.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{room.hostDisplayName}</td>
                    <td className="px-3 py-2">
                      <RoomActivity room={room} />
                      <span className="mt-0.5 block text-xs text-wanas-text-muted">
                        {room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {room.playerCount} / {room.playerCap}
                    </td>
                    <td className="px-3 py-2">{room.connectedCount}</td>
                    <td className="px-3 py-2">{room.disconnectedCount}</td>
                    <td className="px-3 py-2">{room.spectatorCount}</td>
                    <td className="px-3 py-2">{formatAdminDateTime(room.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 space-y-3 md:hidden">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={adminRoomPath(room.id)}
                className="block rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
              >
                <p className="font-bold">{room.code}</p>
                <p className="mt-1 text-wanas-text-secondary">{room.hostDisplayName}</p>
                <p className="mt-2">
                  <RoomActivity room={room} />
                </p>
                <p className="mt-2 text-wanas-text-muted">
                  {room.playerCount} / {room.playerCap} · {room.connectedCount} {ADMIN_COPY.connected} ·{' '}
                  {room.disconnectedCount} {ADMIN_COPY.disconnected} · {room.spectatorCount}{' '}
                  {ADMIN_COPY.spectators}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
