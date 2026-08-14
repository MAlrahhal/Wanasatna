'use client';

import { useMemo } from 'react';
import type { ImposterDrawRoundResultEntry } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { compareByRoundPointsThenName } from '@/lib/game/leaderboard-sort';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

export type ImposterDrawRoundResultsScreenProps = {
  impostorName: string;
  impostorVotedOut: boolean | null;
  impostorGuessedCorrectly: boolean | null;
  selectedImageGuess: string | null;
  revealedAnswerLabel: string | null;
  playersWon: boolean | null;
  roundResults: readonly ImposterDrawRoundResultEntry[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  remainingSeconds?: number;
  totalDurationSeconds?: number;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  className?: string;
};

export function ImposterDrawRoundResultsScreen({
  impostorName,
  impostorVotedOut,
  impostorGuessedCorrectly,
  selectedImageGuess,
  revealedAnswerLabel,
  playersWon,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  roomCode,
  remainingSeconds = 0,
  totalDurationSeconds = 10,
  continueLabel,
  waitingMessage,
  isContinueLoading = false,
  onContinue,
  className,
}: ImposterDrawRoundResultsScreenProps) {
  const sortedRoundResults = useMemo(
    () =>
      [...roundResults].sort((left, right) =>
        compareByRoundPointsThenName(
          { roundPoints: left.roundPoints, name: left.name, playerId: left.playerId },
          { roundPoints: right.roundPoints, name: right.name, playerId: right.playerId },
        ),
      ),
    [roundResults],
  );

  const outcomeLabel = playersWon ? 'فاز اللاعبون' : 'فاز الإمبوستر';
  const votingResult = impostorVotedOut
    ? 'تم كشف الإمبوستر بالتصويت'
    : 'نجا الإمبوستر من التصويت';
  const guessResult =
    impostorGuessedCorrectly === true
      ? `تخمين الصورة: صحيح${selectedImageGuess ? ` (${selectedImageGuess})` : ''}`
      : selectedImageGuess
        ? `تخمين الصورة: خاطئ (${selectedImageGuess})`
        : 'تخمين الصورة: لم يُرسل';

  const progressMax = Math.max(totalDurationSeconds, 1);
  const progressNow = Math.max(0, Math.min(remainingSeconds, totalDurationSeconds));
  const progressPercent = Math.round((progressNow / progressMax) * 100);

  const progressBar = (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-wanas-surface-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progressMax}
      aria-valuenow={progressNow}
      aria-label={`الانتقال التلقائي ${progressNow} من ${progressMax} ثانية`}
    >
      <div
        className="h-full rounded-full bg-wanas-accent transition-[width] duration-200 ease-linear"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        <div
          className={cn(
            'wanas-game-card rounded-[1.5rem] px-5 py-5 text-center sm:px-8 sm:py-6',
            playersWon && 'border-wanas-success-border/80 bg-wanas-success-surface',
          )}
        >
          <p className="text-xl font-semibold sm:text-2xl">{outcomeLabel}</p>
          <p className="mt-3 wanas-game-helper">{votingResult}</p>
          <p className="mt-1 wanas-game-helper">{guessResult}</p>
          {revealedAnswerLabel ? (
            <p className="mt-4 text-lg font-semibold text-wanas-text-primary">
              الصورة كانت: {revealedAnswerLabel}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-wanas-text-secondary">الإمبوستر هو: {impostorName}</p>
        </div>

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">نقاط الجولة</h2>
          <ul className="space-y-2.5">
            {sortedRoundResults.map((player) => {
              const avatarColors = getPlayerAvatarColors(player.playerId);
              const isCurrent = player.playerId === currentPlayerId;

              return (
                <li
                  key={player.playerId}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-3 py-3',
                    isCurrent
                      ? 'border-wanas-accent/50 bg-wanas-accent-soft/40'
                      : 'border-[color:var(--wanas-game-card-border)]',
                  )}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
                  >
                    {player.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-wanas-text-primary">
                      {player.name}
                      {player.isImpostor ? ' · إمبوستر' : ''}
                    </p>
                    <p className="text-xs text-wanas-text-muted">
                      {player.votedCorrectly ? 'صوّت بشكل صحيح' : 'لم يصوّت للإمبوستر'}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold text-wanas-text-primary">+{player.roundPoints}</p>
                    <p className="text-xs text-wanas-text-muted">{player.totalPoints} إجمالي</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </GameCard>

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
