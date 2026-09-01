'use client';

import type { TimingChallengeRoundResultEntry } from '@wanasatna/shared';
import { AdPlaceholder } from '@/components/ads/ad-placeholder';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import { TIMING_CHALLENGE_GAME_ICON, TIMING_CHALLENGE_GAME_NAME } from '@/lib/game/timing-challenge-brand';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';
import { DigitalTimerDisplay, ElectronicPanel } from './electronic-panel';
import { formatDigitalTimer, formatSecondsFromMs } from './format';

type RoundResultsScreenProps = {
  mode: 'guess-time' | 'stop-timer';
  targetMs: number;
  roundResults: readonly TimingChallengeRoundResultEntry[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  totalDurationSeconds?: number;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
};

export function TimingChallengeRoundResultsScreen({
  mode,
  targetMs,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  roomCode,
  remainingSeconds = 0,
  deadlineAtMs,
  totalDurationSeconds = 10,
  continueLabel,
  waitingMessage,
  isContinueLoading = false,
  onContinue,
}: RoundResultsScreenProps) {
  const winner = roundResults.find((entry) => entry.placement === 1) ?? null;
  const progressBar = (
    <DeadlineProgress
      deadlineAtMs={deadlineAtMs}
      remainingSeconds={remainingSeconds}
      totalDurationSeconds={totalDurationSeconds}
    />
  );


  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl">
      <GameHeader
        gameName={TIMING_CHALLENGE_GAME_NAME}
        gameIcon={TIMING_CHALLENGE_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-4">
        <ElectronicPanel>
          <DigitalTimerDisplay
            value={formatDigitalTimer(targetMs)}
            label={mode === 'guess-time' ? 'الوقت الحقيقي' : 'الهدف'}
          />
          {winner ? (
            <p className="mt-4 text-center text-sm font-bold text-wanas-accent">
              الأقرب: {winner.name}
              {winner.isTied ? ' (تعادل)' : ''}
            </p>
          ) : null}
        </ElectronicPanel>

        <GameCard className="p-3 sm:p-4">
          <ul className="space-y-2">
            {roundResults.map((entry) => {
              const valueMs = mode === 'guess-time' ? entry.guessMs : entry.elapsedMs;

              return (
                <li
                  key={entry.playerId}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-wanas-border bg-wanas-surface-soft px-3 py-2.5',
                    entry.placement === 1 && 'border-wanas-accent/50',
                    entry.playerId === currentPlayerId && 'ring-1 ring-wanas-accent/30',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-wanas-text-primary">
                      {entry.placement}. {entry.name}
                      {entry.isTied ? ' · تعادل' : ''}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-wanas-text-muted" dir="ltr">
                      {valueMs !== null ? formatDigitalTimer(valueMs) : '--:--.--'} — الفرق{' '}
                      {entry.errorMs !== null ? `${formatSecondsFromMs(entry.errorMs)}s` : '—'}
                    </p>
                  </div>
                  <div className="text-left text-xs font-bold text-wanas-text-secondary" dir="ltr">
                    +{entry.roundPoints}
                    <span className="mx-1 text-wanas-text-muted">·</span>
                    {entry.totalPoints}
                  </div>
                </li>
              );
            })}
          </ul>
        </GameCard>

        <AdPlaceholder
          placement="round-results-center"
          format="horizontal"
          className="hidden lg:flex"
        />
        <AdPlaceholder
          placement="round-results-mobile"
          format="horizontal"
          className="lg:hidden"
        />

        {continueLabel && onContinue ? (
          <div className="mx-auto w-full max-w-md space-y-3">
            <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-sm">
              {presentSystemCopy(waitingMessage, SYSTEM_COPY.nextRoundAuto)}
            </p>
            {progressBar}
            <Button
              size="lg"
              className="w-full min-h-14 focus-visible:ring-offset-4"
              loading={isContinueLoading}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          </div>
        ) : waitingMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="mx-auto w-full max-w-md space-y-3 rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-5 py-6 text-center shadow-sm"
          >
            <p className="wanas-game-helper font-medium text-wanas-text-secondary">
              {presentSystemCopy(waitingMessage)}
            </p>
            {progressBar}
          </div>
        ) : null}
      </div>
    </GameScreen>
  );
}
