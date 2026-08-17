/**
 * Room Chat — send, history, privacy, rate limit, retention.
 * Run: pnpm --filter @wanasatna/server test:room-chat
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStatus } from '@prisma/client';
import type { Socket } from 'socket.io';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  consumeChatLimit,
  resetAbuseLimiterForTests,
  setAbuseLimiterNow,
} from '../src/lib/abuse-limiter.js';
import { deleteGameShell, initGameShell } from '../src/modules/game/game.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { loadRoomChatHistory, sendRoomChatMessage } from '../src/modules/room/services/room-chat.service.js';
import { deleteRoomWithRelations } from '../src/modules/room/services/room-cleanup.service.js';
import { validateSendRoomChatPayload } from '../src/modules/room/room.validators.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

function fakeSocket(id: string): Socket {
  return { id, handshake: { headers: {}, address: '127.0.0.1' } } as unknown as Socket;
}

async function mustCreate(playerName: string) {
  const result = await createRoom({ playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function mustJoin(roomCode: string, playerName: string) {
  const result = await joinRoom({ roomCode, playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function cleanupRoom(roomId: string): Promise<void> {
  deleteGameShell(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await deleteRoomWithRelations(roomId).catch(() => undefined);
}

async function main(): Promise<void> {
  await test('source: additive RoomMessage migration; no admin/gameplay/new dep', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /model RoomMessage \{/);
    assert.match(schema, /senderNameSnapshot\s+String/);
    assert.match(schema, /onDelete: Cascade/);
    assert.match(schema, /onDelete: SetNull/);
    assert.doesNotMatch(schema, /model ChatMessage \{/);
    assert.doesNotMatch(schema, /enum ChatMessageType/);

    const sql = read('prisma/migrations/20260817120000_add_room_message/migration.sql');
    assert.match(sql, /CREATE TABLE "RoomMessage"/);
    assert.match(sql, /RoomMessage_roomId_createdAt_idx/);
    assert.match(sql, /ON DELETE CASCADE/);
    assert.match(sql, /ON DELETE SET NULL/);
    assert.doesNotMatch(sql, /DROP TABLE|DROP TYPE|DROP COLUMN|DROP CONSTRAINT/);

    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
    assert.equal(pkg.dependencies?.['@prisma/client'], '^6.2.1');

    const handlers = read('src/modules/room/room-chat.socket.handlers.ts');
    assert.match(handlers, /ROOM_CHAT_SEND_EVENT/);
    assert.match(handlers, /ROOM_CHAT_MESSAGE_EVENT/);
    assert.match(handlers, /socket\.data/);
    assert.match(handlers, /consumeChatLimit/);
    assert.doesNotMatch(handlers, /authUser|preferredDisplayName|email/);
    assert.doesNotMatch(read('src/index.ts'), /admin/i);
    assert.doesNotMatch(handlers, /NOT_PARTICIPANT|submitGuess|canGuess/);
  });

  await test('empty, oversize, control/bidi rejected; Arabic/emoji/script text accepted', () => {
    assert.equal(validateSendRoomChatPayload({ content: '   ' }).success, false);
    assert.equal(validateSendRoomChatPayload({ content: '' }).success, false);
    assert.equal(validateSendRoomChatPayload({ content: 'ا'.repeat(301) }).success, false);
    assert.equal(validateSendRoomChatPayload({ content: 'مر\nحبا' }).success, false);
    assert.equal(validateSendRoomChatPayload({ content: 'hi\u202E' }).success, false);
    assert.equal(validateSendRoomChatPayload({ content: 'مرحبا' }).success, true);
    assert.equal(validateSendRoomChatPayload({ content: 'hello 👋' }).success, true);
    assert.equal(validateSendRoomChatPayload({ content: '<script>alert(1)</script>' }).success, true);
  });

  await test('player and spectator send; spoofed sender ignored', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    try {
      const init = await initGameShell(host.room.id, host.player.id, { gameId: 'bara-al-salafa' });
      assert.equal(init.success, true);
      const spectator = await mustJoin(host.room.code, uniqueName('متفرج'));
      assert.equal(spectator.player.isSpectator, true);

      const playerSend = await sendRoomChatMessage(host.room.id, host.player.id, {
        content: 'مرحبا',
        senderName: 'هاكر',
        playerId: 'spoof',
        userId: 'acct',
        role: 'ADMIN',
      });
      assert.equal(playerSend.success, true);
      if (playerSend.success) {
        assert.equal(playerSend.data.message.senderName, host.player.name);
        assert.equal(playerSend.data.message.content, 'مرحبا');
        assert.equal(playerSend.data.message.playerId, host.player.id);
        assert.equal('userId' in playerSend.data.message, false);
        assert.equal('email' in playerSend.data.message, false);
        assert.equal('role' in playerSend.data.message, false);
      }

      const specSend = await sendRoomChatMessage(host.room.id, spectator.player.id, {
        content: 'أشاهد',
      });
      assert.equal(specSend.success, true);
      if (specSend.success) {
        assert.equal(specSend.data.message.senderName, spectator.player.name);
      }

      const guestSend = await sendRoomChatMessage(host.room.id, guest.player.id, {
        content: '<script>alert(1)</script>',
      });
      assert.equal(guestSend.success, true);
      if (guestSend.success) {
        assert.equal(guestSend.data.message.content, '<script>alert(1)</script>');
      }
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('cross-room and LEFT send rejected', async () => {
    const roomA = await mustCreate(uniqueName('غرفةأ'));
    const roomB = await mustCreate(uniqueName('غرفةب'));
    try {
      const cross = await sendRoomChatMessage(roomB.room.id, roomA.player.id, { content: 'cross' });
      assert.equal(cross.success, false);

      await prisma.player.update({
        where: { id: roomA.player.id },
        data: { status: PlayerStatus.LEFT },
      });
      const left = await sendRoomChatMessage(roomA.room.id, roomA.player.id, { content: 'بعد المغادرة' });
      assert.equal(left.success, false);
    } finally {
      await cleanupRoom(roomA.room.id);
      await cleanupRoom(roomB.room.id);
    }
  });

  await test('history keeps latest 50 oldest-to-newest; refresh retains', async () => {
    const host = await mustCreate(uniqueName('أرشيف'));
    try {
      for (let index = 0; index < 51; index += 1) {
        const sent = await sendRoomChatMessage(host.room.id, host.player.id, {
          content: `م${index}`,
        });
        assert.equal(sent.success, true);
      }

      const first = await loadRoomChatHistory(host.room.id, host.player.id);
      assert.equal(first.success, true);
      if (first.success) {
        assert.equal(first.data.messages.length, 50);
        assert.equal(first.data.messages[0]?.content, 'م1');
        assert.equal(first.data.messages[49]?.content, 'م50');
      }

      const second = await loadRoomChatHistory(host.room.id, host.player.id);
      assert.equal(second.success, true);
      if (first.success && second.success) {
        assert.deepEqual(
          second.data.messages.map((row) => row.id),
          first.data.messages.map((row) => row.id),
        );
      }
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('player delete keeps snapshot; room delete removes messages', async () => {
    const host = await mustCreate(uniqueName('حذف'));
    const guest = await mustJoin(host.room.code, uniqueName('زائر'));
    try {
      const sent = await sendRoomChatMessage(host.room.id, guest.player.id, { content: 'باقية' });
      assert.equal(sent.success, true);
      const messageId = sent.success ? sent.data.message.id : '';

      await prisma.player.delete({ where: { id: guest.player.id } });
      const kept = await prisma.roomMessage.findUnique({ where: { id: messageId } });
      assert.ok(kept);
      assert.equal(kept?.content, 'باقية');
      assert.equal(kept?.senderNameSnapshot, guest.player.name);
      assert.equal(kept?.playerId, null);

      await deleteRoomWithRelations(host.room.id);
      const gone = await prisma.roomMessage.findUnique({ where: { id: messageId } });
      assert.equal(gone, null);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('rate limit burst 5 then refill ~1 / 2s; DB catch does not throw', () => {
    resetAbuseLimiterForTests();
    let now = 8_000_000;
    setAbuseLimiterNow(() => now);
    const socket = fakeSocket('chat-a');
    for (let index = 0; index < 5; index += 1) {
      assert.equal(consumeChatLimit(socket), true);
    }
    assert.equal(consumeChatLimit(socket), false);
    now += 2000;
    assert.equal(consumeChatLimit(socket), true);

    const service = read('src/modules/room/services/room-chat.service.ts');
    assert.match(service, /catch \{/);
    assert.match(service, /INTERNAL_ERROR/);
    assert.doesNotMatch(service, /socket\.disconnect/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
