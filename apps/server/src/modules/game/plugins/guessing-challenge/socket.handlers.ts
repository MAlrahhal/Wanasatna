import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  GuessingChallengeCardActionPayload,
  GuessingChallengeContinuePayload,
  GuessingChallengeLookPayload,
  GuessingChallengeMode,
  GuessingChallengeSubmitFinalGuessPayload,
  GuessingChallengeTurnActionPayload,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_LOOK_EVENT,
  GUESSING_CHALLENGE_LOOK_UPDATE_EVENT,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_REJECT_CARD_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
  GUESSING_CHALLENGE_WINNER_POINTS,
  isActiveMatchParticipant,
  normalizeTextAnswer,
} from '@wanasatna/shared';
import { consumeLookLimit } from '../../../../lib/abuse-limiter.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  getGameSocketContext,
  rejectIfGameSyncRateLimited,
  sendGameResponse,
} from '../../game.socket.utils.js';
import {
  AnswerAttemptStatus,
  AnswerRejectReason,
  recordAnswerAttempt,
} from '../../runtime/answer-attempt-log.js';
import { ensureGuessingChallengeMatchStateWithTimer } from './init-match.js';
import {
  broadcastPhaseChanged,
  continueFromRoundResults,
  startRoundResults,
} from './match-lifecycle.js';
import {
  clearGuessingChallengeRoomMode,
  setGuessingChallengeRoomMode,
} from './mode-store.js';
import {
  clearGuessingChallengePhaseTimerRuntime,
  restartGuessingChallengePhaseTimer,
} from './phase-timer.js';
import {
  applyFinalGuess,
  applyLookDirection,
  buildGuessingChallengePlayerView,
  clearLookThrottleForRoom,
  confirmSpecialCard,
  endQuestionTurn,
  isEligibleGuessingChallengeActor,
  rejectSpecialCard,
  resetPlayerLook,
} from './state.js';
import { identityMatchesGuess } from './identities.js';
import {
  deleteGuessingChallengeState,
  getGuessingChallengeState,
  setGuessingChallengeState,
} from './store.js';

function gameNotReadyError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code: 'INVALID_PHASE', message: 'Game is not ready yet.' },
  };
}

function notParticipantError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code: 'NOT_PARTICIPANT', message: 'أنت لست مشاركاً في هذه الجولة.' },
  };
}

function invalidActionError(
  message: string,
): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
  };
}

function clearGuessingChallengeRuntime(roomId: string): void {
  clearGuessingChallengePhaseTimerRuntime(roomId);
  clearLookThrottleForRoom(roomId);
  clearGuessingChallengeRoomMode(roomId);
  deleteGuessingChallengeState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
  extra?: Record<string, unknown>,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getGuessingChallengeState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: {
      view: buildGuessingChallengePlayerView(match, playerId, shell),
      ...extra,
    },
  });
}

function classifyGuessingChallengeReject(message: string): {
  status: AnswerAttemptStatus;
  rejectReason: AnswerRejectReason | null;
} {
  if (message === 'انتهى هذا الدور.') {
    return { status: AnswerAttemptStatus.LATE, rejectReason: null };
  }
  if (message === 'ليس دورك الآن') {
    return { status: AnswerAttemptStatus.OUT_OF_TURN, rejectReason: null };
  }
  if (message === 'انتهت هذه الجولة.') {
    return { status: AnswerAttemptStatus.LATE, rejectReason: null };
  }
  if (message === 'اكتب تخمينك أولًا') {
    return { status: AnswerAttemptStatus.REJECTED, rejectReason: AnswerRejectReason.EMPTY };
  }
  if (message === 'لست مشاركاً في هذه المباراة.') {
    return { status: AnswerAttemptStatus.REJECTED, rejectReason: AnswerRejectReason.NOT_PARTICIPANT };
  }
  return { status: AnswerAttemptStatus.REJECTED, rejectReason: AnswerRejectReason.VALIDATION };
}

async function logGuessingChallengeAttempt(
  roomId: string,
  playerId: string,
  match: NonNullable<ReturnType<typeof getGuessingChallengeState>>,
  rawAnswer: string,
  fields: {
    status: AnswerAttemptStatus;
    rejectReason?: AnswerRejectReason | null;
    wasCorrect: boolean | null;
    wasCounted: boolean;
    pointsAwarded?: number;
  },
): Promise<void> {
  const teamId = match.teamByPlayerId[playerId] ?? null;
  const identity = teamId ? match.round.identitiesByTeamId[teamId] : null;
  await recordAnswerAttempt({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    playerId,
    playerDisplayName: match.playerNames[playerId] ?? 'لاعب',
    rawAnswer,
    normalizedAnswer: rawAnswer.trim() ? normalizeTextAnswer(rawAnswer) || null : null,
    roundIndex: match.currentRound,
    roundId: match.round.roundId,
    turnId: match.round.turnId,
    promptId: identity?.id ?? null,
    promptText: identity?.value ?? '',
    teamId,
    ...fields,
  });
}

export function applyGuessingChallengeLobbySettings(
  roomId: string,
  settingsInput: unknown,
): { success: true } | { success: false; error: string } {
  if (!settingsInput || typeof settingsInput !== 'object') {
    clearGuessingChallengeRoomMode(roomId);
    return { success: true };
  }

  const mode = (settingsInput as { mode?: unknown }).mode;
  if (mode === undefined) {
    clearGuessingChallengeRoomMode(roomId);
    return { success: true };
  }

  if (mode !== '1v1' && mode !== '2v2') {
    return { success: false, error: 'وضع اللعب غير صالح.' };
  }

  setGuessingChallengeRoomMode(roomId, mode as GuessingChallengeMode);
  return { success: true };
}

export function registerGuessingChallengeSocketHandlers(io: Server, socket: Socket): void {
  socket.on(GUESSING_CHALLENGE_SYNC_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    if (rejectIfGameSyncRateLimited(socket, callback)) {
      return;
    }

    const { roomId, playerId } = socket.data;
    const shell = getGameShellByRoomId(roomId!);

    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.phase === 'PLAYING') {
      ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    GUESSING_CHALLENGE_END_QUESTION_EVENT,
    (payload: GuessingChallengeTurnActionPayload, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const match = getGuessingChallengeState(roomId!);
    if (!match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (
      !isActiveMatchParticipant(shell, playerId!) ||
      !isEligibleGuessingChallengeActor(match, playerId!)
    ) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    const result = endQuestionTurn(
      match,
      playerId!,
      payload?.roundId ?? '',
      payload?.turnId ?? '',
    );
    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    setGuessingChallengeState(roomId!, result.match);
    restartGuessingChallengePhaseTimer(io, roomId!);
    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on(
    GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
    async (payload: GuessingChallengeSubmitFinalGuessPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { roomId, playerId } = socket.data;

      const shell = getGameShellByRoomId(roomId!);
      if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
      const current = getGuessingChallengeState(roomId!);
      const rawGuess = typeof payload?.guess === 'string' ? payload.guess : '';
      if (
        !current ||
        !isActiveMatchParticipant(shell, playerId!) ||
        !isEligibleGuessingChallengeActor(current, playerId!)
      ) {
        if (current) {
          await logGuessingChallengeAttempt(roomId!, playerId!, current, rawGuess, {
            status: AnswerAttemptStatus.REJECTED,
            rejectReason: AnswerRejectReason.NOT_PARTICIPANT,
            wasCorrect: null,
            wasCounted: false,
          });
        }
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const result = applyFinalGuess(
        () => getGuessingChallengeState(roomId!),
        (next) => setGuessingChallengeState(roomId!, next),
        playerId!,
        rawGuess,
        payload?.roundId ?? '',
        payload?.turnId ?? '',
      );

      if (!result.accepted) {
        const classified = classifyGuessingChallengeReject(result.message);
        const teamId = current.teamByPlayerId[playerId!];
        const identity = teamId ? current.round.identitiesByTeamId[teamId] : null;
        const isCorrect =
          Boolean(identity && rawGuess.trim()) && identityMatchesGuess(identity!, rawGuess);
        const status =
          isCorrect && classified.status === AnswerAttemptStatus.LATE
            ? current.round.winningTeamId
              ? AnswerAttemptStatus.DUPLICATE
              : AnswerAttemptStatus.CORRECT_NOT_COUNTED
            : classified.status;
        await logGuessingChallengeAttempt(roomId!, playerId!, current, rawGuess, {
          status,
          rejectReason: classified.rejectReason,
          wasCorrect: isCorrect ? true : rawGuess.trim() ? false : null,
          wasCounted: false,
        });
        sendGameResponse(callback, invalidActionError(result.message));
        return;
      }

      if (result.correct) {
        await logGuessingChallengeAttempt(roomId!, playerId!, result.match, rawGuess, {
          status: AnswerAttemptStatus.CORRECT_COUNTED,
          wasCorrect: true,
          wasCounted: true,
          pointsAwarded: GUESSING_CHALLENGE_WINNER_POINTS,
        });
        startRoundResults(io, roomId!, result.match);
        respondWithView(callback, roomId!, playerId!, { guessCorrect: true });
        return;
      }

      await logGuessingChallengeAttempt(roomId!, playerId!, result.match, rawGuess, {
        status: AnswerAttemptStatus.WRONG_COUNTED,
        wasCorrect: false,
        wasCounted: true,
        pointsAwarded: 0,
      });
      restartGuessingChallengePhaseTimer(io, roomId!);
      broadcastPhaseChanged(io, roomId!);
      respondWithView(callback, roomId!, playerId!, {
        guessCorrect: false,
        guessFeedback: 'إجابة غير صحيحة',
      });
    },
  );

  // USE_YELLOW means "confirm yellow-card use" (team confirmation in 2v2).
  socket.on(
    GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
    (payload: GuessingChallengeCardActionPayload, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const current = getGuessingChallengeState(roomId!);
    if (
      !current ||
      !isActiveMatchParticipant(shell, playerId!) ||
      !isEligibleGuessingChallengeActor(current, playerId!)
    ) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    const result = confirmSpecialCard(
      () => getGuessingChallengeState(roomId!),
      (next) => setGuessingChallengeState(roomId!, next),
      shell,
      playerId!,
      'yellow',
      payload?.roundId ?? '',
      payload?.turnId ?? '',
      payload?.requestId,
    );

    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    restartGuessingChallengePhaseTimer(io, roomId!);
    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
    },
  );

  // USE_RED means "confirm red-card use" (team confirmation in 2v2).
  socket.on(
    GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
    (payload: GuessingChallengeCardActionPayload, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const current = getGuessingChallengeState(roomId!);
    if (
      !current ||
      !isActiveMatchParticipant(shell, playerId!) ||
      !isEligibleGuessingChallengeActor(current, playerId!)
    ) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    const result = confirmSpecialCard(
      () => getGuessingChallengeState(roomId!),
      (next) => setGuessingChallengeState(roomId!, next),
      shell,
      playerId!,
      'red',
      payload?.roundId ?? '',
      payload?.turnId ?? '',
      payload?.requestId,
    );

    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    restartGuessingChallengePhaseTimer(io, roomId!);
    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on(
    GUESSING_CHALLENGE_REJECT_CARD_EVENT,
    (payload: GuessingChallengeCardActionPayload, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const current = getGuessingChallengeState(roomId!);
    if (
      !current ||
      !isActiveMatchParticipant(shell, playerId!) ||
      !isEligibleGuessingChallengeActor(current, playerId!)
    ) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    const result = rejectSpecialCard(
      () => getGuessingChallengeState(roomId!),
      (next) => setGuessingChallengeState(roomId!, next),
      shell,
      playerId!,
      payload?.roundId ?? '',
      payload?.turnId ?? '',
      payload?.requestId,
    );

    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on(
    GUESSING_CHALLENGE_LOOK_EVENT,
    (payload: GuessingChallengeLookPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      if (!consumeLookLimit(socket)) {
        return;
      }

      const { roomId, playerId } = socket.data;
      const shell = getGameShellByRoomId(roomId!);
      if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
      const match = getGuessingChallengeState(roomId!);
      if (!match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (
        !isActiveMatchParticipant(shell, playerId!) ||
        !isEligibleGuessingChallengeActor(match, playerId!)
      ) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const applied = applyLookDirection(
        match,
        roomId!,
        playerId!,
        typeof payload?.yaw === 'number' ? payload.yaw : 0,
        typeof payload?.pitch === 'number' ? payload.pitch : 0,
      );

      if (!applied) {
        sendGameResponse(callback, { success: true, data: { throttled: true } });
        return;
      }

      setGuessingChallengeState(roomId!, applied.match);
      io.to(getRoomChannel(roomId!)).emit(GUESSING_CHALLENGE_LOOK_UPDATE_EVENT, {
        playerId: playerId!,
        yaw: applied.yaw,
        pitch: applied.pitch,
      });
      sendGameResponse(callback, {
        success: true,
        data: { yaw: applied.yaw, pitch: applied.pitch },
      });
    },
  );

  socket.on(
    GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
    (payload: GuessingChallengeContinuePayload, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    const match = getGuessingChallengeState(roomId!);
    if (!match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (payload?.roundId !== match.round.roundId) {
      sendGameResponse(callback, invalidActionError('انتهت هذه الجولة.'));
      return;
    }

    continueFromRoundResults(io, roomId!, match, shell, playerId!);
    if (getGuessingChallengeState(roomId!)) {
      respondWithView(callback, roomId!, playerId!);
      return;
    }

    sendGameResponse(callback, { success: true, data: {} });
    },
  );

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId) {
      return;
    }

    const shell = getGameShellByRoomId(roomId);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
      return;
    }

    if (playerId) {
      const match = getGuessingChallengeState(roomId);
      if (match) {
        setGuessingChallengeState(roomId, resetPlayerLook(match, playerId));
        io.to(getRoomChannel(roomId)).emit(GUESSING_CHALLENGE_LOOK_UPDATE_EVENT, {
          playerId,
          yaw: 0,
          pitch: 0,
        });
      }
    }

    // Runtime cleanup is owned by shared shell/end-game paths.
    void clearGuessingChallengeRuntime;
  });
}

export { clearGuessingChallengeRuntime };
