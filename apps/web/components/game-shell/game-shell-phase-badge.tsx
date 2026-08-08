import type { GamePhase } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

const PHASE_LABELS: Record<GamePhase, string> = {
  WAITING: 'انتظار',
  COUNTDOWN: 'عدّ تنازلي',
  PLAYING: 'جاري اللعب',
  FINISHED: 'انتهت',
};

type GameShellPhaseBadgeProps = {
  phase: GamePhase;
};

export function GameShellPhaseBadge({ phase }: GameShellPhaseBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        phase === 'WAITING' && 'bg-muted text-muted-foreground',
        phase === 'COUNTDOWN' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        phase === 'PLAYING' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        phase === 'FINISHED' && 'bg-primary/10 text-primary',
      )}
    >
      {PHASE_LABELS[phase]}
    </span>
  );
}
