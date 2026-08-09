import { registerBaraAlSalafaPlugin } from './bara-al-salafa/index.js';
import { registerDrawGuessPlugin } from './draw-guess/index.js';
import { registerFastAnswerPlugin } from './fast-answer/index.js';
import { registerImposterDrawPlugin } from './imposter-draw/index.js';
import { registerJudgePlugin } from './judge/index.js';
import { registerTimingChallengePlugin } from './timing-challenge/index.js';
import { registerWhoWroteItPlugin } from './who-wrote-it/index.js';

/**
 * Central plugin registration.
 * Add new games here — the Game Shell never imports them directly.
 */
export function registerAllGamePlugins(): void {
  registerBaraAlSalafaPlugin();
  registerDrawGuessPlugin();
  registerImposterDrawPlugin();
  registerTimingChallengePlugin();
  registerFastAnswerPlugin();
  registerWhoWroteItPlugin();
  registerJudgePlugin();
}

export { registerBaraAlSalafaPlugin } from './bara-al-salafa/index.js';
export { registerDrawGuessPlugin } from './draw-guess/index.js';
export { registerFastAnswerPlugin } from './fast-answer/index.js';
export { registerImposterDrawPlugin } from './imposter-draw/index.js';
export { registerTimingChallengePlugin } from './timing-challenge/index.js';
export { registerWhoWroteItPlugin } from './who-wrote-it/index.js';
export { registerJudgePlugin } from './judge/index.js';
