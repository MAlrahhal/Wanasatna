'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ADMIN_DASHBOARD_GAME_IDS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SOURCES,
  FEEDBACK_STATUSES,
  type AdminFeedbackData,
  type AdminFeedbackItem,
  type FeedbackStatus,
} from '@wanasatna/shared';
import { UiDialog } from '@/components/ui/dialog';
import { deleteAdminFeedback, fetchAdminFeedback, patchAdminFeedbackStatus } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_GAME_TITLES } from '@/lib/admin/copy';
import { formatAdminDateTime } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS = {
  SUGGESTION: 'اقتراح',
  PROBLEM: 'مشكلة',
  OTHER: 'أخرى',
} as const;

const STATUS_LABELS = {
  NEW: 'جديدة',
  REVIEWED: 'تمت المراجعة',
  RESOLVED: 'تم الحل',
} as const;

const SOURCE_LABELS = {
  LOBBY: 'اللوبي',
  GAMEPLAY: 'داخل اللعبة',
  FINAL_RESULTS: 'النتائج النهائية',
} as const;

function pageFromQuery(value: string | null): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
        status === 'NEW'
          ? 'bg-wanas-primary-surface text-wanas-accent'
          : status === 'REVIEWED'
            ? 'bg-wanas-warning-surface text-wanas-warning-dark'
            : 'bg-wanas-success-surface text-wanas-success-dark',
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function FeedbackDetails({
  item,
  pending,
  onStatus,
  onDelete,
  onClose,
}: {
  item: AdminFeedbackItem;
  pending: boolean;
  onStatus: (status: FeedbackStatus) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const details = [
    ['النوع', CATEGORY_LABELS[item.category]],
    ['الحالة', STATUS_LABELS[item.status]],
    ['المصدر', SOURCE_LABELS[item.source]],
    ['اللعبة', item.gameId ? (ADMIN_GAME_TITLES[item.gameId] ?? item.gameId) : null],
    ['معرّف الغرفة', item.roomId],
    ['المسار', item.route],
    [
      'الجهاز',
      item.deviceCategory === 'mobile'
        ? 'جوال'
        : item.deviceCategory === 'desktop'
          ? 'كمبيوتر'
          : item.deviceCategory,
    ],
    ['المتصفح', item.userAgent],
    ['تاريخ الإرسال', formatAdminDateTime(item.createdAt)],
    ['آخر تحديث', item.updatedAt !== item.createdAt ? formatAdminDateTime(item.updatedAt) : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <section
      className="border-wanas-border bg-wanas-surface mt-6 rounded-2xl border p-4 sm:p-5"
      aria-label={ADMIN_COPY.feedbackDetails}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-wanas-text-primary text-lg font-bold">
            {ADMIN_COPY.feedbackDetails}
          </h2>
          <p className="text-wanas-text-primary mt-3 whitespace-pre-wrap break-words text-sm leading-7">
            {item.message}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-wanas-text-muted hover:bg-wanas-surface-soft size-10 shrink-0 rounded-xl"
          aria-label="إغلاق التفاصيل"
        >
          ✕
        </button>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="bg-wanas-surface-soft min-w-0 rounded-xl px-3 py-2.5">
            <dt className="text-wanas-text-muted text-xs font-semibold">{label}</dt>
            <dd
              className="text-wanas-text-primary mt-1 break-words text-sm"
              dir={label === 'المتصفح' || label === 'المسار' ? 'ltr' : undefined}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          {ADMIN_COPY.feedbackStatus}
          <select
            value={item.status}
            disabled={pending}
            onChange={(event) => onStatus(event.target.value as FeedbackStatus)}
            className="border-wanas-border bg-wanas-surface h-11 rounded-xl border px-3 font-normal"
          >
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="border-wanas-error-border bg-wanas-error-surface text-wanas-error inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold disabled:opacity-50"
        >
          {ADMIN_COPY.feedbackDelete}
        </button>
      </div>
    </section>
  );
}

export function AdminFeedbackClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const category = searchParams.get('category') ?? '';
  const source = searchParams.get('source') ?? '';
  const gameId = searchParams.get('gameId') ?? '';
  const page = pageFromQuery(searchParams.get('page'));
  const [data, setData] = useState<AdminFeedbackData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const selected = useMemo(
    () => data?.feedback.find((item) => item.id === selectedId) ?? null,
    [data, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminFeedback({ status, category, source, gameId, page });
    setLoading(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setData(result.data);
    setError(false);
    setSelectedId((current) =>
      current && result.data.feedback.some((item) => item.id === current) ? current : null,
    );
  }, [category, gameId, page, source, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function navigate(next: {
    status?: string;
    category?: string;
    source?: string;
    gameId?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const values = {
      status: next.status ?? status,
      category: next.category ?? category,
      source: next.source ?? source,
      gameId: next.gameId ?? gameId,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    const nextPage = next.page ?? 1;
    if (nextPage > 1) params.set('page', String(nextPage));
    router.push(params.size ? `${pathname}?${params.toString()}` : pathname);
  }

  async function updateStatus(nextStatus: FeedbackStatus) {
    if (!selected || pending || nextStatus === selected.status) return;
    setPending(true);
    const result = await patchAdminFeedbackStatus(selected.id, nextStatus);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setData((current) =>
      current
        ? {
            ...current,
            feedback: current.feedback.map((item) =>
              item.id === selected.id
                ? { ...item, status: result.data.status, updatedAt: result.data.updatedAt }
                : item,
            ),
            stats: {
              ...current.stats,
              new:
                current.stats.new +
                (selected.status === 'NEW' ? -1 : 0) +
                (nextStatus === 'NEW' ? 1 : 0),
            },
          }
        : current,
    );
  }

  async function confirmDelete() {
    if (!selected || pending) return;
    setPending(true);
    const result = await deleteAdminFeedback(selected.id);
    setPending(false);
    setDeleteOpen(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setSelectedId(null);
    await load();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-wanas-text-primary text-2xl font-bold">{ADMIN_COPY.feedbackTitle}</h1>
        <button
          type="button"
          onClick={() => void load()}
          className="border-wanas-border h-10 rounded-xl border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>

      {data ? (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [ADMIN_COPY.feedbackTotal, data.stats.total],
            [ADMIN_COPY.feedbackNew, data.stats.new],
            [ADMIN_COPY.feedbackProblems, data.stats.problems],
            [ADMIN_COPY.feedbackSuggestions, data.stats.suggestions],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="border-wanas-border bg-wanas-surface rounded-2xl border p-4"
            >
              <p className="text-wanas-text-muted text-xs font-semibold">{label}</p>
              <p className="text-wanas-text-primary mt-2 text-2xl font-black tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="border-wanas-border bg-wanas-surface mt-6 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">
          الحالة
          <select
            value={status}
            onChange={(event) => navigate({ status: event.target.value })}
            className="border-wanas-border bg-wanas-surface mt-1 h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">كل الحالات</option>
            {FEEDBACK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          النوع
          <select
            value={category}
            onChange={(event) => navigate({ category: event.target.value })}
            className="border-wanas-border bg-wanas-surface mt-1 h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">كل الأنواع</option>
            {FEEDBACK_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          المصدر
          <select
            value={source}
            onChange={(event) => navigate({ source: event.target.value })}
            className="border-wanas-border bg-wanas-surface mt-1 h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">كل المصادر</option>
            {FEEDBACK_SOURCES.map((value) => (
              <option key={value} value={value}>
                {SOURCE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          اللعبة
          <select
            value={gameId}
            onChange={(event) => navigate({ gameId: event.target.value })}
            className="border-wanas-border bg-wanas-surface mt-1 h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">كل الألعاب</option>
            {ADMIN_DASHBOARD_GAME_IDS.map((value) => (
              <option key={value} value={value}>
                {ADMIN_GAME_TITLES[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-wanas-error mt-5 text-sm font-semibold">
          {ADMIN_COPY.loadFailed}
        </p>
      ) : null}
      {loading && !data ? (
        <p className="text-wanas-text-muted mt-8 text-sm">{ADMIN_COPY.resolving}</p>
      ) : null}

      {selected ? (
        <FeedbackDetails
          item={selected}
          pending={pending}
          onStatus={(value) => void updateStatus(value)}
          onDelete={() => setDeleteOpen(true)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {data && data.feedback.length === 0 ? (
        <p className="border-wanas-border bg-wanas-surface text-wanas-text-muted mt-8 rounded-2xl border p-5 text-sm">
          {ADMIN_COPY.feedbackEmpty}
        </p>
      ) : null}

      {data && data.feedback.length > 0 ? (
        <>
          <div className="border-wanas-border mt-8 hidden overflow-x-auto rounded-2xl border md:block">
            <table className="w-full min-w-[850px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-3">{ADMIN_COPY.feedbackType}</th>
                  <th className="px-3 py-3">{ADMIN_COPY.feedbackMessage}</th>
                  <th className="px-3 py-3">{ADMIN_COPY.feedbackPlace}</th>
                  <th className="px-3 py-3">{ADMIN_COPY.feedbackDate}</th>
                  <th className="px-3 py-3">{ADMIN_COPY.feedbackStatus}</th>
                  <th className="px-3 py-3">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {data.feedback.map((item) => (
                  <tr key={item.id} className="border-wanas-border border-t">
                    <td className="px-3 py-3">{CATEGORY_LABELS[item.category]}</td>
                    <td className="max-w-sm px-3 py-3">
                      <p className="truncate" title={item.message}>
                        {item.message}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {item.gameId
                        ? (ADMIN_GAME_TITLES[item.gameId] ?? item.gameId)
                        : SOURCE_LABELS[item.source]}
                    </td>
                    <td className="text-wanas-text-secondary whitespace-nowrap px-3 py-3">
                      {formatAdminDateTime(item.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="font-bold underline"
                      >
                        فتح
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 space-y-3 md:hidden">
            {data.feedback.map((item) => (
              <article
                key={item.id}
                className="border-wanas-border bg-wanas-surface rounded-2xl border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong>{CATEGORY_LABELS[item.category]}</strong>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6">
                  {item.message}
                </p>
                <p className="text-wanas-text-muted mt-2 text-xs">
                  {formatAdminDateTime(item.createdAt)}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="mt-3 text-sm font-bold underline"
                >
                  فتح التفاصيل
                </button>
              </article>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 text-sm">
            <p className="text-wanas-text-muted">
              {ADMIN_COPY.pageLabel} {data.page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => navigate({ page: page - 1 })}
                className="border-wanas-border h-10 rounded-xl border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.previousPage}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => navigate({ page: page + 1 })}
                className="border-wanas-border h-10 rounded-xl border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.nextPage}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <UiDialog
        open={deleteOpen}
        title={ADMIN_COPY.feedbackDelete}
        description={ADMIN_COPY.feedbackDeleteConfirm}
        variant="warning"
        confirmLabel={ADMIN_COPY.feedbackDeleteConfirmCta}
        cancelLabel={ADMIN_COPY.cancel}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
