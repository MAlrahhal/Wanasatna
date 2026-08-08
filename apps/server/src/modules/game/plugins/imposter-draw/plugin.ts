import type {
  GamePluginDefinition,
  GamePluginSettings,
  ImposterDrawMatchState,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_CLEAR_CANVAS_EVENT,
  IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
  IMPOSTER_DRAW_STATE_EVENT,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_STROKE_POINTS_EVENT,
  IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
  IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState } from './state.js';

const metadata = {
  id: IMPOSTER_DRAW_GAME_ID,
  title: 'الإمبوستر بالرسم',
  description: 'امبوستر يحاول يتموّه… والباقي يحاولون يكشفونه.',
  iconLabel: 'إ',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildImposterDrawPluginDefinition(
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
          error: 'تحتاج لعبة الإمبوستر بالرسم إلى ٣ لاعبين على الأقل.',
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
    deserializeState: (payload) => payload as ImposterDrawMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: IMPOSTER_DRAW_SYNC_EVENT,
        phaseChanged: IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
        stroke: IMPOSTER_DRAW_STROKE_EVENT,
        strokePoints: IMPOSTER_DRAW_STROKE_POINTS_EVENT,
        clearCanvas: IMPOSTER_DRAW_CLEAR_CANVAS_EVENT,
        submitVote: IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
        submitImageGuess: IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
        continueRoundResults: IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
        state: IMPOSTER_DRAW_STATE_EVENT,
      },
    },
  };
}
