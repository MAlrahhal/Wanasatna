import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

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

assert.match(shell, /<GameChatMockPanel[\s\S]*data-game-ad-association="chat"/);
assert.match(shell, /data-game-ad-association="chat"[\s\S]*placement="game-chat"/);
assert.match(
  shell,
  /data-game-support-section="leaderboard"[\s\S]*<GameLeaderboardPanel[\s\S]*placement="game-leaderboard"/,
);
assert.equal(shell.match(/placement="game-chat"/g)?.length, 1);
assert.equal(shell.match(/placement="game-leaderboard"/g)?.length, 1);

for (const game of games) {
  const results = read(`plugins/${game}/round-results-screen.tsx`);
  assert.equal(results.match(/placement="game-round-results"/g)?.length, 1, game);
  assert.ok(
    results.indexOf('placement="game-round-results"') > results.lastIndexOf('</GameCard>'),
    `${game}: round-results ad must follow the complete score card`,
  );
  assert.doesNotMatch(results, /AdPlaceholder|round-results-(?:center|mobile)/, game);
}

const finalResults = read('plugins/bara-al-salafa/match-results-screen.tsx');
assert.match(
  finalResults,
  /<FinalLeaderboard[\s\S]*placement="game-final-results"[\s\S]*<MatchStats/,
);
assert.equal(finalResults.match(/placement="game-final-results"/g)?.length, 1);
assert.doesNotMatch(finalResults, /AdPlaceholder|final-results-(?:center|mobile)/);

const playerListOwners = [
  'plugins/bara-al-salafa/free-questions-screen.tsx',
  'plugins/bara-al-salafa/voting-screen.tsx',
  'plugins/timing-challenge/peer-status-list.tsx',
];
for (const file of playerListOwners) {
  const source = read(file);
  assert.match(
    source,
    /(?:players|peers|votablePlayers)\.map[\s\S]*placement="game-player-list"/,
    file,
  );
  assert.equal(source.match(/placement="game-player-list"/g)?.length, 1, file);
}

const interactionOwners = [
  'plugins/draw-guess/drawing-screen.tsx',
  'plugins/imposter-draw/drawing-turns-screen.tsx',
  'plugins/timing-challenge/guess-screen.tsx',
  'plugins/timing-challenge/stop-timer-screen.tsx',
  'plugins/guessing-challenge/playing-screen.tsx',
];
for (const file of interactionOwners) {
  const source = read(file);
  assert.match(source, /placement="game-interaction"/, file);
  assert.equal(source.match(/placement="game-interaction"/g)?.length, 1, file);
}

for (const file of [
  'plugins/fast-answer/question-screen.tsx',
  'plugins/who-wrote-it/answering-screen.tsx',
  'plugins/judge/answering-screen.tsx',
]) {
  const source = read(file);
  assert.match(source, /<form[\s\S]*<\/form>[\s\S]*placement="game-answer-input"/, file);
  assert.equal(source.match(/placement="game-answer-input"/g)?.length, 1, file);
  assert.doesNotMatch(source, /placement="game-(?:chat|leaderboard)"/, file);
}

const fastAnswer = read('plugins/fast-answer/question-screen.tsx');
assert.ok(
  fastAnswer.indexOf('placement="game-answer-input"') > fastAnswer.indexOf('</form>'),
  'Fast Answer interaction ad must follow its answer form',
);
assert.ok(
  fastAnswer.indexOf('data-fast-answer-post-interaction-status') >
    fastAnswer.indexOf('placement="game-answer-input"'),
  'Fast Answer must keep game content between its interaction ad and shared support ads',
);

const drawGuessResults = read('plugins/draw-guess/round-results-screen.tsx');
assert.match(drawGuessResults, /placement="game-round-results"/);

const config = read('lib/ads/adsterra.ts');
for (const placement of [
  'game-chat',
  'game-player-list',
  'game-leaderboard',
  'game-answer-input',
  'game-interaction',
  'game-round-results',
  'game-final-results',
]) {
  assert.match(config, new RegExp(`'${placement}': \\{ enabled: true \\}`), placement);
}

const productionAdComponents = [
  read('components/ads/ad-placement.tsx'),
  read('components/ads/adsterra-banner.tsx'),
].join('\n');
assert.doesNotMatch(productionAdComponents, /fixed|sticky|absolute|z-/);
assert.doesNotMatch(
  [shell, ...games.map((game) => read(`plugins/${game}/round-results-screen.tsx`))].join('\n'),
  /ADSTERRA_BANNER_300x250|placement="(?:round-results|final-results)-(?:center|mobile)"/,
);

console.log('Cross-game Adsterra placement contract passed');
