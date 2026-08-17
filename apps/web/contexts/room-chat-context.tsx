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
  ROOM_CHAT_MESSAGE_EVENT,
  ROOM_CHAT_SEND_EVENT,
  ROOM_CHAT_SYNC_EVENT,
  type RoomChatHistoryData,
  type RoomChatMessage,
  type RoomChatSendData,
} from '@wanasatna/shared';
import { useRoom } from '@/contexts/room-context';
import { emitRoomAck } from '@/lib/room-v2/emit';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import { getRoomSocket } from '@/lib/room/socket';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';

type RoomChatContextValue = {
  messages: RoomChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  loadError: string | null;
  sendError: string | null;
  reload: () => Promise<void>;
  send: (content: string) => Promise<boolean>;
};

const RoomChatContext = createContext<RoomChatContextValue | null>(null);

function upsertMessage(list: RoomChatMessage[], incoming: RoomChatMessage): RoomChatMessage[] {
  if (list.some((message) => message.id === incoming.id)) {
    return list;
  }
  return [...list, incoming];
}

export function RoomChatProvider({ children }: { children: ReactNode }) {
  const { player, status } = useRoom();
  const playerId = player?.id ?? null;
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!playerId) {
      setMessages([]);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    const response = await emitRoomAck<RoomChatHistoryData>(ROOM_CHAT_SYNC_EVENT, {});
    setIsLoading(false);

    if (!response.success) {
      setLoadError(getRoomErrorMessage(response.error.code, SYSTEM_COPY.chatLoadFailed));
      return;
    }

    setLoadError(null);
    setMessages(response.data.messages);
  }, [playerId]);

  useEffect(() => {
    void reload();
  }, [reload, status]);

  useEffect(() => {
    if (!playerId) {
      return;
    }

    const socket = getRoomSocket();
    const onMessage = (payload: RoomChatMessage) => {
      if (!payload?.id || typeof payload.content !== 'string') {
        return;
      }
      setMessages((current) => upsertMessage(current, payload));
    };

    socket.on(ROOM_CHAT_MESSAGE_EVENT, onMessage);
    return () => {
      socket.off(ROOM_CHAT_MESSAGE_EVENT, onMessage);
    };
  }, [playerId]);

  const send = useCallback(
    async (content: string) => {
      if (!playerId) {
        return false;
      }

      setIsSending(true);
      setSendError(null);
      const response = await emitRoomAck<RoomChatSendData>(ROOM_CHAT_SEND_EVENT, { content });
      setIsSending(false);

      if (!response.success) {
        setSendError(
          getRoomErrorMessage(response.error.code, response.error.message) || SYSTEM_COPY.chatSendFailed,
        );
        return false;
      }

      setMessages((current) => upsertMessage(current, response.data.message));
      return true;
    },
    [playerId],
  );

  const value = useMemo(
    () => ({
      messages,
      isLoading,
      isSending,
      loadError,
      sendError,
      reload,
      send,
    }),
    [messages, isLoading, isSending, loadError, sendError, reload, send],
  );

  return <RoomChatContext.Provider value={value}>{children}</RoomChatContext.Provider>;
}

export function useRoomChat(): RoomChatContextValue {
  const value = useContext(RoomChatContext);
  if (!value) {
    throw new Error('useRoomChat must be used within RoomChatProvider');
  }
  return value;
}
