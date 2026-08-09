/**
 * Focused web checks for Guessing Challenge catalog + privacy UI helpers.
 */
import assert from 'node:assert/strict';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { getHomeGameShowcase } from '@/lib/home/game-showcase';
import { getGameRoundCategories } from '@/lib/game/round-categories/registry';

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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
