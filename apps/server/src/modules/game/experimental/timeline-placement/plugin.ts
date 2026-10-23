import type { GamePluginDefinition, GamePluginSettings } from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_CHOOSE_EVENT,
  TIMELINE_PLACEMENT_CONTINUE_EVENT,
  TIMELINE_PLACEMENT_DEFAULT_SETTINGS,
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT,
  TIMELINE_PLACEMENT_MAX_PLAYERS,
  TIMELINE_PLACEMENT_MIN_PLAYERS,
  TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
  TIMELINE_PLACEMENT_STATE_EVENT,
  TIMELINE_PLACEMENT_SYNC_EVENT,
  TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { createTimelinePlacementMatch, type TimelinePlacementMatchState } from './state.js';

export const timelinePlacementPluginDefinition: GamePluginDefinition = {
  id: TIMELINE_PLACEMENT_GAME_ID,
  title: 'زمانها وين؟',
  description: 'ضع الحدث في مكانه الصحيح على الخط الزمني',
  iconLabel: 'ز',
  minPlayers: TIMELINE_PLACEMENT_MIN_PLAYERS,
  maxPlayers: TIMELINE_PLACEMENT_MAX_PLAYERS,
  defaultSettings: {} satisfies GamePluginSettings,
  settingsSchema: [],
  createInitialState: (context) =>
    createTimelinePlacementMatch({
      playerIds: context.players.map((player) => player.id),
      playerNames: Object.fromEntries(context.players.map((player) => [player.id, player.name])),
      settings: TIMELINE_PLACEMENT_DEFAULT_SETTINGS,
    }),
  serializeState: (state) => state,
  deserializeState: (payload) => payload as TimelinePlacementMatchState,
  lifecycle: {},
  socket: {
    events: {
      lobbySync: TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT,
      updateSettings: TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
      sync: TIMELINE_PLACEMENT_SYNC_EVENT,
      choose: TIMELINE_PLACEMENT_CHOOSE_EVENT,
      continue: TIMELINE_PLACEMENT_CONTINUE_EVENT,
      phaseChanged: TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
      state: TIMELINE_PLACEMENT_STATE_EVENT,
    },
  },
};
