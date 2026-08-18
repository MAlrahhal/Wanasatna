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
import { ADMIN_COPY, ADMIN_GAME_TITLES } from '@/lib/admin/copy';
import { cn } from '@/lib/utils';

const RANGE_LABEL: Record<AdminAnalyticsRange, string> = {
  '24h': ADMIN_COPY.range24h,
  '7d': ADMIN_COPY.range7d,
  '30d': ADMIN_COPY.range30d,
  all: ADMIN_COPY.rangeAll,
};

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

function formatAverage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(1);
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-wanas-border bg-wanas-surface p-4">
      <p className="text-xs font-semibold text-wanas-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-wanas-text-primary">{value}</p>
    </div>
  );
}

function barWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) {
    return '0%';
  }
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export function AdminAnalyticsClient() {
  const [range, setRange] = useState<AdminAnalyticsRange>(ADMIN_ANALYTICS_DEFAULT_RANGE);
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const load = useCallback(async (nextRange: AdminAnalyticsRange) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      const result = await fetchAdminAnalytics(nextRange);
      if (!result.ok) {
        setError(true);
        return;
      }
      setData(result.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load(range);
  }, [load, range]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current) {
        return;
      }
      void load(rangeRef.current);
    }, ADMIN_ANALYTICS_POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const overviewEmpty =
    data !== null &&
    data.overview.roomsCreated === 0 &&
    data.overview.matchesStarted === 0 &&
    data.overview.roomsJoined === 0;

  const maxDailyStarted = data
    ? Math.max(0, ...data.daily.map((row) => row.matchesStarted + row.roomsCreated))
    : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.analyticsTitle}</h1>
        <button
          type="button"
          onClick={() => {
            void load(range);
          }}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>

      <p className="mt-2 text-xs text-wanas-text-muted">{ADMIN_COPY.rangeUtcNote}</p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={ADMIN_COPY.analyticsTitle}>
        {ADMIN_ANALYTICS_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => {
              setRange(value);
            }}
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

      {loading && !data ? (
        <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>
      ) : null}

      {error && !data ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
          <p role="alert" className="text-sm font-semibold text-wanas-error">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load(range);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          {error ? (
            <p role="alert" className="mt-4 text-sm font-semibold text-wanas-error">
              {ADMIN_COPY.loadFailed}
            </p>
          ) : null}

          {overviewEmpty ? (
            <p className="mt-6 text-sm text-wanas-text-muted">{ADMIN_COPY.emptyPeriod}</p>
          ) : null}

          <h2 className="mt-8 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.overview}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={ADMIN_COPY.roomsCreated} value={data.overview.roomsCreated} />
            <MetricCard label={ADMIN_COPY.joinCount} value={data.overview.roomsJoined} />
            <MetricCard label={ADMIN_COPY.spectatorJoins} value={data.overview.spectatorsJoined} />
            <MetricCard label={ADMIN_COPY.reconnectSuccess} value={data.overview.reconnectsSucceeded} />
            <MetricCard label={ADMIN_COPY.roomsClosed} value={data.overview.roomsClosed} />
            <MetricCard label={ADMIN_COPY.matchesStarted} value={data.overview.matchesStarted} />
            <MetricCard label={ADMIN_COPY.matchesCompleted} value={data.overview.matchesCompleted} />
            <MetricCard label={ADMIN_COPY.matchesAborted} value={data.overview.matchesAborted} />
            <MetricCard
              label={ADMIN_COPY.completionRate}
              value={formatPercent(data.overview.completionRate)}
            />
            <MetricCard label={ADMIN_COPY.activeMatchRecords} value={data.overview.matchesActive} />
          </div>

          <h2 className="mt-10 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.gameUsage}</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-wanas-border">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.games}</th>
                  <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.started}</th>
                  <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.completed}</th>
                  <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.aborted}</th>
                  <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.completionRate}</th>
                </tr>
              </thead>
              <tbody>
                {data.games.map((game) => (
                  <tr key={game.gameId} className="border-t border-wanas-border">
                    <td className="px-3 py-2 font-semibold">
                      {ADMIN_GAME_TITLES[game.gameId] ?? game.gameId}
                    </td>
                    <td className="px-3 py-2">{game.started}</td>
                    <td className="px-3 py-2">{game.completed}</td>
                    <td className="px-3 py-2">{game.aborted}</td>
                    <td className="px-3 py-2">{formatPercent(game.completionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.participation}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricCard
              label={ADMIN_COPY.totalParticipations}
              value={data.participation.totalParticipations}
            />
            <MetricCard
              label={ADMIN_COPY.averageParticipants}
              value={formatAverage(data.participation.averageParticipants)}
            />
          </div>

          {data.daily.length > 0 ? (
            <>
              <h2 className="mt-10 text-lg font-bold text-wanas-text-primary">{ADMIN_COPY.activity}</h2>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-wanas-border">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                    <tr>
                      <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.day}</th>
                      <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.roomsCreated}</th>
                      <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.matchesStarted}</th>
                      <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.completed}</th>
                      <th className="px-3 py-2 text-start font-semibold">{ADMIN_COPY.aborted}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((row) => (
                      <tr key={row.date} className="border-t border-wanas-border">
                        <td className="px-3 py-2 font-semibold">{row.date}</td>
                        <td className="px-3 py-2">{row.roomsCreated}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span>{row.matchesStarted}</span>
                            <span
                              className="inline-block h-2 rounded bg-wanas-text-muted"
                              style={{
                                width: barWidth(row.matchesStarted + row.roomsCreated, maxDailyStarted),
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">{row.matchesCompleted}</td>
                        <td className="px-3 py-2">{row.matchesAborted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
