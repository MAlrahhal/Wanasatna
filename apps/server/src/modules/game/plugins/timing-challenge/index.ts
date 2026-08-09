import { registerGame } from '../../runtime/plugin-registry.js';
import { buildTimingChallengePluginDefinition } from './plugin.js';
import { registerTimingChallengeSocketHandlers } from './socket.handlers.js';

export function registerTimingChallengePlugin(): void {
  registerGame({
    definition: buildTimingChallengePluginDefinition(),
    registerSocketHandlers: registerTimingChallengeSocketHandlers,
  });
}

export { buildTimingChallengePluginDefinition as timingChallengePluginDefinitionBuilder };
