import type {
  BaraAlSalafaMatchState,
  GamePluginDefinition,
  GamePluginSettings,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_GAME_ID,
  contentValidationToPluginError,
  pluginActionEvent,
  pluginStateEvent,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState } from './state.js';

const metadata = {
  id: BARA_AL_SALAFA_GAME_ID,
  title: 'برا السالفة',
  description: 'اكتشف من برا السالفة قبل ما ينكشف!',
  iconLabel: 'ب',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildBaraAlSalafaPluginDefinition(
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
      const connectedCount = _context.players.filter((player) => player.isConnected && !player.isSpectator).length;

      if (connectedCount < settings.minPlayers) {
        return {
          success: false,
          error: 'تحتاج لعبة برا السالفة إلى 3 لاعبين على الأقل.',
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
      createMatchState(context.players, bundle, settings),
    serializeState: (state) => state,
    deserializeState: (payload) => payload as BaraAlSalafaMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: pluginActionEvent(BARA_AL_SALAFA_GAME_ID, 'sync'),
        phaseChanged: pluginActionEvent(BARA_AL_SALAFA_GAME_ID, 'phase-changed'),
        chooseFreeQuestionPlayer: pluginActionEvent(
          BARA_AL_SALAFA_GAME_ID,
          'choose-free-question-player',
        ),
        skipFreeQuestionTurn: pluginActionEvent(
          BARA_AL_SALAFA_GAME_ID,
          'skip-free-question-turn',
        ),
        submitVote: pluginActionEvent(BARA_AL_SALAFA_GAME_ID, 'submit-vote'),
        state: pluginStateEvent(BARA_AL_SALAFA_GAME_ID),
      },
    },
  };
}
