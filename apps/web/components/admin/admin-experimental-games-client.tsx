'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type ExperimentalGameSummary,
  type ExperimentalGameSelectedPayload,
} from '@wanasatna/shared';
import { useAuth } from '@/contexts/auth-context';
import { fetchAdminExperimentalGames } from '@/lib/admin/api';
import { buildLobbyUrl, writeSelectedGameId } from '@/lib/room/session';
import { emitRoomAck } from '@/lib/room-v2/emit';
import { getRoomSessionManager } from '@/lib/room-v2';

export function AdminExperimentalGamesClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [games, setGames] = useState<ExperimentalGameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchingGameId, setLaunchingGameId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminExperimentalGames();
    if (!result.ok) {
      setError('تعذر تحميل منطقة الألعاب التجريبية.');
      setLoading(false);
      return;
    }
    setEnabled(result.data.enabled);
    setGames(result.data.games);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function launch(game: ExperimentalGameSummary) {
    if (launchingGameId || user?.role !== 'ADMIN') {
      return;
    }

    setLaunchingGameId(game.gameId);
    setError(null);
    const manager = getRoomSessionManager();
    try {
      const created = await manager.create(user.preferredDisplayName);
      if (!created.success) {
        setError(created.error.message);
        return;
      }

      const selected = await emitRoomAck<ExperimentalGameSelectedPayload>(
        SELECT_EXPERIMENTAL_GAME_EVENT,
        { gameId: game.gameId },
      );
      if (!selected.success) {
        await manager.leave();
        setError(selected.error.message);
        return;
      }

      writeSelectedGameId(game.gameId);
      router.push(buildLobbyUrl(created.data.roomCode));
    } catch {
      await manager.leave();
      setError('تعذر إنشاء غرفة الاختبار. حاول مرة أخرى.');
    } finally {
      setLaunchingGameId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-wanas-warning text-xs font-bold tracking-wide">للاختبار فقط</p>
        <h1 className="text-wanas-text-primary mt-1 text-2xl font-bold">الألعاب التجريبية</h1>
        <p className="text-wanas-text-muted mt-2 max-w-2xl text-sm">
          مساحة داخلية لتجربة ألعاب غير منشورة. لا تظهر هذه الألعاب في الموقع العام أو لوبيات
          المستخدمين.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-wanas-error/30 text-wanas-error rounded-xl border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-wanas-text-muted text-sm">جاري التحميل…</p> : null}

      {!loading && !enabled ? (
        <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-5">
          <h2 className="text-wanas-text-primary font-bold">الاختبارات التجريبية متوقفة</h2>
          <p className="text-wanas-text-muted mt-2 text-sm">
            فعّلها صراحةً في بيئة اختبار غير إنتاجية. تظل معطلة دائمًا في الإنتاج.
          </p>
        </section>
      ) : null}

      {!loading && enabled && games.length === 0 ? (
        <section className="border-wanas-border bg-wanas-surface rounded-2xl border border-dashed p-6 text-center">
          <h2 className="text-wanas-text-primary font-bold">لا توجد ألعاب تجريبية مسجلة</h2>
          <p className="text-wanas-text-muted mt-2 text-sm">
            ستظهر هنا الألعاب المكتملة للتجربة بعد اعتماد مواصفاتها وتسجيلها في الخادم.
          </p>
        </section>
      ) : null}

      {enabled && games.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {games.map((game) => (
            <section
              key={game.gameId}
              className="border-wanas-border bg-wanas-surface rounded-2xl border p-5"
            >
              <h2 className="text-wanas-text-primary font-bold">{game.title}</h2>
              <p className="text-wanas-text-muted mt-2 text-sm">{game.description}</p>
              <p className="text-wanas-text-muted mt-3 text-xs font-semibold">
                {game.minPlayers}–{game.maxPlayers} لاعبين
              </p>
              <button
                type="button"
                disabled={launchingGameId !== null}
                onClick={() => void launch(game)}
                className="bg-wanas-accent mt-4 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {launchingGameId === game.gameId ? 'جاري إنشاء الغرفة…' : 'إنشاء غرفة اختبار'}
              </button>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
