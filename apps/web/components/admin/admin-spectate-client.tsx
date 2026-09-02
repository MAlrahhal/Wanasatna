'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  AdminActionResponse,
  AdminRoomDetails,
  AdminSpectateData,
  GameShellState,
} from '@wanasatna/shared';
import {
  ADMIN_SPECTATE_JOIN_EVENT,
  ADMIN_SPECTATE_LEAVE_EVENT,
  ADMIN_SPECTATE_SYNC_EVENT,
  BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
  DRAW_GUESS_CANVAS_UPDATED_EVENT,
  DRAW_GUESS_PHASE_CHANGED_EVENT,
  FAST_ANSWER_PHASE_CHANGED_EVENT,
  GAME_SHELL_NAVIGATE_EVENT,
  GAME_SHELL_STATE_EVENT,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
  HOST_CHANGED_EVENT,
  IMPOSTER_DRAW_CANVAS_UPDATED_EVENT,
  IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
  JUDGE_PHASE_CHANGED_EVENT,
  MARATHON_STATE_EVENT,
  ROOM_CLOSED_EVENT,
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  ROOM_UPDATED_EVENT,
  TEAM_SNAPSHOT_EVENT,
  TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
  WHO_WROTE_IT_PHASE_CHANGED_EVENT,
} from '@wanasatna/shared';
import { AdminSpectateLiveView } from '@/components/admin/admin-spectate-live-view';
import { GameLeaderboardPanel } from '@/components/game-experience/game-leaderboard-panel';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { adminGameTitle } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminRoomPath } from '@/lib/admin/routes';
import { createAdminSpectateSocket } from '@/lib/admin/spectate-socket';
import { mapLockedMatchLeaderboard } from '@/lib/game/map-locked-match-leaderboard';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';

const LIVE_SYNC_EVENTS = [
  ROOM_UPDATED_EVENT,
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  HOST_CHANGED_EVENT,
  GAME_SHELL_STATE_EVENT,
  GAME_SHELL_NAVIGATE_EVENT,
  MARATHON_STATE_EVENT,
  TEAM_SNAPSHOT_EVENT,
  BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
  DRAW_GUESS_PHASE_CHANGED_EVENT,
  DRAW_GUESS_CANVAS_UPDATED_EVENT,
  IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
  IMPOSTER_DRAW_CANVAS_UPDATED_EVENT,
  TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
  FAST_ANSWER_PHASE_CHANGED_EVENT,
  WHO_WROTE_IT_PHASE_CHANGED_EVENT,
  JUDGE_PHASE_CHANGED_EVENT,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
] as const;

function emitAck<T>(socket: Socket, event: string, payload?: unknown): Promise<AdminActionResponse<T>> {
  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (error: unknown, response?: unknown) => {
      const candidate = response ?? error;
      if (
        candidate &&
        typeof candidate === 'object' &&
        'success' in candidate &&
        typeof (candidate as { success: unknown }).success === 'boolean'
      ) {
        resolve(candidate as AdminActionResponse<T>);
        return;
      }
      resolve({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: ADMIN_COPY.spectateUnavailable },
      });
    });
  });
}

function toLobbyPlayers(room: AdminRoomDetails): LobbyPlayer[] {
  return room.players.map((player) => ({
    id: player.id,
    name: player.displayName,
    isHost: player.isHost,
    isSpectator: player.isSpectator,
    isConnected: player.status === 'CONNECTED',
  }));
}

function CompactChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'bg-wanas-surface-soft inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}

function CompactRoomPanel({ data }: { data: AdminSpectateData }) {
  const { room, shell, marathon, teams, pluginView } = data;
  const lobbyPlayers = useMemo(() => toLobbyPlayers(room), [room]);
  const scoreboard = useMemo(
    () =>
      mapLockedMatchLeaderboard(
        pluginView?.view as Parameters<typeof mapLockedMatchLeaderboard>[0],
        '',
        lobbyPlayers,
      ),
    [lobbyPlayers, pluginView],
  );

  const teamNames = useMemo(() => {
    if (!teams?.assignments.length) {
      return null;
    }
    const names = new Map(room.players.map((player) => [player.id, player.displayName]));
    const blue = teams.assignments
      .filter((row) => row.teamId === 'blue')
      .map((row) => names.get(row.playerId) ?? 'لاعب');
    const red = teams.assignments
      .filter((row) => row.teamId === 'red')
      .map((row) => names.get(row.playerId) ?? 'لاعب');
    return { blue, red };
  }, [room.players, teams]);

  return (
    <aside className="min-w-0 space-y-3 lg:sticky lg:top-4">
      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3">
        <h2 className="mb-2 text-xs font-semibold text-[color:var(--wanas-game-text-secondary)]">
          {ADMIN_COPY.players}
        </h2>
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {room.players.map((player) => (
            <li
              key={player.id}
              className="border-wanas-border flex items-center gap-2 rounded-xl border px-2 py-1.5"
            >
              <PlayerAvatar
                playerId={player.id}
                playerName={player.displayName}
                className="size-8"
                sizes="32px"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{player.displayName}</p>
                <p className="text-wanas-text-muted text-[11px]">
                  {player.status === 'CONNECTED' ? ADMIN_COPY.connected : ADMIN_COPY.disconnected}
                </p>
              </div>
              {player.isHost ? (
                <span className="text-wanas-text-muted shrink-0 text-[10px] font-semibold">
                  {ADMIN_COPY.host}
                </span>
              ) : null}
              {player.isSpectator ? (
                <span className="text-wanas-text-muted shrink-0 text-[10px] font-semibold">
                  {ADMIN_COPY.spectator}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {teamNames ? (
        <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 text-xs">
          <p className="mb-2 font-semibold">الفِرق</p>
          <p className="text-wanas-text-secondary">الأزرق: {teamNames.blue.join('، ') || '—'}</p>
          <p className="text-wanas-text-secondary mt-1">الأحمر: {teamNames.red.join('، ') || '—'}</p>
        </section>
      ) : null}

      {scoreboard.length > 0 ? (
        <GameLeaderboardPanel entries={scoreboard} className="max-h-72" />
      ) : null}

      <section className="border-wanas-border bg-wanas-surface space-y-1 rounded-2xl border p-3 text-xs">
        <p>
          <span className="text-wanas-text-muted">{ADMIN_COPY.host}: </span>
          {room.hostDisplayName}
        </p>
        <p>
          <span className="text-wanas-text-muted">{ADMIN_COPY.capacity}: </span>
          {room.playerCount} / {room.playerCap}
        </p>
        <p>
          {room.connectedCount} {ADMIN_COPY.connected} · {room.spectatorCount} {ADMIN_COPY.spectators}
        </p>
        {shell ? <ShellSummary shell={shell} /> : null}
        {marathon ? (
          <p className="text-wanas-text-secondary">
            ماراثون · اللعبة {marathon.currentGameIndex + 1} / {marathon.gamePlan.length}
          </p>
        ) : null}
        <Link href={adminRoomPath(room.id)} className="inline-block pt-1 font-semibold underline">
          {ADMIN_COPY.roomDetails}
        </Link>
      </section>
    </aside>
  );
}

function ShellSummary({ shell }: { shell: GameShellState }) {
  return (
    <p className="text-wanas-text-secondary">
      {adminGameTitle(shell.gameId)} · {shell.phase}
      {shell.countdownRemainingSeconds != null ? ` · ${shell.countdownRemainingSeconds}ث` : ''}
    </p>
  );
}

function SpectateHeader({
  data,
  connected,
}: {
  data: AdminSpectateData;
  connected: boolean;
}) {
  const { room } = data;
  const statusLabel = room.activity === 'IN_GAME' ? ADMIN_COPY.inGame : ADMIN_COPY.lobby;
  const gameLabel = adminGameTitle(room.gameId ?? data.shell?.gameId);

  return (
    <header className="border-wanas-border bg-wanas-surface flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2">
      <p className="bg-wanas-surface-soft inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold">
        {ADMIN_COPY.spectateBanner}
      </p>
      <p className="text-sm font-bold tracking-wide">{room.code}</p>
      <CompactChip>{statusLabel}</CompactChip>
      {gameLabel !== '—' ? <CompactChip>{gameLabel}</CompactChip> : null}
      <CompactChip className={connected ? 'text-wanas-success-dark' : 'text-wanas-error'}>
        {connected ? ADMIN_COPY.spectateConnectionLive : ADMIN_COPY.spectateConnectionLost}
      </CompactChip>
      <CompactChip>
        {room.playerCount} {ADMIN_COPY.players} · {room.spectatorCount} {ADMIN_COPY.spectators}
      </CompactChip>
      <p className="text-wanas-text-muted hidden text-[11px] sm:inline">{ADMIN_COPY.spectateReadOnly}</p>
      <div className="ms-auto flex flex-wrap gap-2">
        <Link
          href={ADMIN_ROUTES.rooms}
          className="border-wanas-border inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold"
        >
          {ADMIN_COPY.spectateBackToAdmin}
        </Link>
      </div>
    </header>
  );
}

export function AdminSpectateClient() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const socketRef = useRef<Socket | null>(null);
  const [data, setData] = useState<AdminSpectateData | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'closed' | 'error'>('connecting');
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: AdminSpectateData) => {
    setData(snapshot);
    setStatus('live');
    setErrorMessage(null);
  }, []);

  const joinRoom = useCallback(
    async (socket: Socket) => {
      const result = await emitAck<AdminSpectateData>(socket, ADMIN_SPECTATE_JOIN_EVENT, { roomId });
      if (!result.success) {
        if (result.error.code === 'ROOM_CLOSED') {
          setStatus('closed');
          setErrorMessage(result.error.message);
          return;
        }
        setStatus('error');
        setErrorMessage(
          result.error.code === 'UNAUTHORIZED' || result.error.code === 'FORBIDDEN'
            ? ADMIN_COPY.spectateDenied
            : result.error.message,
        );
        return;
      }
      applySnapshot(result.data);
    },
    [applySnapshot, roomId],
  );

  const syncRoom = useCallback(async (socket: Socket) => {
    const result = await emitAck<AdminSpectateData>(socket, ADMIN_SPECTATE_SYNC_EVENT);
    if (!result.success) {
      if (result.error.code === 'ROOM_CLOSED' || result.error.code === 'ROOM_NOT_FOUND') {
        setStatus('closed');
        setErrorMessage(result.error.message);
      }
      return;
    }
    applySnapshot(result.data);
  }, [applySnapshot]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const socket = createAdminSpectateSocket();
    socketRef.current = socket;

    const onClosed = () => {
      setStatus('closed');
      setErrorMessage(ADMIN_COPY.spectateClosedHint);
    };

    const onLiveEvent = () => {
      void syncRoom(socket);
    };

    socket.on('connect', () => {
      setConnected(true);
      void joinRoom(socket);
    });
    socket.on('disconnect', () => {
      setConnected(false);
    });
    socket.on(ROOM_CLOSED_EVENT, onClosed);
    for (const event of LIVE_SYNC_EVENTS) {
      socket.on(event, onLiveEvent);
    }

    socket.connect();

    return () => {
      socket.off(ROOM_CLOSED_EVENT, onClosed);
      for (const event of LIVE_SYNC_EVENTS) {
        socket.off(event, onLiveEvent);
      }
      void emitAck(socket, ADMIN_SPECTATE_LEAVE_EVENT);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [joinRoom, roomId, syncRoom]);

  if (status === 'connecting' && !data) {
    return <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.spectateConnecting}</p>;
  }

  if (status === 'error' && !data) {
    return (
      <div className="space-y-3 overflow-x-hidden">
        <p role="alert" className="text-wanas-error text-sm font-semibold">
          {errorMessage ?? ADMIN_COPY.spectateUnavailable}
        </p>
        <Link href={ADMIN_ROUTES.rooms} className="text-sm font-semibold underline">
          {ADMIN_COPY.spectateBackToAdmin}
        </Link>
      </div>
    );
  }

  if (status === 'closed') {
    return (
      <div className="-mt-4 space-y-3 overflow-x-hidden">
        <p className="bg-wanas-surface-soft inline-flex rounded-full px-3 py-1 text-xs font-semibold">
          {ADMIN_COPY.spectateBanner}
        </p>
        <h1 className="text-xl font-bold">{ADMIN_COPY.spectateClosed}</h1>
        <p className="text-wanas-text-secondary text-sm">{errorMessage ?? ADMIN_COPY.spectateClosedHint}</p>
        <Link
          href={ADMIN_ROUTES.rooms}
          className="border-wanas-border inline-flex h-11 items-center rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.spectateBackToAdmin}
        </Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="-mt-4 flex min-h-0 flex-col gap-3 overflow-x-hidden">
      <SpectateHeader data={data} connected={connected} />
      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start">
        <div className="min-w-0">
          <AdminSpectateLiveView data={data} />
        </div>
        <CompactRoomPanel data={data} />
      </div>
    </div>
  );
}
