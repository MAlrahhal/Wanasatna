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
import {
  MARATHON_CONTINUE_EVENT,
  MARATHON_END_EVENT,
  MARATHON_PREPARE_EVENT,
  MARATHON_RETURN_TO_LOBBY_EVENT,
  MARATHON_START_EVENT,
  MARATHON_STATE_EVENT,
  MARATHON_SYNC_EVENT,
  GAME_SHELL_STATE_EVENT,
  type GameShellState,
  type MarathonGamePlanItem,
  type MarathonState,
} from '@wanasatna/shared';
import { emitGameShellWithAck } from '@/lib/game-shell/emit';
import type { AuthoritativeRuntimeSnapshot } from '@/lib/room/authoritative-route';
import { getRoomSocket } from '@/lib/room/socket';
import { useRoom } from './room-context';

type MarathonContextValue = {
  state: MarathonState | null;
  errorMessage: string | null;
  prepare: () => Promise<boolean>;
  start: (gamePlan: MarathonGamePlanItem[]) => Promise<boolean>;
  continueNow: () => Promise<void>;
  returnToLobby: () => Promise<void>;
  endMarathon: () => Promise<boolean>;
  reconcileGameShellSync: (
    gameShell: AuthoritativeRuntimeSnapshot<GameShellState>,
  ) => Promise<void>;
};

const MarathonContext = createContext<MarathonContextValue | null>(null);

export function MarathonProvider({ children }: { children: ReactNode }) {
  const {
    status,
    syncActiveGameShell,
    getActiveGameShellRouteSnapshot,
    reconcileAuthoritativeRoute,
  } = useRoom();
  const [state, setState] = useState<MarathonState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const routeSnapshotRef = useRef<AuthoritativeRuntimeSnapshot<MarathonState>>({
    status: 'unknown',
  });
  const syncGenerationRef = useRef(0);

  const applyMarathonState = useCallback(
    (nextState: MarathonState | null) => {
      const marathon: AuthoritativeRuntimeSnapshot<MarathonState> = {
        status: 'ready',
        state: nextState,
      };
      syncGenerationRef.current += 1;
      routeSnapshotRef.current = marathon;
      setState(nextState);
      reconcileAuthoritativeRoute({
        gameShell: getActiveGameShellRouteSnapshot(),
        marathon,
      });
      return marathon;
    },
    [getActiveGameShellRouteSnapshot, reconcileAuthoritativeRoute],
  );

  const syncMarathonState = useCallback(async () => {
    const requestGeneration = syncGenerationRef.current + 1;
    syncGenerationRef.current = requestGeneration;
    routeSnapshotRef.current = { status: 'unknown' };

    const response = await emitGameShellWithAck<{ state: MarathonState | null }>(
      MARATHON_SYNC_EVENT,
    );

    if (response.success && requestGeneration === syncGenerationRef.current) {
      routeSnapshotRef.current = { status: 'ready', state: response.data.state };
      setState(response.data.state);
    }

    return routeSnapshotRef.current;
  }, []);

  const reconcileGameShellSync = useCallback(
    async (gameShell: AuthoritativeRuntimeSnapshot<GameShellState>) => {
      // A mounted /game page may be the first observer after a missed event.
      // Resolve both independent runtimes before making a terminal null-shell
      // decision, so an active Marathon transition cannot be mistaken for Lobby.
      const marathon = await syncMarathonState();
      reconcileAuthoritativeRoute({ gameShell, marathon });
    },
    [reconcileAuthoritativeRoute, syncMarathonState],
  );

  useEffect(() => {
    const socket = getRoomSocket();
    const onState = (payload: { state: MarathonState | null }) => applyMarathonState(payload.state);
    const onShellState = (payload: { state: GameShellState | null }) => {
      reconcileAuthoritativeRoute({
        gameShell: { status: 'ready', state: payload.state },
        marathon: routeSnapshotRef.current,
      });
    };
    socket.on(MARATHON_STATE_EVENT, onState);
    socket.on(GAME_SHELL_STATE_EVENT, onShellState);
    return () => {
      socket.off(MARATHON_STATE_EVENT, onState);
      socket.off(GAME_SHELL_STATE_EVENT, onShellState);
    };
  }, [applyMarathonState, reconcileAuthoritativeRoute]);

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }

    let cancelled = false;
    void Promise.all([syncActiveGameShell(), syncMarathonState()]).then(([gameShell, marathon]) => {
      if (!cancelled) {
        reconcileAuthoritativeRoute({ gameShell, marathon });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reconcileAuthoritativeRoute, status, syncActiveGameShell, syncMarathonState]);

  const prepare = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_PREPARE_EVENT);
    if (!response.success) {
      setErrorMessage(response.error.message);
      return false;
    }
    setErrorMessage(null);
    applyMarathonState(response.data.state);
    return true;
  }, [applyMarathonState]);

  const start = useCallback(
    async (gamePlan: MarathonGamePlanItem[]) => {
      const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_START_EVENT, {
        gamePlan,
      });
      if (!response.success) {
        setErrorMessage(response.error.message);
        return false;
      }
      setErrorMessage(null);
      applyMarathonState(response.data.state);
      return true;
    },
    [applyMarathonState],
  );

  const continueNow = useCallback(async () => {
    if (!state) return;
    const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_CONTINUE_EVENT, {
      marathonId: state.marathonId,
      currentGameIndex: state.currentGameIndex,
      activeShellId: state.activeShellId,
    });
    if (!response.success) {
      setErrorMessage(response.error.message);
      return;
    }
    setErrorMessage(null);
    applyMarathonState(response.data.state);
  }, [applyMarathonState, state]);

  const returnToLobby = useCallback(async () => {
    const response = await emitGameShellWithAck<{ path: '/lobby' }>(MARATHON_RETURN_TO_LOBBY_EVENT);
    if (!response.success) {
      setErrorMessage(response.error.message);
      return;
    }
    setErrorMessage(null);
    const [gameShell, marathon] = await Promise.all([syncActiveGameShell(), syncMarathonState()]);
    reconcileAuthoritativeRoute({ gameShell, marathon });
  }, [reconcileAuthoritativeRoute, syncActiveGameShell, syncMarathonState]);

  const endMarathon = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_END_EVENT);
    if (!response.success) {
      setErrorMessage(response.error.message);
      return false;
    }
    setErrorMessage(null);
    applyMarathonState(response.data.state);
    return true;
  }, [applyMarathonState]);

  const value = useMemo(
    () => ({
      state,
      errorMessage,
      prepare,
      start,
      continueNow,
      returnToLobby,
      endMarathon,
      reconcileGameShellSync,
    }),
    [
      state,
      errorMessage,
      prepare,
      start,
      continueNow,
      returnToLobby,
      endMarathon,
      reconcileGameShellSync,
    ],
  );
  return <MarathonContext.Provider value={value}>{children}</MarathonContext.Provider>;
}

export function useMarathon(): MarathonContextValue {
  const context = useContext(MarathonContext);
  if (!context) throw new Error('useMarathon must be used within MarathonProvider');
  return context;
}
