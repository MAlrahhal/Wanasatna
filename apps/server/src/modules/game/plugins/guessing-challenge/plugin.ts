import type {
  GamePluginDefinition,
  GamePluginSettings,
  GuessingChallengeMatchState,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
  GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
  GUESSING_CHALLENGE_STATE_EVENT,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState } from './state.js';

const metadata = {
  id: GUESSING_CHALLENGE_GAME_ID,
  title: 'تحدي التخمين',
  description: 'اعرف هويتك قبل خصمك',
  iconLabel: 'ت',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildGuessingChallengePluginDefinition(
  content: LoadedGameContent,
): GamePluginDefinition {
  const { bundle, settings } = content;

  return {
    ...metadata,
    minPlayers: settings.minPlayers,
    maxPlayers: settings.maxPlayers,
    defaultSettings: settings as GamePluginSettings,
    settingsSchema: [],
    validateStart: (_context, _pluginSettings) => {
      const connectedCount = _context.players.filter((player) => player.isConnected).length;

      if (connectedCount !== 2) {
        return {
          success: false,
          error: 'تحدي التخمين للعبتين فقط — يلزم لاعبان متصلان.',
        };
      }

      const validation = validateGameStartContent(bundle, settings, connectedCount);
      const error = contentValidationToPluginError(validation);

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    },
    createInitialState: (context, _pluginSettings) =>
      createMatchState(context.roomId, context.players, settings),
    serializeState: (state) => state,
    deserializeState: (payload) => payload as GuessingChallengeMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: GUESSING_CHALLENGE_SYNC_EVENT,
        phaseChanged: GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
        endQuestion: GUESSING_CHALLENGE_END_QUESTION_EVENT,
        submitFinalGuess: GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
        useYellowCard: GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
        useRedCard: GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
        continueRoundResults: GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
        setCategory: GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
        state: GUESSING_CHALLENGE_STATE_EVENT,
      },
    },
  };
}
