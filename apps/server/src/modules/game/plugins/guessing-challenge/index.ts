import { GUESSING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildGuessingChallengePluginDefinition } from './plugin.js';
import { registerGuessingChallengeSocketHandlers } from './socket.handlers.js';

export function registerGuessingChallengePlugin(): void {
  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);

  if (!content) {
    throw new Error('Guessing Challenge content must be registered before the plugin.');
  }

  registerGame({
    definition: buildGuessingChallengePluginDefinition(content),
    registerSocketHandlers: registerGuessingChallengeSocketHandlers,
  });
}

export { buildGuessingChallengePluginDefinition as guessingChallengePluginDefinitionBuilder };
