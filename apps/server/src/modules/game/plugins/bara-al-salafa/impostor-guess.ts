import type { BaraAlSalafaMatchState, GameContentBundle } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_IMPOSTOR_GUESS_OPTION_COUNT,
  buildImpostorGuessOptions,
} from '@wanasatna/shared';
import { withRound } from './round-state.js';

export function buildRoundImpostorGuessOptions(
  bundle: GameContentBundle,
  match: BaraAlSalafaMatchState,
): string[] {
  return buildImpostorGuessOptions(
    bundle,
    match.round.word,
    match.round.wordCategoryId,
    BARA_AL_SALAFA_IMPOSTOR_GUESS_OPTION_COUNT,
  );
}

export function applyImpostorGuessSubmission(
  match: BaraAlSalafaMatchState,
  playerId: string,
  selectedWord: string,
): BaraAlSalafaMatchState {
  if (playerId !== match.round.impostorPlayerId) {
    return match;
  }

  return withRound(match, {
    ...match.round,
    selectedWord,
    guessedCorrectly: selectedWord === match.round.word,
  });
}

export function finalizeImpostorGuessWithoutSubmission(
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  if (match.round.selectedWord !== null) {
    return match;
  }

  return withRound(match, {
    ...match.round,
    guessedCorrectly: false,
  });
}
