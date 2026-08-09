'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GamePluginScreenProps, ImposterDrawPlayerView } from '@wanasatna/shared';
import { IMPOSTER_DRAW_GAME_ID } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { mapImposterDrawLeaderboard } from '@/lib/game/map-imposter-draw-leaderboard';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { ImpostorGuessScreen } from '@/plugins/bara-al-salafa/impostor-guess-screen';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { VotingScreen } from '@/plugins/bara-al-salafa/voting-screen';
import { DrawingTurnsScreen } from './drawing-turns-screen';
import { ImposterDrawRevealScreen } from './reveal-screen';
import { ImposterDrawRoundResultsScreen } from './round-results-screen';
import { useImposterDrawPlayerView } from './use-player-view';

const TIMED_PHASES = new Set(['drawing-turns', 'reveal']);

function toLobbyPlayers(
  votablePlayers: ImposterDrawPlayerView['votablePlayers'],
  currentPlayerId: string,
  currentPlayerName: string,
): LobbyPlayer[] {
  return [
    {
      id: currentPlayerId,
      name: currentPlayerName,
      isHost: false,
      isSpectator: false,
      isConnected: true,
    },
    ...votablePlayers.map((player) => ({
      id: player.playerId,
      name: player.name,
      isHost: false,
      isSpectator: false,
      isConnected: true,
    })),
  ];
}

export function ImposterDrawGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isImposterDraw = shellState?.gameId === IMPOSTER_DRAW_GAME_ID;
  const shellPhase = shellState?.phase;
  // Mounted only via GamePluginRenderer for this plugin id; enable by shell phase.
  const pluginEnabled = isImposterDraw && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<ImposterDrawPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);
  const [selectedVoteTargetId, setSelectedVoteTargetId] = useState<string | null>(null);
  const [selectedGuessWord, setSelectedGuessWord] = useState<string | null>(null);

  const {
    view,
    errorMessage,
    isLoading,
    remainingSeconds,
    actionError,
    isSubmittingAction,
    clearCanvas,
    submitVote,
    submitImageGuess,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
  } = useImposterDrawPlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isImposterDraw &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    if (view?.gamePhase !== 'voting') {
      setSelectedVoteTargetId(null);
    }

    if (view?.gamePhase !== 'impostor-guess') {
      setSelectedGuessWord(null);
    }
  }, [view?.gamePhase]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isImposterDraw && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: IMPOSTER_DRAW_GAME_NAME,
        gameIcon: IMPOSTER_DRAW_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapImposterDrawLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: IMPOSTER_DRAW_GAME_NAME,
      gameIcon: IMPOSTER_DRAW_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: TIMED_PHASES.has(activeView.gamePhase)
        ? { remainingSeconds, format: 'seconds' as const, lowTimeThreshold: 5 }
        : undefined,
      leaderboardEntries: mapImposterDrawLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isImposterDraw,
    player,
    players,
    pluginEnabled,
    remainingSeconds,
    setExperienceMeta,
    showFinalMatchResults,
    view,
  ]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  const handleReturnToLobby = useCallback(() => {
    if (!isHost || shellPhase !== 'FINISHED' || isReturningToLobby) {
      return;
    }

    setIsReturningToLobby(true);
    void returnToLobby().finally(() => {
      setIsReturningToLobby(false);
    });
  }, [isHost, isReturningToLobby, returnToLobby, shellPhase]);

  const guessOptions = useMemo(
    () =>
      (view?.impostorGuessOptions ?? []).map((label) => ({
        id: label,
        emoji: '🖼️',
        label,
      })),
    [view?.impostorGuessOptions],
  );

  if (showFinalMatchResults && room && player && activeFinalResultsView) {
    const shellFinished = shellPhase === 'FINISHED';
    const returnStatusMessage = !shellFinished
      ? 'جاري إنهاء المباراة...'
      : !isHost
        ? 'بانتظار المضيف للعودة إلى اللوبي.'
        : null;

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
        gameName={IMPOSTER_DRAW_GAME_NAME}
        returnStatusMessage={returnStatusMessage}
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={isHost && shellFinished ? handleReturnToLobby : undefined}
      />
    );
  }

  if (!pluginEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">جاري تحميل اللعبة...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <p className="text-sm text-destructive">{errorMessage}</p>
      </section>
    );
  }

  if (!view || !room || !player) {
    return null;
  }

  if (view.gamePhase === 'drawing-turns') {
    return (
      <DrawingTurnsScreen
        strokes={view.strokes}
        canDraw={view.canDraw}
        role={view.role}
        referenceImage={view.referenceImage}
        currentDrawerName={view.currentDrawerName}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        actionError={actionError}
        onClearCanvas={() => void clearCanvas()}
        onEmitStroke={(payload) => void emitStroke(payload)}
        onEmitStrokePoints={(payload) => void emitStrokePoints(payload)}
      />
    );
  }

  if (view.gamePhase === 'voting') {
    return (
      <VotingScreen
        players={toLobbyPlayers(view.votablePlayers, player.id, player.name)}
        currentPlayerId={player.id}
        selectedPlayerId={selectedVoteTargetId}
        confirmedPlayerId={view.confirmedVoteTargetPlayerId}
        hasVoted={view.hasVoted}
        submittedVotesCount={view.submittedVotesCount}
        eligibleVotersCount={view.eligibleVotersCount}
        roundNumber={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        questionTitle="من هو الإمبوستر؟"
        questionHelper="اختر اللاعب الذي تشك أنه يرسم بدون معرفة الصورة."
        isSubmitting={isSubmittingAction}
        errorMessage={actionError}
        onSelectPlayer={setSelectedVoteTargetId}
        onConfirmVote={() => {
          if (selectedVoteTargetId) {
            void submitVote(selectedVoteTargetId);
          }
        }}
      />
    );
  }

  if (view.gamePhase === 'reveal' && view.revealedImage && view.revealedImpostorName && view.revealedImpostorPlayerId) {
    return (
      <ImposterDrawRevealScreen
        revealedImage={view.revealedImage}
        impostorName={view.revealedImpostorName}
        impostorPlayerId={view.revealedImpostorPlayerId}
        impostorVotedOut={view.impostorVotedOut}
        voteTally={view.voteTally}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
      />
    );
  }

  if (view.gamePhase === 'impostor-guess') {
    return (
      <ImpostorGuessScreen
        isImpostor={view.role === 'impostor'}
        options={guessOptions}
        selectedWord={selectedGuessWord ?? view.selectedImageGuess}
        hasSubmitted={view.hasSubmittedImageGuess}
        roundNumber={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        phaseLabel="تخمين الصورة"
        showTimer={false}
        showOptionsToObservers
        waitingTitle="الإمبوستر يحاول تخمين الصورة..."
        waitingHelper="شاهد الخيارات وانتظر نتيجة التخمين."
        heroTitle="ما هي الصورة؟"
        heroHelper="اختر الصورة التي يعتقد الجميع أنهم يرسمونها."
        onSelectWord={view.role === 'impostor' ? setSelectedGuessWord : undefined}
        onSubmit={
          view.role === 'impostor'
            ? () => {
                if (selectedGuessWord) {
                  void submitImageGuess(selectedGuessWord);
                }
              }
            : undefined
        }
      />
    );
  }

  if (view.gamePhase === 'round-results' && view.revealedImage && view.revealedImpostorName) {
    return (
      <div className="space-y-4">
        <ImposterDrawRoundResultsScreen
          revealedImage={view.revealedImage}
          impostorName={view.revealedImpostorName}
          impostorVotedOut={view.impostorVotedOut}
          impostorGuessedCorrectly={view.impostorGuessedCorrectly}
          selectedImageGuess={view.selectedImageGuess}
          playersWon={view.playersWon}
          roundResults={view.roundResults}
          voteTally={view.voteTally}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          continueLabel={view.canContinueFromRoundResults ? view.roundResultsContinueLabel : null}
          waitingMessage={view.roundResultsWaitingMessage}
          isContinueLoading={isSubmittingAction}
          onContinue={
            view.canContinueFromRoundResults && !isSubmittingAction
              ? () => void continueFromRoundResults()
              : undefined
          }
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  return null;
}
