'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  AdminActionResponse,
  AdminRoomDetails,
  AdminSpectateData,
  DrawStroke,
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
import { ADMIN_COPY } from '@/lib/admin/copy';
import { adminGameTitle } from '@/lib/admin/format';
import { ADMIN_ROUTES, adminRoomPath } from '@/lib/admin/routes';
import { createAdminSpectateSocket } from '@/lib/admin/spectate-socket';
import { DrawingCanvas } from '@/plugins/draw-guess/drawing-canvas';

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

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStrokes(value: unknown): DrawStroke[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const strokes: DrawStroke[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const stroke = item as DrawStroke;
    if (typeof stroke.id !== 'string' || !Array.isArray(stroke.points)) {
      return null;
    }
    strokes.push(stroke);
  }
  return strokes;
}

function Scoreboard({ view }: { view: Record<string, unknown> }) {
  const rows = [view.leaderboard, view.resultsLeaderboard].find((value) => Array.isArray(value) && value.length > 0);
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4">
      <h2 className="mb-3 text-lg font-bold">{ADMIN_COPY.spectateScoreboard}</h2>
      <ul className="space-y-2 text-sm">
        {rows.map((row, index) => {
          if (!row || typeof row !== 'object') {
            return null;
          }
          const entry = row as Record<string, unknown>;
          const name = textValue(entry.name) ?? textValue(entry.playerName) ?? 'لاعب';
          const score = entry.score ?? entry.points ?? entry.total ?? '—';
          return (
            <li key={textValue(entry.playerId) ?? `${name}-${index}`} className="flex justify-between gap-3">
              <span>{name}</span>
              <span className="tabular-nums">{String(score)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PluginViewPanel({
  gameId,
  view,
}: {
  gameId: string;
  view: Record<string, unknown>;
}) {
  const phaseLabel = textValue(view.phaseLabel);
  const instruction = textValue(view.instruction);
  const question = textValue(view.question) ?? textValue(view.prompt);
  const category = textValue(view.categoryLabel) ?? textValue(view.categoryName);
  const round = numberValue(view.currentRound);
  const total = numberValue(view.totalRounds);
  const strokes = asStrokes(view.strokes);

  return (
    <div className="space-y-4">
      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm">
        <p className="font-semibold">{adminGameTitle(gameId)}</p>
        {phaseLabel ? <p className="text-wanas-text-secondary mt-1">{phaseLabel}</p> : null}
        {round && total ? (
          <p className="text-wanas-text-muted mt-1">
            الجولة {round} / {total}
          </p>
        ) : null}
        {category ? <p className="text-wanas-text-muted mt-1">{category}</p> : null}
        {instruction ? <p className="mt-2">{instruction}</p> : null}
        {question ? <p className="mt-2 font-semibold">{question}</p> : null}
      </section>
      {strokes ? (
        <div className="border-wanas-border bg-wanas-surface pointer-events-none overflow-hidden rounded-2xl border">
          <DrawingCanvas strokes={strokes} readOnly className="w-full" />
        </div>
      ) : null}
      <Scoreboard view={view} />
    </div>
  );
}

function RoomRoster({ room }: { room: AdminRoomDetails }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{ADMIN_COPY.players}</h2>
      <ul className="divide-wanas-border border-wanas-border bg-wanas-surface divide-y overflow-hidden rounded-2xl border">
        {room.players.map((player) => (
          <li key={player.id} className="px-4 py-3 text-sm">
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
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShellSummary({ shell }: { shell: GameShellState }) {
  return (
    <p className="text-wanas-text-secondary text-sm">
      {adminGameTitle(shell.gameId)} · {shell.phase}
      {shell.countdownRemainingSeconds != null ? ` · ${shell.countdownRemainingSeconds}ث` : ''}
    </p>
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
      <div className="space-y-4">
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
      <div className="space-y-4">
        <p className="bg-wanas-surface-soft inline-flex rounded-full px-3 py-1 text-xs font-semibold">
          {ADMIN_COPY.spectateBanner}
        </p>
        <h1 className="text-2xl font-bold">{ADMIN_COPY.spectateClosed}</h1>
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

  const { room, shell, marathon, pluginView } = data;
  const activityLabel =
    room.activity === 'IN_GAME'
      ? `${ADMIN_COPY.inGame}${room.gameId ? ` · ${adminGameTitle(room.gameId)}` : ''}`
      : ADMIN_COPY.lobby;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="bg-wanas-surface-soft inline-flex rounded-full px-3 py-1 text-xs font-semibold">
          {ADMIN_COPY.spectateBanner}
        </p>
        <p
          className={
            connected
              ? 'text-wanas-success-dark text-xs font-semibold'
              : 'text-wanas-error text-xs font-semibold'
          }
        >
          {connected ? ADMIN_COPY.spectateConnectionLive : ADMIN_COPY.spectateConnectionLost}
        </p>
      </div>

      <div>
        <Link href={ADMIN_ROUTES.rooms} className="text-wanas-text-secondary text-sm font-semibold underline">
          {ADMIN_COPY.spectateBackToAdmin}
        </Link>
        <Link href={adminRoomPath(room.id)} className="text-wanas-text-secondary ms-4 text-sm font-semibold underline">
          {ADMIN_COPY.roomDetails}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">{ADMIN_COPY.spectateTitle}</h1>
        <p className="mt-1 text-lg font-semibold tracking-wide">{room.code}</p>
        <p className="text-wanas-text-muted mt-2 text-sm">{ADMIN_COPY.spectateReadOnly}</p>
      </div>

      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-wanas-text-muted">{ADMIN_COPY.host}</dt>
            <dd>{room.hostDisplayName}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">الحالة الحالية</dt>
            <dd>{room.status === 'PLAYING' ? ADMIN_COPY.inGame : ADMIN_COPY.lobby}</dd>
          </div>
          <div>
            <dt className="text-wanas-text-muted">النشاط</dt>
            <dd>{activityLabel}</dd>
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
          <div>
            <dt className="text-wanas-text-muted">القفل</dt>
            <dd>{room.isLocked ? ADMIN_COPY.locked : ADMIN_COPY.open}</dd>
          </div>
        </dl>
        {shell ? <div className="mt-3">{<ShellSummary shell={shell} />}</div> : null}
        {marathon ? (
          <p className="text-wanas-text-secondary mt-2 text-sm">
            ماراثون · {marathon.status} · اللعبة {marathon.currentGameIndex + 1} / {marathon.gamePlan.length}
          </p>
        ) : null}
      </section>

      <RoomRoster room={room} />

      {pluginView ? (
        <PluginViewPanel gameId={pluginView.gameId} view={pluginView.view} />
      ) : shell ? (
        <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.spectateNoRuntime}</p>
      ) : (
        <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.spectateLobbyState}</p>
      )}

      <Link
        href={ADMIN_ROUTES.rooms}
        className="border-wanas-border inline-flex h-11 items-center rounded-xl border px-4 text-sm font-semibold"
      >
        {ADMIN_COPY.spectateBackToAdmin}
      </Link>
    </div>
  );
}
