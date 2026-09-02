'use client';

import type {
  AdminSpectateData,
  BaraAlSalafaPlayerView,
  DrawGuessPlayerView,
  FastAnswerPlayerView,
  GuessingChallengePlayerView,
  ImposterDrawPlayerView,
  JudgePlayerView,
  TimingChallengePlayerView,
  WhoWroteItPlayerView,
} from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_ROUND_RESULTS_SECONDS,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_ROUND_RESULTS_SECONDS,
  JUDGE_GAME_ID,
  JUDGE_ROUND_RESULTS_SECONDS,
  TIMING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_ROUND_RESULTS_SECONDS,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_ROUND_RESULTS_SECONDS,
} from '@wanasatna/shared';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { GameScreen } from '@/components/game/game-card';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { adminGameTitle } from '@/lib/admin/format';
import { BARA_AL_SALAFA_GAME_NAME } from '@/lib/game/bara-al-salafa-brand';
import { DRAW_GUESS_GAME_ICON, DRAW_GUESS_GAME_NAME } from '@/lib/game/draw-guess-brand';
import { FAST_ANSWER_GAME_ICON, FAST_ANSWER_GAME_NAME } from '@/lib/game/fast-answer-brand';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { JUDGE_GAME_ICON, JUDGE_GAME_NAME } from '@/lib/game/judge-brand';
import { TIMING_CHALLENGE_GAME_ICON, TIMING_CHALLENGE_GAME_NAME } from '@/lib/game/timing-challenge-brand';
import { WHO_WROTE_IT_GAME_ICON, WHO_WROTE_IT_GAME_NAME } from '@/lib/game/who-wrote-it-brand';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { MatchResultsScreen, type MatchLeaderboardEntry } from '@/plugins/bara-al-salafa/match-results-screen';
import { RoundResultsScreen as BaraRoundResultsScreen } from '@/plugins/bara-al-salafa/round-results-screen';
import { WaitingSpectatorScreen } from '@/plugins/bara-al-salafa/waiting-spectator-screen';
import { DrawingCanvas } from '@/plugins/draw-guess/drawing-canvas';
import { DrawGuessRoundResultsScreen } from '@/plugins/draw-guess/round-results-screen';
import { FastAnswerQuestionScreen } from '@/plugins/fast-answer/question-screen';
import { FastAnswerRoundResultsScreen } from '@/plugins/fast-answer/round-results-screen';
import { GuessingChallengeSpectatorPlaying } from '@/plugins/guessing-challenge/game-screen';
import { GuessingChallengeRoundResultsScreen } from '@/plugins/guessing-challenge/round-results-screen';
import { ImposterDrawRoundResultsScreen } from '@/plugins/imposter-draw/round-results-screen';
import { JudgeAnsweringScreen } from '@/plugins/judge/answering-screen';
import { JudgeJudgingScreen } from '@/plugins/judge/judging-screen';
import { JudgeRoundResultsScreen } from '@/plugins/judge/round-results-screen';
import { HiddenTimingScreen } from '@/plugins/timing-challenge/hidden-timing-screen';
import { TimingChallengeRoundResultsScreen } from '@/plugins/timing-challenge/round-results-screen';
import { ElectronicPanel } from '@/plugins/timing-challenge/electronic-panel';
import { PeerStatusList } from '@/plugins/timing-challenge/peer-status-list';
import { WhoWroteItAnsweringScreen } from '@/plugins/who-wrote-it/answering-screen';
import { WhoWroteItGuessingScreen } from '@/plugins/who-wrote-it/guessing-screen';
import { WhoWroteItRoundResultsScreen } from '@/plugins/who-wrote-it/round-results-screen';

const OBSERVER_ID = '';

function matchLeaderboard(
  rows: ReadonlyArray<{ playerId: string; name: string; totalPoints: number; rank: number; isFirstPlace: boolean }>,
): MatchLeaderboardEntry[] {
  return rows.map((row) => ({
    id: row.playerId,
    name: row.name,
    totalPoints: row.totalPoints,
    rank: row.rank,
    isFirstPlace: row.isFirstPlace,
    isCurrentPlayer: false,
  }));
}

function FallbackWatch({
  gameName,
  gameIcon,
  roomCode,
  currentRound,
  totalRounds,
  phaseLabel,
  deadlineAtMs,
  message,
}: {
  gameName: string;
  gameIcon?: string;
  roomCode: string;
  currentRound?: number;
  totalRounds?: number;
  phaseLabel?: string;
  deadlineAtMs?: number | null;
  message?: string;
}) {
  return (
    <GameScreen ariaLabel="مشاهدة" maxWidth="3xl" className="gap-3">
      <GameHeader
        gameName={gameName}
        gameIcon={gameIcon}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel={phaseLabel ?? SYSTEM_COPY.spectatorTitle}
        timer={
          deadlineAtMs
            ? resolveHeaderTimer({ deadlineAtMs, format: 'seconds', lowTimeThreshold: 5 })
            : undefined
        }
      />
      {message ? (
        <p className="text-center text-sm text-wanas-text-secondary">{message}</p>
      ) : null}
    </GameScreen>
  );
}

function ReadOnlyCanvas({
  gameName,
  gameIcon,
  roomCode,
  currentRound,
  totalRounds,
  phaseLabel,
  deadlineAtMs,
  strokes,
  caption,
}: {
  gameName: string;
  gameIcon?: string;
  roomCode: string;
  currentRound?: number;
  totalRounds?: number;
  phaseLabel?: string;
  deadlineAtMs?: number | null;
  strokes: DrawGuessPlayerView['strokes'];
  caption?: string;
}) {
  return (
    <GameScreen ariaLabel="لوحة الرسم" maxWidth="6xl" className="gap-3">
      <GameHeader
        gameName={gameName}
        gameIcon={gameIcon}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel={phaseLabel}
        timer={
          deadlineAtMs
            ? resolveHeaderTimer({ deadlineAtMs, format: 'seconds', lowTimeThreshold: 10 })
            : undefined
        }
      />
      {caption ? <p className="text-center text-sm text-wanas-text-secondary">{caption}</p> : null}
      <div className="pointer-events-none overflow-hidden rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)]">
        <DrawingCanvas strokes={strokes} readOnly className="w-full" />
      </div>
    </GameScreen>
  );
}

function FastAnswerLive({ view, roomCode }: { view: FastAnswerPlayerView; roomCode: string }) {
  if (view.gamePhase === 'question' && view.question) {
    return (
      <div className="space-y-3">
        <GameHeader
          gameName={FAST_ANSWER_GAME_NAME}
          gameIcon={FAST_ANSWER_GAME_ICON}
          roomCode={roomCode}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel={view.categoryLabel ? `الفئة: ${view.categoryLabel}` : view.phaseLabel}
          timer={resolveHeaderTimer({
            deadlineAtMs: view.questionDeadlineAtMs ?? view.deadlineAtMs,
            format: 'seconds',
            lowTimeThreshold: 5,
          })}
        />
        <FastAnswerQuestionScreen question={view.question} canSubmit={false} isSubmitting={false} />
      </div>
    );
  }

  if (view.gamePhase === 'round-results' && view.revealedAnswer !== null) {
    return (
      <FastAnswerRoundResultsScreen
        revealedAnswer={view.revealedAnswer}
        timedOut={view.timedOut}
        winnerName={view.winnerName}
        roundResults={view.roundResults}
        currentPlayerId={OBSERVER_ID}
        roundNumber={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={roomCode}
        deadlineAtMs={view.deadlineAtMs}
        totalDurationSeconds={FAST_ANSWER_ROUND_RESULTS_SECONDS}
        waitingMessage={view.roundResultsWaitingMessage}
      />
    );
  }

  if (view.gamePhase === 'match-completed') {
    return (
      <MatchResultsScreen
        leaderboard={matchLeaderboard(view.resultsLeaderboard)}
        currentPlayerId={OBSERVER_ID}
        totalRounds={view.totalRounds}
        playerCount={view.resultsLeaderboard.length}
        roomCode={roomCode}
        gameName={FAST_ANSWER_GAME_NAME}
      />
    );
  }

  return (
    <FallbackWatch
      gameName={FAST_ANSWER_GAME_NAME}
      gameIcon={FAST_ANSWER_GAME_ICON}
      roomCode={roomCode}
      currentRound={view.currentRound}
      totalRounds={view.totalRounds}
      phaseLabel={view.phaseLabel}
      deadlineAtMs={view.deadlineAtMs}
    />
  );
}

export function AdminSpectateLiveView({ data }: { data: AdminSpectateData }) {
  const roomCode = data.room.code;
  const plugin = data.pluginView;
  const shell = data.shell;

  if (!plugin) {
    if (shell?.phase === 'COUNTDOWN') {
      return (
        <FallbackWatch
          gameName={adminGameTitle(shell.gameId)}
          roomCode={roomCode}
          phaseLabel="العد التنازلي"
          deadlineAtMs={null}
          message={
            shell.countdownRemainingSeconds != null
              ? `تبدأ الجولة خلال ${shell.countdownRemainingSeconds} ثانية`
              : ADMIN_COPY.spectateNoRuntime
          }
        />
      );
    }

    return (
      <FallbackWatch
        gameName={adminGameTitle(data.room.gameId ?? shell?.gameId)}
        roomCode={roomCode}
        phaseLabel={data.room.activity === 'IN_GAME' ? ADMIN_COPY.inGame : ADMIN_COPY.lobby}
        message={
          data.room.activity === 'IN_GAME' ? ADMIN_COPY.spectateNoRuntime : ADMIN_COPY.spectateLobbyState
        }
      />
    );
  }

  switch (plugin.gameId) {
    case FAST_ANSWER_GAME_ID:
      return <FastAnswerLive view={plugin.view as FastAnswerPlayerView} roomCode={roomCode} />;
    case BARA_AL_SALAFA_GAME_ID: {
      const view = plugin.view as BaraAlSalafaPlayerView;
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={BARA_AL_SALAFA_GAME_NAME}
          />
        );
      }
      if (view.gamePhase === 'round-results' && view.revealedWord && view.revealedImpostorName) {
        return (
          <BaraRoundResultsScreen
            revealedWord={view.revealedWord}
            impostorPlayerId={view.revealedImpostorPlayerId ?? ''}
            impostorPlayerName={view.revealedImpostorName}
            impostorGuessedCorrectly={view.impostorGuessedCorrectly ?? false}
            roundResults={view.roundResults.map((row) => ({
              id: row.playerId,
              name: row.name,
              roundPoints: row.roundPoints,
              totalPoints: row.totalPoints,
              isImpostor: row.isImpostor,
              earnedPoints: row.earnedPoints,
            }))}
            currentPlayerId={OBSERVER_ID}
            roundNumber={view.currentRound}
            totalRounds={view.totalRounds}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS}
            waitingMessage={view.roundResultsWaitingMessage}
          />
        );
      }
      return (
        <WaitingSpectatorScreen
          civilianWord={view.spectatorCivilianWord}
          outsiderConcept={view.spectatorOutsiderConcept}
          categoryName={view.categoryName}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={roomCode}
          deadlineAtMs={view.deadlineAtMs}
        />
      );
    }
    case DRAW_GUESS_GAME_ID: {
      const view = plugin.view as DrawGuessPlayerView;
      if (view.gamePhase === 'round-results' && view.revealedWord) {
        return (
          <DrawGuessRoundResultsScreen
            revealedWord={view.revealedWord}
            guessedCorrectly={view.guessedCorrectly}
            correctGuesserName={view.correctGuesserName}
            drawerName={view.drawerName}
            roundResults={view.roundResults}
            currentPlayerId={OBSERVER_ID}
            roundNumber={view.currentRound}
            totalRounds={view.totalRounds}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS}
            waitingMessage={view.roundResultsWaitingMessage}
          />
        );
      }
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={DRAW_GUESS_GAME_NAME}
          />
        );
      }
      return (
        <ReadOnlyCanvas
          gameName={DRAW_GUESS_GAME_NAME}
          gameIcon={DRAW_GUESS_GAME_ICON}
          roomCode={roomCode}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel={view.phaseLabel}
          deadlineAtMs={view.deadlineAtMs}
          strokes={view.strokes}
          caption={view.drawerName ? `يرسم: ${view.drawerName}` : undefined}
        />
      );
    }
    case IMPOSTER_DRAW_GAME_ID: {
      const view = plugin.view as ImposterDrawPlayerView;
      if (view.gamePhase === 'round-results') {
        return (
          <ImposterDrawRoundResultsScreen
            impostorName={view.revealedImpostorName ?? '—'}
            impostorVotedOut={view.impostorVotedOut}
            impostorGuessedCorrectly={view.impostorGuessedCorrectly}
            selectedImageGuess={view.selectedImageGuess}
            revealedAnswerLabel={view.revealedAnswerLabel}
            playersWon={view.playersWon}
            roundResults={view.roundResults}
            currentPlayerId={OBSERVER_ID}
            roundNumber={view.currentRound}
            totalRounds={view.totalRounds}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={IMPOSTER_DRAW_ROUND_RESULTS_SECONDS}
            waitingMessage={view.roundResultsWaitingMessage}
          />
        );
      }
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={IMPOSTER_DRAW_GAME_NAME}
          />
        );
      }
      return (
        <ReadOnlyCanvas
          gameName={IMPOSTER_DRAW_GAME_NAME}
          gameIcon={IMPOSTER_DRAW_GAME_ICON}
          roomCode={roomCode}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel={view.phaseLabel}
          deadlineAtMs={view.deadlineAtMs}
          strokes={view.strokes}
          caption={view.currentDrawerName ? `يرسم: ${view.currentDrawerName}` : undefined}
        />
      );
    }
    case TIMING_CHALLENGE_GAME_ID: {
      const view = plugin.view as TimingChallengePlayerView;
      if (view.gamePhase === 'round-results' && view.targetMs != null) {
        return (
          <TimingChallengeRoundResultsScreen
            mode={view.mode}
            targetMs={view.targetMs}
            roundResults={view.roundResults}
            currentPlayerId={OBSERVER_ID}
            roundNumber={view.currentRound}
            totalRounds={view.totalRounds}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={TIMING_CHALLENGE_ROUND_RESULTS_SECONDS}
            waitingMessage={view.roundResultsWaitingMessage}
          />
        );
      }
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={TIMING_CHALLENGE_GAME_NAME}
          />
        );
      }
      if (view.gamePhase === 'hidden-timing') {
        return (
          <GameScreen ariaLabel="تحدي التوقيت" maxWidth="3xl" className="gap-3">
            <GameHeader
              gameName={TIMING_CHALLENGE_GAME_NAME}
              gameIcon={TIMING_CHALLENGE_GAME_ICON}
              roomCode={roomCode}
              currentRound={view.currentRound}
              totalRounds={view.totalRounds}
              phaseLabel={view.phaseLabel}
            />
            <HiddenTimingScreen />
            <PeerStatusList peers={view.peers} currentPlayerId={OBSERVER_ID} />
          </GameScreen>
        );
      }
      return (
        <GameScreen ariaLabel="تحدي التوقيت" maxWidth="3xl" className="gap-3">
          <GameHeader
            gameName={TIMING_CHALLENGE_GAME_NAME}
            gameIcon={TIMING_CHALLENGE_GAME_ICON}
            roomCode={roomCode}
            currentRound={view.currentRound}
            totalRounds={view.totalRounds}
            phaseLabel={view.phaseLabel}
          />
          <ElectronicPanel ariaLabel={view.phaseLabel}>
            <p className="text-center text-base font-bold text-wanas-text-primary">{view.phaseLabel}</p>
          </ElectronicPanel>
          <PeerStatusList peers={view.peers} currentPlayerId={OBSERVER_ID} />
        </GameScreen>
      );
    }
    case JUDGE_GAME_ID: {
      const view = plugin.view as JudgePlayerView;
      if (view.gamePhase === 'answering' && view.prompt) {
        return (
          <div className="space-y-3">
            <GameHeader
              gameName={JUDGE_GAME_NAME}
              gameIcon={JUDGE_GAME_ICON}
              roomCode={roomCode}
              currentRound={view.currentRound}
              totalRounds={view.totalRounds}
              phaseLabel={view.judgeName ? `القاضي: ${view.judgeName}` : view.phaseLabel}
              timer={resolveHeaderTimer({
                deadlineAtMs: view.deadlineAtMs,
                format: 'seconds',
                lowTimeThreshold: 5,
              })}
            />
            <JudgeAnsweringScreen
              prompt={view.prompt}
              isJudge={false}
              canSubmit={false}
              hasSubmitted={false}
              submittedCount={view.submittedAnswerCount}
              totalSlots={view.totalAnswerSlots}
              isSubmitting={false}
              isSpectator
            />
          </div>
        );
      }
      if (view.gamePhase === 'judging') {
        return (
          <div className="space-y-3">
            <GameHeader
              gameName={JUDGE_GAME_NAME}
              gameIcon={JUDGE_GAME_ICON}
              roomCode={roomCode}
              currentRound={view.currentRound}
              totalRounds={view.totalRounds}
              phaseLabel={view.judgeName ? `القاضي: ${view.judgeName}` : view.phaseLabel}
              timer={resolveHeaderTimer({
                deadlineAtMs: view.deadlineAtMs,
                format: 'seconds',
                lowTimeThreshold: 5,
              })}
            />
            <JudgeJudgingScreen
              prompt={view.prompt ?? ''}
              answers={view.anonymousAnswers}
              isJudge={false}
              canSelect={false}
              isSubmitting={false}
              isSpectator
              onSelectWinner={() => undefined}
            />
          </div>
        );
      }
      if (view.gamePhase === 'round-results') {
        return (
          <JudgeRoundResultsScreen
            winningAnswerText={view.winningAnswerText}
            winnerName={view.winnerName}
            revealEntries={view.revealEntries}
            roundResults={view.roundResults}
            currentPlayerId={OBSERVER_ID}
            roundNumber={view.currentRound}
            totalRounds={view.totalRounds}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={JUDGE_ROUND_RESULTS_SECONDS}
            waitingMessage={view.roundResultsWaitingMessage}
          />
        );
      }
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={JUDGE_GAME_NAME}
          />
        );
      }
      break;
    }
    case WHO_WROTE_IT_GAME_ID: {
      const view = plugin.view as WhoWroteItPlayerView;
      if (view.gamePhase === 'answering' && view.question) {
        return (
          <div className="space-y-3">
            <GameHeader
              gameName={WHO_WROTE_IT_GAME_NAME}
              gameIcon={WHO_WROTE_IT_GAME_ICON}
              roomCode={roomCode}
              currentRound={view.currentRound}
              totalRounds={view.totalRounds}
              phaseLabel={view.phaseLabel}
              timer={resolveHeaderTimer({
                deadlineAtMs: view.deadlineAtMs,
                format: 'seconds',
                lowTimeThreshold: 5,
              })}
            />
            <WhoWroteItAnsweringScreen
              question={view.question}
              canSubmit={false}
              hasSubmitted={false}
              submittedCount={view.submittedAnswerCount}
              totalSlots={view.totalAnswerSlots}
              isSubmitting={false}
              isSpectator
            />
          </div>
        );
      }
      if (view.gamePhase === 'guessing') {
        return (
          <div className="space-y-3">
            <GameHeader
              gameName={WHO_WROTE_IT_GAME_NAME}
              gameIcon={WHO_WROTE_IT_GAME_ICON}
              roomCode={roomCode}
              currentRound={view.currentRound}
              totalRounds={view.totalRounds}
              phaseLabel={view.phaseLabel}
            />
            <WhoWroteItGuessingScreen
              currentAnswer={view.currentAnonymousAnswer}
              options={[]}
              progressIndex={view.guessingProgressIndex}
              progressTotal={view.guessingProgressTotal}
              isOwnAnswer={false}
              hasGuessedCurrent={false}
              canSubmitGuess={false}
              currentGuessCount={view.currentAnswerGuessCount}
              requiredGuessCount={view.currentAnswerRequiredGuessCount}
              isSubmitting={false}
              isSpectator
              onGuess={() => undefined}
            />
          </div>
        );
      }
      if (view.gamePhase === 'round-results') {
        return (
          <WhoWroteItRoundResultsScreen
            revealEntries={view.revealEntries}
            roundResults={view.roundResults}
            currentPlayerId={OBSERVER_ID}
            roundNumber={view.currentRound}
            totalRounds={view.totalRounds}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={WHO_WROTE_IT_ROUND_RESULTS_SECONDS}
            waitingMessage={view.roundResultsWaitingMessage}
          />
        );
      }
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={WHO_WROTE_IT_GAME_NAME}
          />
        );
      }
      break;
    }
    case GUESSING_CHALLENGE_GAME_ID: {
      const view = plugin.view as GuessingChallengePlayerView;
      if (view.gamePhase === 'playing') {
        return (
          <div className="space-y-3">
            <GameHeader
              gameName={GUESSING_CHALLENGE_GAME_NAME}
              gameIcon={GUESSING_CHALLENGE_GAME_ICON}
              roomCode={roomCode}
              currentRound={view.currentRound}
              totalRounds={view.totalRounds}
              phaseLabel={view.currentTurnPlayerName ? `دور ${view.currentTurnPlayerName}` : view.phaseLabel}
              timer={
                view.deadlineAtMs
                  ? resolveHeaderTimer({
                      deadlineAtMs: view.deadlineAtMs,
                      format: 'seconds',
                      lowTimeThreshold: 5,
                    })
                  : undefined
              }
            />
            <GuessingChallengeSpectatorPlaying view={view} showSpectatorNotice={false} />
          </div>
        );
      }
      if (view.gamePhase === 'round-results') {
        return (
          <GuessingChallengeRoundResultsScreen
            view={view}
            currentPlayerId={OBSERVER_ID}
            roomCode={roomCode}
            deadlineAtMs={view.deadlineAtMs}
            totalDurationSeconds={GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS}
          />
        );
      }
      if (view.gamePhase === 'match-completed') {
        return (
          <MatchResultsScreen
            leaderboard={matchLeaderboard(view.resultsLeaderboard)}
            currentPlayerId={OBSERVER_ID}
            totalRounds={view.totalRounds}
            playerCount={view.resultsLeaderboard.length}
            roomCode={roomCode}
            gameName={GUESSING_CHALLENGE_GAME_NAME}
          />
        );
      }
      break;
    }
    default:
      break;
  }

  return (
    <FallbackWatch
      gameName={adminGameTitle(plugin.gameId)}
      roomCode={roomCode}
      phaseLabel={SYSTEM_COPY.spectatorTitle}
      message={ADMIN_COPY.spectateNoRuntime}
    />
  );
}
