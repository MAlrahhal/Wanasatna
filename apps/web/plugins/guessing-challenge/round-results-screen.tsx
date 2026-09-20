'use client';

import { useMemo } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import Image from 'next/image';
import { ResultsAdPlacement } from '@/components/ads/results-ad-placement';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { SYSTEM_COPY, presentSystemCopy } from '@/lib/ui/system-copy';
import { GameplayScene } from './gameplay-scene';

export type GuessingChallengeRoundResultsScreenProps = {
  view: GuessingChallengePlayerView;
  currentPlayerId: string;
  roomCode: string;
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  totalDurationSeconds?: number;
  isContinueLoading?: boolean;
  onContinue?: () => void;
};

export function GuessingChallengeRoundResultsScreen({
  view,
  currentPlayerId,
  roomCode,
  remainingSeconds = 0,
  deadlineAtMs,
  totalDurationSeconds = 10,
  isContinueLoading = false,
  onContinue,
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
  const selfIdentity = view.self.revealedIdentity ?? selfReveal?.identity ?? null;

  const mappedTeammate = useMemo(() => {
    if (!view.teammate) {
      return null;
    }
    return {
      playerId: view.teammate.playerId,
      name: view.teammate.name,
      seat: view.teammate.seat,
      lookYaw: view.teammate.lookYaw,
      lookPitch: view.teammate.lookPitch,
    };
  }, [view.teammate]);

  const mappedOpponents = useMemo(() => {
    if (view.mode === '2v2' && view.opponents.length > 0) {
      return view.opponents.map((opponent) => ({
        playerId: opponent.playerId,
        name: opponent.name,
        seat: opponent.seat,
        lookYaw: opponent.lookYaw,
        lookPitch: opponent.lookPitch,
      }));
    }
    if (opponentReveal) {
      return [
        {
          playerId: opponentReveal.playerId,
          name: opponentReveal.name,
          seat: 0 as const,
        },
      ];
    }
    return undefined;
  }, [opponentReveal, view.mode, view.opponents]);

  const opponentIdentity =
    view.mode === '2v2'
      ? (view.opponent.visibleIdentity ?? opponentReveal?.identity ?? null)
      : (opponentReveal?.identity ?? view.opponent.visibleIdentity);

  const opponentName =
    view.mode === '2v2'
      ? (view.opponents[0]?.name ?? view.opponent.name)
      : (opponentReveal?.name ?? view.opponent.name);
  const selfWon = view.winningTeamId !== null && view.winningTeamId === view.selfTeam;
  const opponentWon =
    view.winningTeamId !== null && view.selfTeam !== null && view.winningTeamId !== view.selfTeam;
  const winningIdentity =
    view.revealEntries.find((entry) => entry.isWinner)?.identity?.value ?? null;

  return (
    <GameScreen ariaLabel="نتائج الجولة" maxWidth="4xl" className="min-w-0 gap-3 sm:gap-4">
      <GameHeader
        gameName={GUESSING_CHALLENGE_GAME_NAME}
        gameIcon={GUESSING_CHALLENGE_GAME_ICON}
        roomCode={roomCode}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        phaseLabel="نتائج الجولة"
      />

      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="wanas-game-card border-wanas-success-border/80 bg-wanas-success-surface rounded-2xl px-4 py-3 text-center sm:px-5 sm:py-3.5">
          <p className="text-wanas-success-dark break-words text-base font-bold sm:text-lg">
            {view.winnerName ?? 'لاعب'} فاز بالجولة
          </p>
          {winningIdentity ? (
            <p className="text-wanas-text-primary mt-1 break-words text-sm font-semibold">
              الهوية: {winningIdentity}
            </p>
          ) : null}
          {view.winningGuess ? (
            <p className="text-wanas-text-muted mt-0.5 break-words text-xs">
              التخمين: «{view.winningGuess}»
            </p>
          ) : null}
          <p className="text-wanas-success-dark mt-1 text-xs font-semibold">+100</p>
        </div>

        {selfIdentity ? (
          <section
            className="wanas-game-card border-wanas-accent/45 bg-wanas-accent/10 rounded-2xl px-4 py-4 text-center sm:px-5"
            data-testid="gc-self-word-reveal"
            aria-label="كانت كلمتك"
          >
            <p className="text-wanas-text-muted text-sm font-semibold">كانت كلمتك:</p>
            {selfIdentity.type === 'image' && selfIdentity.imageUrl ? (
              <Image
                src={selfIdentity.imageUrl}
                alt={selfIdentity.value ?? 'كلمتك في الجولة'}
                width={320}
                height={144}
                unoptimized
                className="mx-auto mt-2 max-h-36 max-w-full rounded-xl object-contain"
              />
            ) : (
              <p className="text-wanas-text-primary mt-1 break-words text-2xl font-black sm:text-3xl">
                {selfIdentity.value}
              </p>
            )}
          </section>
        ) : null}

        <GameplayScene
          className="gc-results-scene"
          mode="reveal"
          matchMode={view.mode}
          selfTeam={view.selfTeam ?? undefined}
          selfSeat={view.selfSeat ?? undefined}
          teammate={mappedTeammate}
          opponents={mappedOpponents}
          opponentName={opponentName}
          selfName={selfReveal?.name ?? view.self.name}
          opponentIdentity={opponentIdentity}
          selfIdentity={selfIdentity}
          selfHidden={false}
          opponentHighlight={opponentWon}
          selfHighlight={selfWon}
          showSpecialCards={false}
        />

        <GameCard className="p-4 sm:p-5">
          <h2 className="wanas-game-title mb-3">نقاط الجولة</h2>
          <ul className="space-y-2" data-testid="gc-round-scores">
            {sortedResults.map((entry) => (
              <li
                key={entry.playerId}
                className="border-border flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <span className="text-wanas-text-primary min-w-0 break-words font-medium">
                  {entry.name}
                  {entry.isWinner ? ' ⭐' : ''}
                </span>
                <span className="text-wanas-text-muted shrink-0 text-xs sm:text-sm">
                  +{entry.roundPoints} · الإجمالي {entry.totalPoints}
                </span>
              </li>
            ))}
          </ul>
        </GameCard>

        <ResultsAdPlacement />

        {view.canContinueFromRoundResults && onContinue ? (
          <div className="space-y-2.5">
            <p className="text-wanas-text-muted text-center text-sm">
              {presentSystemCopy(view.roundResultsWaitingMessage, SYSTEM_COPY.nextRoundAuto)}
            </p>
            <DeadlineProgress
              deadlineAtMs={deadlineAtMs}
              remainingSeconds={remainingSeconds}
              totalDurationSeconds={totalDurationSeconds}
            />
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={isContinueLoading}
              onClick={onContinue}
            >
              {view.roundResultsContinueLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-wanas-text-muted text-center text-sm">
              {presentSystemCopy(view.roundResultsWaitingMessage, SYSTEM_COPY.nextRoundAuto)}
            </p>
            <DeadlineProgress
              deadlineAtMs={deadlineAtMs}
              remainingSeconds={remainingSeconds}
              totalDurationSeconds={totalDurationSeconds}
            />
          </div>
        )}
      </div>
    </GameScreen>
  );
}
