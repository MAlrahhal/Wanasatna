'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ADMIN_SYSTEM_POLL_MS, type AdminSystemData } from '@wanasatna/shared';
import { fetchAdminSystem } from '@/lib/admin/api';
import { ADMIN_COPY } from '@/lib/admin/copy';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} س ${minutes} د`;
  }
  return `${minutes} د`;
}

function formatBytes(value: number): string {
  const mb = value / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function StatusCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-wanas-border bg-wanas-surface p-4">
      <p className="text-xs font-semibold text-wanas-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-wanas-text-primary">{value}</p>
    </div>
  );
}

export function AdminSystemClient() {
  const [data, setData] = useState<AdminSystemData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      const result = await fetchAdminSystem();
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
    void load();

    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current) {
        return;
      }
      void load();
    }, ADMIN_SYSTEM_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  if (loading && !data) {
    return <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>;
  }

  if (error && !data) {
    return (
      <div className="mt-8 space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
        <p role="alert" className="text-sm font-semibold text-wanas-error">
          {ADMIN_COPY.loadFailed}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.retry}
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.systemTitle}</h1>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.refresh}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-wanas-error">
          {ADMIN_COPY.loadFailed}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label={ADMIN_COPY.serverStatus} value={ADMIN_COPY.serverOk} />
        <StatusCard
          label={ADMIN_COPY.databaseStatus}
          value={data.databaseReachable ? ADMIN_COPY.reachable : ADMIN_COPY.unreachable}
        />
        <StatusCard label={ADMIN_COPY.uptime} value={formatUptime(data.uptimeSeconds)} />
        <StatusCard label={ADMIN_COPY.currentConnections} value={data.connectedSockets} />
        <StatusCard label={ADMIN_COPY.liveRooms} value={data.rooms} />
        <StatusCard label={ADMIN_COPY.liveGames} value={data.liveGameShells} />
        <StatusCard label={ADMIN_COPY.recordedActiveMatches} value={data.activeMatches} />
        <StatusCard
          label={ADMIN_COPY.memoryUsage}
          value={`${formatBytes(data.memory.rss)} RSS`}
        />
      </div>
    </div>
  );
}
