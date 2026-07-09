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
import { useRouter, useSearchParams } from 'next/navigation';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import {
  CREATE_ROOM_EVENT,
  HOST_CHANGED_EVENT,
  JOIN_ROOM_EVENT,
  KICK_PLAYER_EVENT,
  LEAVE_ROOM_EVENT,
  LOCK_ROOM_EVENT,
  PLAYER_KICKED_EVENT,
  RECONNECT_EVENT,
  ROOM_UPDATED_EVENT,
  UNLOCK_ROOM_EVENT,
} from '@/lib/room/events';
import { normalizeRoomDates, toLobbyPlayer } from '@/lib/room/map-player';
import {
  clearRoomSession,
  readRoomSession,
  readSelectedGameId,
  writeRoomSession,
  writeSelectedGameId,
} from '@/lib/room/session';
import { disconnectRoomSocket, getRoomSocket } from '@/lib/room/socket';
import type {
  HostChangedPayload,
  PlayerKickedPayload,
  ReconnectResponse,
  RoomActionResponse,
  RoomData,
  RoomErrorCode,
  RoomPlayerData,
  RoomSessionData,
  RoomUpdatedPayload,
} from '@/lib/room/types';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type RoomContextValue = {
  status: ConnectionStatus;
  errorMessage: string | null;
  room: RoomData | null;
  player: RoomPlayerData | null;
  players: LobbyPlayer[];
  isHost: boolean;
  selectedGameId: string | null;
  lockRoom: () => Promise<void>;
  unlockRoom: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  selectGame: (gameId: string) => void;
  leaveRoom: () => Promise<void>;
};

const RoomContext = createContext<RoomContextValue | null>(null);

function emitWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<RoomActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (response: RoomActionResponse<T>) => {
      resolve(response);
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
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [player, setPlayer] = useState<RoomPlayerData | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const isHost = player?.isHost ?? false;

  const upsertPlayer = useCallback((nextPlayer: RoomPlayerData) => {
    const lobbyPlayer = toLobbyPlayer(nextPlayer);

    setPlayers((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === lobbyPlayer.id);

      if (existingIndex === -1) {
        return [...current, lobbyPlayer];
      }

      const updated = [...current];
      updated[existingIndex] = lobbyPlayer;
      return updated;
    });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setPlayers((current) => current.filter((entry) => entry.id !== playerId));
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
      setPlayers([toLobbyPlayer(data.player)]);
      applySessionFromData(data);
      setStatus('connected');
      setErrorMessage(null);
      router.replace(`/lobby?code=${normalizedRoom.code}`, { scroll: false });
    },
    [router],
  );

  const handleFailure = useCallback((code: RoomErrorCode, fallback?: string) => {
    setStatus('error');
    setErrorMessage(getRoomErrorMessage(code, fallback));
  }, []);

  const registerSocketListeners = useCallback(() => {
    const socket = getRoomSocket();

    socket.off(JOIN_ROOM_EVENT);
    socket.off(LEAVE_ROOM_EVENT);
    socket.off(KICK_PLAYER_EVENT);
    socket.off(HOST_CHANGED_EVENT);
    socket.off(ROOM_UPDATED_EVENT);
    socket.off(PLAYER_KICKED_EVENT);

    socket.on(JOIN_ROOM_EVENT, (payload: { player: RoomPlayerData }) => {
      upsertPlayer(payload.player);
    });

    socket.on(LEAVE_ROOM_EVENT, (payload: { playerId: string }) => {
      removePlayer(payload.playerId);
    });

    socket.on(KICK_PLAYER_EVENT, (payload: { playerId: string }) => {
      removePlayer(payload.playerId);
    });

    socket.on(HOST_CHANGED_EVENT, (payload: HostChangedPayload) => {
      applyHostChange(payload);
    });

    socket.on(ROOM_UPDATED_EVENT, (payload: RoomUpdatedPayload) => {
      setRoom((current) => (current ? { ...current, isLocked: payload.isLocked } : current));
    });

    socket.on(PLAYER_KICKED_EVENT, (payload: PlayerKickedPayload) => {
      clearRoomSession();
      setStatus('error');
      setErrorMessage('تم طردك من الغرفة.');
      setRoom(null);
      setPlayer(null);
      setPlayers([]);
      setSelectedGameId(null);
      disconnectRoomSocket();

      if (payload.roomId) {
        router.push('/');
      }
    });
  }, [applyHostChange, removePlayer, router, upsertPlayer]);

  const connectToRoom = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);

    const socket = getRoomSocket();

    if (!socket.connected) {
      socket.connect();
    }

    registerSocketListeners();

    const storedSession = readRoomSession();
    const roomCode = searchParams.get('code');
    const playerName = searchParams.get('name');
    const action = searchParams.get('action');

    if (storedSession?.playerId) {
      const response = (await emitWithAck<RoomSessionData>(RECONNECT_EVENT, {
        playerId: storedSession.playerId,
      })) as ReconnectResponse;

      if (response.success) {
        applyRoomSession(response.data);
        setSelectedGameId(readSelectedGameId());
        return;
      }

      if (response.hostChanged) {
        applyHostChange(response.hostChanged);
      }

      clearRoomSession();
      handleFailure(response.error.code);
      return;
    }

    if (roomCode && playerName) {
      const response = await emitWithAck<RoomSessionData>(JOIN_ROOM_EVENT, {
        roomCode,
        playerName,
      });

      if (response.success) {
        applyRoomSession(response.data);
        return;
      }

      handleFailure(response.error.code);
      return;
    }

    if (action === 'create' && playerName) {
      const response = await emitWithAck<RoomSessionData>(CREATE_ROOM_EVENT, {
        playerName,
      });

      if (response.success) {
        applyRoomSession(response.data);
        setSelectedGameId(readSelectedGameId());
        return;
      }

      handleFailure(response.error.code);
      return;
    }

    setStatus('error');
    setErrorMessage('تعذر الاتصال بالغرفة. استخدم رابط الانضمام أو أنشئ غرفة جديدة.');
  }, [
    applyHostChange,
    applyRoomSession,
    handleFailure,
    registerSocketListeners,
    searchParams,
  ]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void connectToRoom();

    return () => {
      disconnectRoomSocket();
    };
  }, [connectToRoom]);

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
    },
    [isHost],
  );

  const leaveRoom = useCallback(async () => {
    const response = await emitWithAck<{ roomDeleted: boolean; hostChanged: HostChangedPayload | null }>(
      LEAVE_ROOM_EVENT,
    );

    clearRoomSession();
    disconnectRoomSocket();
    setRoom(null);
    setPlayer(null);
    setPlayers([]);
    setSelectedGameId(null);

    if (!response.success) {
      router.push('/');
      return;
    }

    router.push('/');
  }, [router]);

  const value = useMemo<RoomContextValue>(
    () => ({
      status,
      errorMessage,
      room,
      player,
      players,
      isHost,
      selectedGameId,
      lockRoom,
      unlockRoom,
      kickPlayer,
      selectGame,
      leaveRoom,
    }),
    [
      errorMessage,
      isHost,
      kickPlayer,
      leaveRoom,
      lockRoom,
      player,
      players,
      room,
      selectGame,
      selectedGameId,
      status,
      unlockRoom,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);

  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }

  return context;
}
