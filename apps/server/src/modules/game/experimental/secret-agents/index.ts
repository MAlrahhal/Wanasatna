import { SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';
import { getSecretAgentsLobbyState, validateSecretAgentsRoster } from './lobby-state.js';
import { ensureSecretAgentsMatch } from './init-match.js';
import { cleanupSecretAgentsRuntime } from './match-lifecycle.js';
import { reconcileSecretAgentsConnectivity } from './phase-timer.js';
import { secretAgentsPluginDefinition } from './plugin.js';
import { registerSecretAgentsSocketHandlers } from './socket.handlers.js';
import { getSecretAgentsMatch } from './store.js';
import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';

export const secretAgentsExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: SECRET_AGENTS_GAME_ID,
  title: 'العملاء السريون',
  description: 'لعبة فرق مغلقة الاختبار: تلميح واحد، لوحة كلمات، وقاتل واحد.',
  minPlayers: 4,
  maxPlayers: 15,
  plugin: {
    definition: secretAgentsPluginDefinition,
    registerSocketHandlers: registerSecretAgentsSocketHandlers,
  },
  resolveStartParticipantIds: (roomId) => {
    const lobby = getSecretAgentsLobbyState(roomId);
    const participantPlayerIds = Object.keys(lobby.assignments);
    const validation = validateSecretAgentsRoster({
      assignments: lobby.assignments,
      eligiblePlayerIds: participantPlayerIds,
    });
    return validation.success ? validation.participantPlayerIds : null;
  },
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getSecretAgentsMatch(roomId) !== null,
    initialize: ensureSecretAgentsMatch,
    cleanup: cleanupSecretAgentsRuntime,
    reconcileConnectivity: reconcileSecretAgentsConnectivity,
    onPermanentLeave: (io, roomId) => reconcileSecretAgentsConnectivity(io, roomId),
  },
};
