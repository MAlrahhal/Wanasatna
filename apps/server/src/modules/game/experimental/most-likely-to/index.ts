import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';
import {
  MOST_LIKELY_TO_GAME_ID,
  MOST_LIKELY_TO_MAX_PLAYERS,
  MOST_LIKELY_TO_MIN_PLAYERS,
} from '@wanasatna/shared';
import { ensureMostLikelyToMatch } from './init-match.js';
import {
  cleanupMostLikelyToRuntime,
  handleMostLikelyToPermanentLeave,
  reconcileMostLikelyToRuntime,
} from './match-lifecycle.js';
import { mostLikelyToPluginDefinition } from './plugin.js';
import { registerMostLikelyToSocketHandlers } from './socket.handlers.js';
import { getMostLikelyToMatch } from './store.js';

export const mostLikelyToExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: MOST_LIKELY_TO_GAME_ID,
  title: 'مين أكثر واحد؟',
  description: 'تصويت اجتماعي سري لعشرة مواقف مرحة، ثم كشف اختيارات المجموعة.',
  minPlayers: MOST_LIKELY_TO_MIN_PLAYERS,
  maxPlayers: MOST_LIKELY_TO_MAX_PLAYERS,
  plugin: {
    definition: mostLikelyToPluginDefinition,
    registerSocketHandlers: registerMostLikelyToSocketHandlers,
  },
  resolveStartParticipantIds: (_roomId, players) =>
    players
      .filter((player) => player.isConnected && !player.isSpectator)
      .map((player) => player.id),
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getMostLikelyToMatch(roomId) !== null,
    initialize: ensureMostLikelyToMatch,
    cleanup: cleanupMostLikelyToRuntime,
    reconcileConnectivity: reconcileMostLikelyToRuntime,
    onPermanentLeave: handleMostLikelyToPermanentLeave,
  },
};
