import {
  ONE_WORD_ONLY_GAME_ID,
  ONE_WORD_ONLY_MAX_PLAYERS,
  ONE_WORD_ONLY_MIN_PLAYERS,
} from '@wanasatna/shared';
import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';
import { ensureOneWordOnlyMatch } from './init-match.js';
import { hydrateOneWordOnlyLobbySettings } from './lobby-settings.js';
import { cleanupOneWordOnlyRuntime } from './match-lifecycle.js';
import { onOneWordOnlyPermanentLeave, reconcileOneWordOnlyConnectivity } from './phase-timer.js';
import { oneWordOnlyPluginDefinition } from './plugin.js';
import { registerOneWordOnlySocketHandlers } from './socket.handlers.js';
import { getOneWordOnlyMatch } from './store.js';

export const oneWordOnlyExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: ONE_WORD_ONLY_GAME_ID,
  title: 'كلمة وحدة بس',
  description: 'اختبار مغلق: تلميح واحد لكل لاعب، والمخمّن يختار من ثمانية خيارات.',
  minPlayers: ONE_WORD_ONLY_MIN_PLAYERS,
  maxPlayers: ONE_WORD_ONLY_MAX_PLAYERS,
  plugin: {
    definition: oneWordOnlyPluginDefinition,
    registerSocketHandlers: registerOneWordOnlySocketHandlers,
  },
  resolveStartParticipantIds: (_roomId, players) => {
    const eligible = players
      .filter((player) => player.isConnected && !player.isSpectator)
      .slice(0, ONE_WORD_ONLY_MAX_PLAYERS)
      .map((player) => player.id);
    return eligible.length >= ONE_WORD_ONLY_MIN_PLAYERS ? eligible : null;
  },
  hydrateLobbyState: hydrateOneWordOnlyLobbySettings,
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getOneWordOnlyMatch(roomId) !== null,
    initialize: ensureOneWordOnlyMatch,
    cleanup: cleanupOneWordOnlyRuntime,
    reconcileConnectivity: reconcileOneWordOnlyConnectivity,
    onPermanentLeave: onOneWordOnlyPermanentLeave,
  },
};
