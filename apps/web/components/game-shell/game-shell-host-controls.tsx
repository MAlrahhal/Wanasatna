'use client';

import type { GamePhase } from '@wanasatna/shared';
import { useGameShell } from '@/contexts/game-shell-context';

type GameShellHostControlsProps = {
  phase: GamePhase;
  hasShell?: boolean;
  integratedFlow?: boolean;
};

export function GameShellHostControls({
  phase,
  hasShell = true,
  integratedFlow = false,
}: GameShellHostControlsProps) {
  const { initShell, startCountdown, cancelCountdown, endGame, returnToLobby } = useGameShell();

  if (integratedFlow && phase === 'FINISHED') {
    return (
      <button
        type="button"
        onClick={() => void returnToLobby()}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        العودة إلى اللوبي
      </button>
    );
  }

  if (phase === 'WAITING' && !hasShell) {
    return (
      <button
        type="button"
        onClick={() => void initShell()}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        تهيئة Shell
      </button>
    );
  }

  if (phase === 'WAITING' && !integratedFlow) {
    return (
      <button
        type="button"
        onClick={() => void startCountdown()}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
      >
        بدء العدّ التنازلي
      </button>
    );
  }

  if (phase === 'COUNTDOWN' && !integratedFlow) {
    return (
      <button
        type="button"
        onClick={() => void cancelCountdown()}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
      >
        إلغاء العدّ التنازلي
      </button>
    );
  }

  if (phase === 'PLAYING' && !integratedFlow) {
    return (
      <button
        type="button"
        onClick={() => void endGame()}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-destructive/30 px-4 text-sm font-medium text-destructive"
      >
        إنهاء اللعبة
      </button>
    );
  }

  return null;
}
