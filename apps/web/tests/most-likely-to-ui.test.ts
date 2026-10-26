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

test('Arabic mobile voting UI shows question, progress, shared timer, and confirmed own selection', () => {
  const screen = read('plugins/most-likely-to/game-screen.tsx');
  const experience = read('lib/game/experimental-game-experience.ts');
  assert.match(screen, /مين أكثر واحد؟/);
  assert.match(screen, /السؤال \{view\.questionNumber\} \/ \{view\.totalQuestions\}/);
  assert.match(screen, /صوّت \{view\.submittedVoteCount\} من \{view\.eligibleVoterCount\}/);
  assert.match(experience, /view\.phase === 'voting' \? countdown\(view\.deadlineAtMs\)/);
  assert.match(screen, /grid-cols-2[\s\S]*sm:grid-cols-3[\s\S]*lg:grid-cols-4/);
  assert.match(screen, /min-h-32/);
  assert.match(screen, /aria-pressed=\{selected\}/);
  assert.match(screen, /اختيارك/);
  assert.match(screen, /جارٍ تثبيت اختيارك/);
});

test('client waits for server acknowledgment before replacing the visible selection', () => {
  const hook = read('plugins/most-likely-to/use-player-view.ts');
  const action = hook.slice(
    hook.indexOf('const action'),
    hook.indexOf('return {', hook.indexOf('const action')),
  );
  assert.match(action, /await emitPluginWithAck/);
  assert.match(action, /if \(response\.success\)[\s\S]*setView\(response\.data\.view\)/);
  assert.doesNotMatch(action, /setView\([\s\S]*await emitPluginWithAck/);
  assert.match(hook, /questionId: view\.questionId/);
  assert.match(hook, /nomineePlayerId/);
  assert.doesNotMatch(hook, /voterPlayerId|userId|isAdmin|premium/);
});

test('private voting copy and waiting/spectator states do not expose other choices', () => {
  const screen = read('plugins/most-likely-to/game-screen.tsx');
  assert.match(screen, /لن يظهر اختيارك للآخرين قبل الكشف/);
  assert.match(screen, /بانتظار السؤال التالي/);
  assert.match(screen, /ستدخل قائمة التصويت والترشيح في السؤال التالي/);
  assert.match(screen, /مشاهدة فقط/);
  const voting = screen.slice(
    screen.indexOf('function VotingPanel'),
    screen.indexOf('function RevealPanel'),
  );
  assert.doesNotMatch(voting, /voterNames|result\.votes|nominee\.voteCount/);
});

test('reveal covers named disclosures, positive ties, zero votes, and a controlled crown', () => {
  const screen = read('plugins/most-likely-to/game-screen.tsx');
  assert.match(screen, /لا توجد أصوات لهذا السؤال/);
  assert.match(screen, /topNomineePlayerIds\.includes/);
  assert.match(screen, /aria-label="من الأكثر ترشيحًا"/);
  assert.doesNotMatch(screen, /animate-bounce/);
  assert.match(screen, /صوّت له:/);
  assert.match(screen, /عرض كل اختيارات اللاعبين/);
  assert.match(screen, /\{vote\.voterName\} صوّت لـ \{vote\.nomineeName\}/);
  assert.match(screen, /السؤال التالي/);
  assert.match(screen, /بانتظار المضيف للسؤال التالي/);
});

test('final recap is lighthearted, includes all questions, and has no formal winner', () => {
  const screen = read('plugins/most-likely-to/game-screen.tsx');
  assert.match(screen, /خلاصة الأسئلة العشرة/);
  assert.match(screen, /view\.recap\.map/);
  assert.match(screen, /nominee\.voteCount/);
  assert.match(screen, /الأكثر ترشيحًا خلال الجلسة/);
  assert.match(screen, /لا توجد نقاط أو فائز رسمي/);
  assert.match(screen, /العودة إلى الغرفة/);
});

test('game remains private room metadata and absent from public discovery sources', () => {
  const privateMetadata = read('lib/games/experimental-room-game.ts');
  assert.match(privateMetadata, /MOST_LIKELY_TO_GAME_ID/);
  assert.match(privateMetadata, /مين أكثر واحد؟/);

  for (const path of [
    'lib/public/game-catalog.ts',
    'lib/lobby/mock-games.ts',
    'components/public/game-cards.tsx',
    'components/public/public-navbar.tsx',
    'components/home/home-navbar.tsx',
    'app/sitemap.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /most-likely-to|مين أكثر واحد/);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
