/**
 * Owner visual revision: dedicated invite join + compact lobby config stack.
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

function firstIndex(source: string, snippet: string): number {
  const index = source.indexOf(snippet);
  assert.notEqual(index, -1, `missing ${snippet}`);
  return index;
}

test('?code= activates dedicated invite UI and reuses Join', () => {
  const home = read('app/(public)/home-page-client.tsx');
  const invite = read('components/public/invite-join-card.tsx');
  const cards = read('components/public/room-action-cards.tsx');
  const hook = read('lib/public/use-room-actions.ts');
  const layout = read('components/public/public-layout-client.tsx');

  assert.match(home, /if \(room\.inviteFromLink\)/);
  assert.match(home, /<InviteJoinCard/);
  assert.match(hook, /inviteFromLink:\s*urlInviteCode !== '' && joinCode === urlInviteCode/);
  assert.match(hook, /handleJoinRoom/);
  assert.match(home, /onJoinRoom=\{room\.handleJoinRoom\}/);

  const start = home.indexOf('if (room.inviteFromLink)');
  const firstReturn = home.indexOf('return (', start);
  const secondReturn = home.indexOf('return (', firstReturn + 1);
  const inviteBranch = home.slice(start, secondReturn);
  assert.match(inviteBranch, /InviteJoinCard/);
  assert.doesNotMatch(inviteBranch, /RoomActionCards/);
  assert.doesNotMatch(inviteBranch, /HomeActiveRoomResume/);
  assert.doesNotMatch(inviteBranch, /FeatureCard/);
  assert.doesNotMatch(inviteBranch, /GamePreviewCard/);

  assert.match(invite, /دخول الغرفة/);
  assert.match(invite, /لقد فتحت رابط دعوة للانضمام إلى غرفة\. أدخل اسمك للمتابعة\./);
  assert.match(invite, /id="join-name"/);
  assert.match(invite, /placeholder="اكتب اسمك"/);
  assert.match(invite, /id="join-code"/);
  assert.match(invite, /readOnly/);
  assert.match(invite, /dir="ltr"/);
  assert.match(invite, /تم تزويدك برمز الغرفة عبر رابط الدعوة\./);
  assert.match(invite, /onJoinRoom/);
  assert.doesNotMatch(invite, /إنشاء غرفة/);
  assert.doesNotMatch(invite, /onCreateRoom/);
  assert.doesNotMatch(invite, /onJoinCodeChange/);

  assert.doesNotMatch(cards, /inviteFromLink/);
  assert.match(cards, /إنشاء غرفة/);
  assert.match(layout, /inviteEntry \? null : <PublicFooter/);
});

test('normal Home without ?code= still has create/join and marketing', () => {
  const home = read('app/(public)/home-page-client.tsx');
  assert.match(home, /<RoomActionCards/);
  assert.match(home, /<HomeActiveRoomResume/);
  assert.match(home, /ألعاب مميزة/);
  assert.match(home, /ابدأ الوناسة بثلاث خطوات/);
});

test('join still requires name and existing session helpers are unchanged', () => {
  const hook = read('lib/public/use-room-actions.ts');
  const session = read('lib/room/session.ts');
  const header = read('components/lobby/lobby-header.tsx');

  assert.match(hook, /يرجى إدخال اسمك للانضمام/);
  assert.match(hook, /manager\.join\(trimmedCode, trimmedName\)/);
  assert.match(session, /buildRoomInvitePath/);
  assert.match(session, /`\/\?code=\$\{encodeURIComponent\(roomCode\)\}`/);
  assert.match(header, /buildRoomInviteUrl/);
  assert.match(header, /تم نسخ الرابط/);
  assert.doesNotMatch(header, /navigator\.share/);
});

test('lobby stack is Marathon → Category → Settings → Start', () => {
  const screen = read('components/lobby/lobby-screen.tsx');
  const grid = read('components/lobby/game-grid.tsx');
  const marathon = firstIndex(screen, '<LobbyMarathonBanner');
  const category = firstIndex(screen, '<RoundCategoryPanel');
  const settings = firstIndex(screen, '<GameSettingsPanel');
  const start = firstIndex(screen, '<LobbyStartGamePanel');
  const catalog = firstIndex(screen, '<GameGrid');

  assert.ok(catalog < marathon);
  assert.ok(marathon < category);
  assert.ok(category < settings);
  assert.ok(settings < start);
  assert.doesNotMatch(grid, /RoundCategoryPanel/);
  assert.doesNotMatch(grid, /LobbyMarathonBanner/);
});

test('category selection and compact layout are preserved', () => {
  const panel = read('components/lobby/round-category-panel.tsx');
  const categories = read('lib/game/round-categories/bara-al-salafa.ts');

  assert.match(panel, /onSelectCategory\(category\.id\)/);
  assert.match(panel, /grid grid-cols-2/);
  assert.match(panel, /bg-wanas-accent text-white/);
  assert.match(categories, /كرة قدم/);
  assert.match(categories, /سيارات/);
  assert.match(categories, /بلدان/);
  assert.match(categories, /أكلات/);
  assert.match(categories, /حيوانات/);
  assert.match(categories, /عشوائي/);
  assert.match(categories, /تقنيات/);
  assert.match(categories, /ألعاب/);
  assert.match(categories, /مسلسلات/);
  assert.match(categories, /أفلام/);
  assert.match(categories, /defaultCategoryId: 'random'/);
});

test('game settings and host start behavior are unchanged', () => {
  const settings = read('components/lobby/game-settings-panel.tsx');
  const draw = read('components/lobby/draw-guess-settings-panel.tsx');
  const guess = read('components/lobby/guessing-challenge-settings-panel.tsx');
  const timing = read('components/lobby/timing-challenge-settings-panel.tsx');
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  const marathon = read('components/lobby/lobby-marathon-banner.tsx');

  assert.match(settings, /DrawGuessSettingsPanel/);
  assert.match(settings, /GuessingChallengeSettingsPanel/);
  assert.match(settings, /TimingChallengeSettingsPanel/);
  assert.match(settings, /setDrawGuessDrawerMode/);
  assert.match(settings, /setGuessingChallengeMode/);
  assert.match(settings, /setTimingChallengeSettings/);
  assert.match(draw, /id: 'random'/);
  assert.match(draw, /id: 'fixed'/);
  assert.match(guess, /id: '1v1'/);
  assert.match(guess, /id: '2v2'/);
  assert.match(timing, /id: 'guess-time'/);
  assert.match(timing, /id: 'stop-timer'/);
  assert.match(start, /await startGame\(\)/);
  assert.match(start, /getGameStartPlayerRequirementReason/);
  assert.match(start, /بدء اللعبة/);
  assert.match(marathon, /ماراثون الألعاب/);
  assert.match(marathon, /قريباً/);
  assert.doesNotMatch(marathon, /startMarathon|onStartMarathon/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
