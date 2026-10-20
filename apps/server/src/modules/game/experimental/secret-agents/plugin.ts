import type { GamePluginDefinition, GamePluginSettings } from '@wanasatna/shared';
import {
  SECRET_AGENTS_ASSIGN_EVENT,
  SECRET_AGENTS_CONFIRM_CARD_EVENT,
  SECRET_AGENTS_GAME_ID,
  SECRET_AGENTS_LOBBY_SYNC_EVENT,
  SECRET_AGENTS_MAX_PLAYERS,
  SECRET_AGENTS_MIN_PLAYERS,
  SECRET_AGENTS_PASS_EVENT,
  SECRET_AGENTS_PHASE_CHANGED_EVENT,
  SECRET_AGENTS_RANDOMIZE_EVENT,
  SECRET_AGENTS_STATE_EVENT,
  SECRET_AGENTS_SUBMIT_CLUE_EVENT,
  SECRET_AGENTS_SYNC_EVENT,
  SECRET_AGENTS_TOGGLE_NOMINATION_EVENT,
  SECRET_AGENTS_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { getSecretAgentsLobbyState, validateSecretAgentsRoster } from './lobby-state.js';
import { createSecretAgentsMatch, type SecretAgentsMatchState } from './state.js';

export const secretAgentsPluginDefinition: GamePluginDefinition = {
  id: SECRET_AGENTS_GAME_ID,
  title: 'العملاء السريون',
  description: 'اربط الكلمات بتلميح واحد واحذر القاتل',
  iconLabel: 'س',
  minPlayers: SECRET_AGENTS_MIN_PLAYERS,
  maxPlayers: SECRET_AGENTS_MAX_PLAYERS,
  defaultSettings: {} satisfies GamePluginSettings,
  settingsSchema: [],
  validateStart: (context) => {
    const lobby = getSecretAgentsLobbyState(context.roomId);
    const validation = validateSecretAgentsRoster({
      assignments: lobby.assignments,
      eligiblePlayerIds: context.players
        .filter((player) => player.isConnected)
        .map((player) => player.id),
    });
    return validation.success ? { success: true } : { success: false, error: validation.error };
  },
  createInitialState: (context) => {
    const lobby = getSecretAgentsLobbyState(context.roomId);
    return createSecretAgentsMatch({
      assignments: lobby.assignments,
      playerNames: Object.fromEntries(context.players.map((player) => [player.id, player.name])),
      settings: lobby.settings,
    });
  },
  serializeState: (state) => state,
  deserializeState: (payload) => payload as SecretAgentsMatchState,
  lifecycle: {},
  socket: {
    events: {
      lobbySync: SECRET_AGENTS_LOBBY_SYNC_EVENT,
      assign: SECRET_AGENTS_ASSIGN_EVENT,
      randomize: SECRET_AGENTS_RANDOMIZE_EVENT,
      updateSettings: SECRET_AGENTS_UPDATE_SETTINGS_EVENT,
      sync: SECRET_AGENTS_SYNC_EVENT,
      submitClue: SECRET_AGENTS_SUBMIT_CLUE_EVENT,
      toggleNomination: SECRET_AGENTS_TOGGLE_NOMINATION_EVENT,
      confirmCard: SECRET_AGENTS_CONFIRM_CARD_EVENT,
      pass: SECRET_AGENTS_PASS_EVENT,
      phaseChanged: SECRET_AGENTS_PHASE_CHANGED_EVENT,
      state: SECRET_AGENTS_STATE_EVENT,
    },
  },
};
