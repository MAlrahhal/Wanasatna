import { JUDGE_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildJudgePluginDefinition } from './plugin.js';
import { registerJudgeSocketHandlers } from './socket.handlers.js';

export function registerJudgePlugin(): void {
  const content = getLoadedGameContent(JUDGE_GAME_ID);

  if (!content) {
    throw new Error('Judge content must be registered before the plugin.');
  }

  registerGame({
    definition: buildJudgePluginDefinition(content),
    registerSocketHandlers: registerJudgeSocketHandlers,
  });
}

export { buildJudgePluginDefinition as judgePluginDefinitionBuilder };
