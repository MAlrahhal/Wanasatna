'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import {
  CREATE_ROOM_EVENT,
  GAME_SHELL_NAVIGATE_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
  HOST_CHANGED_EVENT,
  JOIN_ROOM_EVENT,
  KICK_PLAYER_EVENT,
  LEAVE_ROOM_EVENT,
  LOCK_ROOM_EVENT,
  PLAYER_KICKED_EVENT,
  RECONNECT_EVENT,
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  ROOM_UPDATED_EVENT,
  UNLOCK_ROOM_EVENT,
  GAME_SHELL_STATE_EVENT,
  isActiveMatchParticipant,
  isWaitingForNextMatch,
  type GameShellNavigatePayload,
  type GameShellState,
  type HostChangedPayload,
  type PlayerKickedPayload,
  type ReconnectResponse,
  type RoomActionResponse,
  type RoomData,
  type RoomErrorCode,
  type RoomPlayerData,
  type RoomPlayersSnapshotPayload,
  type RoomSessionData,
  type RoomUpdatedPayload,
  type GuessingChallengeMode,
  type TimingChallengeSettings,
  GUESSING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
  TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
  TIMING_CHALLENGE_DEFAULT_ROUNDS,
  TIMING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import { emitGameShellWithAck } from '@/lib/game-shell/emit';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';
import { hasClientGamePlugin } from '@/lib/game-plugins/registry';
import { normalizeRoomDates, toLobbyPlayers } from '@/lib/room/map-player';
import {
  beginNewRoomIdentity,
  buildLobbyUrl,
  clearRoomSession,
  lobbyUrlNeedsNormalization,
  readRoomSession,
  readSelectedGameId,
  resolveRoomEntryIntent,
  shouldClearSessionOnReconnectFailure,
  STALE_ROOM_SESSION_MESSAGE,
  writeRoomSession,
  writeSelectedGameId,
} from '@/lib/room/session';
import {
  findRoomReconnectCredential,
  removeRoomReconnectCredential,
  saveRoomReconnectCredential,
} from '@/lib/room/reconnect-credential';
import { disconnectRoomSocket, getRoomSocket, waitForRoomSocketConnection } from '@/lib/room/socket';
import {
  rebindRoomSocketFromStoredSession,
  setRoomSessionResumeListener,
} from '@/lib/room/socket-resume';
import { getDefaultRoundCategoryId } from '@/lib/game/round-categories';
import { registerAllClientGamePlugins } from '@/plugins';

const DEFAULT_TIMING_CHALLENGE_SETTINGS: TimingChallengeSettings = {
  mode: 'guess-time',
  rounds: TIMING_CHALLENGE_DEFAULT_ROUNDS,
  minSeconds: TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
  maxSeconds: TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
};

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type RoomContextValue = {
  status: ConnectionStatus;
  errorMessage: string | null;
  room: RoomData | null;
  player: RoomPlayerData | null;
  players: LobbyPlayer[];
  isHost: boolean;
  selectedGameId: string | null;
  selectedRoundCategoryId: string | null;
  timingChallengeSettings: TimingChallengeSettings;
  setTimingChallengeSettings: (settings: TimingChallengeSettings) => void;
  guessingChallengeMode: GuessingChallengeMode;
  setGuessingChallengeMode: (mode: GuessingChallengeMode) => void;
  lockRoom: () => Promise<void>;
  unlockRoom: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  selectGame: (gameId: string) => void;
  selectRoundCategory: (categoryId: string) => void;
  startGame: () => Promise<void>;
  leaveRoom: (redirectTo?: string) => Promise<void>;
  isWaitingForNextMatch: boolean;
  activeMatchParticipantIds: string[] | null;
};

const RoomContext = createContext<RoomContextValue | null>(null);

function isRoomActionResponse<T>(value: unknown): value is RoomActionResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

function emitWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<RoomActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (error: unknown, response?: RoomActionResponse<T>) => {
      // Socket.IO timeout acks are (err, value). If a transport path delivers the
      // payload as the first argument, accept it instead of treating it as failure.
      const resolved = isRoomActionResponse<T>(response)
        ? response
        : isRoomActionResponse<T>(error)
          ? error
          : undefined;

      if (!resolved) {
        resolve({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: getRoomErrorMessage('CONNECTION_FAILED'),
          },
        });
        return;
      }

      resolve(resolved);
    });
  });
}

function applySessionFromData(data: RoomSessionData) {
  writeRoomSession({
    playerId: data.player.id,
    roomId: data.room.id,
    playerName: data.player.name,
    roomCode: data.room.code,
  });

  if (data.reconnectToken) {
    saveRoomReconnectCredential({
      playerId: data.player.id,
      roomId: data.room.id,
      roomCode: data.room.code,
      reconnectToken: data.reconnectToken,
    });
  }
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const connectionAttemptRef = useRef(0);
  const searchParamsRef = useRef<Pick<URLSearchParams, 'get' | 'has' | 'toString'>>(searchParams);
  const pathnameRef = useRef(pathname);
  const connectToRoomRef = useRef<(options?: { resumeStoredSessionOnly?: boolean }) => Promise<void>>(
    async () => undefined,
  );

  searchParamsRef.current = searchParams;
  pathnameRef.current = pathname;

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [player, setPlayer] = useState<RoomPlayerData | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedRoundCategoryId, setSelectedRoundCategoryId] = useState<string | null>(null);
  const [timingChallengeSettings, setTimingChallengeSettings] = useState<TimingChallengeSettings>(
    DEFAULT_TIMING_CHALLENGE_SETTINGS,
  );
  const [guessingChallengeMode, setGuessingChallengeMode] =
    useState<GuessingChallengeMode>('1v1');
  const [activeGameShell, setActiveGameShell] = useState<GameShellState | null>(null);
  // Latest shell for socket callbacks: listener closures must never act on a
  // stale shell snapshot (e.g. suppressing /game navigation for a player who
  // joined the next match after waiting out the previous one).
  const activeGameShellRef = useRef<GameShellState | null>(null);
  const removeSocketListenersRef = useRef<(() => void) | null>(null);
  /** Guards stale room-sync ACK from regressing a newer join snapshot roster. */
  const lastRosterSnapshotAtRef = useRef(0);
  const lastRosterIdsRef = useRef<Set<string>>(new Set());

  const isHost = player?.isHost ?? false;

  useEffect(() => {
    activeGameShellRef.current = activeGameShell;
  }, [activeGameShell]);

  const isWaitingForNextMatchValue = useMemo(
    () => (player ? isWaitingForNextMatch(activeGameShell, player.id) : false),
    [activeGameShell, player],
  );

  const activeMatchParticipantIds = activeGameShell?.matchParticipantIds ?? null;

  const syncActiveGameShell = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: GameShellState | null }>(
      GAME_SHELL_SYNC_EVENT,
    );

    if (response.success) {
      activeGameShellRef.current = response.data.state;
      setActiveGameShell(response.data.state);
    }

    return response;
  }, []);

  const applyPlayersSnapshot = useCallback((payload: RoomPlayersSnapshotPayload) => {
    lastRosterSnapshotAtRef.current = Date.now();
    lastRosterIdsRef.current = new Set(payload.players.map((entry) => entry.id));
    setPlayers(toLobbyPlayers(payload.players));
  }, []);

  const applyHostChange = useCallback((payload: HostChangedPayload) => {
    setRoom((current) =>
      current ? { ...current, hostPlayerId: payload.hostPlayerId } : current,
    );

    setPlayer((current) =>
      current
        ? {
            ...current,
            isHost: current.id === payload.hostPlayerId,
          }
        : current,
    );

    setPlayers((current) =>
      current.map((entry) => ({
        ...entry,
        isHost: entry.id === payload.hostPlayerId,
      })),
    );
  }, []);

  const applyRoomSession = useCallback(
    (data: RoomSessionData) => {
      const normalizedRoom = normalizeRoomDates(data.room);

      setRoom(normalizedRoom);
      setPlayer(data.player);

      // Guard against stale room-sync ACK overwriting a newer join snapshot.
      // If we recently received a larger authoritative snapshot, do not regress
      // the roster from a sync payload that is missing those players.
      const nextPlayers = toLobbyPlayers(data.players);
      const nextIds = new Set(nextPlayers.map((entry) => entry.id));
      const snapshotAgeMs = Date.now() - lastRosterSnapshotAtRef.current;
      const wouldRegress =
        snapshotAgeMs < 2500 &&
        lastRosterIdsRef.current.size > nextIds.size &&
        [...nextIds].every((id) => lastRosterIdsRef.current.has(id));

      if (!wouldRegress) {
        lastRosterIdsRef.current = nextIds;
        setPlayers(nextPlayers);
      }

      applySessionFromData(data);
      setStatus('connected');
      setErrorMessage(null);

      const isOnGameRoute = pathnameRef.current === '/game';
      const nextUrl = buildLobbyUrl(normalizedRoom.code);

      // Synchronously clear create/join intent from the URL + ref before any
      // socket "reconnect" handler re-enters connectToRoom. Async router.replace
      // alone can leave action=create sticky long enough to wipe the new session.
      if (
        !isOnGameRoute &&
        lobbyUrlNeedsNormalization(searchParamsRef.current, normalizedRoom.code)
      ) {
        const nextParams = new URLSearchParams();
        nextParams.set('code', normalizedRoom.code);
        searchParamsRef.current = nextParams;

        if (typeof window !== 'undefined') {
          window.history.replaceState(window.history.state, '', nextUrl);
        }

        router.replace(nextUrl, { scroll: false });
      }
    },
    [router],
  );

  const handleFailure = useCallback((code: RoomErrorCode, fallback?: string) => {
    setStatus('error');
    setErrorMessage(getRoomErrorMessage(code, fallback));
  }, []);

  const redirectIfActiveGameShell = useCallback(
    async (playerId?: string) => {
      const response = await syncActiveGameShell();
      const resolvedPlayerId = playerId ?? player?.id;

      if (
        response.success &&
        response.data.state &&
        response.data.state.phase !== 'FINISHED' &&
        resolvedPlayerId &&
        isActiveMatchParticipant(response.data.state, resolvedPlayerId)
      ) {
        router.push('/game');
      }
    },
    [player?.id, router, syncActiveGameShell],
  );

  const registerSocketListeners = useCallback(() => {
    const socket = getRoomSocket();

    // Remove only the handlers this provider registered previously. Other
    // providers (e.g. GameShellProvider) share this socket, so removing an
    // event without naming our handler would wipe their listeners too.
    removeSocketListenersRef.current?.();

    const onPlayersSnapshot = (payload: RoomPlayersSnapshotPayload) => {
      applyPlayersSnapshot(payload);
    };

    const onHostChanged = (payload: HostChangedPayload) => {
      applyHostChange(payload);
    };

    const onRoomUpdated = (payload: RoomUpdatedPayload) => {
      setRoom((current) => (current ? { ...current, isLocked: payload.isLocked } : current));
    };

    const onPlayerKicked = (payload: PlayerKickedPayload) => {
      setRoomSessionResumeListener(null);
      beginNewRoomIdentity();
      setStatus('error');
      setErrorMessage('تم طردك من الغرفة.');
      setRoom(null);
      setPlayer(null);
      setPlayers([]);
      setSelectedGameId(null);
      setSelectedRoundCategoryId(null);

      if (payload.roomId) {
        router.push('/');
      }
    };

    const onGameShellNavigate = (payload: GameShellNavigatePayload) => {
      if (payload.path === '/game') {
        const session = readRoomSession();

        // Suppress only for players waiting out a currently active match.
        // Reads the latest shell via ref so a finished match or a new match
        // that includes this player can never be blocked by a stale closure.
        if (
          session?.playerId &&
          isWaitingForNextMatch(activeGameShellRef.current, session.playerId)
        ) {
          return;
        }
      }

      if (payload.message) {
        try {
          sessionStorage.setItem('wanasatna:lobby-notice', payload.message);
        } catch {
          /* storage unavailable */
        }
      }

      const path =
        payload.path === '/lobby' && payload.roomCode
          ? buildLobbyUrl(payload.roomCode)
          : payload.path;

      router.push(path);
    };

    const onGameShellState = (payload: { state: GameShellState }) => {
      activeGameShellRef.current = payload.state;
      setActiveGameShell(payload.state);
    };

    socket.on(ROOM_PLAYERS_SNAPSHOT_EVENT, onPlayersSnapshot);
    socket.on(HOST_CHANGED_EVENT, onHostChanged);
    socket.on(ROOM_UPDATED_EVENT, onRoomUpdated);
    socket.on(PLAYER_KICKED_EVENT, onPlayerKicked);
    socket.on(GAME_SHELL_NAVIGATE_EVENT, onGameShellNavigate);
    socket.on(GAME_SHELL_STATE_EVENT, onGameShellState);

    removeSocketListenersRef.current = () => {
      socket.off(ROOM_PLAYERS_SNAPSHOT_EVENT, onPlayersSnapshot);
      socket.off(HOST_CHANGED_EVENT, onHostChanged);
      socket.off(ROOM_UPDATED_EVENT, onRoomUpdated);
      socket.off(PLAYER_KICKED_EVENT, onPlayerKicked);
      socket.off(GAME_SHELL_NAVIGATE_EVENT, onGameShellNavigate);
      socket.off(GAME_SHELL_STATE_EVENT, onGameShellState);
      removeSocketListenersRef.current = null;
    };
  }, [applyHostChange, applyPlayersSnapshot, router]);

  const ensureSocketReady = useCallback(
    async (
      isStale: () => boolean,
      options?: { suppressFailureUi?: boolean },
    ): Promise<boolean> => {
      registerSocketListeners();

      const activeSocket = getRoomSocket();

      try {
        if (!activeSocket.connected) {
          activeSocket.connect();
          await waitForRoomSocketConnection(activeSocket);
        }
      } catch {
        if (!isStale() && !options?.suppressFailureUi) {
          handleFailure('CONNECTION_FAILED');
        }
        return false;
      }

      return !isStale();
    },
    [handleFailure, registerSocketListeners],
  );

  const connectToRoom = useCallback(async (options?: { resumeStoredSessionOnly?: boolean }) => {
    const attemptId = ++connectionAttemptRef.current;
    const isStale = () => connectionAttemptRef.current !== attemptId;
    const resumeStoredSessionOnly = options?.resumeStoredSessionOnly === true;

    // Transport resume must not flash the lobby into a loading/error state.
    if (!resumeStoredSessionOnly) {
      setStatus('connecting');
      setErrorMessage(null);
    }

    if (!(await ensureSocketReady(isStale, { suppressFailureUi: resumeStoredSessionOnly }))) {
      return;
    }

    const storedSession = readRoomSession();
    let intent = resumeStoredSessionOnly
      ? ({ type: 'none' } as const)
      : resolveRoomEntryIntent(searchParamsRef.current, storedSession);

    if (resumeStoredSessionOnly && storedSession) {
      const credential = findRoomReconnectCredential(storedSession.roomCode);

      if (credential && credential.playerId === storedSession.playerId) {
        intent = {
          type: 'reconnect',
          playerId: credential.playerId,
          roomId: credential.roomId,
          roomCode: credential.roomCode,
          reconnectToken: credential.reconnectToken,
        };
      }
    }

    // TEMP diagnostic — no secrets/tokens.
    console.info('[room-entry]', {
      intent: intent.type,
      resumeStoredSessionOnly,
      hasStoredSession: Boolean(storedSession),
      url: searchParamsRef.current.toString(),
    });

    if (intent.type === 'create') {
      beginNewRoomIdentity();

      if (!(await ensureSocketReady(isStale))) {
        return;
      }

      const response = await emitWithAck<RoomSessionData>(CREATE_ROOM_EVENT, {
        playerName: intent.playerName,
      });

      if (isStale()) {
        return;
      }

      console.info('[room-entry]', {
        intent: 'create',
        success: response.success,
        errorCode: response.success ? undefined : response.error.code,
      });

      if (response.success) {
        applyRoomSession(response.data);
        const restoredGameId = readSelectedGameId();
        setSelectedGameId(restoredGameId);
        setSelectedRoundCategoryId(getDefaultRoundCategoryId(restoredGameId));
        await redirectIfActiveGameShell(response.data.player.id);
        return;
      }

      handleFailure(response.error.code);
      return;
    }

    if (intent.type === 'join') {
      beginNewRoomIdentity();

      if (!(await ensureSocketReady(isStale))) {
        return;
      }

      const response = await emitWithAck<RoomSessionData>(JOIN_ROOM_EVENT, {
        roomCode: intent.roomCode,
        playerName: intent.playerName,
      });

      if (isStale()) {
        return;
      }

      if (response.success) {
        applyRoomSession(response.data);
        await redirectIfActiveGameShell(response.data.player.id);
        return;
      }

      handleFailure(response.error.code);
      return;
    }

    if (intent.type === 'reconnect') {
      const response = (await emitWithAck<RoomSessionData>(RECONNECT_EVENT, {
        playerId: intent.playerId,
        roomId: intent.roomId,
        roomCode: intent.roomCode,
        reconnectToken: intent.reconnectToken,
      })) as ReconnectResponse;

      if (isStale()) {
        return;
      }

      console.info('[room-entry]', {
        intent: 'reconnect',
        success: response.success,
        errorCode: response.success ? undefined : response.error.code,
      });

      if (response.success) {
        applyRoomSession(response.data);
        const restoredGameId = readSelectedGameId();
        setSelectedGameId(restoredGameId);
        setSelectedRoundCategoryId(getDefaultRoundCategoryId(restoredGameId));
        await redirectIfActiveGameShell(response.data.player.id);
        return;
      }

      // Transport resume should not destroy an already-rendered lobby on transient errors.
      // Module-level rebind already attempted; avoid wiping a live lobby UI here.
      if (resumeStoredSessionOnly) {
        return;
      }

      if (response.hostChanged) {
        applyHostChange(response.hostChanged);
      }

      if (
        response.error.code === 'RECONNECT_INVALID_TOKEN' ||
        response.error.code === 'PLAYER_NOT_FOUND' ||
        response.error.code === 'RECONNECT_EXPIRED' ||
        response.error.code === 'ROOM_NOT_FOUND'
      ) {
        removeRoomReconnectCredential(intent.roomCode);
      }

      if (shouldClearSessionOnReconnectFailure(response.error.code)) {
        clearRoomSession();
        disconnectRoomSocket();
      }

      const fallbackName =
        searchParamsRef.current.get('name')?.trim() ||
        storedSession?.playerName?.trim() ||
        '';

      // Stale credential / deleted identity: try a fresh join when the room may still exist.
      const canFallbackJoin =
        Boolean(fallbackName && intent.roomCode) &&
        (response.error.code === 'RECONNECT_INVALID_TOKEN' ||
          response.error.code === 'PLAYER_NOT_FOUND' ||
          response.error.code === 'RECONNECT_EXPIRED');

      if (canFallbackJoin) {
        beginNewRoomIdentity();

        if (!(await ensureSocketReady(isStale))) {
          return;
        }

        const joinResponse = await emitWithAck<RoomSessionData>(JOIN_ROOM_EVENT, {
          roomCode: intent.roomCode,
          playerName: fallbackName,
        });

        if (isStale()) {
          return;
        }

        if (joinResponse.success) {
          applyRoomSession(joinResponse.data);
          await redirectIfActiveGameShell(joinResponse.data.player.id);
          return;
        }

        handleFailure(joinResponse.error.code);
        return;
      }

      const reconnectMessage =
        response.error.code === 'CONNECTION_FAILED' ||
        response.error.code === 'RECONNECT_EXPIRED' ||
        response.error.code === 'RECONNECT_INVALID_TOKEN' ||
        response.error.code === 'PLAYER_NOT_FOUND'
          ? STALE_ROOM_SESSION_MESSAGE
          : undefined;

      handleFailure(response.error.code, reconnectMessage ?? response.error.message);
      return;
    }

    if (isStale()) {
      return;
    }

    if (resumeStoredSessionOnly) {
      return;
    }

    setStatus('error');
    setErrorMessage('تعذر الاتصال بالغرفة. استخدم رابط الانضمام أو أنشئ غرفة جديدة.');
  }, [
    applyHostChange,
    applyRoomSession,
    ensureSocketReady,
    handleFailure,
    redirectIfActiveGameShell,
  ]);

  connectToRoomRef.current = connectToRoom;

  useEffect(() => {
    setRoomSessionResumeListener((data) => {
      applyRoomSession(data);
    });

    void (async () => {
      await connectToRoom();
      const attemptAfterConnect = connectionAttemptRef.current;

      // After /game → /lobby (or any remount), force an authoritative rebind/sync so
      // React roster state cannot diverge from server socket membership.
      if (!readRoomSession()) {
        return;
      }

      const synced = await rebindRoomSocketFromStoredSession();

      if (synced && connectionAttemptRef.current === attemptAfterConnect) {
        applyRoomSession(synced);
      }
    })();

    return () => {
      connectionAttemptRef.current += 1;
      removeSocketListenersRef.current?.();
      setRoomSessionResumeListener(null);
    };
    // Connect once on mount; URL params are read via searchParamsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockRoom = useCallback(async () => {
    const response = await emitWithAck<{ roomId: string; isLocked: boolean }>(LOCK_ROOM_EVENT);

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
    }
  }, []);

  const unlockRoom = useCallback(async () => {
    const response = await emitWithAck<{ roomId: string; isLocked: boolean }>(UNLOCK_ROOM_EVENT);

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
    }
  }, []);

  const kickPlayer = useCallback(async (targetPlayerId: string) => {
    const response = await emitWithAck<{ kickedPlayerId: string; roomDeleted: boolean }>(
      KICK_PLAYER_EVENT,
      { playerId: targetPlayerId },
    );

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
    }
  }, []);

  const selectGame = useCallback(
    (gameId: string) => {
      if (!isHost) {
        return;
      }

      setSelectedGameId(gameId);
      writeSelectedGameId(gameId);
      setSelectedRoundCategoryId(getDefaultRoundCategoryId(gameId));
    },
    [isHost],
  );

  const selectRoundCategory = useCallback(
    (categoryId: string) => {
      if (!isHost) {
        return;
      }

      setSelectedRoundCategoryId(categoryId);
    },
    [isHost],
  );

  const startGame = useCallback(async () => {
    if (!isHost) {
      return;
    }

    if (!selectedGameId) {
      setErrorMessage(getGameShellErrorMessage('GAME_NOT_SELECTED'));
      return;
    }

    // Guard against Web/Server deploy skew: never navigate into a broken game shell.
    registerAllClientGamePlugins();
    if (!hasClientGamePlugin(selectedGameId)) {
      setErrorMessage(
        'هذه اللعبة غير متاحة في نسخة الواجهة الحالية. حدّث الصفحة ثم حاول مرة أخرى.',
      );
      return;
    }

    const response = await emitGameShellWithAck<{ state: GameShellState }>(
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      {
        gameId: selectedGameId,
        categoryId: selectedRoundCategoryId,
        ...(selectedGameId === TIMING_CHALLENGE_GAME_ID
          ? { timingChallenge: timingChallengeSettings }
          : {}),
        ...(selectedGameId === GUESSING_CHALLENGE_GAME_ID
          ? { guessingChallenge: { mode: guessingChallengeMode } }
          : {}),
      },
    );

    if (!response.success) {
      setErrorMessage(getGameShellErrorMessage(response.error.code, response.error.message));
      return;
    }

    setErrorMessage(null);
    router.push('/game');
  }, [
    guessingChallengeMode,
    isHost,
    router,
    selectedGameId,
    selectedRoundCategoryId,
    timingChallengeSettings,
  ]);

  const leaveRoom = useCallback(async (redirectTo = '/') => {
    const leavingRoomCode = room?.code ?? readRoomSession()?.roomCode ?? undefined;

    const response = await emitWithAck<{ roomDeleted: boolean; hostChanged: HostChangedPayload | null }>(
      LEAVE_ROOM_EVENT,
    );

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
      return;
    }

    // Detach listeners before tearing down the socket so a manager reconnect
    // cannot race and re-apply a just-invalidated identity.
    removeSocketListenersRef.current?.();
    setRoomSessionResumeListener(null);
    beginNewRoomIdentity(leavingRoomCode);
    setRoom(null);
    setPlayer(null);
    setPlayers([]);
    setSelectedGameId(null);
    setSelectedRoundCategoryId(null);
    setActiveGameShell(null);
    activeGameShellRef.current = null;

    router.push(redirectTo);
  }, [room?.code, router]);

  const value = useMemo<RoomContextValue>(
    () => ({
      status,
      errorMessage,
      room,
      player,
      players,
      isHost,
      selectedGameId,
      selectedRoundCategoryId,
      timingChallengeSettings,
      setTimingChallengeSettings,
      guessingChallengeMode,
      setGuessingChallengeMode,
      lockRoom,
      unlockRoom,
      kickPlayer,
      selectGame,
      selectRoundCategory,
      startGame,
      leaveRoom,
      isWaitingForNextMatch: isWaitingForNextMatchValue,
      activeMatchParticipantIds,
    }),
    [
      activeMatchParticipantIds,
      errorMessage,
      isHost,
      isWaitingForNextMatchValue,
      kickPlayer,
      leaveRoom,
      lockRoom,
      player,
      players,
      room,
      selectGame,
      selectRoundCategory,
      selectedGameId,
      selectedRoundCategoryId,
      setGuessingChallengeMode,
      setTimingChallengeSettings,
      startGame,
      status,
      timingChallengeSettings,
      guessingChallengeMode,
      unlockRoom,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useOptionalRoom(): RoomContextValue | null {
  return useContext(RoomContext);
}

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);

  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }

  return context;
}
