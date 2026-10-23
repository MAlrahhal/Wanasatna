import {
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_MAX_PLAYERS,
  TIMELINE_PLACEMENT_MIN_PLAYERS,
} from '@wanasatna/shared';
import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';
import { ensureTimelinePlacementMatch } from './init-match.js';
import { hydrateTimelinePlacementLobbySettings } from './lobby-settings.js';
import { cleanupTimelinePlacementRuntime } from './match-lifecycle.js';
import {
  onTimelinePlacementPermanentLeave,
  reconcileTimelinePlacementConnectivity,
} from './phase-timer.js';
import { timelinePlacementPluginDefinition } from './plugin.js';
import { registerTimelinePlacementSocketHandlers } from './socket.handlers.js';
import { getTimelinePlacementMatch } from './store.js';

export const timelinePlacementExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: TIMELINE_PLACEMENT_GAME_ID,
  title: 'زمانها وين؟',
  description: 'اختبار مغلق: ضع الأحداث في مكانها الصحيح على خط زمني مشترك.',
  minPlayers: TIMELINE_PLACEMENT_MIN_PLAYERS,
  maxPlayers: TIMELINE_PLACEMENT_MAX_PLAYERS,
  plugin: {
    definition: timelinePlacementPluginDefinition,
    registerSocketHandlers: registerTimelinePlacementSocketHandlers,
  },
  resolveStartParticipantIds: (_roomId, players) => {
    const eligible = players
      .filter((player) => player.isConnected && !player.isSpectator)
      .slice(0, TIMELINE_PLACEMENT_MAX_PLAYERS)
      .map((player) => player.id);
    return eligible.length >= TIMELINE_PLACEMENT_MIN_PLAYERS ? eligible : null;
  },
  hydrateLobbyState: hydrateTimelinePlacementLobbySettings,
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getTimelinePlacementMatch(roomId) !== null,
    initialize: ensureTimelinePlacementMatch,
    cleanup: cleanupTimelinePlacementRuntime,
    reconcileConnectivity: reconcileTimelinePlacementConnectivity,
    onPermanentLeave: onTimelinePlacementPermanentLeave,
  },
};
