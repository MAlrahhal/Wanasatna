'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  MARATHON_CONTINUE_EVENT,
  MARATHON_PREPARE_EVENT,
  MARATHON_RETURN_TO_LOBBY_EVENT,
  MARATHON_START_EVENT,
  MARATHON_STATE_EVENT,
  MARATHON_SYNC_EVENT,
  type MarathonGamePlanItem,
  type MarathonState,
} from '@wanasatna/shared';
import { emitGameShellWithAck } from '@/lib/game-shell/emit';
import { getRoomSocket } from '@/lib/room/socket';
import { useRoom } from './room-context';

type MarathonContextValue = {
  state: MarathonState | null;
  errorMessage: string | null;
  prepare: () => Promise<boolean>;
  start: (gamePlan: MarathonGamePlanItem[]) => Promise<boolean>;
  continueNow: () => Promise<void>;
  returnToLobby: () => Promise<void>;
};

const MarathonContext = createContext<MarathonContextValue | null>(null);

export function MarathonProvider({ children }: { children: ReactNode }) {
  const { status } = useRoom();
  const [state, setState] = useState<MarathonState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = getRoomSocket();
    const onState = (payload: { state: MarathonState }) => setState(payload.state);
    socket.on(MARATHON_STATE_EVENT, onState);
    return () => {
      socket.off(MARATHON_STATE_EVENT, onState);
    };
  }, []);

  useEffect(() => {
    if (status !== 'connected') {
      return;
    }
    void emitGameShellWithAck<{ state: MarathonState | null }>(MARATHON_SYNC_EVENT).then(
      (response) => {
        if (response.success) {
          setState(response.data.state);
        }
      },
    );
  }, [status]);

  const prepare = useCallback(async () => {
    const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_PREPARE_EVENT);
    if (!response.success) {
      setErrorMessage(response.error.message);
      return false;
    }
    setErrorMessage(null);
    setState(response.data.state);
    return true;
  }, []);

  const start = useCallback(async (gamePlan: MarathonGamePlanItem[]) => {
    const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_START_EVENT, {
      gamePlan,
    });
    if (!response.success) {
      setErrorMessage(response.error.message);
      return false;
    }
    setErrorMessage(null);
    setState(response.data.state);
    return true;
  }, []);

  const continueNow = useCallback(async () => {
    if (!state) return;
    const response = await emitGameShellWithAck<{ state: MarathonState }>(MARATHON_CONTINUE_EVENT, {
      marathonId: state.marathonId,
      currentGameIndex: state.currentGameIndex,
      activeShellId: state.activeShellId,
    });
    if (!response.success) setErrorMessage(response.error.message);
  }, [state]);

  const returnToLobby = useCallback(async () => {
    const response = await emitGameShellWithAck<{ path: '/lobby' }>(MARATHON_RETURN_TO_LOBBY_EVENT);
    if (!response.success) setErrorMessage(response.error.message);
  }, []);

  const value = useMemo(
    () => ({ state, errorMessage, prepare, start, continueNow, returnToLobby }),
    [state, errorMessage, prepare, start, continueNow, returnToLobby],
  );
  return <MarathonContext.Provider value={value}>{children}</MarathonContext.Provider>;
}

export function useMarathon(): MarathonContextValue {
  const context = useContext(MarathonContext);
  if (!context) throw new Error('useMarathon must be used within MarathonProvider');
  return context;
}
