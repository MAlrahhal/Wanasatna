import {
  EMOJI_LANGUAGE_GAME_ID,
  EMOJI_LANGUAGE_MAX_PLAYERS,
  EMOJI_LANGUAGE_MIN_PLAYERS,
} from '@wanasatna/shared';
import type { ExperimentalGameRegistration } from '../experimental-game.registry.js';
import { ensureEmojiLanguageMatch } from './init-match.js';
import { hydrateEmojiLanguageLobbySettings } from './lobby-settings.js';
import { cleanupEmojiLanguageRuntime } from './match-lifecycle.js';
import {
  onEmojiLanguagePermanentLeave,
  reconcileEmojiLanguageConnectivity,
} from './phase-timer.js';
import { emojiLanguagePluginDefinition } from './plugin.js';
import { registerEmojiLanguageSocketHandlers } from './socket.handlers.js';
import { getEmojiLanguageMatch } from './store.js';

export const emojiLanguageExperimentalRegistration: ExperimentalGameRegistration = {
  gameId: EMOJI_LANGUAGE_GAME_ID,
  title: 'لغة الإيموجي',
  description: 'اختبار مغلق: اكتب تلميحًا بالرموز أو حل لغزًا جاهزًا.',
  minPlayers: EMOJI_LANGUAGE_MIN_PLAYERS,
  maxPlayers: EMOJI_LANGUAGE_MAX_PLAYERS,
  plugin: {
    definition: emojiLanguagePluginDefinition,
    registerSocketHandlers: registerEmojiLanguageSocketHandlers,
  },
  resolveStartParticipantIds: (_roomId, players) => {
    const eligible = players
      .filter((player) => player.isConnected && !player.isSpectator)
      .slice(0, EMOJI_LANGUAGE_MAX_PLAYERS)
      .map((player) => player.id);
    return eligible.length >= EMOJI_LANGUAGE_MIN_PLAYERS ? eligible : null;
  },
  hydrateLobbyState: hydrateEmojiLanguageLobbySettings,
  runtime: {
    handlesActorRecovery: true,
    hasState: (roomId) => getEmojiLanguageMatch(roomId) !== null,
    initialize: ensureEmojiLanguageMatch,
    cleanup: cleanupEmojiLanguageRuntime,
    reconcileConnectivity: reconcileEmojiLanguageConnectivity,
    onPermanentLeave: onEmojiLanguagePermanentLeave,
  },
};
