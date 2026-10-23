import type { GamePluginDefinition, GamePluginSettings } from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_DEFAULT_SETTINGS,
  EMOJI_LANGUAGE_GAME_ID,
  EMOJI_LANGUAGE_LOBBY_SYNC_EVENT,
  EMOJI_LANGUAGE_MAX_PLAYERS,
  EMOJI_LANGUAGE_MIN_PLAYERS,
  EMOJI_LANGUAGE_PHASE_CHANGED_EVENT,
  EMOJI_LANGUAGE_STATE_EVENT,
  EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
  EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT,
  EMOJI_LANGUAGE_SYNC_EVENT,
  EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { createEmojiLanguageMatch, type EmojiLanguageMatchState } from './state.js';

export const emojiLanguagePluginDefinition: GamePluginDefinition = {
  id: EMOJI_LANGUAGE_GAME_ID,
  title: 'لغة الإيموجي',
  description: 'حوّل المعنى إلى رموز وافهم تلميحات الآخرين',
  iconLabel: '😀',
  minPlayers: EMOJI_LANGUAGE_MIN_PLAYERS,
  maxPlayers: EMOJI_LANGUAGE_MAX_PLAYERS,
  defaultSettings: {} satisfies GamePluginSettings,
  settingsSchema: [],
  createInitialState: (context) =>
    createEmojiLanguageMatch({
      playerIds: context.players.map((player) => player.id),
      playerNames: Object.fromEntries(context.players.map((player) => [player.id, player.name])),
      settings: EMOJI_LANGUAGE_DEFAULT_SETTINGS,
    }),
  serializeState: (state) => state,
  deserializeState: (payload) => payload as EmojiLanguageMatchState,
  lifecycle: {},
  socket: {
    events: {
      lobbySync: EMOJI_LANGUAGE_LOBBY_SYNC_EVENT,
      updateSettings: EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
      sync: EMOJI_LANGUAGE_SYNC_EVENT,
      submitClue: EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
      submitGuess: EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT,
      phaseChanged: EMOJI_LANGUAGE_PHASE_CHANGED_EVENT,
      state: EMOJI_LANGUAGE_STATE_EVENT,
    },
  },
};
