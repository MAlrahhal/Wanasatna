'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ADMIN_DASHBOARD_POLL_MS, type AdminRoomDetails } from '@wanasatna/shared';
import {
  fetchAdminRoom,
  forceCloseAdminRoom,
  kickAdminPlayer,
  lockAdminRoom,
  unlockAdminRoom,
} from '@/lib/admin/api';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminRoomHistoryPath, adminRoomSpectatePath } from '@/lib/admin/routes';

export function AdminRoomDetailClient() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [room, setRoom] = useState<AdminRoomDetails | null>(null);
  const [error, setError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const inFlightRef = useRef(false);
  const confirmOpenRef = useRef(false);

  useEffect(() => {
    confirmOpenRef.current = kickTarget !== null || closeOpen;
  }, [closeOpen, kickTarget]);

  useEffect(() => {
    if (!kickTarget && !closeOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || pending) {
        return;
      }
      setKickTarget(null);
      setCloseOpen(false);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [kickTarget, closeOpen, pending]);

  const load = useCallback(async () => {
    if (!roomId || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      const result = await fetchAdminRoom(roomId);
      if (!result.ok) {
        if (result.status === 404) {
          setMissing(true);
          setRoom(null);
          setError(false);
          return;
        }
        setError(true);
        return;
      }

      setRoom(result.data);
      setMissing(false);
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);

    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current || confirmOpenRef.current) {
        return;
      }
      void load();
    }, ADMIN_DASHBOARD_POLL_MS);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  async function handleLockToggle() {
    if (!room || pending) {
      return;
    }
    setPending(true);
    setActionError(null);
    const result = room.isLocked ? await unlockAdminRoom(room.id) : await lockAdminRoom(room.id);
    setPending(false);
    if (!result.ok) {
      setActionError(result.message ?? ADMIN_COPY.actionFailed);
      return;
    }
    await load();
  }

  async function handleKick() {
    if (!room || !kickTarget || pending) {
      return;
    }
    setPending(true);
    setActionError(null);
    const result = await kickAdminPlayer(room.id, kickTarget.id);
    setPending(false);
    setKickTarget(null);
    if (!result.ok) {
      setActionError(result.message ?? ADMIN_COPY.actionFailed);
      return;
    }
    if (result.data.roomDeleted) {
      router.replace(ADMIN_ROUTES.rooms);
      return;
    }
    await load();
  }

  async function handleForceClose() {
    if (!room || pending) {
      return;
    }
    setPending(true);
    setActionError(null);
    const result = await forceCloseAdminRoom(room.id);
    setPending(false);
    setCloseOpen(false);
    if (!result.ok) {
      setActionError(result.message ?? ADMIN_COPY.actionFailed);
      return;
    }
    router.replace(ADMIN_ROUTES.rooms);
  }

  if (loading && !room) {
    return <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.resolving}</p>;
  }

  if (missing) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-wanas-error text-sm font-semibold">
          {ADMIN_COPY.roomMissing}
        </p>
        <Link href={ADMIN_ROUTES.rooms} className="text-sm font-semibold underline">
          {ADMIN_COPY.backToRooms}
        </Link>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="border-wanas-error-border bg-wanas-error-surface space-y-3 rounded-2xl border p-4">
        <p role="alert" className="text-wanas-error text-sm font-semibold">
          {ADMIN_COPY.loadFailed}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="border-wanas-border bg-wanas-surface inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.retry}
        </button>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  const activityLabel =
    room.activity === 'IN_GAME'
      ? `${ADMIN_COPY.inGame}${room.gameId ? ` · ${adminGameTitle(room.gameId)}` : ''}`
      : ADMIN_COPY.lobby;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={ADMIN_ROUTES.rooms}
          className="text-wanas-text-secondary text-sm font-semibold underline"
        >
          {ADMIN_COPY.backToRooms}
        </Link>
        <h1 className="text-wanas-text-primary mt-3 text-2xl font-bold">
          {ADMIN_COPY.roomDetails}
        </h1>
        <p className="mt-1 text-lg font-semibold tracking-wide">{room.code}</p>
        <p className="text-wanas-text-muted mt-1 font-mono text-[11px]">{room.id}</p>
        {room.historyId ? (
          <Link
            href={adminRoomHistoryPath(room.historyId)}
            className="mt-2 inline-block text-sm font-semibold underline"
          >
            فتح السجل الدائم للغرفة
          </Link>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="text-wanas-error text-sm font-semibold">
          {actionError}
        </p>
      ) : null}

      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-wanas-text-muted">أُنشئت</dt>
            <dd>{formatAdminDateTime(room.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">القفل</dt>
            <dd>{room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">النشاط</dt>
            <dd>{activityLabel}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">الحالة الحالية</dt>
            <dd>{room.status === 'PLAYING' ? ADMIN_COPY.inGame : ADMIN_COPY.lobby}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.host}</dt>
            <dd>{room.hostDisplayName}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.capacity}</dt>
            <dd>
              {room.playerCount} / {room.playerCap}
            </dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">الحضور</dt>
            <dd>
              {room.connectedCount} {ADMIN_COPY.connected} · {room.disconnectedCount}{' '}
              {ADMIN_COPY.disconnected} · {room.spectatorCount} {ADMIN_COPY.spectators}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={adminRoomSpectatePath(room.id)}
          className="border-wanas-border hover:bg-wanas-surface-soft inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.spectateLive}
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void handleLockToggle();
          }}
          className="border-wanas-border hover:bg-wanas-surface-soft inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-60"
        >
          {room.isLocked ? ADMIN_COPY.unlockRoom : ADMIN_COPY.lockRoom}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setCloseOpen(true)}
          className="border-wanas-error-border bg-wanas-error-surface text-wanas-error inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-60"
        >
          {ADMIN_COPY.closeRoom}
        </button>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="border-wanas-border hover:bg-wanas-surface-soft inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">{ADMIN_COPY.players}</h2>
        <ul className="divide-wanas-border border-wanas-border bg-wanas-surface divide-y overflow-hidden rounded-2xl border">
          {room.players.map((player) => (
            <li
              key={player.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <p className="font-semibold">
                  {player.displayName}
                  {player.isHost ? (
                    <span className="text-wanas-text-muted ms-2 text-xs">{ADMIN_COPY.host}</span>
                  ) : null}
                </p>
                <p className="text-wanas-text-muted">
                  {player.status === 'CONNECTED' ? ADMIN_COPY.connected : ADMIN_COPY.disconnected}
                  {player.isSpectator ? ` · ${ADMIN_COPY.spectator}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setKickTarget({ id: player.id, name: player.displayName })}
                className="border-wanas-border hover:bg-wanas-surface-soft inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold disabled:opacity-60"
              >
                {ADMIN_COPY.kickPlayer}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {kickTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-kick-title"
          aria-describedby="admin-kick-desc"
        >
          <div className="border-wanas-border bg-wanas-surface w-full max-w-md rounded-2xl border p-5">
            <p id="admin-kick-title" className="text-base font-bold">
              {ADMIN_COPY.kickConfirm}
            </p>
            <p id="admin-kick-desc" className="text-wanas-text-secondary mt-2 text-sm">
              {kickTarget.name}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void handleKick();
                }}
                className="border-wanas-error-border bg-wanas-error-surface text-wanas-error inline-flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
              >
                {ADMIN_COPY.kickConfirmCta}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setKickTarget(null)}
                className="border-wanas-border inline-flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
              >
                {ADMIN_COPY.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-close-title"
        >
          <div className="border-wanas-error-border bg-wanas-surface w-full max-w-md rounded-2xl border p-5">
            <p id="admin-close-title" className="text-wanas-error text-base font-bold">
              {ADMIN_COPY.closeConfirmTitle}
            </p>
            <p className="text-wanas-text-primary mt-3 text-sm">
              سيتم إغلاق الغرفة {room.code} نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void handleForceClose();
                }}
                className="border-wanas-error-border bg-wanas-error-surface text-wanas-error inline-flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
              >
                {ADMIN_COPY.closeConfirmCta}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setCloseOpen(false)}
                className="border-wanas-border inline-flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold"
              >
                {ADMIN_COPY.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
