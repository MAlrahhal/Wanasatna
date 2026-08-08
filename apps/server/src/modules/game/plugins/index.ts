import { registerGameDefinition } from '../runtime/plugin-registry.js';
import { registerBaraAlSalafaPlugin } from './bara-al-salafa/index.js';
import { registerDrawGuessPlugin } from './draw-guess/index.js';
import { registerImposterDrawPlugin } from './imposter-draw/index.js';
import { judgePlugin } from './judge/plugin.js';

/**
 * Central plugin registration.
 * Add new games here — the Game Shell never imports them directly.
 */
export function registerAllGamePlugins(): void {
  registerBaraAlSalafaPlugin();
  registerDrawGuessPlugin();
  registerImposterDrawPlugin();
  registerGameDefinition(judgePlugin);
}

export { registerBaraAlSalafaPlugin } from './bara-al-salafa/index.js';
export { registerDrawGuessPlugin } from './draw-guess/index.js';
export { registerImposterDrawPlugin } from './imposter-draw/index.js';
export { judgePlugin };
