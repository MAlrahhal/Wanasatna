import { BARA_AL_SALAFA_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { registerGame } from '../../runtime/plugin-registry.js';
import { buildBaraAlSalafaPluginDefinition } from './plugin.js';
import { registerBaraAlSalafaSocketHandlers } from './socket.handlers.js';

export function registerBaraAlSalafaPlugin(): void {
  const content = getLoadedGameContent(BARA_AL_SALAFA_GAME_ID);

  if (!content) {
    throw new Error('Bara Al-Salafa content must be loaded before plugin registration.');
  }

  registerGame({
    definition: buildBaraAlSalafaPluginDefinition(content),
    registerSocketHandlers: registerBaraAlSalafaSocketHandlers,
  });
}

export { buildBaraAlSalafaPluginDefinition as baraAlSalafaPluginDefinitionBuilder };
