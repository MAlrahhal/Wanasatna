'use client';

import type { GameShellPlayerRecoveryPayload } from '@wanasatna/shared';

type GamePlayerRecoveryOverlayProps = {
  recovery: GameShellPlayerRecoveryPayload;
};

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function GamePlayerRecoveryOverlay({ recovery }: GamePlayerRecoveryOverlayProps) {
  if (!recovery.isActive) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
      role="alertdialog"
      aria-labelledby="player-recovery-title"
      aria-describedby="player-recovery-body"
    >
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)] p-5 text-center shadow-xl">
        <h2
          id="player-recovery-title"
          className="text-base font-semibold text-[color:var(--wanas-game-text-primary)]"
        >
          بانتظار عودة اللاعبين
        </h2>
        <p
          id="player-recovery-body"
          className="mt-2 text-sm text-[color:var(--wanas-game-text-secondary)]"
        >
          عدد اللاعبين الحالي أقل من المطلوب لإكمال اللعبة.
        </p>
        <p className="mt-4 font-mono text-2xl font-bold tabular-nums text-[color:var(--wanas-game-accent)]">
          سيتم إنهاء اللعبة بعد {formatCountdown(recovery.remainingSeconds)}
        </p>
        <p className="mt-3 text-xs text-[color:var(--wanas-game-text-secondary)]">
          {recovery.connectedCount} / {recovery.minimumCount} لاعبين
        </p>
        <p className="mt-3 text-xs text-[color:var(--wanas-game-text-secondary)]">
          إذا عاد أحد اللاعبين قبل انتهاء الوقت ستكمل اللعبة تلقائيًا.
        </p>
      </div>
    </div>
  );
}
