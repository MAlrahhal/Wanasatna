'use client';

import { BARA_AL_SALAFA_GAME_ID } from '@wanasatna/shared';
import { useGameShell } from '@/contexts/game-shell-context';
import { GameShellHostControls } from './game-shell-host-controls';
import { GameShellPhaseBadge } from './game-shell-phase-badge';
import { GameShellPhaseMessage } from './game-shell-phase-message';
import { GameShellPlayers } from './game-shell-players';
import { GameShellTimers } from './game-shell-timers';

export function GameShellScreen() {
  const { state, errorMessage, isHost, isReady, setReady, syncShell } = useGameShell();

  if (!state) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col justify-center gap-4 p-6">
        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">جاري تحميل shell اللعبة...</p>
        </div>
      </div>
    );
  }

  const showIntegratedControls = Boolean(state.gameId);
  const hideShellCountdown =
    state.gameId === BARA_AL_SALAFA_GAME_ID && state.phase === 'COUNTDOWN';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Game Shell</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">
                {state.gameId ?? 'إطار اللعبة العام'}
              </h1>
              <GameShellPhaseBadge phase={state.phase} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void syncShell()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
          >
            مزامنة الحالة
          </button>
        </div>
      </header>

      <GameShellPhaseMessage phase={state.phase} />

      <GameShellTimers
        countdownRemainingSeconds={state.countdownRemainingSeconds}
        gameTimerRemainingSeconds={state.gameTimerRemainingSeconds}
        hideCountdown={hideShellCountdown}
      />

      <GameShellPlayers players={state.players} />

      {(state.phase === 'WAITING' && !showIntegratedControls) || isHost ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-foreground">التحكم</h2>
          <div className="flex flex-wrap gap-2">
            {!isHost && state.phase === 'WAITING' && !showIntegratedControls ? (
              <button
                type="button"
                onClick={() => void setReady(!isReady)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                {isReady ? 'إلغاء الجاهزية' : 'أنا جاهز'}
              </button>
            ) : null}
            {isHost ? (
              <GameShellHostControls
                phase={state.phase}
                integratedFlow={showIntegratedControls}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
