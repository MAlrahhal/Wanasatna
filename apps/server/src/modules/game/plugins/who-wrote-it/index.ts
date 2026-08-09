import { WHO_WROTE_IT_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildWhoWroteItPluginDefinition } from './plugin.js';
import { registerWhoWroteItSocketHandlers } from './socket.handlers.js';

export function registerWhoWroteItPlugin(): void {
  const content = getLoadedGameContent(WHO_WROTE_IT_GAME_ID);

  if (!content) {
    throw new Error('Who Wrote It content must be registered before the plugin.');
  }

  registerGame({
    definition: buildWhoWroteItPluginDefinition(content),
    registerSocketHandlers: registerWhoWroteItSocketHandlers,
  });
}

export { buildWhoWroteItPluginDefinition as whoWroteItPluginDefinitionBuilder };
