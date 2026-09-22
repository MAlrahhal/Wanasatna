import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const lobbyHeader = read('components/lobby/lobby-header.tsx');
const lobbyScreen = read('components/lobby/lobby-screen.tsx');
const experienceHeader = read('components/game-experience/game-experience-header.tsx');
const experienceShell = read('components/game-experience/game-experience-shell.tsx');
const results = read('plugins/bara-al-salafa/match-results-screen.tsx');
const button = read('components/feedback/feedback-button.tsx');
const dialog = read('components/feedback/feedback-dialog.tsx');
const api = read('lib/feedback/api.ts');
const admin = read('components/admin/admin-feedback-client.tsx');
const routes = read('lib/admin/routes.ts');

assert.match(lobbyHeader, /<FeedbackButton[\s\S]*source="LOBBY"/);
assert.match(lobbyScreen, /roomId=\{room\.id\}/);
assert.match(experienceHeader, /<FeedbackButton[\s\S]*source="GAMEPLAY"/);
assert.match(experienceShell, /<FeedbackButton source="GAMEPLAY" compact/);
assert.match(results, /<FinalResultsFeedbackCta/);
assert.match(results, /useGameExperienceShellActive/);

assert.match(dialog, /PUBLIC_EXTERNAL_LINKS\.discordInvite/);
assert.match(dialog, /انضم إلى <bdi dir="ltr">Discord<\/bdi>/);
assert.match(dialog, /اكتب ملاحظتك هنا\.\.\./);
assert.match(dialog, /pendingRef\.current/);
assert.match(dialog, /message\.trim\(\)/);
assert.match(dialog, /role="alert"/);
assert.match(dialog, /event\.key === 'Escape'/);
assert.match(dialog, /max-h-\[calc\(100dvh-1\.5rem\)\]/);
assert.match(button, /source="FINAL_RESULTS"/);
assert.match(button, /initialView="form"/);
assert.match(api, /\/api\/feedback/);

assert.match(routes, /feedback: '\/admin\/feedback'/);
assert.match(admin, /fetchAdminFeedback/);
assert.match(admin, /patchAdminFeedbackStatus/);
assert.match(admin, /deleteAdminFeedback/);
assert.match(admin, /<UiDialog/);
assert.match(admin, /FEEDBACK_STATUSES/);

const pluginIndex = read('plugins/index.ts');
for (const game of [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'timing-challenge',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
  'fast-answer',
]) {
  assert.match(pluginIndex, new RegExp(game));
}

console.log('feedback UI contracts passed');
