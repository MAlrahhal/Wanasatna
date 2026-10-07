import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import { ImpostorGuessScreen } from '@/plugins/bara-al-salafa/impostor-guess-screen';
import { mapImpostorGuessLiveProps } from '@/plugins/bara-al-salafa/live-phase-adapters';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

const options = [
  { id: 'الأولى', label: 'الأولى' },
  { id: 'الثانية', label: 'الثانية' },
  { id: 'الثالثة', label: 'الثالثة' },
];

const commonProps = {
  options,
  selectedWord: null,
  hasSubmitted: false,
  roundNumber: 1,
  totalRounds: 3,
  roomCode: 'TEST',
};

test('observer sees every ordered option as read-only with clear Arabic copy', () => {
  const markup = renderToStaticMarkup(
    createElement(ImpostorGuessScreen, {
      ...commonProps,
      isImpostor: false,
      showOptionsToObservers: true,
    }),
  );

  assert.match(markup, /الكلمات المعروضة — انتظر اختيار اللاعب/);
  assert.ok(markup.indexOf('الأولى') < markup.indexOf('الثانية'));
  assert.ok(markup.indexOf('الثانية') < markup.indexOf('الثالثة'));
  assert.equal((markup.match(/disabled=""/g) ?? []).length, options.length);
  assert.match(markup, /الأولى — للعرض فقط/);
});

test('chooser sees enabled choices while submission stays disabled until a choice is made', () => {
  const markup = renderToStaticMarkup(
    createElement(ImpostorGuessScreen, {
      ...commonProps,
      isImpostor: true,
    }),
  );

  assert.equal((markup.match(/disabled=""/g) ?? []).length, 1);
  assert.match(markup, /اختيار الأولى/);
  assert.match(markup, /تأكيد الاختيار/);
});

test('Outside the Topic adapter preserves authoritative order and enables observer display', () => {
  const view = {
    isImpostorGuessActivePlayer: false,
    impostorGuessOptions: options.map((option) => option.label),
    hasSubmittedImpostorGuess: false,
    currentRound: 1,
    totalRounds: 3,
  } as BaraAlSalafaPlayerView;

  const props = mapImpostorGuessLiveProps(view, 'TEST', 1234);
  assert.deepEqual(
    props.options.map((option) => option.id),
    options.map((option) => option.id),
  );
  assert.equal(props.isImpostor, false);
  assert.equal(props.showOptionsToObservers, true);
});

test('Drawing Impostor exposes controls only when the authoritative view can guess', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const source = readFileSync(join(root, 'plugins/imposter-draw/game-screen.tsx'), 'utf8');
  const guessBranch = source.slice(source.indexOf("if (view.gamePhase === 'impostor-guess')"));

  assert.match(guessBranch, /showOptionsToObservers/);
  assert.match(guessBranch, /waitingHelper="الكلمات المعروضة — انتظر اختيار اللاعب\."/);
  assert.match(guessBranch, /onSelectWord=\{view\.canGuessImage/);
  assert.match(guessBranch, /onSubmit=\{\s*view\.canGuessImage/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
