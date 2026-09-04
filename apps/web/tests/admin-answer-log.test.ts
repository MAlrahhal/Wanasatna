/**
 * Admin Answer Log UI contracts on Match History detail.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ANSWER_ATTEMPT_PAGE_SIZE } from '@wanasatna/shared';
import {
  ADMIN_ANSWER_STATUS_LABEL,
  ADMIN_COPY,
} from '../lib/admin/copy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

test('answer log lives on match detail and is linked from room history', () => {
  const matchDetail = read('components/admin/admin-match-detail-client.tsx');
  const roomDetail = read('components/admin/admin-room-history-detail-client.tsx');
  const log = read('components/admin/admin-answer-log.tsx');
  assert.match(matchDetail, /AdminAnswerLogSection/);
  assert.match(matchDetail, /gameId=\{match\.gameId\}/);
  assert.match(roomDetail, /ADMIN_COPY\.answerLogCount/);
  assert.match(roomDetail, /match\.answerAttemptCount/);
  assert.doesNotMatch(roomDetail, /fetchAdminMatchAnswers/);
  assert.match(log, /fetchAdminMatchAnswers/);
  assert.equal(ADMIN_COPY.answerLogTitle, 'سجل الإجابات');
});

test('desktop table, mobile cards, filters, pagination, and expansion', () => {
  const log = read('components/admin/admin-answer-log.tsx');
  assert.match(log, /hidden overflow-x-auto[\s\S]*md:block/);
  assert.match(log, /md:hidden/);
  assert.match(log, /ADMIN_COPY\.answerTime/);
  assert.match(log, /ADMIN_COPY\.answerPlayer/);
  assert.match(log, /ADMIN_COPY\.answerPrompt/);
  assert.match(log, /ADMIN_COPY\.answerText/);
  assert.match(log, /ADMIN_COPY\.answerOutcome/);
  assert.match(log, /ADMIN_COPY\.answerCounted/);
  assert.match(log, /ADMIN_COPY\.answerPoints/);
  assert.match(log, /answersPage/);
  assert.match(log, /outcome/);
  assert.match(log, /round/);
  assert.match(log, /<details/);
  assert.match(log, /truncateText/);
  assert.equal(ADMIN_ANSWER_ATTEMPT_PAGE_SIZE, 50);
});

test('status labels, empty vs unavailable copy, and safe text rendering', () => {
  const log = read('components/admin/admin-answer-log.tsx');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.CORRECT_COUNTED, 'صحيحة — احتُسبت');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.CORRECT_NOT_COUNTED, 'صحيحة — لم تُحتسب');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.WRONG_COUNTED, 'خاطئة');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.WRONG_NOT_COUNTED, 'خاطئة');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.REJECTED, 'مرفوضة');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.LATE, 'متأخرة');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.OUT_OF_TURN, 'خارج الدور');
  assert.equal(ADMIN_ANSWER_STATUS_LABEL.DUPLICATE, 'مكررة');
  assert.equal(
    ADMIN_COPY.answerLogUnavailable,
    'لا توجد سجلات إجابات لهذه المباراة — السجل غير متوفر لهذه الفترة.',
  );
  assert.equal(ADMIN_COPY.answerLogEmpty, 'لم تُسجَّل أي إجابات في هذه المباراة.');
  assert.match(log, /answerLogUnavailable/);
  assert.match(log, /answerLogEmpty/);
  assert.match(log, /ADMIN_COPY\.retry/);
  assert.doesNotMatch(log, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(log, /innerHTML/);
});

test('admin API client paginates answers without secret fields', () => {
  const api = read('lib/admin/api.ts');
  assert.match(api, /fetchAdminMatchAnswers/);
  assert.match(api, /\/history\/\$\{encodeURIComponent\(matchId\)\}\/answers/);
  assert.match(api, /historyAvailable/);
  assert.doesNotMatch(api, /livePlayerId/);
  assert.doesNotMatch(api, /passwordHash|tokenHash|socketId|ipAddress/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
