import type {
  GamePluginDefinition,
  GamePluginSettings,
  LoadedGameContent,
  WhoWroteItMatchState,
} from '@wanasatna/shared';
import {
  WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_PHASE_CHANGED_EVENT,
  WHO_WROTE_IT_SET_CATEGORY_EVENT,
  WHO_WROTE_IT_STATE_EVENT,
  WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
  WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
  WHO_WROTE_IT_SYNC_EVENT,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState } from './state.js';

const metadata = {
  id: WHO_WROTE_IT_GAME_ID,
  title: 'من كتبها؟',
  description: 'خمّن مين كتب الجملة بين إجابات اللاعبين.',
  iconLabel: 'م',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildWhoWroteItPluginDefinition(
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

      if (connectedCount < settings.minPlayers) {
        return {
          success: false,
          error: 'تحتاج لعبة من كتبها؟ إلى 3 لاعبين على الأقل.',
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
    deserializeState: (payload) => payload as WhoWroteItMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: WHO_WROTE_IT_SYNC_EVENT,
        phaseChanged: WHO_WROTE_IT_PHASE_CHANGED_EVENT,
        submitAnswer: WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
        submitOwnerGuess: WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
        continueRoundResults: WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
        setCategory: WHO_WROTE_IT_SET_CATEGORY_EVENT,
        state: WHO_WROTE_IT_STATE_EVENT,
      },
    },
  };
}
