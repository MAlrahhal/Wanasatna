import { registerExperimentalGame } from './experimental-game.registry.js';
import { secretAgentsExperimentalRegistration } from './secret-agents/index.js';
import { emojiLanguageExperimentalRegistration } from './emoji-language/index.js';

export function registerAllExperimentalGames(): void {
  registerExperimentalGame(secretAgentsExperimentalRegistration);
  registerExperimentalGame(emojiLanguageExperimentalRegistration);
}
