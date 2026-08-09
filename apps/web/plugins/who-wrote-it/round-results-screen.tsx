'use client';

import { useMemo } from 'react';
import type {
  WhoWroteItRevealEntry,
  WhoWroteItRoundResultEntry,
} from '@wanasatna/shared';
import { WHO_WROTE_IT_GAME_ID } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { RoundCategoryPanel } from '@/components/lobby/round-category-panel';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { WHO_WROTE_IT_GAME_ICON, WHO_WROTE_IT_GAME_NAME } from '@/lib/game/who-wrote-it-brand';
import { cn } from '@/lib/utils';

export type WhoWroteItRoundResultsScreenProps = {
  revealEntries: readonly WhoWroteItRevealEntry[];
  roundResults: readonly WhoWroteItRoundResultEntry[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  isHost?: boolean;
  nextCategoryId?: string | null;
  onSelectNextCategory?: (categoryId: string) => void;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
};

export function WhoWroteItRoundResultsScreen({
  revealEntries,
  roundResults,
  currentPlayerId,
  roundNumber,
  totalRounds,
  roomCode,
  isHost = false,
  nextCategoryId = null,
  onSelectNextCategory,
  continueLabel,
  waitingMessage,
  isContinueLoading = false,
  onContinue,
}: WhoWroteItRoundResultsScreenProps) {
  const sortedResults = useMemo(
    () =>
      [...roundResults].sort((left, right) => {
        if (right.correctCount !== left.correctCount) {
          return right.correctCount - left.correctCount;
        }
        return left.name.localeCompare(right.name, 'ar');
      }),
    [roundResults],
  );

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl">
      <GameHeader
        gameName={WHO_WROTE_IT_GAME_NAME}
        gameIcon={WHO_WROTE_IT_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-6 sm:gap-7">
        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">من كتب كل إجابة؟</h2>
          <ul className="space-y-3">
            {revealEntries.map((entry) => (
              <li
                key={entry.answerId}
                className="rounded-xl border border-wanas-border bg-wanas-surface-soft px-4 py-3"
              >
                <p className="break-words text-sm font-semibold text-wanas-text-primary">
                  «{entry.text}»
                </p>
                <p className="mt-2 text-sm text-wanas-text-muted">
                  كتبها: <span className="font-semibold text-wanas-text-primary">{entry.ownerName}</span>
                </p>
                {entry.ownerPlayerId !== currentPlayerId ? (
                  <p className="mt-1 text-sm">
                    تخمينك:{' '}
                    <span
                      className={cn(
                        'font-semibold',
                        entry.isCorrect ? 'text-wanas-success-dark' : 'text-destructive',
                      )}
                    >
                      {entry.guessedOwnerName ?? '—'} {entry.isCorrect ? '✅' : '❌'}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-wanas-text-muted">هذه إجابتك</p>
                )}
              </li>
            ))}
          </ul>
        </GameCard>

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">نقاط الجولة</h2>
          <ul className="space-y-2.5">
            {sortedResults.map((player) => {
              const colors = getPlayerAvatarColors(player.playerId);
              const isCurrent = player.playerId === currentPlayerId;

              return (
                <li
                  key={player.playerId}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5',
                    isCurrent && 'bg-wanas-accent/10',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        colors.bg,
                        colors.text,
                      )}
                    >
                      {player.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-wanas-text-primary">
                        {player.name}
                        {isCurrent ? ' (أنت)' : ''}
                      </p>
                      <p className="text-xs text-wanas-text-muted">
                        {player.correctCount} إجابات صحيحة · المجموع: {player.totalPoints}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-sm font-bold tabular-nums',
                      player.roundPoints > 0
                        ? 'text-wanas-success-dark'
                        : 'text-wanas-text-muted',
                    )}
                  >
                    {player.roundPoints > 0 ? `+${player.roundPoints}` : '0'}
                  </p>
                </li>
              );
            })}
          </ul>
        </GameCard>

        {roundNumber < totalRounds ? (
          <RoundCategoryPanel
            gameId={WHO_WROTE_IT_GAME_ID}
            selectedCategoryId={nextCategoryId}
            isHost={isHost}
            isActiveMatch
            onSelectCategory={(categoryId) => onSelectNextCategory?.(categoryId)}
          />
        ) : null}

        {onContinue && continueLabel ? (
          <div className="flex justify-center">
            <Button
              type="button"
              size="lg"
              loading={isContinueLoading}
              onClick={onContinue}
              className="min-w-48"
            >
              {continueLabel}
            </Button>
          </div>
        ) : waitingMessage ? (
          <p className="text-center text-sm text-wanas-text-muted">{waitingMessage}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
