import { hasClientGamePlugin, registerGame } from '@/lib/game-plugins/registry';
import { baraAlSalafaClientPlugin } from '@/plugins/bara-al-salafa';
import { drawGuessClientPlugin } from '@/plugins/draw-guess';
import { fastAnswerClientPlugin } from '@/plugins/fast-answer';
import { imposterDrawClientPlugin } from '@/plugins/imposter-draw';
import { judgeClientPlugin } from '@/plugins/judge';
import { timingChallengeClientPlugin } from '@/plugins/timing-challenge';

const allClientGamePlugins = [
  baraAlSalafaClientPlugin,
  drawGuessClientPlugin,
  fastAnswerClientPlugin,
  imposterDrawClientPlugin,
  judgeClientPlugin,
  timingChallengeClientPlugin,
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
  fastAnswerClientPlugin,
  imposterDrawClientPlugin,
  judgeClientPlugin,
  timingChallengeClientPlugin,
};
