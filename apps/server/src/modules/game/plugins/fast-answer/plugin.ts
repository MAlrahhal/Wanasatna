import type {
  FastAnswerMatchState,
  GamePluginDefinition,
  GamePluginSettings,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_PHASE_CHANGED_EVENT,
  FAST_ANSWER_STATE_EVENT,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState } from './state.js';

const metadata = {
  id: FAST_ANSWER_GAME_ID,
  title: 'أسرع إجابة',
  description: 'أسئلة سريعة… أول واحد يجيب صح يكسب النقاط.',
  iconLabel: 'س',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildFastAnswerPluginDefinition(
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
          error: 'تحتاج لعبة أسرع إجابة إلى لاعبين على الأقل.',
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
    deserializeState: (payload) => payload as FastAnswerMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: FAST_ANSWER_SYNC_EVENT,
        phaseChanged: FAST_ANSWER_PHASE_CHANGED_EVENT,
        submitAnswer: FAST_ANSWER_SUBMIT_ANSWER_EVENT,
        continueRoundResults: FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
        state: FAST_ANSWER_STATE_EVENT,
      },
    },
  };
}
