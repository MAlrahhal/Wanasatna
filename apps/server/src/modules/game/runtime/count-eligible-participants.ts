import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  GUESSING_CHALLENGE_GAME_ID,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_GAME_ID,
} from '@wanasatna/shared';
import type { GameShellRecord } from '../game.service.js';
import { getConnectedParticipantIds as getBaraConnectedParticipantIds } from '../plugins/bara-al-salafa/free-questions.js';
import { getBaraAlSalafaState } from '../plugins/bara-al-salafa/store.js';
import { getConnectedParticipantIds as getDrawGuessConnectedParticipantIds } from '../plugins/draw-guess/state.js';
import { getDrawGuessState } from '../plugins/draw-guess/store.js';
import { getConnectedParticipantIds as getFastAnswerConnectedParticipantIds } from '../plugins/fast-answer/state.js';
import { getFastAnswerState } from '../plugins/fast-answer/store.js';
import { getConnectedParticipantIds as getGuessingChallengeConnectedParticipantIds } from '../plugins/guessing-challenge/state.js';
import { getGuessingChallengeState } from '../plugins/guessing-challenge/store.js';
import { getConnectedParticipantIds as getImposterDrawConnectedParticipantIds } from '../plugins/imposter-draw/state.js';
import { getImposterDrawState } from '../plugins/imposter-draw/store.js';
import { getConnectedParticipantIds as getJudgeConnectedParticipantIds } from '../plugins/judge/state.js';
import { getJudgeState } from '../plugins/judge/store.js';
import { getConnectedParticipantIds as getTimingChallengeConnectedParticipantIds } from '../plugins/timing-challenge/state.js';
import { getTimingChallengeState } from '../plugins/timing-challenge/store.js';
import { getConnectedParticipantIds as getWhoWroteItConnectedParticipantIds } from '../plugins/who-wrote-it/state.js';
import { getWhoWroteItState } from '../plugins/who-wrote-it/store.js';
import { getGamePluginDefinition } from './plugin-registry.js';

function countLockedShellParticipants(shell: GameShellRecord): number {
  if (!shell.matchParticipantIds) {
    return shell.players.filter((player) => player.isConnected && !player.isSpectator).length;
  }

  const lockedIds = new Set(shell.matchParticipantIds);

  return shell.players.filter((player) => player.isConnected && lockedIds.has(player.id)).length;
}

export function getGameMinPlayers(gameId: string | null): number | undefined {
  if (!gameId) {
    return undefined;
  }

  return getGamePluginDefinition(gameId)?.minPlayers;
}

export function countConnectedEligibleParticipants(shell: GameShellRecord): number {
  if (shell.gameId === BARA_AL_SALAFA_GAME_ID) {
    const match = getBaraAlSalafaState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getBaraConnectedParticipantIds(shell, match).length;
  }

  if (shell.gameId === DRAW_GUESS_GAME_ID) {
    const match = getDrawGuessState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getDrawGuessConnectedParticipantIds(shell, match).length;
  }

  if (shell.gameId === IMPOSTER_DRAW_GAME_ID) {
    const match = getImposterDrawState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getImposterDrawConnectedParticipantIds(shell, match).length;
  }

  if (shell.gameId === TIMING_CHALLENGE_GAME_ID) {
    const match = getTimingChallengeState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getTimingChallengeConnectedParticipantIds(match, shell).length;
  }

  if (shell.gameId === FAST_ANSWER_GAME_ID) {
    const match = getFastAnswerState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getFastAnswerConnectedParticipantIds(match, shell).length;
  }

  if (shell.gameId === WHO_WROTE_IT_GAME_ID) {
    const match = getWhoWroteItState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getWhoWroteItConnectedParticipantIds(match, shell).length;
  }

  if (shell.gameId === JUDGE_GAME_ID) {
    const match = getJudgeState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getJudgeConnectedParticipantIds(match, shell).length;
  }

  if (shell.gameId === GUESSING_CHALLENGE_GAME_ID) {
    const match = getGuessingChallengeState(shell.roomId);

    if (!match) {
      return countLockedShellParticipants(shell);
    }

    return getGuessingChallengeConnectedParticipantIds(match, shell).length;
  }

  return shell.players.filter((player) => player.isConnected && !player.isSpectator).length;
}
