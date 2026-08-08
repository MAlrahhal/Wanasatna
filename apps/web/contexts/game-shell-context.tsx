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
  GAME_SHELL_CANCEL_COUNTDOWN_EVENT,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_INIT_EVENT,
  GAME_SHELL_PLAYER_RECOVERY_EVENT,
  GAME_SHELL_RESET_EVENT,
  GAME_SHELL_RETURN_TO_LOBBY_EVENT,
  GAME_SHELL_SET_READY_EVENT,
  GAME_SHELL_START_COUNTDOWN_EVENT,
  GAME_SHELL_STATE_EVENT,
  GAME_SHELL_SYNC_EVENT,
  type GameShellPlayerRecoveryPayload,
  type GameShellState,
  type InitGameShellPayload,
} from '@wanasatna/shared';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';
import { emitGameShellWithAck } from '@/lib/game-shell/emit';
import { getRoomSocket } from '@/lib/room/socket';

type GameShellContextValue = {
  state: GameShellState | null;
  playerRecovery: GameShellPlayerRecoveryPayload | null;
  errorMessage: string | null;
  isHost: boolean;
  isReady: boolean;
  initShell: (payload?: InitGameShellPayload) => Promise<void>;
  syncShell: () => Promise<void>;
  setReady: (isReady: boolean) => Promise<void>;
  startCountdown: () => Promise<void>;
  cancelCountdown: () => Promise<void>;
  endGame: () => Promise<void>;
  resetShell: () => Promise<void>;
  returnToLobby: () => Promise<void>;
};

const GameShellContext = createContext<GameShellContextValue | null>(null);

export function GameShellProvider({
  children,
  hostPlayerId,
  currentPlayerId,
}: {
  children: ReactNode;
  hostPlayerId: string | null;
  currentPlayerId: string | null;
}) {
  const [state, setState] = useState<GameShellState | null>(null);
  const [playerRecovery, setPlayerRecovery] = useState<GameShellPlayerRecoveryPayload | null>(null);
  const recoverySequenceRef = useRef(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHost = Boolean(
    hostPlayerId && currentPlayerId && hostPlayerId === currentPlayerId,
  );

  const isReady = Boolean(
    currentPlayerId && state?.readyPlayerIds.includes(currentPlayerId),
  );

  const handleFailure = useCallback((code: Parameters<typeof getGameShellErrorMessage>[0]) => {
    setErrorMessage(getGameShellErrorMessage(code));
  }, []);

  useEffect(() => {
    const socket = getRoomSocket();

    function onStateUpdate(payload: { state: GameShellState }) {
      setState(payload.state);
      setErrorMessage(null);
    }

    function onRecoveryUpdate(payload: GameShellPlayerRecoveryPayload) {
      if (payload.sequence < recoverySequenceRef.current) {
        return;
      }

      recoverySequenceRef.current = payload.sequence;

      if (!payload.isActive) {
        setPlayerRecovery(null);
        return;
      }

      setPlayerRecovery(payload);
    }

    socket.on(GAME_SHELL_STATE_EVENT, onStateUpdate);
    socket.on(GAME_SHELL_PLAYER_RECOVERY_EVENT, onRecoveryUpdate);

    return () => {
      socket.off(GAME_SHELL_STATE_EVENT, onStateUpdate);
      socket.off(GAME_SHELL_PLAYER_RECOVERY_EVENT, onRecoveryUpdate);
    };
  }, []);

  const syncShell = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: GameShellState | null }>(
      GAME_SHELL_SYNC_EVENT,
    );

    if (!response.success) {
      handleFailure(response.error.code);
      return;
    }

    setState(response.data.state);
  }, [handleFailure]);

  useEffect(() => {
    if (!currentPlayerId) {
      return;
    }

    void syncShell();
  }, [currentPlayerId, syncShell]);

  const initShell = useCallback(
    async (payload: InitGameShellPayload = {}) => {
      const response = await emitGameShellWithAck<{ state: GameShellState }>(
        GAME_SHELL_INIT_EVENT,
        payload,
      );

      if (!response.success) {
        handleFailure(response.error.code);
        return;
      }

      setState(response.data.state);
      setErrorMessage(null);
    },
    [handleFailure],
  );

  const setReady = useCallback(
    async (ready: boolean) => {
      const response = await emitGameShellWithAck<{ state: GameShellState }>(
        GAME_SHELL_SET_READY_EVENT,
        { isReady: ready },
      );

      if (!response.success) {
        handleFailure(response.error.code);
        return;
      }

      setState(response.data.state);
    },
    [handleFailure],
  );

  const startCountdown = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: GameShellState }>(
      GAME_SHELL_START_COUNTDOWN_EVENT,
    );

    if (!response.success) {
      handleFailure(response.error.code);
      return;
    }

    setState(response.data.state);
  }, [handleFailure]);

  const cancelCountdown = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: GameShellState }>(
      GAME_SHELL_CANCEL_COUNTDOWN_EVENT,
    );

    if (!response.success) {
      handleFailure(response.error.code);
      return;
    }

    setState(response.data.state);
  }, [handleFailure]);

  const endGame = useCallback(async () => {
    const response = await emitGameShellWithAck<{ path: '/lobby' }>(GAME_SHELL_END_EVENT);

    if (!response.success) {
      handleFailure(response.error.code);
      return;
    }

    setState(null);
    setPlayerRecovery(null);
    setErrorMessage(null);
  }, [handleFailure]);

  const resetShell = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: GameShellState }>(
      GAME_SHELL_RESET_EVENT,
    );

    if (!response.success) {
      handleFailure(response.error.code);
      return;
    }

    setState(response.data.state);
  }, [handleFailure]);

  const returnToLobby = useCallback(async () => {
    const response = await emitGameShellWithAck<{ path: '/lobby' }>(
      GAME_SHELL_RETURN_TO_LOBBY_EVENT,
    );

    if (!response.success) {
      handleFailure(response.error.code);
    }
  }, [handleFailure]);

  const value = useMemo<GameShellContextValue>(
    () => ({
      state,
      playerRecovery,
      errorMessage,
      isHost,
      isReady,
      initShell,
      syncShell,
      setReady,
      startCountdown,
      cancelCountdown,
      endGame,
      resetShell,
      returnToLobby,
    }),
    [
      cancelCountdown,
      endGame,
      errorMessage,
      initShell,
      isHost,
      isReady,
      playerRecovery,
      resetShell,
      returnToLobby,
      setReady,
      startCountdown,
      state,
      syncShell,
    ],
  );

  return <GameShellContext.Provider value={value}>{children}</GameShellContext.Provider>;
}

export function useGameShell(): GameShellContextValue {
  const context = useContext(GameShellContext);

  if (!context) {
    throw new Error('useGameShell must be used within GameShellProvider');
  }

  return context;
}
