import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(
  path.join(root, 'app/(room)/marathon/marathon-page-client.tsx'),
  'utf8',
);

assert.doesNotMatch(source, /ابدأ الآن/);
assert.doesNotMatch(source, />العودة إلى اللوبي<\/Button>/);
assert.match(source, /اللعبة التالية:/);
assert.match(source, /<GameIdentity gameId=\{next\.gameId\}/);
assert.match(source, /تبدأ تلقائيًا/);
assert.match(source, /العودة إلى اللوبي.*خلال \{remaining\} ثوانٍ/);
assert.match(source, /role="progressbar"/);
assert.match(source, /جارٍ تجهيز اللعبة التالية تلقائيًا/);
assert.doesNotMatch(source, /continueNow|returnToLobby/);
assert.match(source, /disabled=\{unavailable\}/);
assert.match(source, /selected\.length >= MARATHON_MAX_GAMES/);
assert.match(source, /اختر لعبتين على الأقل للبدء/);
assert.match(source, /وصلت إلى الحد الأقصى: 7 ألعاب/);

assert.match(source, /if \(!isHost\)/);
assert.match(source, /المضيف يجهّز ماراثون الألعاب الآن/);
assert.match(source, /setConfigurations\(\(current\) => \(\{ \.\.\.current, \[gameId\]/);
assert.match(source, /const next = \[\.\.\.current\]/);
assert.match(source, /lastTransition/);
assert.match(source, /تم إنهاء لعبة/);
assert.match(source, /تم تخطي لعبة/);
assert.match(source, /اكتملت لعبة/);
assert.match(source, /اللعبة القادمة:/);
assert.match(source, /endMarathon/);

const managementSource = readFileSync(
  path.join(root, 'components/game-experience/game-room-management-dialog.tsx'),
  'utf8',
);
assert.match(managementSource, /confirmAction === 'end-marathon'/);
assert.match(managementSource, /إنهاء الماراثون/);
assert.match(managementSource, /متابعة الماراثون إلى اللعبة التالية/);

console.log('PASS Marathon setup limits, host privacy, controls, and transition UI contract');
