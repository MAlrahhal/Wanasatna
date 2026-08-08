import { hasClientGamePlugin, registerGame } from '@/lib/game-plugins/registry';
import { baraAlSalafaClientPlugin } from '@/plugins/bara-al-salafa';
import { drawGuessClientPlugin } from '@/plugins/draw-guess';
import { imposterDrawClientPlugin } from '@/plugins/imposter-draw';
import { judgeClientPlugin } from '@/plugins/judge';

const allClientGamePlugins = [
  baraAlSalafaClientPlugin,
  drawGuessClientPlugin,
  imposterDrawClientPlugin,
  judgeClientPlugin,
];

export function registerAllClientGamePlugins(): void {
  for (const plugin of allClientGamePlugins) {
    if (!hasClientGamePlugin(plugin.metadata.id)) {
      registerGame(plugin);
    }
  }
}

// Module-load registration: the registry is populated synchronously before any
// render-time lookup. The has-check keeps this idempotent under Strict Mode,
// Fast Refresh re-execution, and repeated imports.
registerAllClientGamePlugins();

export {
  baraAlSalafaClientPlugin,
  drawGuessClientPlugin,
  imposterDrawClientPlugin,
  judgeClientPlugin,
};
