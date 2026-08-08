type GameShellTimersProps = {
  countdownRemainingSeconds: number | null;
  gameTimerRemainingSeconds: number | null;
  hideCountdown?: boolean;
};

export function GameShellTimers({
  countdownRemainingSeconds,
  gameTimerRemainingSeconds,
  hideCountdown = false,
}: GameShellTimersProps) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${hideCountdown ? '' : 'sm:grid-cols-2'}`}>
      {hideCountdown ? null : (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">العدّ التنازلي</p>
          <p className="mt-1 font-mono text-3xl font-bold text-foreground">
            {countdownRemainingSeconds ?? '—'}
          </p>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">مؤقت اللعبة</p>
        <p className="mt-1 font-mono text-3xl font-bold text-foreground">
          {gameTimerRemainingSeconds ?? '—'}
        </p>
      </div>
    </div>
  );
}
