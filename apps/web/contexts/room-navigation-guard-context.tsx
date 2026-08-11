'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useOptionalRoom } from '@/contexts/room-context';
import { RoomNavigationGuardDialog } from '@/components/room/room-navigation-guard-dialog';
import { shouldGuardNavigation } from '@/lib/room/navigation-guard';
import { getRoomSessionManager, readPersistedActiveRoomSession } from '@/lib/room-v2';

type RoomNavigationGuardContextValue = {
  hasActiveRoomSession: boolean;
  requestNavigation: (href: string) => void;
};

const RoomNavigationGuardContext = createContext<RoomNavigationGuardContextValue | null>(null);

export function RoomNavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const optionalRoom = useOptionalRoom();
  const [storedSessionActive, setStoredSessionActive] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const syncStoredSession = useCallback(() => {
    setStoredSessionActive(readPersistedActiveRoomSession() !== null);
  }, []);

  useEffect(() => {
    syncStoredSession();
  }, [optionalRoom?.status, optionalRoom?.room?.id, syncStoredSession]);

  const hasActiveRoomSession =
    (optionalRoom?.status === 'connected' && optionalRoom.room !== null) || storedSessionActive;

  const requestNavigation = useCallback(
    (href: string) => {
      if (!shouldGuardNavigation(hasActiveRoomSession, href)) {
        router.push(href);
        return;
      }

      setPendingHref(href);
    },
    [hasActiveRoomSession, router],
  );

  const handleStayInRoom = useCallback(() => {
    setPendingHref(null);
  }, []);

  const handleLeaveAndContinue = useCallback(async () => {
    if (!pendingHref || isLeaving) {
      return;
    }

    setIsLeaving(true);

    try {
      if (optionalRoom?.leaveRoom) {
        await optionalRoom.leaveRoom(pendingHref);
      } else {
        await getRoomSessionManager().leave();
        router.replace(pendingHref);
      }
    } finally {
      setIsLeaving(false);
      setPendingHref(null);
      syncStoredSession();
    }
  }, [isLeaving, optionalRoom, pendingHref, router, syncStoredSession]);

  const value = useMemo(
    () => ({
      hasActiveRoomSession,
      requestNavigation,
    }),
    [hasActiveRoomSession, requestNavigation],
  );

  return (
    <RoomNavigationGuardContext.Provider value={value}>
      {children}
      <RoomNavigationGuardDialog
        open={pendingHref !== null}
        isLeaving={isLeaving}
        onStay={handleStayInRoom}
        onLeaveAndContinue={() => void handleLeaveAndContinue()}
      />
    </RoomNavigationGuardContext.Provider>
  );
}

export function useRoomNavigationGuard(): RoomNavigationGuardContextValue {
  const context = useContext(RoomNavigationGuardContext);

  if (!context) {
    throw new Error('useRoomNavigationGuard must be used within RoomNavigationGuardProvider');
  }

  return context;
}

export function useOptionalRoomNavigationGuard(): RoomNavigationGuardContextValue | null {
  return useContext(RoomNavigationGuardContext);
}
