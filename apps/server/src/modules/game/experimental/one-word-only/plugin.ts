import type { GamePluginDefinition, GamePluginSettings } from '@wanasatna/shared';
import {
  ONE_WORD_ONLY_ADVANCE_EVENT,
  ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
  ONE_WORD_ONLY_DEFAULT_SETTINGS,
  ONE_WORD_ONLY_GAME_ID,
  ONE_WORD_ONLY_LOBBY_SYNC_EVENT,
  ONE_WORD_ONLY_MAX_PLAYERS,
  ONE_WORD_ONLY_MIN_PLAYERS,
  ONE_WORD_ONLY_PHASE_CHANGED_EVENT,
  ONE_WORD_ONLY_STATE_EVENT,
  ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
  ONE_WORD_ONLY_SYNC_EVENT,
  ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { createOneWordOnlyMatch, type OneWordOnlyMatchState } from './state.js';

export const oneWordOnlyPluginDefinition: GamePluginDefinition = {
  id: ONE_WORD_ONLY_GAME_ID,
  title: 'كلمة وحدة بس',
  description: 'اكتب تلميحًا واحدًا وساعد المخمّن على اختيار الإجابة.',
  iconLabel: 'ك',
  minPlayers: ONE_WORD_ONLY_MIN_PLAYERS,
  maxPlayers: ONE_WORD_ONLY_MAX_PLAYERS,
  defaultSettings: {} satisfies GamePluginSettings,
  settingsSchema: [],
  createInitialState: (context) =>
    createOneWordOnlyMatch({
      playerIds: context.players.map((player) => player.id),
      playerNames: Object.fromEntries(context.players.map((player) => [player.id, player.name])),
      settings: ONE_WORD_ONLY_DEFAULT_SETTINGS,
    }),
  serializeState: (state) => state,
  deserializeState: (payload) => payload as OneWordOnlyMatchState,
  lifecycle: {},
  socket: {
    events: {
      lobbySync: ONE_WORD_ONLY_LOBBY_SYNC_EVENT,
      updateSettings: ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT,
      sync: ONE_WORD_ONLY_SYNC_EVENT,
      submitClue: ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
      confirmAnswer: ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
      advance: ONE_WORD_ONLY_ADVANCE_EVENT,
      phaseChanged: ONE_WORD_ONLY_PHASE_CHANGED_EVENT,
      state: ONE_WORD_ONLY_STATE_EVENT,
    },
  },
};
