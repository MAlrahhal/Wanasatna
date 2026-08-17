import type {
  GamePluginDefinition,
  GamePluginSettings,
  JudgeMatchState,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
  JUDGE_GAME_ID,
  JUDGE_PHASE_CHANGED_EVENT,
  JUDGE_SELECT_WINNER_EVENT,
  JUDGE_STATE_EVENT,
  JUDGE_SUBMIT_ANSWER_EVENT,
  JUDGE_SYNC_EVENT,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { createMatchState } from './state.js';

const metadata = {
  id: JUDGE_GAME_ID,
  title: 'القاضي',
  description: 'القاضي يحكم… والباقي يحاولون يقنعونه.',
  iconLabel: 'ق',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildJudgePluginDefinition(content: LoadedGameContent): GamePluginDefinition {
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
          error: 'تحتاج لعبة القاضي إلى 3 لاعبين على الأقل.',
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
    deserializeState: (payload) => payload as JudgeMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: JUDGE_SYNC_EVENT,
        phaseChanged: JUDGE_PHASE_CHANGED_EVENT,
        submitAnswer: JUDGE_SUBMIT_ANSWER_EVENT,
        selectWinner: JUDGE_SELECT_WINNER_EVENT,
        continueRoundResults: JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
        state: JUDGE_STATE_EVENT,
      },
    },
  };
}
