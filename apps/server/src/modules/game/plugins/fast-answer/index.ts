import { FAST_ANSWER_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildFastAnswerPluginDefinition } from './plugin.js';
import { registerFastAnswerSocketHandlers } from './socket.handlers.js';

export function registerFastAnswerPlugin(): void {
  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    throw new Error('Fast Answer content must be registered before the plugin.');
  }

  registerGame({
    definition: buildFastAnswerPluginDefinition(content),
    registerSocketHandlers: registerFastAnswerSocketHandlers,
  });
}

export { buildFastAnswerPluginDefinition as fastAnswerPluginDefinitionBuilder };
