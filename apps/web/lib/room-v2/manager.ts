import {
  CREATE_ROOM_EVENT,
  JOIN_ROOM_EVENT,
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  ROOM_SYNC_EVENT,
  HOST_CHANGED_EVENT,
  ROOM_UPDATED_EVENT,
  PLAYER_KICKED_EVENT,
  type HostChangedPayload,
  type PlayerKickedPayload,
  type RoomData,
  type RoomPlayerData,
  type RoomPlayersSnapshotPayload,
  type RoomSessionData,
  type RoomUpdatedPayload,
} from '@wanasatna/shared';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import { disconnectRoomSocket, getRoomSocket, waitForRoomSocketConnection } from '@/lib/room/socket';
import {
  ensureManagerInstanceId,
  getRuntimeId,
  recordContinuity,
} from '@/lib/room-v2/continuity';
import { roomV2Diag } from '@/lib/room-v2/diagnostics';
import { emitRoomAck } from '@/lib/room-v2/emit';
import {
  clearPersistedActiveRoomSession,
  purgeLegacyRoomStorage,
  readPersistedActiveRoomSession,
  writePersistedActiveRoomSession,
} from '@/lib/room-v2/storage';
import type {
  ActiveRoomSession,
  RoomLifecycleStatus,
  RoomV2Result,
} from '@/lib/room-v2/types';

function canonicalizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export type RoomRuntimeSnapshot = {
  room: RoomData | null;
  player: RoomPlayerData | null;
  players: RoomPlayerData[];
};

export type RoomManagerState = {
  status: RoomLifecycleStatus;
  errorMessage: string | null;
  session: ActiveRoomSession | null;
  snapshot: RoomRuntimeSnapshot;
  generation: number;
};

type Listener = (state: RoomManagerState) => void;

function emptySnapshot(): RoomRuntimeSnapshot {
  return { room: null, player: null, players: [] };
}

function sessionFromAck(
  data: RoomSessionData,
  previous: ActiveRoomSession | null,
): ActiveRoomSession | null {
  const reconnectToken = data.reconnectToken ?? previous?.reconnectToken;
  if (!reconnectToken) {
    return null;
  }

  return {
    roomId: data.room.id,
    roomCode: data.room.code,
    playerId: data.player.id,
    playerName: data.player.name,
    reconnectToken,
  };
}

function normalizeRoom(room: RoomData): RoomData {
  return {
    ...room,
    createdAt:
      typeof room.createdAt === 'string' || room.createdAt instanceof Date
        ? room.createdAt
        : new Date(room.createdAt as string),
  };
}

/**
 * Browser-runtime owner of guest Room participation.
 * Not React. Survives route remounts. One instance per tab.
 */
class RoomSessionManager {
  /** Stable id for continuity probes across Home → Lobby. */
  __instanceId?: string;
  private generation = 0;
  private status: RoomLifecycleStatus = 'idle';
  private errorMessage: string | null = null;
  private session: ActiveRoomSession | null = null;
  private snapshot: RoomRuntimeSnapshot = emptySnapshot();
  private listeners = new Set<Listener>();
  private coreListenersBound = false;
  private enterInFlight: 'create' | 'join' | null = null;
  private resumeInFlight: Promise<RoomV2Result<ActiveRoomSession>> | null = null;
  private onTerminal: ((reason: 'kick' | 'closed' | 'leave') => void) | null = null;
  private onSocketManagerReconnect: (() => void) | null = null;
  /** After explicit Leave/Kick — block rewriting Home into /?code=OLD. */
  private explicitLeaveHome = false;
  /** In-memory only: rooms explicitly left this runtime must not resume. */
  private leftRoomIds = new Set<string>();

  constructor() {
    ensureManagerInstanceId(this);
    if (typeof window !== 'undefined') {
      purgeLegacyRoomStorage();
      this.session = readPersistedActiveRoomSession();
      if (this.session) {
        this.status = 'idle';
      }
    }
  }

  getState(): RoomManagerState {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      session: this.session,
      snapshot: this.snapshot,
      generation: this.generation,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediate current snapshot — Provider must not start as null after ACTIVE create.
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Adopt persisted ActiveRoomSession when memory is empty OR diverged from storage.
   * Does not mark ACTIVE — caller decides reuse vs resume.
   */
  rehydrateFromStorageIfNeeded(): void {
    const persisted = readPersistedActiveRoomSession();
    if (!persisted) {
      return;
    }

    // Explicit Leave this runtime — never resurrect that Room from sticky storage.
    if (this.leftRoomIds.has(persisted.roomId)) {
      clearPersistedActiveRoomSession();
      if (this.session?.roomId === persisted.roomId) {
        this.session = null;
      }
      return;
    }

    // Stale in-memory session from a prior Room must never block the Create/Join write.
    if (
      this.session &&
      this.session.roomId === persisted.roomId &&
      this.session.playerId === persisted.playerId
    ) {
      return;
    }

    this.session = persisted;
    if (this.status === 'idle' || this.status === 'error') {
      this.notify();
    }
  }

  /** True when this tab already holds a live bound Room for the URL code (fresh Create/Join). */
  hasLiveActiveRoom(roomCode?: string): boolean {
    if (this.status !== 'active' || !this.session || !this.snapshot.room) {
      return false;
    }

    if (
      roomCode &&
      canonicalizeRoomCode(this.session.roomCode) !== canonicalizeRoomCode(roomCode)
    ) {
      return false;
    }

    return getRoomSocket().connected;
  }

  setTerminalHandler(handler: ((reason: 'kick' | 'closed' | 'leave') => void) | null): void {
    this.onTerminal = handler;
  }

  bumpGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private setSession(session: ActiveRoomSession | null): void {
    this.session = session;
    if (session) {
      writePersistedActiveRoomSession(session);
      roomV2Diag('SESSION_SET', {
        roomCode: session.roomCode,
        roomId: session.roomId,
        playerId: session.playerId,
        generation: this.generation,
      });
    } else {
      clearPersistedActiveRoomSession();
      roomV2Diag('SESSION_CLEAR', { generation: this.generation });
    }
  }

  private clearLocalParticipation(): void {
    this.setSession(null);
    this.snapshot = emptySnapshot();
    this.errorMessage = null;
  }

  private applySessionData(data: RoomSessionData, gen: number): boolean {
    if (gen !== this.generation) {
      roomV2Diag('STALE_OPERATION_DROPPED', {
        roomId: data.room.id,
        roomCode: data.room.code,
        generation: this.generation,
      });
      return false;
    }

    const next = sessionFromAck(data, this.session);
    if (!next) {
      this.status = 'error';
      this.errorMessage = getRoomErrorMessage('INTERNAL_ERROR');
      this.notify();
      return false;
    }

    this.setSession(next);
    this.snapshot = {
      room: normalizeRoom(data.room),
      player: data.player,
      players: data.players,
    };
    this.status = 'active';
    this.errorMessage = null;
    // Successful Create/Join/resume must not keep Leave's invite-suppress flag,
    // or Lobby bootstrap would replaceHomeClean() and bounce back to `/`.
    this.explicitLeaveHome = false;
    this.notify();
    return true;
  }

  private async ensureSocket(): Promise<boolean> {
    const socket = getRoomSocket();
    try {
      // Leave disables Manager reconnection; re-enable for live participation.
      socket.io.reconnection(true);
    } catch {
      /* ignore */
    }
    if (!socket.connected) {
      socket.connect();
      try {
        await waitForRoomSocketConnection(socket, 10_000);
      } catch {
        return false;
      }
    }
    this.bindCoreListeners();
    return true;
  }

  private bindCoreListeners(): void {
    if (this.coreListenersBound) {
      return;
    }

    const socket = getRoomSocket();

    socket.on(ROOM_PLAYERS_SNAPSHOT_EVENT, (payload: RoomPlayersSnapshotPayload) => {
      if (!this.session || payload.roomId !== this.session.roomId) {
        roomV2Diag('FOREIGN_SNAPSHOT_DROPPED', {
          roomId: payload.roomId,
          generation: this.generation,
        });
        return;
      }

      this.snapshot = {
        ...this.snapshot,
        players: payload.players,
        player:
          payload.players.find((p) => p.id === this.session?.playerId) ?? this.snapshot.player,
      };
      this.notify();
    });

    socket.on(HOST_CHANGED_EVENT, (payload: HostChangedPayload) => {
      if (!this.session || payload.roomId !== this.session.roomId) {
        return;
      }

      if (this.snapshot.room) {
        this.snapshot = {
          ...this.snapshot,
          room: { ...this.snapshot.room, hostPlayerId: payload.hostPlayerId },
          player: this.snapshot.player
            ? {
                ...this.snapshot.player,
                isHost: this.snapshot.player.id === payload.hostPlayerId,
              }
            : null,
          players: this.snapshot.players.map((p) => ({
            ...p,
            isHost: p.id === payload.hostPlayerId,
          })),
        };
        this.notify();
      }
    });

    socket.on(ROOM_UPDATED_EVENT, (payload: RoomUpdatedPayload) => {
      if (!this.session || payload.roomId !== this.session.roomId || !this.snapshot.room) {
        return;
      }

      this.snapshot = {
        ...this.snapshot,
        room: { ...this.snapshot.room, isLocked: payload.isLocked },
      };
      this.notify();
    });

    socket.on(PLAYER_KICKED_EVENT, (payload: PlayerKickedPayload) => {
      if (!this.session || payload.roomId !== this.session.roomId) {
        return;
      }

      if (payload.playerId !== this.session.playerId) {
        this.snapshot = {
          ...this.snapshot,
          players: this.snapshot.players.filter((p) => p.id !== payload.playerId),
        };
        this.notify();
        return;
      }

      const gen = this.bumpGeneration();
      void gen;
      this.clearLocalParticipation();
      this.status = 'idle';
      this.notify();
      this.onTerminal?.('kick');
    });

    this.onSocketManagerReconnect = () => {
      roomV2Diag('SOCKET_RECONNECTED', {
        roomCode: this.session?.roomCode,
        generation: this.generation,
      });
      if (this.session && this.status !== 'leaving') {
        void this.resumeSameRoom();
      }
    };
    socket.io.on('reconnect', this.onSocketManagerReconnect);

    socket.on('disconnect', () => {
      roomV2Diag('SOCKET_DISCONNECTED', {
        roomCode: this.session?.roomCode,
        generation: this.generation,
      });
      if (this.session && this.status !== 'leaving') {
        this.status = 'recovering';
        this.notify();
      }
    });

    this.coreListenersBound = true;
  }

  async create(playerName: string): Promise<RoomV2Result<{ roomCode: string }>> {
    if (this.enterInFlight) {
      return {
        success: false,
        error: { code: 'CONNECTION_FAILED', message: getRoomErrorMessage('CONNECTION_FAILED') },
      };
    }

    this.enterInFlight = 'create';
    const gen = this.bumpGeneration();
    this.clearLocalParticipation();
    this.status = 'entering';
    this.notify();
    roomV2Diag('CREATE_START', { generation: gen });
    recordContinuity('CREATE_START', {
      socketId: getRoomSocket().id ?? null,
      managerId: this.__instanceId ?? null,
      status: this.status,
    });

    try {
      if (!(await this.ensureSocket())) {
        this.status = 'error';
        this.errorMessage = getRoomErrorMessage('CONNECTION_FAILED');
        this.notify();
        return {
          success: false,
          error: { code: 'CONNECTION_FAILED', message: this.errorMessage },
        };
      }

      const response = await emitRoomAck<RoomSessionData>(CREATE_ROOM_EVENT, { playerName });

      if (gen !== this.generation) {
        roomV2Diag('STALE_OPERATION_DROPPED', { generation: this.generation });
        return {
          success: false,
          error: { code: 'CONNECTION_FAILED', message: getRoomErrorMessage('CONNECTION_FAILED') },
        };
      }

      if (!response.success) {
        this.status = 'error';
        this.errorMessage = getRoomErrorMessage(
          response.error.code as Parameters<typeof getRoomErrorMessage>[0],
          response.error.message,
        );
        this.notify();
        return { success: false, error: { code: response.error.code, message: this.errorMessage } };
      }

      if (!this.applySessionData(response.data, gen)) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: getRoomErrorMessage('INTERNAL_ERROR') },
        };
      }

      roomV2Diag('CREATE_SUCCESS', {
        roomCode: response.data.room.code,
        roomId: response.data.room.id,
        playerId: response.data.player.id,
        generation: gen,
      });
      recordContinuity('CREATE_SUCCESS', {
        socketId: getRoomSocket().id ?? null,
        managerId: this.__instanceId ?? null,
        roomCode: response.data.room.code,
        playerId: response.data.player.id,
        status: this.status,
        detail: `runtime=${getRuntimeId()}`,
      });

      return { success: true, data: { roomCode: response.data.room.code } };
    } finally {
      this.enterInFlight = null;
    }
  }

  async join(roomCode: string, playerName: string): Promise<RoomV2Result<{ roomCode: string }>> {
    if (this.enterInFlight) {
      return {
        success: false,
        error: { code: 'CONNECTION_FAILED', message: getRoomErrorMessage('CONNECTION_FAILED') },
      };
    }

    this.enterInFlight = 'join';
    const gen = this.bumpGeneration();
    this.clearLocalParticipation();
    this.status = 'entering';
    this.notify();
    roomV2Diag('JOIN_START', { roomCode, generation: gen });
    recordContinuity('JOIN_START', {
      socketId: getRoomSocket().id ?? null,
      managerId: this.__instanceId ?? null,
      roomCode,
      status: this.status,
    });

    try {
      if (!(await this.ensureSocket())) {
        this.status = 'error';
        this.errorMessage = getRoomErrorMessage('CONNECTION_FAILED');
        this.notify();
        return {
          success: false,
          error: { code: 'CONNECTION_FAILED', message: this.errorMessage },
        };
      }

      const response = await emitRoomAck<RoomSessionData>(JOIN_ROOM_EVENT, {
        roomCode,
        playerName,
      });

      if (gen !== this.generation) {
        roomV2Diag('STALE_OPERATION_DROPPED', { generation: this.generation });
        return {
          success: false,
          error: { code: 'CONNECTION_FAILED', message: getRoomErrorMessage('CONNECTION_FAILED') },
        };
      }

      if (!response.success) {
        this.status = 'error';
        this.errorMessage = getRoomErrorMessage(
          response.error.code as Parameters<typeof getRoomErrorMessage>[0],
          response.error.message,
        );
        this.notify();
        return { success: false, error: { code: response.error.code, message: this.errorMessage } };
      }

      if (!this.applySessionData(response.data, gen)) {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: getRoomErrorMessage('INTERNAL_ERROR') },
        };
      }

      roomV2Diag('JOIN_SUCCESS', {
        roomCode: response.data.room.code,
        roomId: response.data.room.id,
        playerId: response.data.player.id,
        generation: gen,
      });
      recordContinuity('JOIN_SUCCESS', {
        socketId: getRoomSocket().id ?? null,
        managerId: this.__instanceId ?? null,
        roomCode: response.data.room.code,
        playerId: response.data.player.id,
        status: this.status,
        detail: `runtime=${getRuntimeId()}`,
      });

      return { success: true, data: { roomCode: response.data.room.code } };
    } finally {
      this.enterInFlight = null;
    }
  }

  /**
   * Same-room resume after hard refresh or transport reconnect.
   * Does nothing if already active with matching bound snapshot (fresh soft-nav).
   * Concurrent callers share one in-flight resume (React Strict Mode / double mount).
   */
  async resumeSameRoom(expectedRoomCode?: string): Promise<RoomV2Result<ActiveRoomSession>> {
    if (this.resumeInFlight) {
      return this.resumeInFlight;
    }

    this.resumeInFlight = this.runResumeSameRoom(expectedRoomCode).finally(() => {
      this.resumeInFlight = null;
    });
    return this.resumeInFlight;
  }

  private async runResumeSameRoom(
    expectedRoomCode?: string,
  ): Promise<RoomV2Result<ActiveRoomSession>> {
    this.rehydrateFromStorageIfNeeded();
    const stored = this.session ?? readPersistedActiveRoomSession();
    if (!stored) {
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: getRoomErrorMessage('PLAYER_NOT_FOUND') },
      };
    }

    if (this.leftRoomIds.has(stored.roomId)) {
      this.bumpGeneration();
      this.clearLocalParticipation();
      this.status = 'idle';
      this.notify();
      recordContinuity('RESUME_BLOCKED_LEFT_ROOM', {
        roomCode: stored.roomCode,
        playerId: stored.playerId,
        detail: stored.roomId,
      });
      return {
        success: false,
        error: { code: 'PLAYER_NOT_FOUND', message: getRoomErrorMessage('PLAYER_NOT_FOUND') },
      };
    }

    if (
      expectedRoomCode &&
      canonicalizeRoomCode(stored.roomCode) !== canonicalizeRoomCode(expectedRoomCode)
    ) {
      this.bumpGeneration();
      this.clearLocalParticipation();
      this.status = 'idle';
      this.notify();
      return {
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: getRoomErrorMessage('ROOM_NOT_FOUND') },
      };
    }

    // Fresh Create/Join soft-nav: socket already bound — ZERO reconnects.
    if (
      this.status === 'active' &&
      this.snapshot.room &&
      this.session &&
      canonicalizeRoomCode(this.session.roomCode) === canonicalizeRoomCode(stored.roomCode) &&
      getRoomSocket().connected
    ) {
      recordContinuity('RESUME_SKIPPED_LIVE', {
        socketId: getRoomSocket().id ?? null,
        managerId: this.__instanceId ?? null,
        roomCode: stored.roomCode,
        playerId: stored.playerId,
        status: this.status,
      });
      return { success: true, data: this.session };
    }

    const gen = this.bumpGeneration();
    this.session = stored;
    this.status = 'recovering';
    this.notify();
    roomV2Diag('RESUME_START', {
      roomCode: stored.roomCode,
      roomId: stored.roomId,
      playerId: stored.playerId,
      generation: gen,
    });
    recordContinuity('RESUME_START', {
      socketId: getRoomSocket().id ?? null,
      managerId: this.__instanceId ?? null,
      roomCode: stored.roomCode,
      playerId: stored.playerId,
      status: this.status,
    });

    if (!(await this.ensureSocket())) {
      // Keep persisted session — Lobby must not treat this as "no session" → Home.
      this.session = stored;
      writePersistedActiveRoomSession(stored);
      this.status = 'error';
      this.errorMessage = getRoomErrorMessage('CONNECTION_FAILED');
      this.notify();
      return {
        success: false,
        error: { code: 'CONNECTION_FAILED', message: this.errorMessage },
      };
    }

    // Prefer bound sync when socket already authenticated to this room.
    const synced = await emitRoomAck<RoomSessionData>(ROOM_SYNC_EVENT, {});
    if (gen === this.generation && synced.success && synced.data.room.id === stored.roomId) {
      this.applySessionData(synced.data, gen);
      roomV2Diag('RESUME_SUCCESS', {
        roomCode: stored.roomCode,
        roomId: stored.roomId,
        playerId: stored.playerId,
        generation: gen,
      });
      recordContinuity('RESUME_SUCCESS_SYNC', {
        socketId: getRoomSocket().id ?? null,
        managerId: this.__instanceId ?? null,
        roomCode: stored.roomCode,
        playerId: stored.playerId,
        status: this.status,
      });
      return { success: true, data: stored };
    }

    const response = await emitRoomAck<RoomSessionData>(RECONNECT_EVENT, {
      playerId: stored.playerId,
      roomId: stored.roomId,
      roomCode: stored.roomCode,
      reconnectToken: stored.reconnectToken,
    });

    if (gen !== this.generation) {
      roomV2Diag('STALE_OPERATION_DROPPED', { generation: this.generation });
      return {
        success: false,
        error: { code: 'CONNECTION_FAILED', message: getRoomErrorMessage('CONNECTION_FAILED') },
      };
    }

    if (!response.success) {
      // Matching-code resume failure must NOT erase ActiveRoomSession — that caused
      // Lobby bootstrap to redirect `/?code=` after a successful Create.
      this.session = stored;
      writePersistedActiveRoomSession(stored);
      this.status = 'error';
      this.errorMessage = getRoomErrorMessage(
        response.error.code as Parameters<typeof getRoomErrorMessage>[0],
        response.error.message,
      );
      this.notify();
      recordContinuity('RESUME_FAILED', {
        socketId: getRoomSocket().id ?? null,
        managerId: this.__instanceId ?? null,
        roomCode: stored.roomCode,
        playerId: stored.playerId,
        status: this.status,
        detail: response.error.code,
      });
      return { success: false, error: { code: response.error.code, message: this.errorMessage } };
    }

    this.applySessionData(response.data, gen);
    roomV2Diag('RESUME_SUCCESS', {
      roomCode: response.data.room.code,
      roomId: response.data.room.id,
      playerId: response.data.player.id,
      generation: gen,
    });
    recordContinuity('RESUME_SUCCESS_RECONNECT', {
      socketId: getRoomSocket().id ?? null,
      managerId: this.__instanceId ?? null,
      roomCode: response.data.room.code,
      playerId: response.data.player.id,
      status: this.status,
    });
    return { success: true, data: this.session! };
  }

  /**
   * Explicit Leave: clear local identity immediately, then best-effort server leave.
   * Captures old identity before clear so Leave cannot target a newer Room.
   * Generation-guarded: a superseding Create/Join must not be torn down by Leave.finally.
   */
  async leave(): Promise<void> {
    // Explicit Leave always suppresses invite-prefill of the room being left.
    this.explicitLeaveHome = true;

    const old = this.session;
    if (old) {
      this.leftRoomIds.add(old.roomId);
    }
    const leaveGen = this.bumpGeneration();
    this.status = 'leaving';
    this.clearLocalParticipation();
    this.notify();
    roomV2Diag('LEAVE', {
      roomCode: old?.roomCode,
      roomId: old?.roomId,
      playerId: old?.playerId,
      generation: leaveGen,
    });
    recordContinuity('LEAVE_START', {
      socketId: getRoomSocket().id ?? null,
      managerId: this.__instanceId ?? null,
      roomCode: old?.roomCode,
      playerId: old?.playerId,
      status: this.status,
    });

    // Best-effort server leave using captured identity only.
    // If the socket is unbound (hard navigation), rebind the OLD seat then leave.
    try {
      if (old) {
        if (this.generation !== leaveGen) {
          roomV2Diag('STALE_OPERATION_DROPPED', {
            generation: this.generation,
            detail: 'leave-superseded-before-server',
          });
          return;
        }

        const socket = getRoomSocket();
        if (!socket.connected) {
          socket.connect();
          try {
            await waitForRoomSocketConnection(socket, 2_000);
          } catch {
            /* best effort */
          }
          if (this.generation !== leaveGen) {
            return;
          }
          await emitRoomAck(
            RECONNECT_EVENT,
            {
              playerId: old.playerId,
              roomId: old.roomId,
              roomCode: old.roomCode,
              reconnectToken: old.reconnectToken,
            },
            2_000,
          );
        }

        if (this.generation !== leaveGen) {
          roomV2Diag('STALE_OPERATION_DROPPED', {
            generation: this.generation,
            detail: 'leave-superseded-before-leave-ack',
          });
          return;
        }

        await emitRoomAck(LEAVE_ROOM_EVENT, {}, 2_000);
      }
    } catch {
      /* ignore */
    } finally {
      // A newer Create/Join bumped generation — do NOT disconnect their live socket.
      if (this.generation !== leaveGen) {
        roomV2Diag('STALE_OPERATION_DROPPED', {
          generation: this.generation,
          detail: 'leave-finally-superseded',
        });
        recordContinuity('LEAVE_SUPERSEDED', {
          socketId: getRoomSocket().id ?? null,
          managerId: this.__instanceId ?? null,
          detail: `leaveGen=${leaveGen},current=${this.generation}`,
        });
        return;
      }

      const socket = getRoomSocket();
      if (this.onSocketManagerReconnect) {
        try {
          socket.io.off('reconnect', this.onSocketManagerReconnect);
        } catch {
          /* ignore */
        }
        this.onSocketManagerReconnect = null;
      }

      disconnectRoomSocket();
      this.coreListenersBound = false;
      this.status = 'idle';
      this.notify();
      this.onTerminal?.('leave');
      recordContinuity('LEAVE_DONE', {
        socketId: null,
        managerId: this.__instanceId ?? null,
        status: this.status,
      });
    }
  }

  /** Apply authoritative RoomSessionData from external game-shell sync paths. */
  adoptAuthoritativeSession(data: RoomSessionData): void {
    if (!this.session || data.room.id !== this.session.roomId) {
      roomV2Diag('FOREIGN_SNAPSHOT_DROPPED', {
        roomId: data.room.id,
        generation: this.generation,
      });
      return;
    }

    this.applySessionData(data, this.generation);
  }

  isEnterInFlight(): boolean {
    return this.enterInFlight !== null;
  }

  /**
   * Room-participation-only reset — same clean slate a hard refresh gives for Room state,
   * without tearing down the whole JS runtime or blindly cycling the socket.
   */
  prepareFreshRoomEntry(): void {
    this.bumpGeneration();
    this.enterInFlight = null;
    this.resumeInFlight = null;
    this.clearLocalParticipation();
    this.status = 'idle';
    this.errorMessage = null;
    this.notify();
    roomV2Diag('SESSION_CLEAR', {
      generation: this.generation,
      detail: 'prepareFreshRoomEntry',
    });
    recordContinuity('FRESH_ENTRY_RESET', {
      socketId: getRoomSocket().id ?? null,
      managerId: this.__instanceId ?? null,
      status: this.status,
      detail: `runtime=${getRuntimeId()}`,
    });
  }

  /**
   * Explicit Leave / Kick / Closed → Home must not become an invite to the room just left.
   * Lobby bootstrap and Home prefill honor this until Home consumes it.
   */
  markExplicitLeaveHome(): void {
    this.explicitLeaveHome = true;
  }

  shouldSuppressInvitePrefill(): boolean {
    return this.explicitLeaveHome;
  }

  clearExplicitLeaveHome(): void {
    this.explicitLeaveHome = false;
  }

  /** True when this tab explicitly left at least one Room since last full reload. */
  hasExplicitlyLeftRoomThisRuntime(): boolean {
    return this.leftRoomIds.size > 0;
  }

  /** Home consumes the flag after clearing join prefill / URL. */
  consumeExplicitLeaveHome(): boolean {
    if (!this.explicitLeaveHome) {
      return false;
    }
    this.explicitLeaveHome = false;
    return true;
  }
}

let singleton: RoomSessionManager | null = null;

const MANAGER_GLOBAL_KEY = '__wanasatna_room_session_manager_v2__';

type ManagerGlobal = typeof globalThis & {
  [MANAGER_GLOBAL_KEY]?: RoomSessionManager;
};

/**
 * One browser-runtime owner across App Router client bundles (Home vs (room) layout).
 * Never reuse an SSR-constructed instance on the client.
 */
export function getRoomSessionManager(): RoomSessionManager {
  if (typeof window === 'undefined') {
    return new RoomSessionManager();
  }

  const g = globalThis as ManagerGlobal;
  if (!g[MANAGER_GLOBAL_KEY]) {
    g[MANAGER_GLOBAL_KEY] = new RoomSessionManager();
  }
  singleton = g[MANAGER_GLOBAL_KEY]!;
  return singleton;
}

/** Test-only reset. */
export function __resetRoomSessionManagerForTests(): void {
  singleton = null;
  if (typeof window !== 'undefined') {
    delete (globalThis as ManagerGlobal)[MANAGER_GLOBAL_KEY];
  }
}
