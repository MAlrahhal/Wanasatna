import type { GamePluginDefinition, GamePluginSettings } from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_ADVANCE_EVENT,
  MOST_LIKELY_TO_GAME_ID,
  MOST_LIKELY_TO_MAX_PLAYERS,
  MOST_LIKELY_TO_MIN_PLAYERS,
  MOST_LIKELY_TO_PHASE_CHANGED_EVENT,
  MOST_LIKELY_TO_STATE_EVENT,
  MOST_LIKELY_TO_SYNC_EVENT,
  MOST_LIKELY_TO_VOTE_EVENT,
} from '@wanasatna/shared';
import { createMostLikelyToMatch, type MostLikelyToMatchState } from './state.js';

export const mostLikelyToPluginDefinition: GamePluginDefinition = {
  id: MOST_LIKELY_TO_GAME_ID,
  title: 'مين أكثر واحد؟',
  description: 'صوّتوا سرًا، ثم اكشفوا اختيارات المجموعة في عشر مواقف مرحة',
  iconLabel: '؟',
  minPlayers: MOST_LIKELY_TO_MIN_PLAYERS,
  maxPlayers: MOST_LIKELY_TO_MAX_PLAYERS,
  defaultSettings: {} satisfies GamePluginSettings,
  settingsSchema: [],
  validateStart: (context) => {
    const count = context.players.filter(
      (player) => player.isConnected && !player.isSpectator,
    ).length;
    if (count < MOST_LIKELY_TO_MIN_PLAYERS || count > MOST_LIKELY_TO_MAX_PLAYERS) {
      return { success: false, error: 'تحتاج اللعبة من 3 إلى 15 لاعبًا متصلًا.' };
    }
    return { success: true };
  },
  createInitialState: (context) =>
    createMostLikelyToMatch({
      participants: context.players
        .filter((player) => player.isConnected && !player.isSpectator)
        .map((player) => ({ playerId: player.id, name: player.name })),
    }),
  serializeState: (state) => state,
  deserializeState: (payload) => payload as MostLikelyToMatchState,
  lifecycle: {},
  socket: {
    events: {
      sync: MOST_LIKELY_TO_SYNC_EVENT,
      vote: MOST_LIKELY_TO_VOTE_EVENT,
      advance: MOST_LIKELY_TO_ADVANCE_EVENT,
      phaseChanged: MOST_LIKELY_TO_PHASE_CHANGED_EVENT,
      state: MOST_LIKELY_TO_STATE_EVENT,
    },
  },
};
