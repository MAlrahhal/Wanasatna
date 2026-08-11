'use client';

import { Suspense } from 'react';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { GameShellProvider } from '@/contexts/game-shell-context';
import { GameShellScreen } from '@/components/game-shell/game-shell-screen';
import { GamePluginLayer } from '@/components/game-plugins/game-plugin-layer';

function GameShellFallback() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">جاري تحميل shell اللعبة...</p>
    </div>
  );
}

function GameContent() {
  const { state } = useGameShell();
  // Integrated lobby→game flow sets gameId immediately in WAITING.
  // The legacy debug GameShellScreen must not own that surface — GamePluginLayer does.
  const hideLegacyShell = Boolean(state?.gameId);

  return (
    <div className="mx-auto flex w-full max-w-[var(--wanas-game-shell-max)] flex-1 flex-col px-4 sm:px-6 lg:px-8">
      {!hideLegacyShell ? <GameShellScreen /> : null}
      <GamePluginLayer />
    </div>
  );
}

function GameShellConnectedScreen() {
  const { room, player, status, errorMessage } = useRoom();

  if (status === 'connecting' || status === 'idle') {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">جاري الاتصال بالغرفة...</p>
      </div>
    );
  }

  if (status === 'error' || !room || !player) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-1 flex-col justify-center gap-4 p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage ?? 'تعذر الاتصال بالغرفة. انضم إلى غرفة أولاً.'}
        </div>
      </div>
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
