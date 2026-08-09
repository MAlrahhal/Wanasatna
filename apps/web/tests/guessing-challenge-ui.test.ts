/**
 * Focused web checks for Guessing Challenge catalog + Real3D / fallback UI wiring.
 * Does not fully render WebGL in jsdom — tests boundaries and source contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { getHomeGameShowcase } from '@/lib/home/game-showcase';
import { getGameRoundCategories } from '@/lib/game/round-categories/registry';
import { resolveIdentityCardText } from '../plugins/guessing-challenge/identity-display';
import { detectWebGLSupport } from '../plugins/guessing-challenge/scene-props';

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

function readPlugin(relativePath: string): string {
  return readFileSync(join(root, 'plugins/guessing-challenge', relativePath), 'utf8');
}

function readPkg(): string {
  return readFileSync(join(root, 'package.json'), 'utf8');
}

test('catalog card exists and marks 2 players', () => {
  const entry = getGameCatalogEntry('guessing-challenge');
  assert.equal(entry.availability, 'available');
  assert.equal(entry.playerRange, 'لاعبان');
  assert.equal(entry.featured, true);

  const lobby = mockLobbyGames.find((game) => game.id === 'guessing-challenge');
  assert.ok(lobby);
  assert.equal(lobby.title, 'تحدي التخمين');
  assert.equal(getHomeGameShowcase('guessing-challenge').availability, 'available');
});

test('round categories include random and football', () => {
  const config = getGameRoundCategories('guessing-challenge');
  assert.ok(config);
  assert.ok(config.categories.some((category) => category.id === 'random'));
  assert.ok(config.categories.some((category) => category.id === 'football'));
});

test('A/B identity helper: own hidden, opponent visible text', () => {
  assert.equal(resolveIdentityCardText(null, true), '؟؟؟');
  assert.equal(
    resolveIdentityCardText({ type: 'text', value: 'بطريق', imageUrl: null }, false),
    'بطريق',
  );
});

test('A lazy Real3D loader + CSS fallback exist', () => {
  const gameplay = readPlugin('gameplay-scene.tsx');
  const real3d = readPlugin('real3d/real3d-scene.tsx');
  const pkg = readPkg();

  assert.match(gameplay, /next\/dynamic/);
  assert.match(gameplay, /ssr:\s*false/);
  assert.match(gameplay, /real3d\/real3d-scene/);
  assert.match(gameplay, /detectWebGLSupport/);
  assert.match(gameplay, /FirstPersonGameScene/);
  assert.match(gameplay, /gc-css-fallback-scene/);
  assert.match(real3d, /Real3DErrorBoundary/);
  assert.match(real3d, /FirstPersonGameScene/);
  assert.match(pkg, /"three"/);
  assert.match(pkg, /"@react-three\/fiber"/);
  assert.match(pkg, /"@react-three\/drei"/);
});

test('detectWebGLSupport is safe without browser GL', () => {
  assert.equal(typeof detectWebGLSupport(), 'boolean');
});

test('C/D/E/F/G playing screen wires GameplayScene + DOM controls', () => {
  const playing = readPlugin('playing-screen.tsx');
  const scene = readPlugin('first-person-game-scene.tsx');
  const special = readPlugin('special-card-button.tsx');
  const realInner = readPlugin('real3d/real3d-scene-inner.tsx');
  const table = readPlugin('real3d/table-and-cards.tsx');

  assert.match(playing, /GameplayScene/);
  assert.match(playing, /selfHidden/);
  assert.match(playing, /opponentIdentity=\{view\.opponent\.visibleIdentity\}/);
  assert.match(playing, /opponentName=\{view\.opponent\.name\}/);
  assert.match(playing, /selfIdentity=\{null\}/);
  assert.match(playing, /turnTitle/);
  assert.match(playing, /gc-end-question/);
  assert.match(playing, /gc-open-guess/);
  assert.match(playing, /gc-final-guess-panel/);
  assert.match(playing, /yellowAvailable=\{view\.self\.yellowCardAvailable\}/);
  assert.match(playing, /redAvailable=\{view\.self\.redCardAvailable\}/);
  assert.match(playing, /canUseYellow=\{view\.canUseYellow\}/);
  assert.match(playing, /canUseRed=\{view\.canUseRed\}/);
  assert.doesNotMatch(playing, /secretIdentity/);

  assert.match(scene, /gc-first-person-scene/);
  assert.match(scene, /gc-opponent-identity/);
  assert.match(scene, /gc-self-identity/);
  assert.match(special, /gc-yellow-card/);
  assert.match(special, /gc-red-card/);

  assert.match(realInner, /gc-real3d-scene/);
  assert.match(realInner, /gc-recenter-camera/);
  assert.match(realInner, /Canvas/);
  assert.match(table, /gc-yellow-card/);
  assert.match(table, /gc-red-card/);
  assert.match(table, /onUseYellow/);
  assert.match(table, /onUseRed/);
  assert.doesNotMatch(playing, /VS/);
  assert.doesNotMatch(playing, /CharacterFigure name=\{view\.self\.name\}/);
});

test('H reveal screen feeds revealed identity only after result', () => {
  const results = readPlugin('round-results-screen.tsx');
  assert.match(results, /GameplayScene/);
  assert.match(results, /mode="reveal"/);
  assert.match(results, /selfIdentity=\{selfReveal\?\.identity/);
  assert.match(results, /opponentIdentity=\{opponentReveal\?\.identity/);
  assert.match(results, /showSpecialCards=\{false\}/);
  assert.doesNotMatch(results, /secretIdentity/);
  assert.doesNotMatch(results, />\s*VS\s*</);
});

test('camera look limits + no pointer lock / locomotion', () => {
  const look = readPlugin('real3d/look-controls.tsx');
  assert.match(look, /YAW_LIMIT/);
  assert.match(look, /PITCH_LIMIT/);
  assert.match(look, /pointerdown/);
  assert.doesNotMatch(look, /requestPointerLock/);
  assert.doesNotMatch(look, /WASD|keydown|velocity/);
});

test('plugin registry does not eagerly import three', () => {
  const index = readPlugin('index.tsx');
  const gameScreen = readPlugin('game-screen.tsx');
  const gameplay = readPlugin('gameplay-scene.tsx');
  assert.doesNotMatch(index, /three|@react-three/);
  assert.doesNotMatch(gameScreen, /three|@react-three/);
  assert.doesNotMatch(gameplay, /from ['"]three['"]/);
  assert.doesNotMatch(gameplay, /from ['"]@react-three/);
});

test('I primary actions remain DOM outside canvas', () => {
  const playing = readPlugin('playing-screen.tsx');
  assert.match(playing, /gc-primary-actions/);
  assert.match(playing, /GameplayScene/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
