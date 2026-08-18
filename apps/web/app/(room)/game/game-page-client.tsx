'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { GameShellProvider } from '@/contexts/game-shell-context';
import { GameShellScreen } from '@/components/game-shell/game-shell-screen';
import { GamePluginLayer } from '@/components/game-plugins/game-plugin-layer';
import { RoomSystemState } from '@/components/room/room-system-state';
import { SystemStatus } from '@/components/ui/system-status';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import {
  planNullShellLobbyRecovery,
  writeLobbyNotice,
} from '@/lib/game-shell/null-shell-recovery';

function GameShellFallback() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <SystemStatus tone="loading" title={SYSTEM_COPY.loading} className="w-full max-w-md" />
    </div>
  );
}

function GameContent() {
  const { state, syncStatus } = useGameShell();
  const { room } = useRoom();
  const router = useRouter();
  const recoveredRef = useRef(false);
  const hideLegacyShell = Boolean(state?.gameId);

  useEffect(() => {
    const plan = planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus,
      roomCode: room?.code,
    });

    if (!plan.recover || recoveredRef.current) {
      return;
    }

    recoveredRef.current = true;
    writeLobbyNotice(plan.notice);
    router.replace(plan.lobbyUrl);
  }, [room?.code, router, syncStatus]);

  return (
    <div className="mx-auto flex w-full max-w-[var(--wanas-game-shell-max)] flex-1 flex-col px-4 sm:px-6 lg:px-8">
      {!hideLegacyShell ? <GameShellScreen /> : null}
      <GamePluginLayer />
    </div>
  );
}

function GameShellConnectedScreen() {
  const { room, player, status, sessionEndReason, errorMessage } = useRoom();

  if (sessionEndReason === 'kick') {
    return <RoomSystemState kind="kicked" />;
  }

  if (sessionEndReason === 'closed') {
    return <RoomSystemState kind="closed" message={errorMessage} />;
  }

  if (status === 'reconnecting' && room && player) {
    return (
      <GameShellProvider hostPlayerId={room.hostPlayerId} currentPlayerId={player.id}>
        <div className="px-4 pt-4 sm:px-6">
          <SystemStatus tone="reconnecting" title={SYSTEM_COPY.reconnecting} className="mx-auto max-w-md" />
        </div>
        <GameContent />
      </GameShellProvider>
    );
  }

  if (status === 'reconnecting') {
    return <RoomSystemState kind="reconnecting" />;
  }

  if (status === 'connecting' || status === 'idle') {
    return <RoomSystemState kind="connecting" />;
  }

  if (status === 'error' || !room || !player) {
    return (
      <RoomSystemState
        kind="error"
        message={errorMessage}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <GameShellProvider hostPlayerId={room.hostPlayerId} currentPlayerId={player.id}>
      <GameContent />
    </GameShellProvider>
  );
}

export function GamePageClient() {
  return (
    <Suspense fallback={<GameShellFallback />}>
      <GameShellConnectedScreen />
    </Suspense>
  );
}
