import {
  EYEWITNESS_GAME_ID,
  EYEWITNESS_MAX_PLAYERS,
  EYEWITNESS_MIN_PLAYERS,
} from '@wanasatna/shared';
import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';
import { ensureEyewitnessMatch } from './init-match.js';
import { hydrateEyewitnessLobbySettings } from './lobby-settings.js';
import { cleanupEyewitnessRuntime } from './match-lifecycle.js';
import { onEyewitnessPermanentLeave, reconcileEyewitnessConnectivity } from './phase-timer.js';
import { eyewitnessPluginDefinition } from './plugin.js';
import { registerEyewitnessSocketHandlers } from './socket.handlers.js';
import { getEyewitnessMatch } from './store.js';

export const eyewitnessExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: EYEWITNESS_GAME_ID,
  title: 'شاهد عيان',
  description: 'اختبار مغلق: شاهد يصف صورة خيالية، والآخرون يرسمونها ويصوّتون.',
  minPlayers: EYEWITNESS_MIN_PLAYERS,
  maxPlayers: EYEWITNESS_MAX_PLAYERS,
  plugin: {
    definition: eyewitnessPluginDefinition,
    registerSocketHandlers: registerEyewitnessSocketHandlers,
  },
  resolveStartParticipantIds: (_roomId, players) => {
    const eligible = players
      .filter((player) => player.isConnected && !player.isSpectator)
      .slice(0, EYEWITNESS_MAX_PLAYERS)
      .map((player) => player.id);
    return eligible.length >= EYEWITNESS_MIN_PLAYERS ? eligible : null;
  },
  hydrateLobbyState: hydrateEyewitnessLobbySettings,
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getEyewitnessMatch(roomId) !== null,
    initialize: ensureEyewitnessMatch,
    cleanup: cleanupEyewitnessRuntime,
    reconcileConnectivity: reconcileEyewitnessConnectivity,
    onPermanentLeave: onEyewitnessPermanentLeave,
  },
};
