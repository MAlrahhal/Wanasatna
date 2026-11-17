import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function test(name: string, run: () => void): void {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('lobby exposes both authoritative modes and self-service team assignments', () => {
  const lobby = read('components/lobby/same-wavelength-lobby-panel.tsx');
  assert.match(lobby, /فردي · 5 جولات/);
  assert.match(lobby, /فرق · 3 جولات كاملة/);
  assert.match(lobby, /SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT/);
  assert.match(lobby, /SAME_WAVELENGTH_ASSIGN_EVENT/);
  assert.match(lobby, /\{ team, role \}/);
  assert.doesNotMatch(lobby, /isAdmin:\s*true|userId:|premium:\s*true/);
});

test('single spectrum is the accessible pointer, touch, and keyboard control', () => {
  const game = read('plugins/same-wavelength/game-screen.tsx');
  const spectrum = read('plugins/same-wavelength/spectrum-control.tsx');
  assert.doesNotMatch(game, /type="range"/);
  assert.match(game, /<SameWavelengthSpectrum/);
  assert.match(spectrum, /type="range"/);
  assert.match(spectrum, /min=\{0\}/);
  assert.match(spectrum, /max=\{100\}/);
  assert.match(spectrum, /dir="ltr"/);
  assert.match(spectrum, /touch-none/);
  assert.match(spectrum, /onInput=/);
  assert.match(spectrum, /onPointerUp=/);
  assert.match(spectrum, /onKeyUp=/);
  assert.match(spectrum, /onCommit\?\.\(next\)/);
  assert.match(spectrum, /إنقاص الموقع درجة واحدة/);
  assert.match(spectrum, /زيادة الموقع درجة واحدة/);
  assert.match(spectrum, /لم يتم اختيار موقع بعد/);
  assert.match(spectrum, /اختر موقعًا على المقياس/);
  assert.doesNotMatch(spectrum, /ثم اسحب لتعديله/);
  assert.match(spectrum, /text-\[11px\] font-bold text-slate-300 sm:text-xs/);
  assert.match(spectrum, /\[0, 25, 50, 75, 100\]/);
  assert.match(spectrum, /position <= 8/);
  assert.match(spectrum, /position >= 92/);
});

test('individual mode exposes one explicit confirmation while team mode preserves two steps', () => {
  const game = read('plugins/same-wavelength/game-screen.tsx');
  const hook = read('plugins/same-wavelength/use-player-view.ts');
  assert.match(game, /submitIndividualGuess/);
  assert.match(game, /canPropose \|\| individualLocked/);
  assert.match(game, /تأكيد تخميني/);
  assert.match(hook, /SAME_WAVELENGTH_PROPOSE_EVENT/);
  assert.match(hook, /SAME_WAVELENGTH_CONFIRM_EVENT/);
  assert.match(hook, /const submitIndividualGuess/);
  assert.match(game, /onCommit=/);
  assert.doesNotMatch(game, /حرّك العلامة، ثم ثبّت تخمينك/);
  assert.doesNotMatch(game, /اختر موقعًا لإرسال اقتراحك/);
  assert.match(game, /إرسال اقتراحي/);
  assert.match(game, /تأكيد الاتفاق على/);
  assert.match(game, /أكّد \{confirmedCount\} من \{view\.teamProposals\.length\}/);
  assert.match(game, /لم يقترح بعد/);
  assert.match(game, /يمكنك متابعة الطيف والتلميح والنتائج، لكن لا يمكنك إرسال علامة/);
});

test('private target is rendered only from the server role-scoped field', () => {
  const game = read('plugins/same-wavelength/game-screen.tsx');
  const hook = read('plugins/same-wavelength/use-player-view.ts');
  assert.match(game, /view\.privateTarget/);
  assert.match(game, /view\.revealedTarget/);
  assert.doesNotMatch(game, /Math\.random|target\s*=\s*position/);
  assert.match(hook, /AckGenerationGate/);
  assert.match(hook, /runLatestAck/);
  assert.match(hook, /bindPluginViewResync/);
  assert.match(hook, /shouldAcceptSameWavelengthView/);
  assert.match(hook, /syncGate\.current\.invalidate\(\)/);
});

test('clue and results UI avoid duplicated target copy and explain timeout outcomes', () => {
  const game = read('plugins/same-wavelength/game-screen.tsx');
  const spectrum = read('plugins/same-wavelength/spectrum-control.tsx');
  assert.match(game, /الهدف السري:/);
  assert.match(game, /tone: 'target'/);
  assert.match(game, /اكتب مثالًا يلمّح إلى مكان الهدف/);
  assert.doesNotMatch(game, /كوب شاي/);
  assert.match(game, /انتهى الوقت بدون تلميح — لا نقاط لهذه الجولة/);
  assert.match(game, /لم يصل الفريق إلى تأكيد جماعي/);
  assert.match(game, /SameWavelengthResultEntry/);
  assert.match(game, /لم يرسل تخمينًا · \+0/);
  assert.doesNotMatch(game, /لم يؤكد تخمينًا/);
  assert.match(game, /showMarkerLegend/);
  assert.match(spectrum, /مفتاح علامات النتيجة/);
  assert.match(game, /<bdi dir="auto"/);
  assert.match(game, /\{index \+ 1\}./);
});

test('game is registered lazily but absent from every public discovery source', () => {
  const plugin = read('plugins/same-wavelength/index.tsx');
  const bootstrap = read('plugins/index.ts');
  assert.match(plugin, /lazyGameScreen/);
  assert.match(plugin, /import\('\.\/game-screen'\)/);
  assert.match(bootstrap, /sameWavelengthClientPlugin/);
  for (const path of [
    'lib/public/game-catalog.ts',
    'lib/lobby/mock-games.ts',
    'components/public/game-cards.tsx',
    'components/public/public-navbar.tsx',
  ]) {
    assert.doesNotMatch(read(path), /same-wavelength|على نفس الموجة/, path);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
