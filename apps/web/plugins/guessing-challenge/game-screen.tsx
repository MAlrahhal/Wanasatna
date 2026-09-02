'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, GuessingChallengePlayerView } from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
} from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameSystemError, GameSystemLoading, SpectatorNotice } from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { toExperienceTimer } from '@/lib/game/deadline-clock';
import { mapGuessingChallengeLeaderboard } from '@/lib/game/map-guessing-challenge-leaderboard';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { Button } from '@/components/ui/button';
import { GameplayScene } from './gameplay-scene';
import { GuessingChallengePlayingScreen } from './playing-screen';
import { GuessingChallengeRoundResultsScreen } from './round-results-screen';
import { useGuessingChallengePlayerView } from './use-player-view';
import { useGuessingChallengeSfx } from './use-sfx';

function conciseGuessingChallengePhaseLabel(view: GuessingChallengePlayerView): string {
  if (view.isMatchSpectator) {
    return SYSTEM_COPY.spectatorTitle;
  }
  if (view.gamePhase === 'round-results') {
    return 'نتائج الجولة';
  }
  if (view.gamePhase === 'match-completed') {
    return 'النتائج النهائية';
  }
  if (view.isMyTurn) {
    return 'دورك';
  }
  if (view.currentTurnPlayerName) {
    return `دور ${view.currentTurnPlayerName}`;
  }
  return 'التخمين';
}

export function GuessingChallengeSpectatorPlaying({
  view,
  showSpectatorNotice = true,
}: {
  view: GuessingChallengePlayerView;
  showSpectatorNotice?: boolean;
}) {
  const [side, setSide] = useState<'blue' | 'red'>('blue');
  const identity = side === 'blue' ? view.spectatorBlueIdentity : view.spectatorRedIdentity;
  const sideLabel = side === 'blue' ? 'الفريق الأزرق' : 'الفريق الأحمر';

  return (
    <GameScreen ariaLabel="مشاهدة تحدي التخمين" maxWidth="4xl" className="min-w-0 gap-3 sm:gap-4">
      {showSpectatorNotice ? <SpectatorNotice /> : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant={side === 'blue' ? 'primary' : 'outline'}
          className="min-h-11"
          aria-pressed={side === 'blue'}
          onClick={() => setSide('blue')}
        >
          هوية الأزرق
        </Button>
        <Button
          type="button"
          variant={side === 'red' ? 'primary' : 'outline'}
          className="min-h-11"
          aria-pressed={side === 'red'}
          onClick={() => setSide('red')}
        >
          هوية الأحمر
        </Button>
      </div>
      <p className="text-center text-sm font-semibold text-wanas-text-primary">
        {sideLabel}: {identity?.value ?? '؟؟؟'}
      </p>
      <GameplayScene
        mode="playing"
        matchMode={view.mode}
        opponentName={view.currentTurnPlayerName ?? 'لاعب'}
        selfName="متفرج"
        opponentIdentity={identity}
        selfIdentity={null}
        selfHidden
        isMyTurn={false}
        turnTitle={`دور ${view.currentTurnPlayerName ?? 'فريق'}`}
        turnInstruction={`تشاهد هوية ${sideLabel}. لا يمكنك السؤال أو التخمين أو استخدام البطاقات.`}
        showSpecialCards={false}
      />
    </GameScreen>
  );
}

export function GuessingChallengeGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isGuessingGame = shellState?.gameId === GUESSING_CHALLENGE_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isGuessingGame && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<GuessingChallengePlayerView | null>(
    null,
  );
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);

  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    guessFeedback,
    isSubmittingAction,
    endQuestion,
    submitFinalGuess,
    useYellowCard,
    useRedCard,
    rejectCard,
    continueFromRoundResults,
    emitLook,
  } = useGuessingChallengePlayerView(pluginEnabled);

  useGuessingChallengeSfx(view, player?.id, guessFeedback);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isGuessingGame &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isGuessingGame && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: GUESSING_CHALLENGE_GAME_NAME,
        gameIcon: GUESSING_CHALLENGE_GAME_ICON,
        phaseLabel: SYSTEM_COPY.loading,
        leaderboardEntries: mapGuessingChallengeLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: GUESSING_CHALLENGE_GAME_NAME,
      gameIcon: GUESSING_CHALLENGE_GAME_ICON,
      layoutMode: showFinalMatchResults
        ? 'final-results'
        : activeView.gamePhase === 'round-results'
          ? 'round-results'
          : 'gameplay',
      phaseLabel: conciseGuessingChallengePhaseLabel(activeView),
      categoryLabel: activeView.categoryLabel
        ? `الفئة: ${activeView.categoryLabel}`
        : undefined,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: toExperienceTimer(activeView.deadlineAtMs, {
        format: 'seconds',
        lowTimeThreshold: 5,
      }),
      leaderboardEntries: mapGuessingChallengeLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isGuessingGame,
    player,
    players,
    pluginEnabled,
    setExperienceMeta,
    showFinalMatchResults,
    view,
  ]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  const handleReturnToLobby = useCallback(async () => {
    if (isReturningToLobby) {
      return;
    }
    setIsReturningToLobby(true);
    if (view?.gamePhase === 'match-completed' && isHost) {
      await continueFromRoundResults();
    } else {
      await returnToLobby();
    }
    setIsReturningToLobby(false);
  }, [
    continueFromRoundResults,
    isHost,
    isReturningToLobby,
    returnToLobby,
    view?.gamePhase,
  ]);

  if (!isGuessingGame || !room || !player) {
    return null;
  }

  if (showFinalMatchResults && activeFinalResultsView) {
    return (
      <MatchResultsScreen
        leaderboard={activeFinalResultsView.resultsLeaderboard.map((entry) => ({
          id: entry.playerId,
          name: entry.name,
          totalPoints: entry.totalPoints,
          rank: entry.rank,
          isFirstPlace: entry.isFirstPlace,
          isCurrentPlayer: entry.playerId === player.id,
        }))}
        currentPlayerId={player.id}
        totalRounds={activeFinalResultsView.totalRounds}
        playerCount={activeFinalResultsView.resultsLeaderboard.length}
        roomCode={room.code}
        gameName={GUESSING_CHALLENGE_GAME_NAME}
        autoReturnDeadlineAtMs={
          activeFinalResultsView.gamePhase === 'match-completed'
            ? activeFinalResultsView.deadlineAtMs
            : undefined
        }
        autoReturnTotalSeconds={
          activeFinalResultsView.gamePhase === 'match-completed'
            ? MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS
            : undefined
        }
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={
          activeFinalResultsView.isHost
            ? () => {
                void handleReturnToLobby();
              }
            : undefined
        }
        returnStatusMessage={
          activeFinalResultsView.isHost
            ? null
            : 'العودة إلى اللوبي تلقائياً خلال ثوانٍ…'
        }
      />
    );
  }

  if (isLoading && !view) {
    return <GameSystemLoading />;
  }

  if (errorMessage && !view) {
    return <GameSystemError message={errorMessage} />;
  }

  if (!view) {
    return null;
  }

  if (view.isMatchSpectator && view.gamePhase === 'playing') {
    return <GuessingChallengeSpectatorPlaying view={view} />;
  }

  if (view.gamePhase === 'round-results') {
    return (
      <GuessingChallengeRoundResultsScreen
        view={view}
        currentPlayerId={player.id}
        roomCode={room.code}
        isContinueLoading={isSubmittingAction}
        remainingSeconds={0}
        deadlineAtMs={view.deadlineAtMs}
        totalDurationSeconds={GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS}
        onContinue={continueFromRoundResults}
      />
    );
  }

  return (
    <GuessingChallengePlayingScreen
      view={view}
      roomCode={room.code}
      actionError={actionError}
      guessFeedback={guessFeedback}
      isSubmittingAction={isSubmittingAction}
      onEndQuestion={endQuestion}
      onSubmitGuess={submitFinalGuess}
      onUseYellow={useYellowCard}
      onUseRed={useRedCard}
      onRejectCard={rejectCard}
      onLookChange={emitLook}
    />
  );
}
