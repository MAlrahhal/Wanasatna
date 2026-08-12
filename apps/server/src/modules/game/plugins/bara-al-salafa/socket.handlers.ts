import type { Server, Socket } from 'socket.io';
import type {
  BaraAlSalafaChooseFreeQuestionPlayerPayload,
  BaraAlSalafaSubmitImpostorGuessPayload,
  BaraAlSalafaSubmitVotePayload,
  GameActionResponse,
} from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
  BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT,
  BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
  BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
  BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
  BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
  BARA_AL_SALAFA_SYNC_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { getGameSocketContext, sendGameResponse } from '../../game.socket.utils.js';
import {
  isPlayerRecoveryActive,
  playerRecoveryBlockedError,
} from '../../runtime/player-recovery.js';
import { getConnectedParticipantIds } from './free-questions.js';
import { ensureBaraAlSalafaMatchStateWithTimer } from './init-match.js';
import {
  applyDirectedQuestionAdvance,
  applyFreeQuestionAdvance,
  applyFreeQuestionPlayerChoice,
  applyFreeQuestionSkipTurn,
  applyHostContinueRoundResults,
  applyImpostorGuessSubmissionAction,
  applyRoleUnderstoodSubmission,
  applyVoteSubmission,
} from './phase-flow.js';
import { clearPhaseTimerRuntime } from './phase-timer.js';
import {
  buildBaraAlSalafaPlayerView,
  buildBaraAlSalafaSpectatorView,
} from './state.js';
import {
  deleteBaraAlSalafaState,
  getBaraAlSalafaState,
} from './store.js';

function gameNotReadyError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'INVALID_PHASE',
      message: 'Game is not ready yet.',
    },
  };
}

function notParticipantError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'NOT_PARTICIPANT',
      message: 'أنت لست مشاركاً في هذه الجولة.',
    },
  };
}

function rejectNonParticipant(
  roomId: string,
  playerId: string,
  callback: ((response: GameActionResponse<unknown>) => void) | undefined,
): boolean {
  const shell = getGameShellByRoomId(roomId);

  if (shell && !isActiveMatchParticipant(shell, playerId)) {
    sendGameResponse(callback, notParticipantError());
    return true;
  }

  return false;
}

function recoveryBlockedResponse(
  roomId: string,
  callback: ((response: GameActionResponse<unknown>) => void) | undefined,
): boolean {
  if (!isPlayerRecoveryActive(roomId)) {
    return false;
  }

  sendGameResponse(callback, playerRecoveryBlockedError());
  return true;
}

function clearBaraAlSalafaRuntime(roomId: string): void {
  clearPhaseTimerRuntime(roomId);
  deleteBaraAlSalafaState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getBaraAlSalafaState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  const view = buildBaraAlSalafaPlayerView(match, playerId, shell);

  sendGameResponse(callback, {
    success: true,
    data: { view },
  });
}

export function registerBaraAlSalafaSocketHandlers(io: Server, socket: Socket): void {
  socket.on(BARA_AL_SALAFA_SYNC_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.phase === 'FINISHED') {
        clearBaraAlSalafaRuntime(roomId!);
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = ensureBaraAlSalafaMatchStateWithTimer(io, roomId!);

      if (!match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!)) {
        sendGameResponse(callback, {
          success: true,
          data: { view: buildBaraAlSalafaSpectatorView(match) },
        });
        return;
      }

      const view = buildBaraAlSalafaPlayerView(match, playerId!, shell);

      sendGameResponse(callback, {
        success: true,
        data: { view },
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (rejectNonParticipant(roomId!, playerId!, callback)) {
      return;
    }

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = getBaraAlSalafaState(roomId!);

      if (!match || match.round.gamePhase !== 'description') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.roleUnderstoodPlayerIds.includes(playerId!)) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'ALREADY_SUBMITTED',
            message: 'لقد أكّدت فهمك بالفعل.',
          },
        });
        return;
      }

      const connectedPlayer = shell.players.find(
        (player) => player.id === playerId && player.isConnected,
      );

      if (!connectedPlayer || !match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_PARTICIPANT',
            message: 'أنت لست مشاركاً في هذه الجولة.',
          },
        });
        return;
      }

      applyRoleUnderstoodSubmission(io, roomId!, match, shell, playerId!);
      respondWithView(callback, roomId!, playerId!);
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = getBaraAlSalafaState(roomId!);

      if (!match || match.round.gamePhase !== 'directed-questions') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const currentPair = match.round.directedQuestionPairs[match.round.currentSpeakerIndex];

      if (!currentPair || currentPair.askerPlayerId !== playerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_ACTIVE_ASKER',
            message: 'ليس دورك كسائل حالياً.',
          },
        });
        return;
      }

      applyDirectedQuestionAdvance(io, roomId!, match, playerId!);
      respondWithView(callback, roomId!, playerId!);
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.hostPlayerId !== playerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_HOST',
            message: 'فقط المضيف يمكنه المتابعة.',
          },
        });
        return;
      }

      const match = getBaraAlSalafaState(roomId!);

      if (
        !match ||
        (match.round.gamePhase !== 'round-results' &&
          match.round.gamePhase !== 'match-completed')
      ) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      applyHostContinueRoundResults(io, roomId!, match, shell, playerId!);

      if (getBaraAlSalafaState(roomId!)) {
        respondWithView(callback, roomId!, playerId!);
        return;
      }

      sendGameResponse(callback, {
        success: true,
        data: {},
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(
    BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
    async (payload: BaraAlSalafaChooseFreeQuestionPlayerPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const shell = getGameShellByRoomId(roomId!);

        if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
          sendGameResponse(callback, gameNotReadyError());
          return;
        }

        const match = getBaraAlSalafaState(roomId!);

        if (!match || match.round.gamePhase !== 'free-questions') {
          sendGameResponse(callback, gameNotReadyError());
          return;
        }

        if (match.round.activeFreeQuestionPlayerId !== playerId) {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'NOT_ACTIVE_PLAYER',
              message: 'ليس دورك حالياً.',
            },
          });
          return;
        }

        if (match.round.pendingFreeQuestionTargetPlayerId) {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'INVALID_TARGET',
              message: 'تم اختيار اللاعب بالفعل. اضغط التالي للمتابعة.',
            },
          });
          return;
        }

        const targetPlayerId = payload?.targetPlayerId;

        if (typeof targetPlayerId !== 'string') {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'INVALID_TARGET',
              message: 'اللاعب المختار غير صالح.',
            },
          });
          return;
        }

        const connectedParticipantIds = new Set(getConnectedParticipantIds(shell, match));

        if (targetPlayerId === playerId || !connectedParticipantIds.has(targetPlayerId)) {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'INVALID_TARGET',
              message: 'اللاعب المختار غير صالح.',
            },
          });
          return;
        }

        applyFreeQuestionPlayerChoice(io, roomId!, match, shell, playerId!, targetPlayerId);
        respondWithView(callback, roomId!, playerId!);
      } catch {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong. Please try again.',
          },
        });
      }
    },
  );

  socket.on(BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = getBaraAlSalafaState(roomId!);

      if (!match || match.round.gamePhase !== 'free-questions') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.activeFreeQuestionPlayerId !== playerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_ACTIVE_PLAYER',
            message: 'ليس دورك حالياً.',
          },
        });
        return;
      }

      if (match.round.pendingFreeQuestionTargetPlayerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'INVALID_PHASE',
            message: 'أكمل المحادثة الحالية بالضغط على التالي.',
          },
        });
        return;
      }

      applyFreeQuestionSkipTurn(io, roomId!, match, shell, playerId!);
      respondWithView(callback, roomId!, playerId!);
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = getBaraAlSalafaState(roomId!);

      if (!match || match.round.gamePhase !== 'free-questions') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.activeFreeQuestionPlayerId !== playerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_ACTIVE_PLAYER',
            message: 'ليس دورك حالياً.',
          },
        });
        return;
      }

      if (!match.round.pendingFreeQuestionTargetPlayerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'INVALID_TARGET',
            message: 'اختر لاعباً أولاً.',
          },
        });
        return;
      }

      applyFreeQuestionAdvance(io, roomId!, match, shell, playerId!);
      respondWithView(callback, roomId!, playerId!);
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, async (payload: BaraAlSalafaSubmitVotePayload, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = getBaraAlSalafaState(roomId!);

      if (!match || match.round.gamePhase !== 'voting') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.submittedVoterIds.includes(playerId!)) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'ALREADY_SUBMITTED',
            message: 'لقد صوّتت بالفعل.',
          },
        });
        return;
      }

      const connectedPlayer = shell.players.find(
        (player) => player.id === playerId && player.isConnected,
      );

      if (!connectedPlayer || !match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_PARTICIPANT',
            message: 'أنت لست مشاركاً في هذه الجولة.',
          },
        });
        return;
      }

      const targetPlayerId = payload?.targetPlayerId;

      if (typeof targetPlayerId !== 'string') {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'INVALID_TARGET',
            message: 'اللاعب المختار غير صالح.',
          },
        });
        return;
      }

      const connectedParticipantIds = new Set(getConnectedParticipantIds(shell, match));

      if (targetPlayerId === playerId || !connectedParticipantIds.has(targetPlayerId)) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'INVALID_TARGET',
            message: 'اللاعب المختار غير صالح.',
          },
        });
        return;
      }

      applyVoteSubmission(io, roomId!, match, shell, playerId!, targetPlayerId);
      respondWithView(callback, roomId!, playerId!);
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(
    BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
    async (payload: BaraAlSalafaSubmitImpostorGuessPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const shell = getGameShellByRoomId(roomId!);

        if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
          sendGameResponse(callback, gameNotReadyError());
          return;
        }

        const match = getBaraAlSalafaState(roomId!);

        if (!match || match.round.gamePhase !== 'impostor-guess') {
          sendGameResponse(callback, gameNotReadyError());
          return;
        }

        if (match.round.impostorPlayerId !== playerId) {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'NOT_IMPOSTOR',
              message: 'فقط برا السالفة يمكنه التخمين.',
            },
          });
          return;
        }

        if (match.round.selectedWord !== null) {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'ALREADY_SUBMITTED',
              message: 'لقد قمت بالتخمين بالفعل.',
            },
          });
          return;
        }

        const selectedWord = payload?.selectedWord;

        if (typeof selectedWord !== 'string' || !match.round.impostorGuessOptions.includes(selectedWord)) {
          sendGameResponse(callback, {
            success: false,
            error: {
              code: 'INVALID_OPTION',
              message: 'الخيار المختار غير صالح.',
            },
          });
          return;
        }

        applyImpostorGuessSubmissionAction(io, roomId!, match, shell, playerId!, selectedWord);
        respondWithView(callback, roomId!, playerId!);
      } catch {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong. Please try again.',
          },
        });
      }
    },
  );
}
