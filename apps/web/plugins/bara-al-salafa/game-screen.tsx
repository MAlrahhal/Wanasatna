'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BaraAlSalafaPlayerView, GamePluginScreenProps } from '@wanasatna/shared';
import { BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameSystemError, GameSystemLoading } from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { toExperienceTimer } from '@/lib/game/deadline-clock';
import { mapBaraAlSalafaLeaderboard } from '@/lib/game/map-bara-leaderboard';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { DirectedQuestionsScreen } from './directed-questions-screen';
import { FreeQuestionsScreen } from './free-questions-screen';
import { ImpostorGuessScreen } from './impostor-guess-screen';
import {
  mapDirectedQuestionsLiveProps,
  mapImpostorGuessLiveProps,
  mapMatchResultsLiveProps,
  mapRevealImpostorLiveProps,
  mapRoundResultsLiveProps,
  mapVotingLiveProps,
  resolveFreeQuestionActivePlayerId,
} from './live-phase-adapters';
import { MatchResultsScreen } from './match-results-screen';
import { RevealImpostorScreen } from './reveal-impostor-screen';
import { RoleRevealScreen } from './role-reveal-screen';
import { RoundResultsScreen } from './round-results-screen';
import { VotingScreen } from './voting-screen';
import { WaitingSpectatorScreen } from './waiting-spectator-screen';
import { useBaraAlSalafaPlayerView } from './use-player-view';
import { useBaraAlSalafaSfx } from './use-sfx';

const TIMED_BARA_PHASES = new Set([
  'description',
  'directed-questions',
  'free-questions',
  'voting',
  'reveal-impostor',
  'impostor-guess',
  'impostor-guess-result',
  'round-results',
  'match-completed',
]);

const NOT_PARTICIPANT_ERROR = 'أنت لست مشاركاً في هذه الجولة.';

function ImpostorGuessResultScreen({
  message,
  secretWord,
}: {
  message: string;
  secretWord: string | null;
}) {
  return (
    <GameScreen ariaLabel="نتيجة تخمين برا السالفة" maxWidth="3xl">
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
        <p className="text-2xl font-semibold text-wanas-text-primary sm:text-3xl">{message}</p>
        {secretWord ? (
          <>
            <p className="mt-8 text-base font-medium text-wanas-text-secondary sm:text-lg">الكلمة:</p>
            <p className="mt-2 max-w-full break-words text-2xl font-semibold text-wanas-text-primary sm:text-3xl">
              {secretWord}
            </p>
          </>
        ) : null}
      </div>
    </GameScreen>
  );
}

export function BaraAlSalafaGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isBaraAlSalafa = shellState?.gameId === 'bara-al-salafa';
  const shellPhase = shellState?.phase;
  const pluginEnabled = isBaraAlSalafa && shellPhase === 'PLAYING';
  const [guessSelection, setGuessSelection] = useState<string | null>(null);
  const [freeQuestionSelection, setFreeQuestionSelection] = useState<string | null>(null);
  const [voteSelection, setVoteSelection] = useState<string | null>(null);
  const [finalResultsView, setFinalResultsView] = useState<BaraAlSalafaPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);
  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    submitRoleUnderstood,
    advanceDirectedQuestion,
    continueFromRoundResults,
    chooseFreeQuestionPlayer,
    skipFreeQuestionTurn,
    advanceFreeQuestion,
    submitVote,
    submitImpostorGuess,
  } = useBaraAlSalafaPlayerView(pluginEnabled);

  useBaraAlSalafaSfx(view, player?.id);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isBaraAlSalafa &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  const treatAsSpectator =
    view?.isMatchSpectator === true ||
    (!view && Boolean(errorMessage?.includes(NOT_PARTICIPANT_ERROR)));

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    setFreeQuestionSelection(null);
  }, [view?.gamePhase, view?.activeFreeQuestionPlayerId, view?.activeFreeQuestionTargetPlayerId]);

  useEffect(() => {
    setVoteSelection(null);
  }, [view?.gamePhase, view?.hasVoted]);

  useEffect(() => {
    setGuessSelection(null);
  }, [view?.gamePhase, view?.hasSubmittedImpostorGuess]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled =
      isBaraAlSalafa && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: 'برا السالفة',
        gameIcon: BARA_AL_SALAFA_GAME_ICON,
        phaseLabel: treatAsSpectator ? SYSTEM_COPY.spectatorTitle : SYSTEM_COPY.loading,
        leaderboardEntries: mapBaraAlSalafaLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: 'برا السالفة',
      gameIcon: BARA_AL_SALAFA_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      categoryLabel: activeView.categoryName
        ? `الفئة: ${activeView.categoryName}`
        : undefined,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: TIMED_BARA_PHASES.has(activeView.gamePhase)
        ? toExperienceTimer(activeView.deadlineAtMs, { format: 'seconds', lowTimeThreshold: 10 })
        : undefined,
      leaderboardEntries: mapBaraAlSalafaLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isBaraAlSalafa,
    player,
    players,
    pluginEnabled,
    setExperienceMeta,
    showFinalMatchResults,
    treatAsSpectator,
    view,
  ]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  const handleFreeQuestionConfirm = useCallback(() => {
    if (!freeQuestionSelection || isSubmittingAction) {
      return;
    }

    void chooseFreeQuestionPlayer(freeQuestionSelection);
  }, [chooseFreeQuestionPlayer, freeQuestionSelection, isSubmittingAction]);

  const handleFreeQuestionSkip = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    void skipFreeQuestionTurn();
  }, [isSubmittingAction, skipFreeQuestionTurn]);

  const handleConfirmVote = useCallback(() => {
    if (!voteSelection || isSubmittingAction || view?.hasVoted) {
      return;
    }

    void submitVote(voteSelection);
  }, [isSubmittingAction, submitVote, view?.hasVoted, voteSelection]);

  const handleSubmitImpostorGuess = useCallback(() => {
    if (!guessSelection || isSubmittingAction || view?.hasSubmittedImpostorGuess) {
      return;
    }

    void submitImpostorGuess(guessSelection);
  }, [guessSelection, isSubmittingAction, submitImpostorGuess, view?.hasSubmittedImpostorGuess]);

  const handleReturnToLobby = useCallback(() => {
    if (isReturningToLobby) {
      return;
    }

    // During match-completed, host skip finishes the match and navigates via server.
    if (view?.gamePhase === 'match-completed' && isHost) {
      setIsReturningToLobby(true);
      void continueFromRoundResults().finally(() => {
        setIsReturningToLobby(false);
      });
      return;
    }

    if (!isHost || shellPhase !== 'FINISHED') {
      return;
    }

    setIsReturningToLobby(true);
    void returnToLobby().finally(() => {
      setIsReturningToLobby(false);
    });
  }, [
    continueFromRoundResults,
    isHost,
    isReturningToLobby,
    returnToLobby,
    shellPhase,
    view?.gamePhase,
  ]);

  if (showFinalMatchResults && room && player && activeFinalResultsView) {
    const shellFinished = shellPhase === 'FINISHED';
    const isMatchCompletedPhase = activeFinalResultsView.gamePhase === 'match-completed';
    const autoReturnMessage = isMatchCompletedPhase
      ? null
      : !shellFinished
        ? SYSTEM_COPY.returningToLobby
        : !isHost
          ? 'بانتظار المضيف للعودة إلى اللوبي.'
          : null;

    return (
      <MatchResultsScreen
        {...mapMatchResultsLiveProps(activeFinalResultsView, player.id, room.code)}
        returnStatusMessage={isHost && (isMatchCompletedPhase || shellFinished) ? null : autoReturnMessage}
        autoReturnDeadlineAtMs={isMatchCompletedPhase ? activeFinalResultsView.deadlineAtMs : undefined}
        autoReturnTotalSeconds={
          isMatchCompletedPhase ? BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS : undefined
        }
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={
          isHost && (isMatchCompletedPhase || shellFinished) ? handleReturnToLobby : undefined
        }
      />
    );
  }

  if (!pluginEnabled) {
    return null;
  }

  if (treatAsSpectator) {
    return <WaitingSpectatorScreen />;
  }

  if (isLoading) {
    return <GameSystemLoading />;
  }

  if (errorMessage) {
    return <GameSystemError message={errorMessage} />;
  }

  if (!view) {
    return null;
  }

  if (view.gamePhase === 'impostor-guess-result') {
    return (
      <ImpostorGuessResultScreen
        message={view.guessResultMessage ?? 'انتهت نتيجة التخمين'}
        secretWord={view.revealedWord}
      />
    );
  }

  if (view.gamePhase === 'round-results') {
    if (!room || !player) {
      return null;
    }

    const roundResultsProps = mapRoundResultsLiveProps(
      view,
      player.id,
      room.code,
      view.deadlineAtMs,
    );

    if (!roundResultsProps) {
      return (
        <GameSystemLoading />
      );
    }

    return (
      <div className="space-y-4">
        <RoundResultsScreen
          {...roundResultsProps}
          onContinue={
            view.canContinueFromRoundResults && !isSubmittingAction
              ? () => void continueFromRoundResults()
              : undefined
          }
          isContinueLoading={isSubmittingAction}
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  if (view.gamePhase === 'reveal-impostor') {
    if (!room) {
      return null;
    }

    const revealImpostorProps = mapRevealImpostorLiveProps(view, room.code, view.deadlineAtMs);

    if (!revealImpostorProps) {
      return (
        <GameSystemLoading />
      );
    }

    return <RevealImpostorScreen {...revealImpostorProps} />;
  }

  if (view.gamePhase === 'impostor-guess') {
    if (!room) {
      return null;
    }

    const impostorGuessProps = mapImpostorGuessLiveProps(view, room.code, view.deadlineAtMs);

    return (
      <div className="space-y-4">
        <ImpostorGuessScreen
          {...impostorGuessProps}
          selectedWord={guessSelection}
          onSelectWord={
            impostorGuessProps.isImpostor &&
            !impostorGuessProps.hasSubmitted &&
            !isSubmittingAction
              ? setGuessSelection
              : undefined
          }
          onSubmit={
            impostorGuessProps.isImpostor &&
            !impostorGuessProps.hasSubmitted &&
            !isSubmittingAction
              ? handleSubmitImpostorGuess
              : undefined
          }
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  if (view.gamePhase === 'voting') {
    if (!room || !player) {
      return null;
    }

    const votingProps = mapVotingLiveProps(
      view,
      players,
      player.id,
      room.code,
      view.deadlineAtMs,
      isSubmittingAction,
      actionError,
    );

    return (
      <VotingScreen
        {...votingProps}
        selectedPlayerId={voteSelection}
        onSelectPlayer={
          !view.hasVoted && !isSubmittingAction ? setVoteSelection : undefined
        }
        onConfirmVote={
          !view.hasVoted && !isSubmittingAction ? handleConfirmVote : undefined
        }
      />
    );
  }

  if (view.gamePhase === 'description') {
    if (!room || !player) {
      return null;
    }

    const role = view.role === 'impostor' ? 'impostor' : 'normal';

    return (
      <RoleRevealScreen
        gameName="برا السالفة"
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        remainingSeconds={0}
        deadlineAtMs={view.deadlineAtMs}
        roomCode={room.code}
        role={role}
        secretWord={view.role === 'player' ? view.displayText : undefined}
        players={players}
        currentPlayerId={player.id}
        onAcknowledge={
          !view.hasAcknowledgedRole && !isSubmittingAction
            ? () => void submitRoleUnderstood()
            : undefined
        }
        acknowledged={view.hasAcknowledgedRole}
        roleAcknowledgementCount={view.roleAcknowledgementCount}
        eligibleRoleAcknowledgementCount={view.eligibleRoleAcknowledgementCount}
        showFallbackTimer={Boolean(view.deadlineAtMs)}
      />
    );
  }

  if (view.gamePhase === 'directed-questions') {
    if (!room || !player) {
      return null;
    }

    const directedQuestionsProps = mapDirectedQuestionsLiveProps(
      view,
      players,
      player.id,
      room.code,
      view.deadlineAtMs,
    );

    if (!directedQuestionsProps) {
      return (
        <GameSystemLoading />
      );
    }

    return (
      <div className="space-y-4">
        <DirectedQuestionsScreen
          {...directedQuestionsProps}
          isSubmittingAdvance={isSubmittingAction}
          onAdvanceNext={
            view.isDirectedQuestionActiveAsker && !isSubmittingAction
              ? () => void advanceDirectedQuestion()
              : undefined
          }
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  if (view.gamePhase === 'free-questions') {
    if (!room || !player) {
      return null;
    }

    const activePlayerId = resolveFreeQuestionActivePlayerId(view, player.id, players);

    if (!activePlayerId) {
      return (
        <GameSystemLoading />
      );
    }

    const participatingPlayers = players.filter((participant) => !participant.isSpectator);
    const activePlayer = participatingPlayers.find((participant) => participant.id === activePlayerId);
    const activePlayerName =
      view.activeFreeQuestionPlayerName ?? activePlayer?.name ?? 'اللاعب';
    const isActivePlayer = view.isFreeQuestionActivePlayer;
    const isConversationActive = Boolean(view.activeFreeQuestionTargetPlayerId);

    return (
      <div className="space-y-4">
        <FreeQuestionsScreen
          players={participatingPlayers}
          currentPlayerId={player.id}
          activePlayerId={activePlayerId}
          activePlayerName={activePlayerName}
          isActivePlayer={isActivePlayer}
          conversationTargetPlayerId={view.activeFreeQuestionTargetPlayerId}
          conversationTargetPlayerName={view.activeFreeQuestionTargetPlayerName}
          selectedTargetPlayerId={freeQuestionSelection}
          completedPlayerIds={view.completedFreeQuestionPlayerIds}
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          showTimer
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          isSubmittingAdvance={isSubmittingAction}
          onSelectPlayer={
            isActivePlayer && !isConversationActive && !isSubmittingAction
              ? setFreeQuestionSelection
              : undefined
          }
          onConfirm={
            isActivePlayer && !isConversationActive && !isSubmittingAction
              ? handleFreeQuestionConfirm
              : undefined
          }
          onSkip={
            isActivePlayer && !isConversationActive && !isSubmittingAction
              ? handleFreeQuestionSkip
              : undefined
          }
          onAdvanceNext={
            isActivePlayer && isConversationActive && !isSubmittingAction
              ? () => void advanceFreeQuestion()
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
