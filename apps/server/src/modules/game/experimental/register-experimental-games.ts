import { registerExperimentalGame } from './experimental-game.registry.js';
import { secretAgentsExperimentalRegistration } from './secret-agents/index.js';

export function registerAllExperimentalGames(): void {
  registerExperimentalGame(secretAgentsExperimentalRegistration);
}
