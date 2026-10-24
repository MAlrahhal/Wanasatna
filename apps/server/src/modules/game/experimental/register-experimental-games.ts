import { registerExperimentalGame } from './experimental-game.registry.js';
import { secretAgentsExperimentalRegistration } from './secret-agents/index.js';
import { mostLikelyToExperimentalRegistration } from './most-likely-to/index.js';
import { emojiLanguageExperimentalRegistration } from './emoji-language/index.js';
import { timelinePlacementExperimentalRegistration } from './timeline-placement/index.js';
import { oneWordOnlyExperimentalRegistration } from './one-word-only/index.js';
import { eyewitnessExperimentalRegistration } from './eyewitness/index.js';

export function registerAllExperimentalGames(): void {
  registerExperimentalGame(secretAgentsExperimentalRegistration);
  registerExperimentalGame(mostLikelyToExperimentalRegistration);
  registerExperimentalGame(emojiLanguageExperimentalRegistration);
  registerExperimentalGame(timelinePlacementExperimentalRegistration);
  registerExperimentalGame(oneWordOnlyExperimentalRegistration);
  registerExperimentalGame(eyewitnessExperimentalRegistration);
}
