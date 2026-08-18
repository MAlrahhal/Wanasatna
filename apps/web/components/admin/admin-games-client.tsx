'use client';

import { useCallback, useEffect, useState } from 'react';
import { ADMIN_GAME_SETTING_SPECS, PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import { fetchAdminGames, patchAdminGameAvailability } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_GAME_TITLES } from '@/lib/admin/copy';
import { cn } from '@/lib/utils';

export function AdminGamesClient() {
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PLAYABLE_GAME_IDS.map((gameId) => [gameId, true])),
  );
  const [error, setError] = useState(false);
  const [pendingGameId, setPendingGameId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchAdminGames();
    if (!result.ok) {
      setError(true);
      return;
    }
    const next = Object.fromEntries(PLAYABLE_GAME_IDS.map((gameId) => [gameId, true]));
    for (const entry of result.data.games) {
      next[entry.gameId] = entry.isEnabled;
    }
    setEnabledById(next);
    setError(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleGame(gameId: string, isEnabled: boolean) {
    if (pendingGameId) {
      return;
    }
    setPendingGameId(gameId);
    const result = await patchAdminGameAvailability(gameId, isEnabled);
    setPendingGameId(null);
    if (!result.ok) {
      setError(true);
      return;
    }
    setEnabledById((current) => ({ ...current, [gameId]: result.data.isEnabled }));
    setError(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.games}</h1>
        <p className="mt-1 text-sm text-wanas-text-muted">{ADMIN_COPY.experimentalSettings}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-wanas-error">
          {ADMIN_COPY.loadFailed}
        </p>
      ) : null}
      <div className="grid gap-3">
        {PLAYABLE_GAME_IDS.map((gameId) => {
          const specs = ADMIN_GAME_SETTING_SPECS[gameId] ?? [];
          const isEnabled = enabledById[gameId] !== false;
          return (
            <section
              key={gameId}
              className="rounded-2xl border border-wanas-border bg-wanas-surface p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-sm font-bold text-wanas-text-primary">
                  {ADMIN_GAME_TITLES[gameId] ?? gameId}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pendingGameId === gameId}
                    onClick={() => void toggleGame(gameId, true)}
                    className={cn(
                      'min-h-10 rounded-full px-3 text-xs font-bold',
                      isEnabled
                        ? 'bg-wanas-success-surface text-wanas-success-dark'
                        : 'border border-wanas-border bg-wanas-surface-soft text-wanas-text-muted',
                    )}
                  >
                    {ADMIN_COPY.gameEnabled}
                  </button>
                  <button
                    type="button"
                    disabled={pendingGameId === gameId}
                    onClick={() => void toggleGame(gameId, false)}
                    className={cn(
                      'min-h-10 rounded-full px-3 text-xs font-bold',
                      !isEnabled
                        ? 'bg-wanas-surface-muted text-wanas-text-muted'
                        : 'border border-wanas-border bg-wanas-surface-soft text-wanas-text-muted',
                    )}
                  >
                    {ADMIN_COPY.gameDisabled}
                  </button>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-wanas-text-muted">
                {specs.map((spec) => (
                  <li key={spec.key}>
                    {spec.label}: {spec.min}–{spec.max}
                    {spec.default !== 0 ? ` (افتراضي ${spec.default})` : ' (افتراضي: عدد اللاعبين)'}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
