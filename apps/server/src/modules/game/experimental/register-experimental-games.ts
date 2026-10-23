import { registerExperimentalGame } from './experimental-game.registry.js';
import { secretAgentsExperimentalRegistration } from './secret-agents/index.js';
import { mostLikelyToExperimentalRegistration } from './most-likely-to/index.js';

export function registerAllExperimentalGames(): void {
  registerExperimentalGame(secretAgentsExperimentalRegistration);
  registerExperimentalGame(mostLikelyToExperimentalRegistration);
}
