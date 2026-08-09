'use client';

import { useMemo } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { RoundCategoryPanel } from '@/components/lobby/round-category-panel';
import { Button } from '@/components/ui/button';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { FirstPersonGameScene } from './first-person-game-scene';

export type GuessingChallengeRoundResultsScreenProps = {
  view: GuessingChallengePlayerView;
  currentPlayerId: string;
  roomCode: string;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  onSelectNextCategory?: (categoryId: string) => void;
};

export function GuessingChallengeRoundResultsScreen({
  view,
  currentPlayerId,
  roomCode,
  isContinueLoading = false,
  onContinue,
  onSelectNextCategory,
}: GuessingChallengeRoundResultsScreenProps) {
  const sortedResults = useMemo(
    () =>
      [...view.roundResults].sort((left, right) => {
        if (right.roundPoints !== left.roundPoints) {
          return right.roundPoints - left.roundPoints;
        }
        return left.name.localeCompare(right.name, 'ar');
      }),
    [view.roundResults],
  );

  const selfReveal = view.revealEntries.find((entry) => entry.playerId === currentPlayerId);
  const opponentReveal = view.revealEntries.find((entry) => entry.playerId !== currentPlayerId);

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl">
      <GameHeader
        gameName={GUESSING_CHALLENGE_GAME_NAME}
        gameIcon={GUESSING_CHALLENGE_GAME_ICON}
        roomCode={roomCode}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="wanas-game-card rounded-[1.75rem] border-wanas-success-border/80 bg-wanas-success-surface px-5 py-6 text-center sm:px-8">
          <p className="text-xl font-bold text-wanas-success-dark sm:text-2xl">
            🎉 {view.winnerName ?? 'لاعب'} فاز بالجولة
          </p>
          {view.winningGuess ? (
            <p className="mt-2 text-sm text-wanas-text-primary">
              التخمين الفائز: «{view.winningGuess}»
            </p>
          ) : null}
        </div>

        <FirstPersonGameScene
          mode="reveal"
          opponentName={opponentReveal?.name ?? view.opponent.name}
          selfName={selfReveal?.name ?? view.self.name}
          opponentIdentity={opponentReveal?.identity ?? view.opponent.visibleIdentity}
          selfIdentity={selfReveal?.identity ?? view.self.revealedIdentity}
          selfHidden={false}
          opponentHighlight={Boolean(opponentReveal?.isWinner)}
          selfHighlight={Boolean(selfReveal?.isWinner)}
          showSpecialCards={false}
        />

        <GameCard className="p-4 sm:p-5">
          <h2 className="wanas-game-title mb-3">نقاط الجولة</h2>
          <ul className="space-y-2" data-testid="gc-round-scores">
            {sortedResults.map((entry) => (
              <li
                key={entry.playerId}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium text-wanas-text-primary">
                  {entry.name}
                  {entry.isWinner ? ' ⭐' : ''}
                </span>
                <span className="text-wanas-text-muted">
                  +{entry.roundPoints} · الإجمالي {entry.totalPoints}
                </span>
              </li>
            ))}
          </ul>
        </GameCard>

        {view.currentRound < view.totalRounds ? (
          <RoundCategoryPanel
            gameId={GUESSING_CHALLENGE_GAME_ID}
            selectedCategoryId={view.nextCategoryId}
            isHost={view.isHost}
            isActiveMatch
            onSelectCategory={(categoryId) => onSelectNextCategory?.(categoryId)}
          />
        ) : null}

        {view.canContinueFromRoundResults && onContinue ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={isContinueLoading}
            onClick={onContinue}
          >
            {view.roundResultsContinueLabel ?? 'بدء الجولة التالية'}
          </Button>
        ) : (
          <p className="text-center text-sm text-wanas-text-muted">
            {view.roundResultsWaitingMessage ?? 'بانتظار المضيف...'}
          </p>
        )}
      </div>
    </GameScreen>
  );
}
