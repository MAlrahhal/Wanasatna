'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import { unlockGameAudio } from '@/lib/game/sounds';
import {
  GAME_SHELL_NAVIGATE_EVENT,
  END_ROOM_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
  KICK_PLAYER_EVENT,
  LOCK_ROOM_EVENT,
  UNLOCK_ROOM_EVENT,
  GAME_SHELL_STATE_EVENT,
  isWaitingForNextMatch,
  type GameShellNavigatePayload,
  type GameShellState,
  type RoomData,
  type RoomPlayerData,
  type GuessingChallengeMode,
  type DrawGuessDrawerMode,
  type TimingChallengeSettings,
  DRAW_GUESS_GAME_ID,
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
  UPDATE_ROOM_GAME_SETTINGS_EVENT,
  UPDATE_PLAYER_AVATAR_EVENT,
  getGameTeamCapability,
  type PlayerAvatarId,
  type PregameTeamSnapshot,
  type TeamId,
} from '@wanasatna/shared';
import { LOBBY_NOTICE_STORAGE_KEY } from '@/lib/game-shell/null-shell-recovery';
import { emitGameShellWithAck } from '@/lib/game-shell/emit';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';
import { hasClientGamePlugin } from '@/lib/game-plugins/registry';
import { normalizeRoomDates, toLobbyPlayers } from '@/lib/room/map-player';
import {
  planAuthoritativeRoomRoute,
  type AuthoritativeRoomRouteSnapshot,
  type AuthoritativeRuntimeSnapshot,
} from '@/lib/room/authoritative-route';
import {
  buildLobbyUrl,
  lobbyUrlNeedsNormalization,
  readSelectedGameId,
  toCanonicalLobbySearchParams,
  writeSelectedGameId,
} from '@/lib/room/session';
import { getRoomSocket } from '@/lib/room/socket';
import { getRuntimeId, recordContinuity } from '@/lib/room-v2/continuity';
import { emitRoomAck } from '@/lib/room-v2/emit';
import { canAutoResumeWithExplicitName } from '@/lib/room-v2/join-intent';
import { getRoomSessionManager, type RoomManagerState } from '@/lib/room-v2';
import type { RoomLifecycleStatus } from '@/lib/room-v2/types';
import { getDefaultRoundCategoryId } from '@/lib/game/round-categories';
import { replaceHomeClean } from '@/lib/public/home-url';
import { registerAllClientGamePlugins } from '@/plugins';

const DEFAULT_TIMING_CHALLENGE_SETTINGS: TimingChallengeSettings = {
  mode: 'guess-time',
  rounds: TIMING_CHALLENGE_DEFAULT_ROUNDS,
  minSeconds: TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
  maxSeconds: TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
};

type ConnectionStatus = 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'error';
type SessionEndReason = 'kick' | 'closed' | null;

type RoomContextValue = {
  status: ConnectionStatus;
  sessionEndReason: SessionEndReason;
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
  drawGuessDrawerMode: DrawGuessDrawerMode;
  setDrawGuessDrawerMode: (mode: DrawGuessDrawerMode) => void;
  drawGuessFixedPlayerId: string | null;
  setDrawGuessFixedPlayerId: (playerId: string) => void;
  lockRoom: () => Promise<void>;
  unlockRoom: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  updateRoomGameSettings: (gameId: string, settings: Record<string, number>) => Promise<void>;
  updatePlayerAvatar: (avatarId: PlayerAvatarId) => Promise<boolean>;
  selectGame: (gameId: string) => void;
  selectRoundCategory: (categoryId: string) => void;
  startGame: () => Promise<void>;
  leaveRoom: (redirectTo?: string) => Promise<void>;
  endRoom: () => Promise<boolean>;
  activeGameShell: GameShellState | null;
  syncActiveGameShell: () => Promise<AuthoritativeRuntimeSnapshot<GameShellState>>;
  getActiveGameShellRouteSnapshot: () => AuthoritativeRuntimeSnapshot<GameShellState>;
  reconcileAuthoritativeRoute: (snapshot: AuthoritativeRoomRouteSnapshot) => void;
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
    case 'recovering':
      return 'reconnecting';
    case 'entering':
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

  if (roomCode && canonicalizeRoomCode(state.session.roomCode) !== canonicalizeRoomCode(roomCode)) {
    return false;
  }

  return getRoomSocket().connected;
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
  const [sessionEndReason, setSessionEndReason] = useState<SessionEndReason>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [player, setPlayer] = useState<RoomPlayerData | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedRoundCategoryId, setSelectedRoundCategoryId] = useState<string | null>(null);
  const [timingChallengeSettings, setTimingChallengeSettings] = useState<TimingChallengeSettings>(
    DEFAULT_TIMING_CHALLENGE_SETTINGS,
  );
  const [guessingChallengeMode, setGuessingChallengeMode] = useState<GuessingChallengeMode>('1v1');
  const [drawGuessDrawerMode, setDrawGuessDrawerMode] = useState<DrawGuessDrawerMode>('random');
  const [drawGuessFixedPlayerId, setDrawGuessFixedPlayerId] = useState<string | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<PregameTeamSnapshot | null>(null);
  const [activeGameShell, setActiveGameShell] = useState<GameShellState | null>(null);
  // Latest shell for socket callbacks: listener closures must never act on a
  // stale shell snapshot (e.g. suppressing /game navigation for a player who
  // joined the next match after waiting out the previous one).
  const activeGameShellRef = useRef<GameShellState | null>(null);
  const activeGameShellRouteSnapshotRef = useRef<AuthoritativeRuntimeSnapshot<GameShellState>>({
    status: 'unknown',
  });
  const activeGameShellSyncGenerationRef = useRef(0);
  const removeSocketListenersRef = useRef<(() => void) | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const selectedGameIdRef = useRef<string | null>(null);

  const isHost = player?.isHost ?? false;

  const visibleTeamSnapshot = teamSnapshot?.gameId === selectedGameId ? teamSnapshot : null;

  useLayoutEffect(() => {
    if (!(
      status === 'connected' &&
      room?.code &&
      lobbyUrlNeedsNormalization(searchParams, room.code)
    )) {
      searchParamsRef.current = searchParams;
    }
    pathnameRef.current = pathname;
    roomCodeRef.current = room?.code ?? null;
    selectedGameIdRef.current = selectedGameId;
  }, [pathname, room?.code, searchParams, selectedGameId, status]);

  const isWaitingForNextMatchValue = useMemo(
    () => (player ? isWaitingForNextMatch(activeGameShell, player.id) : false),
    [activeGameShell, player],
  );

  const activeMatchParticipantIds = activeGameShell?.matchParticipantIds ?? null;

  const applyActiveGameShell = useCallback((state: GameShellState | null) => {
    const snapshot: AuthoritativeRuntimeSnapshot<GameShellState> = { status: 'ready', state };
    activeGameShellSyncGenerationRef.current += 1;
    activeGameShellRef.current = state;
    activeGameShellRouteSnapshotRef.current = snapshot;
    setActiveGameShell(state);
    return snapshot;
  }, []);

  const getActiveGameShellRouteSnapshot = useCallback(
    () => activeGameShellRouteSnapshotRef.current,
    [],
  );

  const reconcileAuthoritativeRoute = useCallback(
    (snapshot: AuthoritativeRoomRouteSnapshot) => {
      const plan = planAuthoritativeRoomRoute({
        pathname: pathnameRef.current,
        roomCode: roomCodeRef.current,
        snapshot,
      });
      if (!plan) {
        return;
      }

      // Update before App Router commits so duplicate state/events are idempotent.
      pathnameRef.current = plan.pathname;
      router.replace(plan.href, { scroll: false });
    },
    [router],
  );

  const syncActiveGameShell = useCallback(async () => {
    const requestGeneration = activeGameShellSyncGenerationRef.current + 1;
    activeGameShellSyncGenerationRef.current = requestGeneration;
    activeGameShellRouteSnapshotRef.current = { status: 'unknown' };

    const response = await emitGameShellWithAck<{ state: GameShellState | null }>(
      GAME_SHELL_SYNC_EVENT,
    );

    if (response.success && requestGeneration === activeGameShellSyncGenerationRef.current) {
      activeGameShellRef.current = response.data.state;
      activeGameShellRouteSnapshotRef.current = {
        status: 'ready',
        state: response.data.state,
      };
      setActiveGameShell(response.data.state);
    }

    return activeGameShellRouteSnapshotRef.current;
  }, []);

  const canonicalizeActiveLobbyUrl = useCallback(
    (roomCode: string) => {
      if (pathnameRef.current === '/game' || pathnameRef.current === '/marathon') {
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

  const redirectIfActiveGameShell = useCallback(async () => {
    const gameShell = await syncActiveGameShell();
    reconcileAuthoritativeRoute({
      gameShell,
      marathon: { status: 'unknown' },
    });
  }, [reconcileAuthoritativeRoute, syncActiveGameShell]);

  const clearLocalGameUi = useCallback(() => {
    setSelectedGameId(null);
    setSelectedRoundCategoryId(null);
    setTeamSnapshot(null);
    setActiveGameShell(null);
    activeGameShellRef.current = null;
    activeGameShellSyncGenerationRef.current += 1;
    activeGameShellRouteSnapshotRef.current = { status: 'unknown' };
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
      roomCodeRef.current = state.snapshot.room?.code ?? null;
      if (state.status === 'active') {
        setSessionEndReason(null);
      }
    });
  }, []);

  // Self-kick / leave terminal — manager owns PLAYER_KICKED; provider only reacts.
  useEffect(() => {
    const manager = getRoomSessionManager();
    manager.setTerminalHandler((reason) => {
      if (reason !== 'kick' && reason !== 'closed') {
        return;
      }

      clearLocalGameUi();
      setSessionEndReason(reason);
      getRoomSessionManager().markExplicitLeaveHome();
    });

    return () => {
      manager.setTerminalHandler(null);
    };
  }, [clearLocalGameUi]);

  const registerSocketListeners = useCallback(() => {
    const socket = getRoomSocket();

    // Remove only the handlers this provider registered previously. Other
    // providers (e.g. GameShellProvider) share this socket, so removing an
    // event without naming our handler would wipe their listeners too.
    // Core room events (players snapshot, host, lock, kick) stay on the manager.
    removeSocketListenersRef.current?.();

    const onGameShellNavigate = (payload: GameShellNavigatePayload) => {
      if (payload.message) {
        try {
          sessionStorage.setItem(LOBBY_NOTICE_STORAGE_KEY, payload.message);
        } catch {
          /* storage unavailable */
        }
      }

      const path =
        payload.path === '/lobby' && payload.roomCode
          ? buildLobbyUrl(payload.roomCode)
          : payload.path;

      if (payload.path === '/lobby' || path.startsWith('/lobby')) {
        applyActiveGameShell(null);
      }

      if (pathnameRef.current === payload.path && payload.path !== '/lobby') {
        return;
      }
      pathnameRef.current = payload.path;
      router.push(path);
    };

    const onGameShellState = (payload: { state: GameShellState | null }) => {
      applyActiveGameShell(payload.state);
    };

    const onTeamSnapshot = (payload: PregameTeamSnapshot) => {
      const selectedId = selectedGameIdRef.current;
      if (!selectedId || payload.gameId !== selectedId) {
        return;
      }
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
  }, [applyActiveGameShell, router]);

  const urlRoomCode = canonicalizeRoomCode(searchParams.get('code')?.trim() ?? '');
  const urlAction = searchParams.get('action')?.trim() ?? '';
  const urlHasName = searchParams.has('name');
  const urlExplicitName = searchParams.get('name')?.trim() ?? '';

  // Bind lobby URL /game resume to manager — never create/join from effects.
  useEffect(() => {
    let cancelled = false;
    const manager = getRoomSessionManager();

    void (async () => {
      // Cross-bundle first paint may have empty memory; storage is authoritative.
      manager.rehydrateFromStorageIfNeeded();

      const legacyIntent = urlAction === 'create' || urlHasName;
      let state = manager.getState();

      // Live Create/Join must never be treated as post-Leave invite suppression.
      if (manager.hasLiveActiveRoom() || state.status === 'active') {
        manager.clearExplicitLeaveHome();
      }

      recordContinuity('LOBBY_BOOTSTRAP', {
        socketId: getRoomSocket().id ?? null,
        managerId: (manager as { __instanceId?: string }).__instanceId ?? null,
        roomCode: urlRoomCode || state.session?.roomCode || null,
        playerId: state.session?.playerId ?? null,
        status: state.status,
        detail: `runtime=${getRuntimeId()};path=${pathname};urlCode=${urlRoomCode || ''};suppress=${manager.shouldSuppressInvitePrefill()}`,
      });

      if (legacyIntent) {
        if (urlHasName && !canAutoResumeWithExplicitName(state.session, urlExplicitName)) {
          if (urlRoomCode) {
            if (manager.shouldSuppressInvitePrefill()) {
              replaceHomeClean(router);
            } else {
              router.replace(`/?code=${encodeURIComponent(urlRoomCode)}`);
            }
          } else {
            router.replace('/');
          }
          return;
        }

        const sessionCode = state.session?.roomCode
          ? canonicalizeRoomCode(state.session.roomCode)
          : '';
        if (sessionCode) {
          canonicalizeActiveLobbyUrl(sessionCode);
          if (
            !isReusableActiveSession(state, sessionCode) &&
            !manager.hasLiveActiveRoom(sessionCode)
          ) {
            await manager.resumeSameRoom(sessionCode);
            if (cancelled) {
              return;
            }
            restoreSelectedGame();
            await redirectIfActiveGameShell();
          }
          return;
        }

        if (urlRoomCode) {
          if (manager.shouldSuppressInvitePrefill()) {
            replaceHomeClean(router);
          } else {
            router.replace(`/?code=${encodeURIComponent(urlRoomCode)}`);
          }
        } else {
          router.replace('/');
        }
        return;
      }

      if (pathname === '/game' || pathname === '/marathon') {
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
        if (cancelled) {
          return;
        }

        // Stale-effect guard: Leave→Home→Create can leave an old bootstrap IIFE running
        // with a closed-over urlRoomCode for Room A. That effect must not leave() Room B.
        const locationCode = canonicalizeRoomCode(
          typeof window !== 'undefined'
            ? (new URL(window.location.href).searchParams.get('code') ?? '')
            : urlRoomCode,
        );
        if (locationCode && locationCode !== urlRoomCode) {
          state = manager.getState();
          const liveCode = state.session?.roomCode
            ? canonicalizeRoomCode(state.session.roomCode)
            : '';
          if (liveCode && (manager.hasLiveActiveRoom(liveCode) || state.status === 'active')) {
            manager.clearExplicitLeaveHome();
            canonicalizeActiveLobbyUrl(liveCode);
            recordContinuity('LOBBY_BOOTSTRAP_STALE', {
              roomCode: urlRoomCode,
              detail: `canonicalize-live;effect=${urlRoomCode};live=${liveCode};loc=${locationCode}`,
            });
            return;
          }
          recordContinuity('LOBBY_BOOTSTRAP_STALE', {
            roomCode: urlRoomCode,
            detail: `effectCode=${urlRoomCode};locationCode=${locationCode}`,
          });
          return;
        }
        if (pathname !== '/lobby' && pathname !== '/game' && pathname !== '/marathon') {
          return;
        }

        state = manager.getState();
        const sessionCode = state.session?.roomCode
          ? canonicalizeRoomCode(state.session.roomCode)
          : '';

        if (sessionCode === urlRoomCode) {
          // Fresh Create/Join: socket already bound — never resume, never redirect Home.
          if (
            manager.hasLiveActiveRoom(urlRoomCode) ||
            isReusableActiveSession(state, urlRoomCode)
          ) {
            manager.clearExplicitLeaveHome();
            recordContinuity('LOBBY_REUSE_LIVE', {
              socketId: getRoomSocket().id ?? null,
              managerId: (manager as { __instanceId?: string }).__instanceId ?? null,
              roomCode: urlRoomCode,
              playerId: state.session?.playerId ?? null,
              status: state.status,
            });
            await redirectIfActiveGameShell();
            return;
          }

          const resumed = await manager.resumeSameRoom(urlRoomCode);
          if (cancelled) {
            return;
          }

          if (resumed.success) {
            restoreSelectedGame();
            await redirectIfActiveGameShell();
            return;
          }

          // Matching session failed to resume — stay on Lobby with error.
          // Do NOT redirect `/?code=` (that was the production Create→Home bounce).
          return;
        }

        // Create/Join still finishing navigation — do not bounce Home mid-flight.
        if (manager.isEnterInFlight()) {
          return;
        }

        // Live Room B must not be destroyed by a stale effect for Room A.
        if (
          manager.hasLiveActiveRoom() ||
          (state.status === 'active' && sessionCode && sessionCode !== urlRoomCode)
        ) {
          manager.clearExplicitLeaveHome();
          if (sessionCode) {
            const nextUrl = `/lobby?code=${encodeURIComponent(sessionCode)}`;
            if (typeof window !== 'undefined') {
              window.history.replaceState(window.history.state, '', nextUrl);
            }
            router.push(nextUrl);
          }
          recordContinuity('LOBBY_BOOTSTRAP_STALE', {
            roomCode: urlRoomCode,
            detail: `refuse-leave-live;session=${sessionCode}`,
          });
          return;
        }

        // Explicit Leave must never become an invite to the room just left.
        if (
          manager.shouldSuppressInvitePrefill() &&
          !manager.hasLiveActiveRoom() &&
          state.status !== 'active'
        ) {
          replaceHomeClean(router);
          return;
        }

        // Different room in URL than active session / no session on lobby code URL.
        if (state.session) {
          if (cancelled) {
            return;
          }
          await manager.leave();
          if (cancelled) {
            return;
          }
        }

        // Genuine shared /lobby?code= link without a session → invite Home prefill only.
        if (manager.shouldSuppressInvitePrefill()) {
          replaceHomeClean(router);
          return;
        }
        router.replace(`/?code=${encodeURIComponent(urlRoomCode)}`);
        return;
      }

      // /lobby with no code: recover bound/persisted session or send home.
      // Soft-nav can briefly mount with empty searchParams — do NOT bounce Home
      // when ActiveRoomSession still exists in memory or storage.
      state = manager.getState();
      manager.rehydrateFromStorageIfNeeded();
      state = manager.getState();
      const recoveredCode = state.session?.roomCode
        ? canonicalizeRoomCode(state.session.roomCode)
        : '';

      if (recoveredCode) {
        manager.clearExplicitLeaveHome();
        canonicalizeActiveLobbyUrl(recoveredCode);
        if (
          !isReusableActiveSession(state, recoveredCode) &&
          !manager.hasLiveActiveRoom(recoveredCode)
        ) {
          await manager.resumeSameRoom(recoveredCode);
          if (cancelled) {
            return;
          }
          restoreSelectedGame();
          await redirectIfActiveGameShell();
        }
        return;
      }

      if (manager.isEnterInFlight()) {
        return;
      }

      if (manager.shouldSuppressInvitePrefill()) {
        replaceHomeClean(router);
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
    urlExplicitName,
    urlHasName,
    urlRoomCode,
  ]);

  // Keep canonical `/lobby?code=` aligned with the LIVE session — beats stale
  // App Router searchParams that briefly revive a previously left room code.
  useEffect(() => {
    if (status !== 'connected' || !room?.code) {
      return;
    }

    const liveCode = canonicalizeRoomCode(room.code);
    if (urlAction === 'create' || urlHasName || !urlRoomCode || urlRoomCode !== liveCode) {
      canonicalizeActiveLobbyUrl(liveCode);
    }
  }, [status, room?.code, urlAction, urlHasName, urlRoomCode, canonicalizeActiveLobbyUrl]);

  // Keep runtime listeners attached across transport reconnects. Correctness does
  // not depend on a broadcast adjacent to the resume ACK; MarathonProvider also
  // performs explicit acknowledged runtime sync after every active transition.
  useEffect(() => {
    registerSocketListeners();

    return () => {
      removeSocketListenersRef.current?.();
    };
  }, [registerSocketListeners]);

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }

    const skipTeamSync = pathname === '/game' || pathname === '/marathon';

    if (!skipTeamSync) {
      void (async () => {
        const sync = await emitGameShellWithAck<{ snapshot: PregameTeamSnapshot | null }>(
          TEAM_SYNC_EVENT,
        );
        if (sync.success) {
          setTeamSnapshot(sync.data.snapshot);
        }
      })();
    }
  }, [pathname, status]);

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

  const updateRoomGameSettings = useCallback(
    async (gameId: string, settings: Record<string, number>) => {
      const response = await emitRoomAck<{
        roomId: string;
        gameSettings: RoomData['gameSettings'];
      }>(UPDATE_ROOM_GAME_SETTINGS_EVENT, { gameId, settings });

      if (!response.success) {
        setErrorMessage(getRoomErrorMessage(response.error.code, response.error.message));
      }
    },
    [],
  );

  const updatePlayerAvatar = useCallback(async (avatarId: PlayerAvatarId) => {
    const response = await emitRoomAck<{ avatarId: PlayerAvatarId }>(UPDATE_PLAYER_AVATAR_EVENT, {
      avatarId,
    });

    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code, response.error.message));
      return false;
    }

    setErrorMessage(null);
    return true;
  }, []);

  const endRoom = useCallback(async () => {
    const response = await emitRoomAck<{ roomId: string }>(END_ROOM_EVENT);
    if (!response.success) {
      setErrorMessage(getRoomErrorMessage(response.error.code, response.error.message));
      return false;
    }
    setErrorMessage(null);
    return true;
  }, []);

  const configureTeams = useCallback(async (gameId: string, mode: string) => {
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
  }, []);

  const selectGame = useCallback(
    (gameId: string) => {
      if (!isHost) {
        return;
      }

      if (!gameId) {
        setSelectedGameId(null);
        writeSelectedGameId(null);
        setTeamSnapshot(null);
        return;
      }

      setSelectedGameId(gameId);
      writeSelectedGameId(gameId);
      setSelectedRoundCategoryId(getDefaultRoundCategoryId(gameId));

      if (getGameTeamCapability(gameId)) {
        const mode = gameId === GUESSING_CHALLENGE_GAME_ID ? guessingChallengeMode : '1v1';
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

    unlockGameAudio();

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
          ? {
              timingChallenge: {
                mode: timingChallengeSettings.mode,
                minSeconds: timingChallengeSettings.minSeconds,
                maxSeconds: timingChallengeSettings.maxSeconds,
              },
            }
          : {}),
        ...(selectedGameId === GUESSING_CHALLENGE_GAME_ID
          ? { guessingChallenge: { mode: guessingChallengeMode } }
          : {}),
        ...(selectedGameId === DRAW_GUESS_GAME_ID
          ? {
              drawGuess: {
                drawerMode: drawGuessDrawerMode,
                ...(drawGuessDrawerMode === 'fixed' && drawGuessFixedPlayerId
                  ? { fixedPlayerId: drawGuessFixedPlayerId }
                  : {}),
              },
            }
          : {}),
      },
    );

    if (!response.success) {
      setErrorMessage(getGameShellErrorMessage(response.error.code, response.error.message));
      if (response.error.code === 'GAME_DISABLED') {
        setSelectedGameId(null);
        writeSelectedGameId(null);
      }
      return;
    }

    setErrorMessage(null);
    const gameShell = applyActiveGameShell(response.data.state);
    reconcileAuthoritativeRoute({
      gameShell,
      marathon: { status: 'unknown' },
    });
  }, [
    applyActiveGameShell,
    drawGuessDrawerMode,
    drawGuessFixedPlayerId,
    guessingChallengeMode,
    isHost,
    reconcileAuthoritativeRoute,
    selectedGameId,
    selectedRoundCategoryId,
    timingChallengeSettings,
  ]);

  const leaveRoom = useCallback(
    async (redirectTo = '/') => {
      removeSocketListenersRef.current?.();
      clearLocalGameUi();
      setErrorMessage(null);

      const manager = getRoomSessionManager();

      let pathname = '/';
      try {
        pathname = new URL(redirectTo, 'http://local.invalid').pathname || '/';
      } catch {
        pathname = redirectTo.split('?')[0] || '/';
      }

      // Explicit Leave → Home must be exactly `/` (never /?code=OLD).
      if (pathname === '/' || pathname === '') {
        // Mark before clearing so any lobby bootstrap during leave() cannot
        // rewrite empty-session + /lobby?code= into an invite /?code=OLD.
        manager.markExplicitLeaveHome();
        // Finish server leave + socket teardown BEFORE Home Create/Join can start.
        // Navigating first caused Create to race Leave.finally and get INTERNAL_ERROR.
        await manager.leave();
        replaceHomeClean(router);
        return;
      }

      await manager.leave();
      router.replace(redirectTo);
    },
    [clearLocalGameUi, router],
  );

  const value = useMemo<RoomContextValue>(
    () => ({
      status,
      sessionEndReason,
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
      drawGuessDrawerMode,
      setDrawGuessDrawerMode,
      drawGuessFixedPlayerId,
      setDrawGuessFixedPlayerId,
      lockRoom,
      unlockRoom,
      kickPlayer,
      updateRoomGameSettings,
      updatePlayerAvatar,
      selectGame,
      selectRoundCategory,
      startGame,
      leaveRoom,
      endRoom,
      activeGameShell,
      syncActiveGameShell,
      getActiveGameShellRouteSnapshot,
      reconcileAuthoritativeRoute,
      isWaitingForNextMatch: isWaitingForNextMatchValue,
      activeMatchParticipantIds,
      teamSnapshot: visibleTeamSnapshot,
      configureTeams,
      assignPlayerTeam,
      randomizeTeams,
    }),
    [
      activeGameShell,
      activeMatchParticipantIds,
      assignPlayerTeam,
      configureTeams,
      errorMessage,
      endRoom,
      getActiveGameShellRouteSnapshot,
      isHost,
      isWaitingForNextMatchValue,
      kickPlayer,
      leaveRoom,
      lockRoom,
      player,
      players,
      randomizeTeams,
      reconcileAuthoritativeRoute,
      room,
      selectGame,
      selectRoundCategory,
      selectedGameId,
      selectedRoundCategoryId,
      sessionEndReason,
      setGuessingChallengeModeAndTeams,
      setTimingChallengeSettings,
      drawGuessDrawerMode,
      drawGuessFixedPlayerId,
      startGame,
      status,
      syncActiveGameShell,
      visibleTeamSnapshot,
      timingChallengeSettings,
      guessingChallengeMode,
      updateRoomGameSettings,
      updatePlayerAvatar,
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
