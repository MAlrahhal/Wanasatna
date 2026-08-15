/**
 * P6-C Guessing Challenge mobile presentation contract.
 * Desktop 3D geometry and look mapping must stay frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAMERA_FOV,
  CAMERA_Y,
  CAMERA_Z,
  cameraPositionForSeat,
  mapRemoteLookPitch,
  mapRemoteLookYaw,
  teammateSeatPosition,
} from '../plugins/guessing-challenge/real3d/seat-layout';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('desktop seat transforms and look mapping are unchanged', () => {
  assert.equal(CAMERA_FOV, 55);
  assert.equal(CAMERA_Y, 1.35);
  assert.equal(CAMERA_Z, 1.65);
  assert.deepEqual(cameraPositionForSeat('1v1', 0), [0, 1.35, 1.65]);
  assert.deepEqual(cameraPositionForSeat('2v2', 0), [-0.26, 1.35, 1.65]);
  assert.deepEqual(cameraPositionForSeat('2v2', 1), [0.26, 1.35, 1.65]);
  assert.deepEqual(teammateSeatPosition(0), [1.22, 0, 1.53]);
  assert.deepEqual(teammateSeatPosition(1), [-1.22, 0, 1.53]);
  assert.equal(mapRemoteLookYaw(0.6, 'toward-camera'), -0.6);
  assert.equal(mapRemoteLookYaw(0.6, 'same-as-local'), 0.6);
  assert.equal(mapRemoteLookPitch(0.4), 0.4);

  const layout = read('plugins/guessing-challenge/real3d/seat-layout.ts');
  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  const hands = read('plugins/guessing-challenge/real3d/first-person-hands.tsx');
  const look = read('plugins/guessing-challenge/real3d/look-controls.tsx');
  assert.match(layout, /SEAT_CAMERA_X = 0\.26/);
  assert.match(layout, /TEAMMATE_X = 1\.22/);
  assert.match(layout, /TEAMMATE_Z = 1\.53/);
  assert.doesNotMatch(inner, /position=\{\[x, 0, 1\.4\]\}/);
  assert.match(inner, /-2\.15/);
  assert.match(hands, /\[0, -0\.48, -0\.9\]/);
  assert.match(hands, /\[0, -0\.22, -1\.22\]/);
  assert.match(hands, /compactHud/);
  assert.match(look, /const element = gl\.domElement/);
  assert.doesNotMatch(look, /window\.addEventListener\('touch/);
  assert.match(look, /DEFAULT_YAW_LIMIT = \(38 \* Math\.PI\) \/ 180/);
  assert.match(look, /DEFAULT_PITCH_LIMIT = \(18 \* Math\.PI\) \/ 180/);
  assert.doesNotMatch(look, /requestPointerLock/);
});

test('mobile scene sizing is CSS-only and desktop shell height is frozen', () => {
  const css = read('plugins/guessing-challenge/real3d/real3d-scene.css');
  assert.match(css, /height: min\(62vh, 480px\)/);
  assert.match(css, /min-height: 240px/);
  assert.match(css, /max-width: 1023px/);
  assert.match(css, /36dvh/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /touch-action:\s*pan-y/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /\.gc-results-scene \.gc-real3d-canvas-shell/);
});

test('special-card overlay does not steal scene pointer events', () => {
  const panel = read('plugins/guessing-challenge/special-cards-panel.tsx');
  assert.match(panel, /pointer-events-none absolute inset-x-2 top-\[18%\]/);
  assert.doesNotMatch(panel, /pointer-events-auto absolute inset-x-2 top-\[18%\]/);
  assert.match(panel, /pointer-events-auto flex h-\[4\.25rem\]/);
  assert.match(panel, /gc-yellow-card/);
  assert.match(panel, /gc-red-card/);
  assert.match(panel, /onUseYellow/);
  assert.match(panel, /onUseRed/);
  assert.match(panel, /items-end/);
  assert.match(panel, /88dvh/);
  assert.match(panel, /safe-area-inset-bottom/);
  assert.match(panel, /data-available=/);
  assert.match(panel, /تم الاستخدام/);
  assert.match(panel, /متاحة/);
});

test('guess form stays IME-safe with mobile sticky confirm', () => {
  const playing = read('plugins/guessing-challenge/playing-screen.tsx');
  assert.match(playing, /GameMobileStickyCta/);
  assert.match(playing, /gc-confirm-guess/);
  assert.match(playing, /submitCurrentGuess/);
  assert.match(playing, /composingGuessRef/);
  assert.match(playing, /isComposing/);
  assert.match(playing, /shouldAutofocusFormField/);
  assert.match(playing, /view\.isMyTurn && !showGuessForm/);
  assert.match(playing, /overflow-x-hidden/);
  assert.doesNotMatch(playing, /relative overflow-hidden rounded-\[1\.5rem\]/);
});

test('turn panel remains overflow-visible and 2v2 seats stay mirrored', () => {
  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  assert.match(inner, /gc-turn-indicator/);
  assert.match(inner, /overflow-visible/);
  assert.match(inner, /break-words/);
  assert.match(inner, /gc-recenter-camera/);
  assert.match(inner, /aria-label="إعادة توسيط النظر"/);
  assert.match(inner, /fov: CAMERA_FOV/);
  assert.equal(cameraPositionForSeat('2v2', 0)[0], -cameraPositionForSeat('2v2', 1)[0]);
});

test('results and spectator stay compact without secret identity', () => {
  const results = read('plugins/guessing-challenge/round-results-screen.tsx');
  const game = read('plugins/guessing-challenge/game-screen.tsx');
  assert.match(results, /gc-results-scene/);
  assert.match(results, /\+100/);
  assert.match(results, /view\.roundResultsContinueLabel/);
  assert.doesNotMatch(results, /secretIdentity/);
  assert.match(game, /SpectatorNotice/);
  assert.match(game, /showSpecialCards=\{false\}/);
  assert.match(game, /MatchResultsScreen/);
  assert.doesNotMatch(game, /secretIdentity/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
