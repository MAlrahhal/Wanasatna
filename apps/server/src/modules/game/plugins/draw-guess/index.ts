import { DRAW_GUESS_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildDrawGuessPluginDefinition } from './plugin.js';
import { registerDrawGuessSocketHandlers } from './socket.handlers.js';

export function registerDrawGuessPlugin(): void {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);

  if (!content) {
    throw new Error('Draw & Guess content must be loaded before plugin registration.');
  }

  registerGame({
    definition: buildDrawGuessPluginDefinition(content),
    registerSocketHandlers: registerDrawGuessSocketHandlers,
  });
}

export { buildDrawGuessPluginDefinition as drawGuessPluginDefinitionBuilder };
