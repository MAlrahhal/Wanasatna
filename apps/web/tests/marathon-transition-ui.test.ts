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

console.log('PASS Marathon transition and final-result UI use automatic progression copy');
