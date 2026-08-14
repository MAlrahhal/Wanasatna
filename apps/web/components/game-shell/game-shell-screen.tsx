'use client';

import { BARA_AL_SALAFA_GAME_ID } from '@wanasatna/shared';
import { useGameShell } from '@/contexts/game-shell-context';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/components/ui/system-status';
import { SYSTEM_COPY, presentRoomActionError } from '@/lib/ui/system-copy';
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
          <SystemStatus tone="error" {...presentRoomActionError(errorMessage)} />
        ) : (
          <SystemStatus tone="loading" title={SYSTEM_COPY.loading} />
        )}
      </div>
    );
  }

  const showIntegratedControls = Boolean(state.gameId);
  const hideShellCountdown =
    state.gameId === BARA_AL_SALAFA_GAME_ID && state.phase === 'COUNTDOWN';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      {errorMessage ? (
        <SystemStatus tone="error" title="حدث خطأ" description={errorMessage} />
      ) : null}

      <header className="rounded-[var(--wanas-radius-card)] border border-wanas-border bg-wanas-surface p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-wanas-text-muted">إطار اللعبة</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-wanas-text-primary">
                {state.gameId ?? 'إطار اللعبة العام'}
              </h1>
              <GameShellPhaseBadge phase={state.phase} />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void syncShell()}>
            مزامنة الحالة
          </Button>
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
        <section className="rounded-[var(--wanas-radius-card)] border border-wanas-border bg-wanas-surface p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-wanas-text-primary">التحكم</h2>
          <div className="flex flex-wrap gap-2">
            {!isHost && state.phase === 'WAITING' && !showIntegratedControls ? (
              <Button type="button" onClick={() => void setReady(!isReady)}>
                {isReady ? 'إلغاء الجاهزية' : 'أنا جاهز'}
              </Button>
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
