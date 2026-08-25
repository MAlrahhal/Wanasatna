'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_GAME_SETTING_SPECS,
  MARATHON_MIN_GAMES,
  MARATHON_SUPPORTED_GAME_IDS,
  settingSelectOptions,
  type MarathonGameConfiguration,
  type MarathonGameId,
  type MarathonGamePlanItem,
} from '@wanasatna/shared';
import { useMarathon } from '@/contexts/marathon-context';
import { useRoom } from '@/contexts/room-context';
import { Button } from '@/components/ui/button';
import { GameArtwork } from '@/components/game/game-artwork';
import { SystemStatus } from '@/components/ui/system-status';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { getDefaultRoundCategoryId, getGameRoundCategories } from '@/lib/game/round-categories';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { cn } from '@/lib/utils';

const gameById = new Map(mockLobbyGames.map((game) => [game.id, game]));

function createConfiguration(gameId: MarathonGameId): MarathonGameConfiguration {
  const settings: Record<string, number> = {};
  for (const spec of ADMIN_GAME_SETTING_SPECS[gameId] ?? []) {
    if (!(gameId === 'judge' && spec.key === 'rounds')) settings[spec.key] = spec.default;
  }
  return {
    categoryId: getDefaultRoundCategoryId(gameId),
    settings,
    ...(gameId === 'timing-challenge'
      ? { timingChallenge: { mode: 'guess-time' as const, minSeconds: 3, maxSeconds: 15 } }
      : {}),
    ...(gameId === 'draw-guess' ? { drawGuess: { drawerMode: 'random' as const } } : {}),
  };
}

function useCountdown(deadline: number | null): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () =>
      setRemaining(deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);
  return remaining;
}

function GameIdentity({ gameId }: { gameId: MarathonGameId }) {
  const game = gameById.get(gameId);
  const catalog = getGameCatalogEntry(gameId);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="size-12 shrink-0">
        <GameArtwork src={catalog.imagePath ?? '/games/fast-answer.png'} sizes="48px" />
      </div>
      <span className="text-wanas-text-primary truncate font-bold">{game?.title ?? gameId}</span>
    </div>
  );
}

function Leaderboard({
  entries,
}: {
  entries: Array<{ playerId: string; playerName: string; totalPoints: number; rank: number }>;
}) {
  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.playerId}
          className="border-wanas-border bg-wanas-surface-soft flex items-center gap-3 rounded-xl border px-4 py-3"
        >
          <span className="text-wanas-accent w-7 text-center text-lg font-black">{entry.rank}</span>
          <span className="min-w-0 flex-1 truncate font-bold">{entry.playerName}</span>
          <span className="font-black tabular-nums">
            {entry.totalPoints.toFixed(2).replace(/\.00$/, '')}
          </span>
        </li>
      ))}
    </ol>
  );
}

function MarathonResults() {
  const { state, continueNow, returnToLobby, errorMessage } = useMarathon();
  const { isHost } = useRoom();
  const remaining = useCountdown(state?.transitionDeadlineAtMs ?? null);
  if (!state) return <SystemStatus tone="loading" title="جارٍ مزامنة الماراتون…" />;
  const final = state.status === 'FINISHED';
  const next = !final ? state.gamePlan[state.currentGameIndex + 1] : null;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="text-center">
        <p className="text-wanas-accent text-sm font-bold">
          {final
            ? 'النتائج النهائية'
            : `اكتملت المباراة ${state.completedGames.length} من ${state.gamePlan.length}`}
        </p>
        <h1 className="mt-1 text-3xl font-black">نتائج الماراثون</h1>
        {final && state.leaderboard[0] ? (
          <p className="mt-2 text-lg">
            🏆 الفائز: <strong>{state.leaderboard[0].playerName}</strong>
          </p>
        ) : null}
      </header>
      <Leaderboard entries={state.leaderboard} />
      {state.skippedGames.length > 0 ? (
        <section className="border-wanas-warning/40 bg-wanas-warning-surface rounded-xl border p-4">
          <h2 className="font-bold">الألعاب المتخطاة</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {state.skippedGames.map((game) => (
              <li key={`${game.gameIndex}-${game.gameId}`}>
                {gameById.get(game.gameId)?.title}: {game.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!final && next ? (
        <section className="border-wanas-accent/35 bg-wanas-surface rounded-2xl border p-4">
          <p className="text-wanas-text-muted mb-3 text-sm">اللعبة القادمة</p>
          <GameIdentity gameId={next.gameId} />
        </section>
      ) : null}
      <p className="text-center text-lg font-black tabular-nums">
        {final ? 'العودة إلى اللوبي' : 'تبدأ خلال'} {remaining}…
      </p>
      {isHost ? (
        <Button size="lg" onClick={() => void (final ? returnToLobby() : continueNow())}>
          {final ? 'العودة إلى اللوبي' : 'ابدأ الآن'}
        </Button>
      ) : null}
      {errorMessage ? <SystemStatus tone="error" title={errorMessage} /> : null}
    </main>
  );
}

export function MarathonPageClient() {
  const { state, start, errorMessage } = useMarathon();
  const { isHost, players, status } = useRoom();
  const [selected, setSelected] = useState<MarathonGameId[]>([]);
  const [configurations, setConfigurations] = useState<
    Record<MarathonGameId, MarathonGameConfiguration>
  >(
    () =>
      Object.fromEntries(
        MARATHON_SUPPORTED_GAME_IDS.map((id) => [id, createConfiguration(id)]),
      ) as Record<MarathonGameId, MarathonGameConfiguration>,
  );
  const [starting, setStarting] = useState(false);

  const supported = useMemo(
    () => MARATHON_SUPPORTED_GAME_IDS.map((id) => ({ id, game: gameById.get(id)! })),
    [],
  );
  if (status !== 'connected')
    return (
      <SystemStatus
        tone="loading"
        title="جارٍ الاتصال بالغرفة…"
        className="mx-auto mt-12 max-w-md"
      />
    );
  if (state && state.status !== 'PREPARING') return <MarathonResults />;
  if (!isHost)
    return (
      <main className="mx-auto max-w-md p-6">
        <SystemStatus tone="info" title="المضيف يجهّز ماراثون الألعاب الآن." />
      </main>
    );

  function toggle(gameId: MarathonGameId) {
    setSelected((current) =>
      current.includes(gameId)
        ? current.filter((id) => id !== gameId)
        : current.length < 7
          ? [...current, gameId]
          : current,
    );
  }
  function move(index: number, direction: -1 | 1) {
    setSelected((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  function update(gameId: MarathonGameId, patch: Partial<MarathonGameConfiguration>) {
    setConfigurations((current) => ({ ...current, [gameId]: { ...current[gameId], ...patch } }));
  }
  async function begin() {
    setStarting(true);
    try {
      const plan: MarathonGamePlanItem[] = selected.map((gameId) => ({
        gameId,
        configuration: configurations[gameId],
      }));
      await start(plan);
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <p className="text-wanas-accent font-bold">وضع خاص</p>
        <h1 className="text-3xl font-black">ماراثون الألعاب</h1>
        <p className="text-wanas-text-muted mt-2">
          اختر من لعبتين إلى 7 ألعاب، اضبط كل لعبة، ثم رتّبها.
        </p>
      </header>
      <section>
        <h2 className="mb-3 text-lg font-black">1. اختر الألعاب ({selected.length}/7)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {supported.map(({ id, game }) => {
            const active = selected.includes(id);
            return (
              <button
                type="button"
                key={id}
                aria-pressed={active}
                onClick={() => toggle(id)}
                className={cn(
                  'bg-wanas-surface rounded-xl border p-3 text-center',
                  active ? 'border-wanas-accent ring-wanas-accent ring-2' : 'border-wanas-border',
                )}
              >
                <div className="mx-auto size-16">
                  <GameArtwork src={getGameCatalogEntry(id).imagePath} sizes="64px" />
                </div>
                <span className="mt-2 block text-sm font-bold">{game.title}</span>
              </button>
            );
          })}
        </div>
      </section>
      {selected.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-black">2. الترتيب والإعدادات</h2>
          <div className="space-y-4">
            {selected.map((gameId, index) => {
              const configuration = configurations[gameId];
              const categories = getGameRoundCategories(gameId);
              return (
                <article
                  key={gameId}
                  className="border-wanas-border bg-wanas-surface rounded-2xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-wanas-accent text-xl font-black">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <GameIdentity gameId={gameId} />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="تحريك لأعلى"
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={index === selected.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="تحريك لأسفل"
                    >
                      ↓
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categories ? (
                      <label className="text-sm font-bold">
                        الفئة
                        <select
                          className="border-wanas-border bg-wanas-surface-soft mt-1 h-11 w-full rounded-lg border px-3"
                          value={configuration.categoryId ?? ''}
                          onChange={(event) => update(gameId, { categoryId: event.target.value })}
                        >
                          {categories.categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {(ADMIN_GAME_SETTING_SPECS[gameId] ?? []).map((spec) =>
                      gameId === 'judge' && spec.key === 'rounds' ? null : (
                        <label key={spec.key} className="text-sm font-bold">
                          {spec.label}
                          <select
                            className="border-wanas-border bg-wanas-surface-soft mt-1 h-11 w-full rounded-lg border px-3"
                            value={configuration.settings[spec.key] ?? spec.default}
                            onChange={(event) =>
                              update(gameId, {
                                settings: {
                                  ...configuration.settings,
                                  [spec.key]: Number(event.target.value),
                                },
                              })
                            }
                          >
                            {settingSelectOptions(spec).map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      ),
                    )}
                    {gameId === 'timing-challenge' && configuration.timingChallenge ? (
                      <label className="text-sm font-bold">
                        وضع اللعب
                        <select
                          className="border-wanas-border bg-wanas-surface-soft mt-1 h-11 w-full rounded-lg border px-3"
                          value={configuration.timingChallenge.mode}
                          onChange={(event) =>
                            update(gameId, {
                              timingChallenge: {
                                ...configuration.timingChallenge!,
                                mode: event.target.value as 'guess-time' | 'stop-timer',
                              },
                            })
                          }
                        >
                          <option value="guess-time">تخمين الوقت</option>
                          <option value="stop-timer">إيقاف المؤقت</option>
                        </select>
                      </label>
                    ) : null}
                    {gameId === 'draw-guess' && configuration.drawGuess ? (
                      <>
                        <label className="text-sm font-bold">
                          اختيار الرسام
                          <select
                            className="border-wanas-border bg-wanas-surface-soft mt-1 h-11 w-full rounded-lg border px-3"
                            value={configuration.drawGuess.drawerMode}
                            onChange={(event) =>
                              update(gameId, {
                                drawGuess: { drawerMode: event.target.value as 'random' | 'fixed' },
                              })
                            }
                          >
                            <option value="random">عشوائي</option>
                            <option value="fixed">لاعب محدد</option>
                          </select>
                        </label>
                        {configuration.drawGuess.drawerMode === 'fixed' ? (
                          <label className="text-sm font-bold">
                            الرسام الثابت
                            <select
                              className="border-wanas-border bg-wanas-surface-soft mt-1 h-11 w-full rounded-lg border px-3"
                              value={configuration.drawGuess.fixedPlayerId ?? ''}
                              onChange={(event) =>
                                update(gameId, {
                                  drawGuess: {
                                    drawerMode: 'fixed',
                                    fixedPlayerId: event.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">اختر لاعبًا</option>
                              {players
                                .filter((player) => !player.isSpectator)
                                .map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {player.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      {errorMessage ? <SystemStatus tone="error" title={errorMessage} /> : null}
      <Button
        size="lg"
        disabled={selected.length < MARATHON_MIN_GAMES || starting}
        loading={starting}
        onClick={() => void begin()}
      >
        بدء الماراتون
      </Button>
    </main>
  );
}
