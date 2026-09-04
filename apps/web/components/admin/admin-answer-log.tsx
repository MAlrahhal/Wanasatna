'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AdminAnswerAttempt, AdminAnswerAttemptData, AnswerAttemptStatus } from '@wanasatna/shared';
import { ANSWER_ATTEMPT_STATUSES } from '@wanasatna/shared';
import { fetchAdminMatchAnswers } from '@/lib/admin/api';
import {
  ADMIN_ANSWER_REJECT_REASON_LABEL,
  ADMIN_ANSWER_STATUS_LABEL,
  ADMIN_COPY,
} from '@/lib/admin/copy';
import { adminGameTitle, formatAdminDateTime } from '@/lib/admin/format';

function truncateText(value: string, max = 48): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

function statusLabel(status: AnswerAttemptStatus): string {
  return ADMIN_ANSWER_STATUS_LABEL[status] ?? status;
}

function OutcomeBadge({ status }: { status: AnswerAttemptStatus }) {
  return (
    <span className="border-wanas-border bg-wanas-surface-soft inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-semibold">
      {statusLabel(status)}
    </span>
  );
}

function AttemptDetails({ attempt }: { attempt: AdminAnswerAttempt }) {
  return (
    <dl className="text-wanas-text-secondary mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <div>
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerRaw}</dt>
        <dd className="mt-1 break-words whitespace-pre-wrap">{attempt.rawAnswer || '—'}</dd>
      </div>
      <div>
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerNormalized}</dt>
        <dd className="mt-1 break-words whitespace-pre-wrap">{attempt.normalizedAnswer || '—'}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerPrompt}</dt>
        <dd className="mt-1 break-words whitespace-pre-wrap">{attempt.promptText || '—'}</dd>
      </div>
      <div>
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerRoundId}</dt>
        <dd className="mt-1 font-mono break-all">{attempt.roundId || '—'}</dd>
      </div>
      <div>
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerTurnId}</dt>
        <dd className="mt-1 font-mono break-all">{attempt.turnId || '—'}</dd>
      </div>
      <div>
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerPromptId}</dt>
        <dd className="mt-1 font-mono break-all">{attempt.promptId || '—'}</dd>
      </div>
      <div>
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerRejectReason}</dt>
        <dd className="mt-1">
          {attempt.rejectReason
            ? (ADMIN_ANSWER_REJECT_REASON_LABEL[attempt.rejectReason] ?? attempt.rejectReason)
            : '—'}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-wanas-text-muted">{ADMIN_COPY.answerTime}</dt>
        <dd className="mt-1">{formatAdminDateTime(attempt.submittedAt)}</dd>
      </div>
    </dl>
  );
}

export function AdminAnswerLogSection({
  matchId,
  gameId,
  startedAt,
}: {
  matchId: string;
  gameId: string;
  startedAt: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('answersPage') ?? '1') || 1);
  const status = searchParams.get('outcome') ?? '';
  const roundRaw = searchParams.get('round') ?? '';
  const roundIndex = Number(roundRaw);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<AdminAnswerAttemptData | null>(null);

  const replaceQuery = useCallback(
    (next: { answersPage?: number; outcome?: string; round?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextPage = next.answersPage ?? page;
      const nextOutcome = next.outcome ?? status;
      const nextRound = next.round ?? roundRaw;
      if (nextPage > 1) {
        params.set('answersPage', String(nextPage));
      } else {
        params.delete('answersPage');
      }
      if (nextOutcome) {
        params.set('outcome', nextOutcome);
      } else {
        params.delete('outcome');
      }
      if (nextRound) {
        params.set('round', nextRound);
      } else {
        params.delete('round');
      }
      const suffix = params.toString();
      router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    },
    [page, pathname, roundRaw, router, searchParams, status],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminMatchAnswers(matchId, {
        page,
        status: ANSWER_ATTEMPT_STATUSES.includes(status as AnswerAttemptStatus)
          ? status
          : undefined,
        roundIndex: Number.isInteger(roundIndex) && roundIndex > 0 ? roundIndex : undefined,
      });
      if (!result.ok) {
        setError(true);
        setData(null);
        return;
      }
      setData(result.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [matchId, page, roundIndex, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{ADMIN_COPY.answerLogTitle}</h2>
          <p className="text-wanas-text-muted mt-1 text-xs">
            {adminGameTitle(gameId)} · {formatAdminDateTime(startedAt)}
          </p>
          <p className="text-wanas-text-muted mt-1 font-mono text-[11px]">{matchId}</p>
        </div>
        <p className="text-wanas-text-muted text-xs tabular-nums">
          {ADMIN_COPY.answerLogCount}: {data?.total ?? '—'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="text-xs">
          <span className="text-wanas-text-muted mb-1 block">{ADMIN_COPY.answerOutcome}</span>
          <select
            className="border-wanas-border bg-wanas-surface h-9 rounded-xl border px-3 text-sm"
            value={status}
            onChange={(event) => {
              replaceQuery({ answersPage: 1, outcome: event.target.value, round: roundRaw });
            }}
          >
            <option value="">{ADMIN_COPY.answerAllOutcomes}</option>
            {ANSWER_ATTEMPT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-wanas-text-muted mb-1 block">{ADMIN_COPY.answerRoundFilter}</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={ADMIN_COPY.answerAllRounds}
            className="border-wanas-border bg-wanas-surface h-9 w-28 rounded-xl border px-3 text-sm"
            value={roundRaw}
            onChange={(event) => {
              replaceQuery({ answersPage: 1, outcome: status, round: event.target.value });
            }}
          />
        </label>
      </div>

      {loading && !data ? (
        <p className="text-wanas-text-muted mt-4 text-sm">{ADMIN_COPY.resolving}</p>
      ) : null}

      {error ? (
        <div className="border-wanas-error-border bg-wanas-error-surface mt-4 space-y-3 rounded-2xl border p-4">
          <p role="alert" className="text-wanas-error text-sm font-semibold">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="border-wanas-border bg-wanas-surface inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}

      {data && data.total === 0 ? (
        <p className="border-wanas-border bg-wanas-surface mt-4 rounded-2xl border px-4 py-6 text-sm">
          {!data.historyAvailable
            ? ADMIN_COPY.answerLogUnavailable
            : status || roundRaw
              ? ADMIN_COPY.answerLogFilteredEmpty
              : ADMIN_COPY.answerLogEmpty}
        </p>
      ) : null}

      {data && data.attempts.length > 0 ? (
        <>
          <div className="border-wanas-border mt-4 hidden overflow-x-auto rounded-2xl border md:block">
            <table className="w-full min-w-[920px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerTime}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerPlayer}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerPrompt}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerText}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerOutcome}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerCounted}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.answerPoints}</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-wanas-border border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatAdminDateTime(attempt.submittedAt)}
                    </td>
                    <td className="px-3 py-2 font-semibold">{attempt.playerDisplayName}</td>
                    <td className="px-3 py-2">{truncateText(attempt.promptText)}</td>
                    <td className="px-3 py-2">{truncateText(attempt.rawAnswer)}</td>
                    <td className="px-3 py-2">
                      <OutcomeBadge status={attempt.status} />
                    </td>
                    <td className="px-3 py-2">
                      {attempt.wasCounted ? ADMIN_COPY.answerYes : ADMIN_COPY.answerNo}
                    </td>
                    <td className="px-3 py-2">
                      <p className="tabular-nums">{attempt.pointsAwarded}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold">التفاصيل</summary>
                        <AttemptDetails attempt={attempt} />
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {data.attempts.map((attempt) => (
              <article
                key={attempt.id}
                className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{attempt.playerDisplayName}</p>
                  <OutcomeBadge status={attempt.status} />
                </div>
                <p className="mt-2 break-words">{truncateText(attempt.rawAnswer, 80)}</p>
                <p className="text-wanas-text-muted mt-2 text-xs">
                  {truncateText(attempt.promptText, 80)}
                </p>
                <p className="text-wanas-text-muted mt-2 text-xs">
                  {formatAdminDateTime(attempt.submittedAt)} ·{' '}
                  {attempt.wasCounted ? ADMIN_COPY.answerYes : ADMIN_COPY.answerNo} ·{' '}
                  {attempt.pointsAwarded}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold">التفاصيل</summary>
                  <AttemptDetails attempt={attempt} />
                </details>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => replaceQuery({ answersPage: page - 1 })}
                className="border-wanas-border inline-flex h-9 items-center rounded-xl border px-3 font-semibold disabled:opacity-40"
              >
                {ADMIN_COPY.previousPage}
              </button>
              <p className="text-wanas-text-muted tabular-nums">
                {ADMIN_COPY.pageLabel} {page} / {totalPages}
              </p>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => replaceQuery({ answersPage: page + 1 })}
                className="border-wanas-border inline-flex h-9 items-center rounded-xl border px-3 font-semibold disabled:opacity-40"
              >
                {ADMIN_COPY.nextPage}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
