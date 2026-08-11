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
  GAME_SHELL_NAVIGATE_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
  KICK_PLAYER_EVENT,
  LOCK_ROOM_EVENT,
  UNLOCK_ROOM_EVENT,
  GAME_SHELL_STATE_EVENT,
  isActiveMatchParticipant,
  isWaitingForNextMatch,
  type GameShellNavigatePayload,
  type GameShellState,
  type RoomData,
  type RoomPlayerData,
  type GuessingChallengeMode,
  type TimingChallengeSettings,
  GUESSING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
  TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
  TIMING_CHALLENGE_DEFAULT_ROUNDS,
  TIMING_CHALLENGE_GAME_ID,
  TEAM_ASSIGN_EVENT,
  TEAM_CONFIGURE_EVENT,
  TEAM_RANDOMIZE_EVENT,
  TEAM_SNAPSHOT_EVENT,
  TEAM_SYNC_EVENT,
  getGameTeamCapability,
  type PregameTeamSnapshot,
  type TeamId,
} from '@wanasatna/shared';
import { emitGameShellWithAck } from '@/lib/game-shell/emit';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';
import { hasClientGamePlugin } from '@/lib/game-plugins/registry';
import { normalizeRoomDates, toLobbyPlayers } from '@/lib/room/map-player';
import {
  buildLobbyUrl,
  lobbyUrlNeedsNormalization,
  readSelectedGameId,
  toCanonicalLobbySearchParams,
  writeSelectedGameId,
} from '@/lib/room/session';
import { getRoomSocket } from '@/lib/room/socket';
import { emitRoomAck } from '@/lib/room-v2/emit';
import {
  getRoomSessionManager,
  type RoomManagerState,
} from '@/lib/room-v2';
import type { RoomLifecycleStatus } from '@/lib/room-v2/types';
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
  teamSnapshot: PregameTeamSnapshot | null;
  configureTeams: (gameId: string, mode: string) => Promise<void>;
  assignPlayerTeam: (playerId: string, teamId: TeamId) => Promise<void>;
  randomizeTeams: () => Promise<void>;
};

const RoomContext = createContext<RoomContextValue | null>(null);

function mapManagerStatus(status: RoomLifecycleStatus): ConnectionStatus {
  switch (status) {
    case 'entering':
    case 'recovering':
      return 'connecting';
    case 'active':
      return 'connected';
    case 'error':
      return 'error';
    case 'leaving':
    case 'idle':
    default:
      return 'idle';
  }
}

function applyManagerStateToReact(
  state: RoomManagerState,
  setters: {
    setStatus: (status: ConnectionStatus) => void;
    setErrorMessage: (message: string | null) => void;
    setRoom: (room: RoomData | null) => void;
    setPlayer: (player: RoomPlayerData | null) => void;
    setPlayers: (players: LobbyPlayer[]) => void;
  },
) {
  setters.setStatus(mapManagerStatus(state.status));
  setters.setErrorMessage(state.errorMessage);
  setters.setRoom(state.snapshot.room ? normalizeRoomDates(state.snapshot.room) : null);
  setters.setPlayer(state.snapshot.player);
  setters.setPlayers(toLobbyPlayers(state.snapshot.players));
}

function isReusableActiveSession(state: RoomManagerState, roomCode?: string): boolean {
  if (state.status !== 'active' || !state.snapshot.room || !state.session) {
    return false;
  }

  if (roomCode && state.session.roomCode !== roomCode) {
    return false;
  }

  return true;
}

/** Canonical 6-digit Room code — UI formatting must never participate in identity. */
function canonicalizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsRef = useRef<Pick<URLSearchParams, 'get' | 'has' | 'toString'>>(searchParams);
  const pathnameRef = useRef(pathname);

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
  const [teamSnapshot, setTeamSnapshot] = useState<PregameTeamSnapshot | null>(null);
  const [activeGameShell, setActiveGameShell] = useState<GameShellState | null>(null);
  // Latest shell for socket callbacks: listener closures must never act on a
  // stale shell snapshot (e.g. suppressing /game navigation for a player who
  // joined the next match after waiting out the previous one).
  const activeGameShellRef = useRef<GameShellState | null>(null);
  const removeSocketListenersRef = useRef<(() => void) | null>(null);
  const playerIdRef = useRef<string | null>(null);

  if (
    !(
      status === 'connected' &&
      room?.code &&
      lobbyUrlNeedsNormalization(searchParams, room.code)
    )
  ) {
    searchParamsRef.current = searchParams;
  }
  pathnameRef.current = pathname;
  playerIdRef.current = player?.id ?? null;

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

  const canonicalizeActiveLobbyUrl = useCallback(
    (roomCode: string) => {
      if (pathnameRef.current === '/game') {
        return;
      }

      if (!lobbyUrlNeedsNormalization(searchParamsRef.current, roomCode)) {
        return;
      }

      const nextUrl = buildLobbyUrl(roomCode);
      searchParamsRef.current = toCanonicalLobbySearchParams(roomCode);

      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', nextUrl);
      }

      router.replace(nextUrl, { scroll: false });
    },
    [router],
  );

  const redirectIfActiveGameShell = useCallback(
    async (playerId?: string) => {
      if (pathnameRef.current === '/game') {
        return;
      }

      const response = await syncActiveGameShell();
      const resolvedPlayerId = playerId ?? playerIdRef.current;

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
    [router, syncActiveGameShell],
  );

  const clearLocalGameUi = useCallback(() => {
    setSelectedGameId(null);
    setSelectedRoundCategoryId(null);
    setTeamSnapshot(null);
    setActiveGameShell(null);
    activeGameShellRef.current = null;
  }, []);

  const restoreSelectedGame = useCallback(() => {
    const restoredGameId = readSelectedGameId();
    setSelectedGameId(restoredGameId);
    setSelectedRoundCategoryId(getDefaultRoundCategoryId(restoredGameId));
  }, []);

  // Sync React state from Room Client Core V2.
  useEffect(() => {
    const manager = getRoomSessionManager();
    return manager.subscribe((state) => {
      applyManagerStateToReact(state, {
        setStatus,
        setErrorMessage,
        setRoom,
        setPlayer,
        setPlayers,
      });
    });
  }, []);

  // Self-kick / leave terminal — manager owns PLAYER_KICKED; provider only reacts.
  useEffect(() => {
    const manager = getRoomSessionManager();
    manager.setTerminalHandler((reason) => {
      if (reason !== 'kick') {
        return;
      }

      clearLocalGameUi();
      setErrorMessage('تم طردك من الغرفة.');
      router.replace('/');
    });

    return () => {
      manager.setTerminalHandler(null);
    };
  }, [clearLocalGameUi, router]);

  const registerSocketListeners = useCallback(() => {
    const socket = getRoomSocket();

    // Remove only the handlers this provider registered previously. Other
    // providers (e.g. GameShellProvider) share this socket, so removing an
    // event without naming our handler would wipe their listeners too.
    // Core room events (players snapshot, host, lock, kick) stay on the manager.
    removeSocketListenersRef.current?.();

    const onGameShellNavigate = (payload: GameShellNavigatePayload) => {
      if (payload.path === '/game') {
        const currentPlayerId = playerIdRef.current;

        if (
          currentPlayerId &&
          isWaitingForNextMatch(activeGameShellRef.current, currentPlayerId)
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

    const onTeamSnapshot = (payload: PregameTeamSnapshot) => {
      setTeamSnapshot(payload);
    };

    socket.on(GAME_SHELL_NAVIGATE_EVENT, onGameShellNavigate);
    socket.on(GAME_SHELL_STATE_EVENT, onGameShellState);
    socket.on(TEAM_SNAPSHOT_EVENT, onTeamSnapshot);

    removeSocketListenersRef.current = () => {
      socket.off(GAME_SHELL_NAVIGATE_EVENT, onGameShellNavigate);
      socket.off(GAME_SHELL_STATE_EVENT, onGameShellState);
      socket.off(TEAM_SNAPSHOT_EVENT, onTeamSnapshot);
      removeSocketListenersRef.current = null;
    };
  }, [router]);

  const urlRoomCode = canonicalizeRoomCode(searchParams.get('code')?.trim() ?? '');
  const urlAction = searchParams.get('action')?.trim() ?? '';
  const urlHasName = searchParams.has('name');

  // Bind lobby URL /game resume to manager — never create/join from effects.
  useEffect(() => {
    let cancelled = false;
    const manager = getRoomSessionManager();

    void (async () => {
      // Cross-bundle first paint may have empty memory; storage is authoritative.
      manager.rehydrateFromStorageIfNeeded();

      const legacyIntent = urlAction === 'create' || urlHasName;
      let state = manager.getState();

      if (legacyIntent) {
        const sessionCode = state.session?.roomCode;
        if (sessionCode) {
          canonicalizeActiveLobbyUrl(sessionCode);
          if (!isReusableActiveSession(state, sessionCode)) {
            await manager.resumeSameRoom(sessionCode);
            if (cancelled) {
              return;
            }
            restoreSelectedGame();
            await redirectIfActiveGameShell(manager.getState().snapshot.player?.id);
          }
          return;
        }

        if (urlRoomCode) {
          router.replace(`/?code=${encodeURIComponent(urlRoomCode)}`);
        } else {
          router.replace('/');
        }
        return;
      }

      if (pathname === '/game') {
        manager.rehydrateFromStorageIfNeeded();
        state = manager.getState();
        if (!state.session) {
          router.replace('/');
          return;
        }

        if (manager.hasLiveActiveRoom() || isReusableActiveSession(state)) {
          return;
        }

        await manager.resumeSameRoom();
        if (!cancelled) {
          restoreSelectedGame();
        }
        return;
      }

      if (urlRoomCode) {
        state = manager.getState();
        const sessionCode = state.session?.roomCode
          ? canonicalizeRoomCode(state.session.roomCode)
          : '';

        if (sessionCode === urlRoomCode) {
          // Fresh Create/Join: socket already bound — never resume, never redirect Home.
          if (manager.hasLiveActiveRoom(urlRoomCode) || isReusableActiveSession(state, urlRoomCode)) {
            await redirectIfActiveGameShell(state.snapshot.player?.id);
            return;
          }

          const resumed = await manager.resumeSameRoom(urlRoomCode);
          if (cancelled) {
            return;
          }

          if (resumed.success) {
            restoreSelectedGame();
            await redirectIfActiveGameShell(manager.getState().snapshot.player?.id);
            return;
          }

          // Matching session failed to resume — stay on Lobby with error.
          // Do NOT redirect `/?code=` (that was the production Create→Home bounce).
          return;
        }

        // Different room in URL than active session: clear participation, invite-only Home.
        if (state.session) {
          await manager.leave();
          if (cancelled) {
            return;
          }
        }
        router.replace(`/?code=${encodeURIComponent(urlRoomCode)}`);
        return;
      }

      // /lobby with no code: recover bound session or send home.
      state = manager.getState();
      if (state.session?.roomCode) {
        canonicalizeActiveLobbyUrl(state.session.roomCode);
        if (!isReusableActiveSession(state, state.session.roomCode)) {
          await manager.resumeSameRoom(state.session.roomCode);
          if (cancelled) {
            return;
          }
          restoreSelectedGame();
          await redirectIfActiveGameShell(manager.getState().snapshot.player?.id);
        }
        return;
      }

      router.replace('/');
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canonicalizeActiveLobbyUrl,
    pathname,
    redirectIfActiveGameShell,
    restoreSelectedGame,
    router,
    urlAction,
    urlHasName,
    urlRoomCode,
  ]);

  // Keep canonical `/lobby?code=` after successful entry even if Next reconciles
  // sticky action=create / name= query params back into the address bar.
  useEffect(() => {
    if (status !== 'connected' || !room?.code) {
      return;
    }

    if (urlAction === 'create' || urlHasName || (urlRoomCode && urlRoomCode !== room.code)) {
      canonicalizeActiveLobbyUrl(room.code);
    }
  }, [status, room?.code, urlAction, urlHasName, urlRoomCode, canonicalizeActiveLobbyUrl]);

  useEffect(() => {
    if (
      status === 'connected' &&
      room?.code &&
      lobbyUrlNeedsNormalization(searchParams, room.code)
    ) {
      return;
    }
    searchParamsRef.current = searchParams;
  }, [searchParams, status, room?.code]);

  // Game-shell + team listeners only while connected (manager owns room core events).
  useEffect(() => {
    if (status !== 'connected') {
      removeSocketListenersRef.current?.();
      return;
    }

    registerSocketListeners();

    void (async () => {
      const sync = await emitGameShellWithAck<{ snapshot: PregameTeamSnapshot | null }>(
        TEAM_SYNC_EVENT,
      );
      if (sync.success) {
        setTeamSnapshot(sync.data.snapshot);
      }
    })();

    return () => {
      removeSocketListenersRef.current?.();
    };
  }, [registerSocketListeners, status]);

  const lockRoom = useCallback(async () => {
    const response = await emitRoomAck<{ roomId: string; isLocked: boolean }>(LOCK_ROOM_EVENT);

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
    }
  }, []);

  const unlockRoom = useCallback(async () => {
    const response = await emitRoomAck<{ roomId: string; isLocked: boolean }>(UNLOCK_ROOM_EVENT);

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
    }
  }, []);

  const kickPlayer = useCallback(async (targetPlayerId: string) => {
    const response = await emitRoomAck<{ kickedPlayerId: string; roomDeleted: boolean }>(
      KICK_PLAYER_EVENT,
      { playerId: targetPlayerId },
    );

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code));
    }
  }, []);

  const configureTeams = useCallback(
    async (gameId: string, mode: string) => {
      if (!getGameTeamCapability(gameId)) {
        setTeamSnapshot(null);
        return;
      }

      const response = await emitGameShellWithAck<PregameTeamSnapshot>(TEAM_CONFIGURE_EVENT, {
        gameId,
        mode,
      });

      if (response.success) {
        setTeamSnapshot(response.data);
        setErrorMessage(null);
        return;
      }

      // Non-hosts / unbound sockets: pull current snapshot if any.
      const sync = await emitGameShellWithAck<{ snapshot: PregameTeamSnapshot | null }>(
        TEAM_SYNC_EVENT,
      );
      if (sync.success) {
        setTeamSnapshot(sync.data.snapshot);
      }
    },
    [],
  );

  const selectGame = useCallback(
    (gameId: string) => {
      if (!isHost) {
        return;
      }

      setSelectedGameId(gameId);
      writeSelectedGameId(gameId);
      setSelectedRoundCategoryId(getDefaultRoundCategoryId(gameId));

      if (getGameTeamCapability(gameId)) {
        const mode =
          gameId === GUESSING_CHALLENGE_GAME_ID ? guessingChallengeMode : '1v1';
        void configureTeams(gameId, mode);
      } else {
        setTeamSnapshot(null);
      }
    },
    [configureTeams, guessingChallengeMode, isHost],
  );

  const setGuessingChallengeModeAndTeams = useCallback(
    (mode: GuessingChallengeMode) => {
      setGuessingChallengeMode(mode);
      if (selectedGameId === GUESSING_CHALLENGE_GAME_ID && isHost) {
        void configureTeams(GUESSING_CHALLENGE_GAME_ID, mode);
      }
    },
    [configureTeams, isHost, selectedGameId],
  );

  const assignPlayerTeam = useCallback(
    async (playerId: string, teamId: TeamId) => {
      if (!isHost) {
        return;
      }
      const response = await emitGameShellWithAck<PregameTeamSnapshot>(TEAM_ASSIGN_EVENT, {
        playerId,
        teamId,
      });
      if (response.success) {
        setTeamSnapshot(response.data);
        setErrorMessage(null);
        return;
      }
      setErrorMessage(getGameShellErrorMessage(response.error.code, response.error.message));
    },
    [isHost],
  );

  const randomizeTeams = useCallback(async () => {
    if (!isHost) {
      return;
    }
    const response = await emitGameShellWithAck<PregameTeamSnapshot>(TEAM_RANDOMIZE_EVENT);
    if (response.success) {
      setTeamSnapshot(response.data);
      setErrorMessage(null);
      return;
    }
    setErrorMessage(getGameShellErrorMessage(response.error.code, response.error.message));
  }, [isHost]);

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

  const leaveRoom = useCallback(
    async (redirectTo = '/') => {
      removeSocketListenersRef.current?.();
      clearLocalGameUi();
      setErrorMessage(null);

      await getRoomSessionManager().leave();
      router.replace(redirectTo);
    },
    [clearLocalGameUi, router],
  );

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
      setGuessingChallengeMode: setGuessingChallengeModeAndTeams,
      lockRoom,
      unlockRoom,
      kickPlayer,
      selectGame,
      selectRoundCategory,
      startGame,
      leaveRoom,
      isWaitingForNextMatch: isWaitingForNextMatchValue,
      activeMatchParticipantIds,
      teamSnapshot,
      configureTeams,
      assignPlayerTeam,
      randomizeTeams,
    }),
    [
      activeMatchParticipantIds,
      assignPlayerTeam,
      configureTeams,
      errorMessage,
      isHost,
      isWaitingForNextMatchValue,
      kickPlayer,
      leaveRoom,
      lockRoom,
      player,
      players,
      randomizeTeams,
      room,
      selectGame,
      selectRoundCategory,
      selectedGameId,
      selectedRoundCategoryId,
      setGuessingChallengeModeAndTeams,
      setTimingChallengeSettings,
      startGame,
      status,
      teamSnapshot,
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
