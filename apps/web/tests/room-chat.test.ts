/**
 * Room Chat UI contracts: plain-text render, no account leak, handler-specific off.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('XSS content is text; no HTML renderer', () => {
  const panel = read('components/room/room-chat-panel.tsx');
  assert.match(panel, /\{message\.content\}/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(panel, /innerHTML/);
  assert.match(panel, /whitespace-pre-wrap/);
});

test('chat identity is Player.name; no account fields', () => {
  const panel = read('components/room/room-chat-panel.tsx');
  const ctx = read('contexts/room-chat-context.tsx');
  assert.match(panel, /message\.senderName/);
  assert.doesNotMatch(panel, /email|preferredDisplayName|userId/);
  assert.doesNotMatch(panel, /user\.role|authUser/);
  assert.doesNotMatch(ctx, /email|preferredDisplayName|authUser/);
  assert.match(ctx, /ROOM_CHAT_SEND_EVENT/);
  assert.match(ctx, /content/);
  assert.doesNotMatch(ctx, /senderName:/);
});

test('socket listener cleanup is handler-specific', () => {
  const ctx = read('contexts/room-chat-context.tsx');
  assert.match(ctx, /socket\.on\(ROOM_CHAT_MESSAGE_EVENT, onMessage\)/);
  assert.match(ctx, /socket\.off\(ROOM_CHAT_MESSAGE_EVENT, onMessage\)/);
  assert.doesNotMatch(ctx, /socket\.off\(\s*ROOM_CHAT_MESSAGE_EVENT\s*\)/);
});

test('chat does not grant gameplay actions', () => {
  const panel = read('components/room/room-chat-panel.tsx');
  assert.doesNotMatch(panel, /submitGuess|canGuess|emitPlugin/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
