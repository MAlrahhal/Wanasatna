import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');
const games = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'timing-challenge',
  'fast-answer',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
] as const;

const shell = read('components/game-experience/game-experience-shell.tsx');
const pluginLayer = read('components/game-plugins/game-plugin-layer.tsx');
assert.match(pluginLayer, /<GameExperienceShell>\{pluginContent\}<\/GameExperienceShell>/);
for (const game of games) {
  assert.match(read(`plugins/${game}/game-screen.tsx`), /useSetGameExperienceMeta/, game);
}
assert.equal(shell.match(/data-game-primary-content/g)?.length, 1);
assert.equal(shell.match(/\{children\}/g)?.length, 2);
assert.match(shell, /meta\.layoutMode === 'gameplay'/);
assert.match(shell, /xl:grid-cols-\[minmax\(240px,280px\)_minmax\(0,1fr\)_160px\]/);
assert.equal(shell.match(/placement="gameplay-side-rail"/g)?.length, 1);
assert.doesNotMatch(shell, /placement="game-(?:chat|leaderboard)"/);
assert.match(
  shell,
  /data-game-support-section="leaderboard"[\s\S]*<GameLeaderboardPanel[\s\S]*placement="gameplay-side-rail"/,
);
assert.ok(
  shell.indexOf('<GameLeaderboardPanel') < shell.indexOf('placement="gameplay-side-rail"'),
  'the desktop side rail keeps the leaderboard above the vertical ad',
);

for (const game of games) {
  const results = read(`plugins/${game}/round-results-screen.tsx`);
  assert.equal(results.match(/unit="results-native"/g)?.length, 1, game);
  assert.ok(
    results.indexOf('unit="results-native"') > results.lastIndexOf('</GameCard>'),
    `${game}: Results Native must follow the complete score card`,
  );
  assert.doesNotMatch(
    results,
    /<AdPlacement|components\/ads\/ad-placement|300x250|round-results-(?:center|mobile)/,
    game,
  );
}

const finalResults = read('plugins/bara-al-salafa/match-results-screen.tsx');
assert.match(finalResults, /<FinalLeaderboard[\s\S]*unit="results-native"[\s\S]*<MatchStats/);
assert.equal(finalResults.match(/unit="results-native"/g)?.length, 1);
assert.doesNotMatch(
  finalResults,
  /<AdPlacement|components\/ads\/ad-placement|300x250|final-results-(?:center|mobile)/,
);

const primaryOwners = [
  'plugins/bara-al-salafa/free-questions-screen.tsx',
  'plugins/bara-al-salafa/voting-screen.tsx',
  'plugins/draw-guess/drawing-screen.tsx',
  'plugins/imposter-draw/drawing-turns-screen.tsx',
  'plugins/timing-challenge/guess-screen.tsx',
  'plugins/timing-challenge/stop-timer-screen.tsx',
  'plugins/guessing-challenge/playing-screen.tsx',
  'plugins/fast-answer/question-screen.tsx',
  'plugins/who-wrote-it/answering-screen.tsx',
  'plugins/judge/answering-screen.tsx',
];
for (const file of primaryOwners) {
  const source = read(file);
  assert.equal(source.match(/placement="gameplay-primary"/g)?.length, 1, file);
  assert.doesNotMatch(source, /placement="game-(?:player-list|answer-input|interaction)"/, file);
}
assert.doesNotMatch(read('plugins/timing-challenge/peer-status-list.tsx'), /AdPlacement/);

const fastAnswer = read('plugins/fast-answer/question-screen.tsx');
assert.ok(fastAnswer.indexOf('placement="gameplay-primary"') > fastAnswer.indexOf('</form>'));
assert.ok(
  fastAnswer.indexOf('data-fast-answer-post-interaction-status') >
    fastAnswer.indexOf('placement="gameplay-primary"'),
);
const voting = read('plugins/bara-al-salafa/voting-screen.tsx');
assert.ok(
  voting.lastIndexOf('placement="gameplay-primary"') > voting.lastIndexOf('onConfirmVote'),
  'the voting ad follows the complete voting interaction',
);

const allAdSources = [
  shell,
  ...games.map((game) => read(`plugins/${game}/round-results-screen.tsx`)),
  ...primaryOwners.map(read),
].join('\n');
assert.doesNotMatch(
  allAdSources,
  /ADSTERRA_BANNER_300x250|placement="(?:round-results|final-results)-/,
);

console.log('Cross-game Adsterra placement contract passed');
