/**
 * P5-C system-state / error / reconnect / dialog contract tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SYSTEM_COPY,
  copyLinkFailedMessage,
  presentRoomActionError,
  toSafeUserErrorMessage,
} from '../lib/ui/system-copy';

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

test('error mapping: missing, full, locked, kicked, generic fallback', () => {
  const errors = read('lib/room/error-messages.ts');
  assert.match(errors, /ROOM_NOT_FOUND:\s*SYSTEM_COPY\.roomMissing/);
  assert.match(errors, /ROOM_FULL:\s*SYSTEM_COPY\.roomFull/);
  assert.match(errors, /ROOM_LOCKED:\s*SYSTEM_COPY\.roomLocked/);
  assert.match(errors, /INTERNAL_ERROR:\s*SYSTEM_COPY\.unexpectedError/);
  assert.doesNotMatch(errors, /Game Shell|socket hang|Prisma/);

  assert.equal(presentRoomActionError(SYSTEM_COPY.roomMissing).title, SYSTEM_COPY.roomMissing);
  assert.equal(presentRoomActionError(SYSTEM_COPY.roomFull).title, SYSTEM_COPY.roomFull);
  assert.equal(presentRoomActionError(SYSTEM_COPY.roomFull).description, SYSTEM_COPY.roomFullHelper);
  assert.equal(presentRoomActionError(SYSTEM_COPY.roomLocked).title, SYSTEM_COPY.roomLocked);
  assert.equal(presentRoomActionError(SYSTEM_COPY.kickedTitle).title, SYSTEM_COPY.kickedTitle);
  assert.equal(presentRoomActionError(SYSTEM_COPY.kickedTitle).description, SYSTEM_COPY.kickedHelper);
  assert.equal(presentRoomActionError('PrismaClientKnownRequestError').title, SYSTEM_COPY.genericError);
  assert.equal(presentRoomActionError('PrismaClientKnownRequestError').description, SYSTEM_COPY.unexpectedError);
  assert.equal(toSafeUserErrorMessage('INTERNAL_ERROR'), SYSTEM_COPY.unexpectedError);
  assert.equal(toSafeUserErrorMessage('socket hang up'), SYSTEM_COPY.unexpectedError);
  assert.equal(toSafeUserErrorMessage('websocket error'), SYSTEM_COPY.unexpectedError);
});

test('invite/home join errors map cleanly and ?code= flow is intact', () => {
  const home = read('app/(public)/home-page-client.tsx');
  const invite = read('components/public/invite-join-card.tsx');
  const hook = read('lib/public/use-room-actions.ts');

  assert.match(home, /presentRoomActionError/);
  assert.match(home, /if \(room\.inviteFromLink\)/);
  assert.match(home, /<InviteJoinCard/);
  assert.match(invite, /presentRoomActionError/);
  assert.match(invite, /id="join-code"/);
  assert.match(invite, /readOnly/);
  assert.match(hook, /inviteFromLink:\s*urlInviteCode !== '' && joinCode === urlInviteCode/);
  assert.match(hook, /manager\.enterFromJoinForm\(trimmedCode, trimmedName\)/);
  assert.doesNotMatch(home, /تعذر إكمال العملية/);
  assert.doesNotMatch(invite, /تعذر إكمال العملية/);
});

test('lobby connecting, reconnect, terminal failure, kick/leave', () => {
  const screen = read('components/lobby/lobby-screen.tsx');
  const header = read('components/lobby/lobby-header.tsx');
  const state = read('components/room/room-system-state.tsx');
  const panel = read('components/lobby/players-panel.tsx');

  assert.match(screen, /kind="connecting"/);
  assert.match(read('app/(room)/layout.tsx'), /SYSTEM_COPY\.connecting/);
  assert.match(screen, /kind="reconnecting"/);
  assert.match(screen, /kind="kicked"/);
  assert.match(screen, /SYSTEM_COPY\.reconnecting/);
  assert.match(screen, /SYSTEM_COPY\.recovered/);
  assert.match(screen, /onRetry=\{\(\) => window\.location\.reload\(\)\}/);
  assert.match(state, /SYSTEM_COPY\.kickedTitle/);
  assert.match(state, /SYSTEM_COPY\.kickedHelper/);
  assert.match(state, /SYSTEM_COPY\.backHome/);
  assert.match(state, /SYSTEM_COPY\.retry/);
  assert.match(header, /SYSTEM_COPY\.leaveConfirmTitle/);
  assert.match(header, /SYSTEM_COPY\.leaveConfirmBody/);
  assert.match(panel, /طرد اللاعب؟/);
  assert.match(panel, /UiDialog/);
});

test('game loading, spectator, experience-meta, no Game Shell or finishing copy', () => {
  const page = read('app/(room)/game/game-page-client.tsx');
  const layer = read('components/game-plugins/game-plugin-layer.tsx');
  const guessing = read('plugins/guessing-challenge/game-screen.tsx');
  const plugins = [
    'plugins/bara-al-salafa/game-screen.tsx',
    'plugins/draw-guess/game-screen.tsx',
    'plugins/fast-answer/game-screen.tsx',
    'plugins/timing-challenge/game-screen.tsx',
    'plugins/imposter-draw/game-screen.tsx',
    'plugins/who-wrote-it/game-screen.tsx',
    'plugins/judge/game-screen.tsx',
    'plugins/guessing-challenge/game-screen.tsx',
  ].map(read).join('\n');

  assert.match(page, /SYSTEM_COPY\.loading/);
  assert.match(page, /kind="kicked"/);
  assert.match(layer, /SYSTEM_COPY\.loading/);
  assert.match(guessing, /useEffect\(\(\) => \(\) => setExperienceMeta\(null\), \[setExperienceMeta\]\)/);
  assert.match(plugins, /GameSystemLoading/);
  assert.match(plugins, /SpectatorNotice|SYSTEM_COPY\.spectator/);
  assert.doesNotMatch(page, /Game Shell/);
  assert.doesNotMatch(layer, /Game Shell/);
  assert.doesNotMatch(plugins, /جاري إنهاء المباراة/);
  assert.doesNotMatch(plugins, /جاري تحميل اللعبة/);
  assert.doesNotMatch(plugins, /الجولة جارية 👀/);
});

test('lobby and in-game share copy invite URL without navigator.share', () => {
  const header = read('components/lobby/lobby-header.tsx');
  const dialog = read('components/game-experience/game-room-management-dialog.tsx');
  const session = read('lib/room/session.ts');

  assert.match(session, /buildRoomInviteUrl/);
  assert.match(session, /`\/\?code=\$\{encodeURIComponent\(roomCode\)\}`/);
  assert.match(header, /buildRoomInviteUrl/);
  assert.match(header, /SYSTEM_COPY\.copiedLink/);
  assert.match(dialog, /buildRoomInviteUrl/);
  assert.match(dialog, /SYSTEM_COPY\.copiedLink/);
  assert.doesNotMatch(header, /navigator\.share/);
  assert.doesNotMatch(dialog, /navigator\.share/);
  assert.doesNotMatch(dialog, /buildLobbyUrl/);
  assert.match(copyLinkFailedMessage('https://example.com/?code=123456'), /انسخه يدوياً/);
});

test('navigation guard uses shared leave copy', () => {
  const guard = read('components/room/room-navigation-guard-dialog.tsx');
  const context = read('contexts/room-navigation-guard-context.tsx');
  assert.match(guard, /SYSTEM_COPY\.leaveConfirmTitle/);
  assert.match(guard, /SYSTEM_COPY\.leaveConfirmBody/);
  assert.match(guard, /UiDialog/);
  assert.match(context, /status === 'reconnecting'/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
