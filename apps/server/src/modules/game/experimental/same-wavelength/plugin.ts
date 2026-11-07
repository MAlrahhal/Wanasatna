import type { GamePluginDefinition, GamePluginSettings } from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_ASSIGN_EVENT,
  SAME_WAVELENGTH_CONFIRM_EVENT,
  SAME_WAVELENGTH_DEFAULT_SETTINGS,
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_LOBBY_SYNC_EVENT,
  SAME_WAVELENGTH_MAX_PLAYERS,
  SAME_WAVELENGTH_MIN_PLAYERS,
  SAME_WAVELENGTH_NEXT_EVENT,
  SAME_WAVELENGTH_PHASE_CHANGED_EVENT,
  SAME_WAVELENGTH_PROPOSE_EVENT,
  SAME_WAVELENGTH_STATE_EVENT,
  SAME_WAVELENGTH_SUBMIT_CLUE_EVENT,
  SAME_WAVELENGTH_SYNC_EVENT,
  SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { createSameWavelengthMatch, type SameWavelengthMatchState } from './state.js';

export const sameWavelengthPluginDefinition: GamePluginDefinition = {
  id: SAME_WAVELENGTH_GAME_ID,
  title: 'على نفس الموجة',
  description: 'اقتربوا من النقطة السرية بين مفهومين متعاكسين',
  iconLabel: '〰️',
  minPlayers: SAME_WAVELENGTH_MIN_PLAYERS,
  maxPlayers: SAME_WAVELENGTH_MAX_PLAYERS,
  defaultSettings: {} satisfies GamePluginSettings,
  settingsSchema: [],
  createInitialState: (context) =>
    createSameWavelengthMatch({
      playerIds: context.players.map((player) => player.id),
      playerNames: Object.fromEntries(context.players.map((player) => [player.id, player.name])),
      settings: SAME_WAVELENGTH_DEFAULT_SETTINGS,
    }),
  serializeState: (state) => state,
  deserializeState: (payload) => payload as SameWavelengthMatchState,
  lifecycle: {},
  socket: {
    events: {
      lobbySync: SAME_WAVELENGTH_LOBBY_SYNC_EVENT,
      updateSettings: SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
      assign: SAME_WAVELENGTH_ASSIGN_EVENT,
      sync: SAME_WAVELENGTH_SYNC_EVENT,
      submitClue: SAME_WAVELENGTH_SUBMIT_CLUE_EVENT,
      propose: SAME_WAVELENGTH_PROPOSE_EVENT,
      confirm: SAME_WAVELENGTH_CONFIRM_EVENT,
      next: SAME_WAVELENGTH_NEXT_EVENT,
      phaseChanged: SAME_WAVELENGTH_PHASE_CHANGED_EVENT,
      state: SAME_WAVELENGTH_STATE_EVENT,
    },
  },
};
