import assert from 'node:assert/strict';
import { getDefaultPlayerAvatarId, isPlayerAvatarId, PLAYER_AVATAR_IDS } from '@wanasatna/shared';
import {
  clearPlayerAvatarId,
  clearRoomPlayerAvatars,
  getPlayerAvatarId,
  setPlayerAvatarId,
} from '../src/modules/room/player-avatar.store.js';
import { mapPlayerData } from '../src/modules/room/room.utils.js';
import { validateUpdatePlayerAvatarPayload } from '../src/modules/room/room.validators.js';

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

run('catalog contains exactly 24 valid unique avatar ids', () => {
  assert.equal(PLAYER_AVATAR_IDS.length, 24);
  assert.equal(new Set(PLAYER_AVATAR_IDS).size, 24);
  assert.equal(PLAYER_AVATAR_IDS[0], 'avatar-01');
  assert.equal(PLAYER_AVATAR_IDS[23], 'avatar-24');
  assert.ok(PLAYER_AVATAR_IDS.every(isPlayerAvatarId));
});

run('automatic assignment is deterministic and valid', () => {
  const first = getDefaultPlayerAvatarId('player-stable-id');
  assert.equal(getDefaultPlayerAvatarId('player-stable-id'), first);
  assert.ok(isPlayerAvatarId(first));
});

run('a selected avatar remains attached to the player until removal', () => {
  const playerId = 'player-reconnect';
  setPlayerAvatarId(playerId, 'room-a', 'avatar-24');
  assert.equal(getPlayerAvatarId(playerId), 'avatar-24');
  assert.equal(getPlayerAvatarId(playerId), 'avatar-24');

  clearPlayerAvatarId(playerId);
  assert.equal(getPlayerAvatarId(playerId), getDefaultPlayerAvatarId(playerId));
});

run('room snapshots expose the selected avatar to every client', () => {
  const playerId = 'player-snapshot';
  setPlayerAvatarId(playerId, 'room-a', 'avatar-17');
  const player = {
    id: playerId,
    name: 'لاعب',
    status: 'CONNECTED',
    isSpectator: false,
  } as Parameters<typeof mapPlayerData>[0];

  assert.equal(mapPlayerData(player, playerId).avatarId, 'avatar-17');
  clearPlayerAvatarId(playerId);
});

run('room cleanup removes only selections belonging to that room', () => {
  setPlayerAvatarId('player-a', 'room-a', 'avatar-03');
  setPlayerAvatarId('player-b', 'room-b', 'avatar-03');
  clearRoomPlayerAvatars('room-a');

  assert.equal(getPlayerAvatarId('player-a'), getDefaultPlayerAvatarId('player-a'));
  assert.equal(getPlayerAvatarId('player-b'), 'avatar-03');
  clearPlayerAvatarId('player-b');
});

run('avatar update validation accepts catalog ids and rejects arbitrary values', () => {
  assert.equal(validateUpdatePlayerAvatarPayload({ avatarId: 'avatar-12' }).success, true);
  assert.equal(validateUpdatePlayerAvatarPayload({ avatarId: 'avatar-25' }).success, false);
  assert.equal(validateUpdatePlayerAvatarPayload({ avatarId: '../secret' }).success, false);
});
