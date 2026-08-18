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
import { ADMIN_ROUTES } from '@/lib/admin/routes';

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

  confirmOpenRef.current = kickTarget !== null || closeOpen;

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
    void load();

    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current || confirmOpenRef.current) {
        return;
      }
      void load();
    }, ADMIN_DASHBOARD_POLL_MS);

    return () => {
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
    return <p className="text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>;
  }

  if (missing) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm font-semibold text-wanas-error">
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
        <Link href={ADMIN_ROUTES.rooms} className="text-sm font-semibold text-wanas-text-secondary underline">
          {ADMIN_COPY.backToRooms}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.roomDetails}</h1>
        <p className="mt-1 text-lg font-semibold tracking-wide">{room.code}</p>
        <p className="mt-1 font-mono text-[11px] text-wanas-text-muted">{room.id}</p>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm font-semibold text-wanas-error">
          {actionError}
        </p>
      ) : null}

      <section className="rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm">
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
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void handleLockToggle();
          }}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold hover:bg-wanas-surface-soft disabled:opacity-60"
        >
          {room.isLocked ? ADMIN_COPY.unlockRoom : ADMIN_COPY.lockRoom}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setCloseOpen(true)}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-wanas-error-border bg-wanas-error-surface px-4 text-sm font-semibold text-wanas-error disabled:opacity-60"
        >
          {ADMIN_COPY.closeRoom}
        </button>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold hover:bg-wanas-surface-soft"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">{ADMIN_COPY.players}</h2>
        <ul className="divide-y divide-wanas-border overflow-hidden rounded-2xl border border-wanas-border bg-wanas-surface">
          {room.players.map((player) => (
            <li
              key={player.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <p className="font-semibold">
                  {player.displayName}
                  {player.isHost ? (
                    <span className="ms-2 text-xs text-wanas-text-muted">{ADMIN_COPY.host}</span>
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
                className="inline-flex h-11 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold hover:bg-wanas-surface-soft disabled:opacity-60"
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
          <div className="w-full max-w-md rounded-2xl border border-wanas-border bg-wanas-surface p-5">
            <p id="admin-kick-title" className="text-base font-bold">
              {ADMIN_COPY.kickConfirm}
            </p>
            <p id="admin-kick-desc" className="mt-2 text-sm text-wanas-text-secondary">
              {kickTarget.name}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void handleKick();
                }}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-wanas-error-border bg-wanas-error-surface text-sm font-semibold text-wanas-error"
              >
                {ADMIN_COPY.kickConfirmCta}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setKickTarget(null)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-wanas-border text-sm font-semibold"
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
          <div className="w-full max-w-md rounded-2xl border border-wanas-error-border bg-wanas-surface p-5">
            <p id="admin-close-title" className="text-base font-bold text-wanas-error">
              {ADMIN_COPY.closeConfirmTitle}
            </p>
            <p className="mt-3 text-sm text-wanas-text-primary">
              سيتم إغلاق الغرفة {room.code} نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void handleForceClose();
                }}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-wanas-error-border bg-wanas-error-surface text-sm font-semibold text-wanas-error"
              >
                {ADMIN_COPY.closeConfirmCta}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setCloseOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-wanas-border text-sm font-semibold"
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
