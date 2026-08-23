import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAYER_AVATAR_IDS } from '@wanasatna/shared';
import { getPlayerAvatarSrc, playerAvatarCatalog } from '../lib/avatars/catalog';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run('all 24 catalog entries resolve to public PNG assets', () => {
  assert.equal(playerAvatarCatalog.length, 24);
  assert.deepEqual(
    playerAvatarCatalog.map(({ id }) => id),
    [...PLAYER_AVATAR_IDS],
  );

  for (const avatarId of PLAYER_AVATAR_IDS) {
    const source = getPlayerAvatarSrc(avatarId);
    assert.equal(source, `/avatars/${avatarId}.png`);
    assert.ok(existsSync(resolve(process.cwd(), 'public', source.slice(1))), source);
  }
});

run('lobby picker exposes all avatars as accessible selectable buttons', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'components/lobby/avatar-picker-dialog.tsx'),
    'utf8',
  );
  assert.match(source, /playerAvatarCatalog\.map/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /grid-cols-4/);
  assert.match(source, /sm:grid-cols-6/);
});

run('player card uses the shared image avatar and no initial-letter fallback', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/lobby/player-card.tsx'), 'utf8');
  assert.match(source, /<PlayerAvatar/);
  assert.doesNotMatch(source, /charAt\(0\)|slice\(0,\s*1\)/);
});
