'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ADMIN_ANALYTICS_DEFAULT_RANGE,
  ADMIN_ANALYTICS_POLL_MS,
  ADMIN_ANALYTICS_RANGES,
  type AdminAnalyticsData,
  type AdminAnalyticsRange,
} from '@wanasatna/shared';
import { fetchAdminAnalytics } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_GAME_TITLES, ADMIN_ROOM_CLOSE_REASON_LABEL } from '@/lib/admin/copy';
import { cn } from '@/lib/utils';

const RANGE_LABEL: Record<AdminAnalyticsRange, string> = {
  '24h': ADMIN_COPY.range24h,
  '7d': ADMIN_COPY.range7d,
  '30d': ADMIN_COPY.range30d,
  all: ADMIN_COPY.rangeAll,
};

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'لا توجد بيانات';
  }
  return new Intl.NumberFormat('ar-SA').format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'لا توجد بيانات';
  }
  return `${Math.round(value * 100)}٪`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return 'لا توجد بيانات';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)} ثانية`;
  }
  return `${(seconds / 60).toFixed(1)} دقيقة`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'لا توجد بيانات';
  }
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  detail,
  emphasis = 'primary',
}: {
  label: string;
  value: string | number;
  detail?: string;
  emphasis?: 'primary' | 'secondary';
}) {
  return (
    <article className="rounded-2xl border border-wanas-border bg-wanas-surface p-3">
      <p className="text-xs font-semibold text-wanas-text-muted">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-bold text-wanas-text-primary',
          emphasis === 'primary' ? 'text-2xl' : 'text-xl',
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-xs text-wanas-text-muted">{detail}</p> : null}
    </article>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max <= 0 || value <= 0 ? '0%' : `${Math.max(3, Math.round((value / max) * 100))}%`;
  return (
    <span className="block h-1.5 rounded-full bg-wanas-surface-soft">
      <span className="block h-1.5 rounded-full bg-wanas-text-primary" style={{ width }} />
    </span>
  );
}

function hourTickClass(hour: number, forCount: boolean): string {
  if (hour % 6 === 0) {
    return forCount ? 'hidden sm:block' : 'block';
  }
  if (hour % 3 === 0) {
    return 'hidden sm:block';
  }
  if (hour % 2 === 0) {
    return 'hidden xl:block';
  }
  return 'hidden 2xl:block';
}

function HourlyActivity({ counts }: { counts: number[] }) {
  const maxHour = Math.max(0, ...counts);

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex h-[4.5rem] items-end gap-px sm:h-[4.75rem] sm:gap-0.5">
        {counts.map((count, hour) => (
          <div
            key={hour}
            className="flex min-w-0 flex-1 flex-col justify-end"
            title={`${String(hour).padStart(2, '0')}:00 · ${count}`}
            aria-label={`الساعة ${hour}: ${count}`}
          >
            <div className="flex h-full items-end rounded-sm bg-wanas-surface-soft px-px">
              <span
                className="w-full rounded-sm bg-wanas-text-primary"
                style={{
                  height: maxHour
                    ? `${Math.max(count ? 6 : 0, Math.round((count / maxHour) * 100))}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-px sm:gap-0.5">
        {counts.map((count, hour) => (
          <div key={hour} className="min-w-0 flex-1 text-center text-[10px] leading-4 sm:text-xs">
            <p className={cn('truncate tabular-nums text-wanas-text-muted', hourTickClass(hour, false))}>
              {hour}
            </p>
            <p
              className={cn(
                'truncate font-semibold tabular-nums text-wanas-text-secondary',
                hourTickClass(hour, true),
              )}
            >
              {count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RangePicker({
  range,
  onChange,
}: {
  range: AdminAnalyticsRange;
  onChange: (range: AdminAnalyticsRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ADMIN_COPY.analyticsTitle}>
      {ADMIN_ANALYTICS_RANGES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={range === value}
          onClick={() => onChange(value)}
          className={cn(
            'inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold',
            range === value
              ? 'border-wanas-text-primary bg-wanas-surface-soft text-wanas-text-primary'
              : 'border-wanas-border text-wanas-text-primary',
          )}
        >
          {RANGE_LABEL[value]}
        </button>
      ))}
    </div>
  );
}

function AnalyticsContent({ data }: { data: AdminAnalyticsData }) {
  const topGame = data.games.find((game) => game.started > 0) ?? null;
  const maxGameMatches = Math.max(0, ...data.games.map((game) => game.started));
  const maxActivity = Math.max(0, ...data.activity.map((point) => point.matchesStarted));
  const groupedSizes = Array.from({ length: 9 }, (_, index) => index + 1).map((size) => ({
    size,
    matchCount: data.matchSizeDistribution
      .filter((point) => (size === 9 ? point.size >= 9 : point.size === size))
      .reduce((sum, point) => sum + point.matchCount, 0),
  }));
  const maxSize = Math.max(0, ...groupedSizes.map((point) => point.matchCount));
  const emptyPeriod =
    data.overview.matchesStarted === 0 &&
    data.overview.roomsCreated === 0 &&
    data.overview.roomsJoined === 0;

  return (
    <div className="space-y-6">
      {emptyPeriod ? (
        <p className="text-sm text-wanas-text-muted">{ADMIN_COPY.emptyPeriod}</p>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.overview}</h2>
          <p className="text-xs text-wanas-text-muted">
            المباريات حسب وقت البدء، من {data.from ? formatDate(data.from) : 'بداية البيانات'} إلى{' '}
            {formatDate(data.to)}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={ADMIN_COPY.matchesStarted}
            value={data.overview.matchesStarted}
            detail={`${data.overview.matchesCompleted} مكتملة · ${data.overview.matchesAborted} ملغاة`}
          />
          <MetricCard
            label={ADMIN_COPY.totalParticipations}
            value={data.participation.totalParticipations}
            detail="هويات فريدة داخل كل مباراة"
          />
          <MetricCard
            label={ADMIN_COPY.averageParticipants}
            value={formatNumber(data.participation.averageParticipants)}
          />
          <MetricCard
            label="أكثر لعبة لعباً"
            value={topGame ? (ADMIN_GAME_TITLES[topGame.gameId] ?? topGame.gameId) : 'لا توجد بيانات'}
            detail={
              topGame ? `${topGame.started} مباراة · ${formatPercent(topGame.matchShare)}` : undefined
            }
          />
          <MetricCard
            label={ADMIN_COPY.roomsCreated}
            value={formatNumber(data.roomHistory.roomsCreated)}
            detail={
              data.roomHistory.coverageStartedAt ? 'من سجل الغرف الدائم' : 'سجل الغرف غير متاح'
            }
            emphasis="secondary"
          />
          <MetricCard
            label="متوسط مدة المباراة"
            value={formatDuration(data.duration.averageSeconds)}
            detail={
              data.duration.measuredMatchCount
                ? `من ${data.duration.measuredMatchCount} مباراة ذات وقت مكتمل`
                : undefined
            }
            emphasis="secondary"
          />
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-wanas-border bg-wanas-surface p-3 sm:p-4">
          <h2 className="text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.gameUsage}</h2>
          <p className="mt-0.5 text-xs text-wanas-text-muted">
            عدد المباريات وحصتها من جميع المباريات في الفترة.
          </p>
          <div className="mt-3 space-y-2">
            {data.games.map((game) => (
              <div
                key={game.gameId}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-sm"
              >
                <p className="font-semibold text-wanas-text-primary">
                  {ADMIN_GAME_TITLES[game.gameId] ?? game.gameId}
                </p>
                <p className="text-wanas-text-secondary">
                  {game.started} · {formatPercent(game.matchShare)}
                </p>
                <div className="col-span-2">
                  <Bar value={game.started} max={maxGameMatches} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-wanas-border bg-wanas-surface p-3 sm:p-4">
          <h2 className="text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.activity}</h2>
          <p className="mt-0.5 text-xs text-wanas-text-muted">
            بدأت / مكتملة / ملغاة. الإلغاء يعتمد على حالة المباراة ABORTED، وليس وقت النهاية.
          </p>
          {data.activity.length === 0 ? (
            <p className="mt-3 text-sm text-wanas-text-muted">لا تتوفر سلسلة زمنية لهذه الفترة.</p>
          ) : (
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pe-1">
              {data.activity.map((point) => (
                <div
                  key={point.bucket}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                >
                  <span className="text-wanas-text-muted">{point.label}</span>
                  <Bar value={point.matchesStarted} max={maxActivity} />
                  <span className="whitespace-nowrap text-wanas-text-secondary">
                    {point.matchesStarted} / {point.matchesCompleted} / {point.matchesAborted}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-wanas-border bg-wanas-surface p-3 sm:p-4">
          <h2 className="text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.participation}</h2>
          <p className="mt-0.5 text-xs text-wanas-text-muted">عدد اللاعبين الفريدين داخل كل مباراة.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {groupedSizes.map((point) => (
              <div key={point.size} className="rounded-xl bg-wanas-surface-soft px-2 py-2 text-center">
                <p className="text-xs text-wanas-text-muted">{point.size === 9 ? '9+' : point.size}</p>
                <p className="mt-0.5 text-lg font-bold">{point.matchCount}</p>
                <div className="mx-auto mt-1.5 w-full">
                  <Bar value={point.matchCount} max={maxSize} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-wanas-border bg-wanas-surface p-3 sm:p-4">
          <h2 className="text-lg font-bold text-wanas-text-primary">متى يكون الموقع نشطاً؟</h2>
          <p className="mt-0.5 text-xs text-wanas-text-muted">
            بداية المباريات حسب ساعة السعودية (Asia/Riyadh).
          </p>
          <div className="mt-3">
            <HourlyActivity counts={data.startsBySaudiHour} />
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold text-wanas-text-primary">رؤى حسب اللعبة</h2>
        <div className="overflow-x-auto rounded-2xl border border-wanas-border bg-wanas-surface">
          <table className="w-full min-w-[800px] text-right text-sm">
            <thead className="bg-wanas-surface-soft text-wanas-text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">اللعبة</th>
                <th className="px-3 py-2 font-semibold">المباريات</th>
                <th className="px-3 py-2 font-semibold">الاستخدام</th>
                <th className="px-3 py-2 font-semibold">{ADMIN_COPY.lastMatch}</th>
                <th className="px-3 py-2 font-semibold">متوسط اللاعبين</th>
                <th className="px-3 py-2 font-semibold">متوسط المدة</th>
              </tr>
            </thead>
            <tbody>
              {data.games.map((game) => (
                <tr key={game.gameId} className="border-t border-wanas-border">
                  <td className="px-3 py-2 font-semibold">
                    {ADMIN_GAME_TITLES[game.gameId] ?? game.gameId}
                  </td>
                  <td className="px-3 py-2">{game.started}</td>
                  <td className="px-3 py-2">{formatPercent(game.matchShare)}</td>
                  <td className="px-3 py-2">{formatDate(game.lastPlayedAt)}</td>
                  <td className="px-3 py-2">{formatNumber(game.averageParticipants)}</td>
                  <td className="px-3 py-2">{formatDuration(game.averageDurationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-wanas-border bg-wanas-surface p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-wanas-text-primary">إحصاءات سجل الغرف</h2>
            <p className="mt-0.5 text-xs text-wanas-text-muted">
              إحصاءات الغرف متاحة منذ بدء تسجيل سجل الغرف الدائم
              {data.roomHistory.coverageStartedAt
                ? `: ${formatDate(data.roomHistory.coverageStartedAt)}`
                : '، ولا تتوفر بيانات غرف بعد.'}
            </p>
          </div>
          {data.roomHistory.isPartialForRange ? (
            <span className="rounded-full bg-wanas-surface-soft px-3 py-1 text-xs font-semibold text-wanas-text-secondary">
              {ADMIN_COPY.partialHistory}
            </span>
          ) : null}
        </div>
        {!data.roomHistory.coverageStartedAt ? (
          <p className="mt-3 text-sm text-wanas-text-muted">لا تتوفر بيانات الغرف لهذه الفترة.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <MetricCard
                label={ADMIN_COPY.roomsCreated}
                value={formatNumber(data.roomHistory.roomsCreated)}
                emphasis="secondary"
              />
              <MetricCard
                label="متوسط مدة الغرفة"
                value={formatDuration(data.roomHistory.averageDurationSeconds)}
                detail={
                  data.roomHistory.measuredRoomCount
                    ? `من ${data.roomHistory.measuredRoomCount} غرفة مغلقة`
                    : undefined
                }
                emphasis="secondary"
              />
              <MetricCard
                label="متوسط المشاركين في الغرفة"
                value={formatNumber(data.roomHistory.averageParticipants)}
                emphasis="secondary"
              />
            </div>
            <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold">الغرف المنشأة بمرور الوقت</h3>
                {data.roomHistory.activity.length ? (
                  <div className="mt-2 space-y-1.5">
                    {data.roomHistory.activity.map((point) => (
                      <div
                        key={point.date}
                        className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                      >
                        <span className="text-wanas-text-muted">{point.date.slice(5)}</span>
                        <Bar
                          value={point.roomsCreated}
                          max={Math.max(
                            0,
                            ...data.roomHistory.activity.map((row) => row.roomsCreated),
                          )}
                        />
                        <span>{point.roomsCreated}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-wanas-text-muted">
                    لا تتوفر سلسلة زمنية لهذه الفترة.
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">{ADMIN_COPY.closeReason}</h3>
                <div className="mt-2 space-y-1.5">
                  {data.roomHistory.closeReasons.map((point) => (
                    <div
                      key={point.reason}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-wanas-text-secondary">
                        {ADMIN_ROOM_CLOSE_REASON_LABEL[point.reason]}
                      </span>
                      <span className="font-semibold">{point.roomCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function AdminAnalyticsClient({ embedded = false }: { embedded?: boolean }) {
  const [range, setRange] = useState<AdminAnalyticsRange>(ADMIN_ANALYTICS_DEFAULT_RANGE);
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async (nextRange: AdminAnalyticsRange, force = false) => {
    if (inFlightRef.current && !force) {
      return;
    }

    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;
    try {
      const result = await fetchAdminAnalytics(nextRange);
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!result.ok) {
        setError(true);
        return;
      }
      setData(result.data);
      setError(false);
    } catch {
      if (requestId === requestIdRef.current) {
        setError(true);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
    void load(range, true);
  }, [load, range]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current) {
        return;
      }
      void load(range);
    }, ADMIN_ANALYTICS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, range]);

  const TitleTag = embedded ? 'h2' : 'h1';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <TitleTag
            className={cn(
              'font-bold text-wanas-text-primary',
              embedded ? 'text-xl' : 'text-2xl',
            )}
          >
            {ADMIN_COPY.analyticsTitle}
          </TitleTag>
          <p className="mt-1 text-xs text-wanas-text-muted">{ADMIN_COPY.rangeUtcNote}</p>
        </div>
        <button
          type="button"
          onClick={() => void load(range, true)}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>
      <div className="mt-3">
        <RangePicker
          range={range}
          onChange={(nextRange) => {
            setLoading(true);
            setRange(nextRange);
          }}
        />
      </div>
      {loading && !data ? (
        <p className="mt-6 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>
      ) : null}
      {error && !data ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
          <p role="alert" className="text-sm font-semibold text-wanas-error">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load(range, true);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}
      {data ? (
        <div className="mt-5">
          {error ? (
            <p role="alert" className="mb-4 text-sm font-semibold text-wanas-error">
              {ADMIN_COPY.loadFailed}
            </p>
          ) : null}
          <AnalyticsContent data={data} />
        </div>
      ) : null}
    </div>
  );
}
