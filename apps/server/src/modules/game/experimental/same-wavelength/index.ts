import {
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_MAX_PLAYERS,
  SAME_WAVELENGTH_MIN_PLAYERS,
} from '@wanasatna/shared';
import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';
import { ensureSameWavelengthMatch } from './init-match.js';
import {
  hydrateSameWavelengthLobbyState,
  resolveSameWavelengthParticipants,
} from './lobby-state.js';
import { cleanupSameWavelengthRuntime } from './match-lifecycle.js';
import {
  onSameWavelengthPermanentLeave,
  reconcileSameWavelengthConnectivity,
} from './phase-timer.js';
import { sameWavelengthPluginDefinition } from './plugin.js';
import { registerSameWavelengthSocketHandlers } from './socket.handlers.js';
import { getSameWavelengthMatch } from './store.js';

export const sameWavelengthExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: SAME_WAVELENGTH_GAME_ID,
  title: 'على نفس الموجة',
  description: 'اختبار مغلق: أعطِ تلميحًا وقارب النقطة السرية على الطيف.',
  minPlayers: SAME_WAVELENGTH_MIN_PLAYERS,
  maxPlayers: SAME_WAVELENGTH_MAX_PLAYERS,
  plugin: {
    definition: sameWavelengthPluginDefinition,
    registerSocketHandlers: registerSameWavelengthSocketHandlers,
  },
  resolveStartParticipantIds: resolveSameWavelengthParticipants,
  hydrateLobbyState: hydrateSameWavelengthLobbyState,
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getSameWavelengthMatch(roomId) !== null,
    initialize: ensureSameWavelengthMatch,
    cleanup: cleanupSameWavelengthRuntime,
    reconcileConnectivity: reconcileSameWavelengthConnectivity,
    onPermanentLeave: onSameWavelengthPermanentLeave,
  },
};
