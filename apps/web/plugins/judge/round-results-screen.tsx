'use client';

import { useMemo } from 'react';
import type { JudgeRevealEntry, JudgeRoundResultEntry } from '@wanasatna/shared';
import { JUDGE_GAME_ID } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { RoundCategoryPanel } from '@/components/lobby/round-category-panel';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { JUDGE_GAME_ICON, JUDGE_GAME_NAME } from '@/lib/game/judge-brand';
import { cn } from '@/lib/utils';
import { JudgeAnswerCard } from './judge-answer-card';

export type JudgeRoundResultsScreenProps = {
  winningAnswerText: string | null;
  winnerName: string | null;
  revealEntries: readonly JudgeRevealEntry[];
  roundResults: readonly JudgeRoundResultEntry[];
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

export function JudgeRoundResultsScreen({
  winningAnswerText,
  winnerName,
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
}: JudgeRoundResultsScreenProps) {
  const sortedResults = useMemo(
    () =>
      [...roundResults].sort((left, right) => {
        if (right.roundPoints !== left.roundPoints) {
          return right.roundPoints - left.roundPoints;
        }
        return left.name.localeCompare(right.name, 'ar');
      }),
    [roundResults],
  );

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl">
      <GameHeader
        gameName={JUDGE_GAME_NAME}
        gameIcon={JUDGE_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-6 sm:gap-7">
        {winningAnswerText && winnerName ? (
          <div className="wanas-game-card rounded-[2rem] border-wanas-success-border/80 bg-wanas-success-surface px-6 py-10 text-center sm:px-10">
            <p className="text-xs font-medium tracking-wide text-wanas-text-muted">أفضل إجابة</p>
            <p className="mt-4 break-words text-2xl font-bold text-wanas-success-dark sm:text-3xl">
              «{winningAnswerText}»
            </p>
            <p className="mt-4 text-lg font-semibold text-wanas-text-primary">
              كتبها: {winnerName}
            </p>
          </div>
        ) : null}

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">كل الإجابات</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {revealEntries.map((entry) => (
              <JudgeAnswerCard
                key={entry.answerId}
                text={entry.text}
                ownerName={entry.ownerName}
                isWinner={entry.isWinner}
              />
            ))}
          </div>
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
                    player.isWinner && 'ring-1 ring-wanas-success-border/60',
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
                        {player.isJudge ? ' · قاضي' : ''}
                      </p>
                      <p className="text-xs text-wanas-text-muted">
                        المجموع: {player.totalPoints}
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
            gameId={JUDGE_GAME_ID}
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
