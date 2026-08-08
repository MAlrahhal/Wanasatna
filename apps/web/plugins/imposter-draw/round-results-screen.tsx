'use client';

import { useMemo } from 'react';
import type {
  ImposterDrawReferenceImage,
  ImposterDrawRoundResultEntry,
  ImposterDrawVoteTallyEntry,
} from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { Button } from '@/components/ui/button';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { compareByRoundPointsThenName } from '@/lib/game/leaderboard-sort';
import { cn } from '@/lib/utils';

export type ImposterDrawRoundResultsScreenProps = {
  revealedImage: ImposterDrawReferenceImage;
  impostorName: string;
  impostorVotedOut: boolean | null;
  impostorGuessedCorrectly: boolean | null;
  selectedImageGuess: string | null;
  playersWon: boolean | null;
  roundResults: readonly ImposterDrawRoundResultEntry[];
  voteTally: readonly ImposterDrawVoteTallyEntry[];
  currentPlayerId: string;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  continueLabel?: string | null;
  waitingMessage?: string | null;
  isContinueLoading?: boolean;
  onContinue?: () => void;
  className?: string;
};

export function ImposterDrawRoundResultsScreen({
  revealedImage,
  impostorName,
  impostorVotedOut,
  impostorGuessedCorrectly,
  selectedImageGuess,
  playersWon,
  roundResults,
  voteTally,
  currentPlayerId,
  roundNumber,
  totalRounds,
  roomCode,
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

      <div className="flex flex-col gap-6 sm:gap-7">
        <div
          className={cn(
            'wanas-game-card rounded-[2rem] px-6 py-10 text-center sm:px-10 sm:py-12',
            playersWon && 'border-wanas-success-border/80 bg-wanas-success-surface',
          )}
        >
          <p className="text-xl font-semibold sm:text-2xl">{outcomeLabel}</p>
          <p className="mt-3 wanas-game-helper">{votingResult}</p>
          <p className="mt-1 wanas-game-helper">{guessResult}</p>
        </div>

        <GameCard className="px-5 py-6 text-center sm:px-8">
          <p className="text-xs font-medium text-wanas-text-muted">الصورة كانت</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={revealedImage.imageUrl}
            alt={revealedImage.label}
            className="mx-auto mt-3 max-h-44 w-full max-w-md rounded-2xl border border-[color:var(--wanas-game-card-border)] object-contain"
          />
          <p className="mt-3 text-2xl font-bold text-wanas-text-primary">{revealedImage.label}</p>
          <p className="mt-2 text-sm text-wanas-text-secondary">الإمبوستر هو: {impostorName}</p>
        </GameCard>

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">نتيجة التصويت</h2>
          <ul className="space-y-2.5">
            {voteTally.map((entry) => (
              <li
                key={entry.playerId}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--wanas-game-card-border)] px-4 py-3"
              >
                <span className="font-medium text-wanas-text-primary">{entry.name}</span>
                <span className="text-sm text-wanas-text-secondary">{entry.voteCount} صوت</span>
              </li>
            ))}
          </ul>
        </GameCard>

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
          <Button
            size="lg"
            className="w-full min-h-14"
            loading={isContinueLoading}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        ) : null}

        {waitingMessage ? (
          <p className="text-center text-sm text-wanas-text-secondary">{waitingMessage}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
