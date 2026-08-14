'use client';

import type { GamePhase } from '@wanasatna/shared';

const PHASE_MESSAGES: Partial<Record<GamePhase, string>> = {
  PLAYING: 'اللعبة جارية',
  FINISHED: 'انتهت اللعبة',
};

type GameShellPhaseMessageProps = {
  phase: GamePhase;
};

export function GameShellPhaseMessage({ phase }: GameShellPhaseMessageProps) {
  const message = PHASE_MESSAGES[phase];

  if (!message) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-2xl font-bold text-foreground">{message}</p>
    </section>
  );
}
