import type {
  DrawGuessMatchState,
  GamePluginDefinition,
  GamePluginSettings,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_CLEAR_CANVAS_EVENT,
  DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_PHASE_CHANGED_EVENT,
  DRAW_GUESS_STATE_EVENT,
  DRAW_GUESS_STROKE_EVENT,
  DRAW_GUESS_STROKE_POINTS_EVENT,
  DRAW_GUESS_SUBMIT_GUESS_EVENT,
  DRAW_GUESS_SYNC_EVENT,
  DRAW_GUESS_UNDO_EVENT,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState, serializeDrawGuessState } from './state.js';

const metadata = {
  id: DRAW_GUESS_GAME_ID,
  title: 'ارسم وخمن',
  description: 'ارسم الكلمة وخمّن رسم باقي اللاعبين.',
  iconLabel: 'ر',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildDrawGuessPluginDefinition(
  content: LoadedGameContent,
): GamePluginDefinition {
  const { bundle, settings } = content;

  return {
    ...metadata,
    minPlayers: settings.minPlayers,
    maxPlayers: settings.maxPlayers,
    defaultSettings: settings as GamePluginSettings,
    settingsSchema: [
      {
        id: 'drawerMode',
        label: 'اختيار الرسام',
        type: 'select',
        defaultValue: 'random',
        options: [
          { value: 'random', label: 'عشوائي' },
          { value: 'fixed', label: 'لاعب محدد' },
        ],
      },
    ],
    validateStart: (_context, _pluginSettings) => {
      const connectedCount = _context.players.filter((player) => player.isConnected).length;

      if (connectedCount < settings.minPlayers) {
        return {
          success: false,
          error: 'تحتاج لعبة ارسم وخمن إلى لاعبين على الأقل.',
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
    serializeState: (state) => serializeDrawGuessState(state as DrawGuessMatchState),
    deserializeState: (payload) => payload as DrawGuessMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: DRAW_GUESS_SYNC_EVENT,
        phaseChanged: DRAW_GUESS_PHASE_CHANGED_EVENT,
        stroke: DRAW_GUESS_STROKE_EVENT,
        strokePoints: DRAW_GUESS_STROKE_POINTS_EVENT,
        clearCanvas: DRAW_GUESS_CLEAR_CANVAS_EVENT,
        undo: DRAW_GUESS_UNDO_EVENT,
        submitGuess: DRAW_GUESS_SUBMIT_GUESS_EVENT,
        continueRoundResults: DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
        state: DRAW_GUESS_STATE_EVENT,
      },
    },
  };
}
