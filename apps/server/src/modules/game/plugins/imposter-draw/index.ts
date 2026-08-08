import { IMPOSTER_DRAW_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildImposterDrawPluginDefinition } from './plugin.js';
import { registerImposterDrawSocketHandlers } from './socket.handlers.js';

export function registerImposterDrawPlugin(): void {
  const content = getLoadedGameContent(IMPOSTER_DRAW_GAME_ID);

  if (!content) {
    throw new Error('Imposter Draw content must be loaded before plugin registration.');
  }

  registerGame({
    definition: buildImposterDrawPluginDefinition(content),
    registerSocketHandlers: registerImposterDrawSocketHandlers,
  });
}

export { buildImposterDrawPluginDefinition as imposterDrawPluginDefinitionBuilder };
