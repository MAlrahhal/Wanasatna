'use client';

import { useEffect } from 'react';
import type {
  TimelineGap,
  TimelinePlacementPlayerView,
  TimelinePublicEvent,
} from '@wanasatna/shared';
import { TIMELINE_PLACEMENT_ANSWER_REVEAL_MS, TIMELINE_PLACEMENT_GAME_ID } from '@wanasatna/shared';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameScreen } from '@/components/game/game-card';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { timelinePlacementExperienceMeta } from '@/lib/game/experimental-game-experience';
import { cn } from '@/lib/utils';
import { useTimelinePlacementPlayerView } from './use-player-view';

export function TimelinePlacementGameScreen() {
  const { state: shell } = useGameShell();
  const setExperienceMeta = useSetGameExperienceMeta();
  const enabled = shell?.gameId === TIMELINE_PLACEMENT_GAME_ID && shell.phase === 'PLAYING';
  const { view, error, loading, submitting, chooseGap, continueRound } =
    useTimelinePlacementPlayerView(enabled);
  const deadlineAtMs = view?.deadlineAtMs ?? null;

  useEffect(() => {
    if (!enabled) {
      setExperienceMeta(null);
      return;
    }
    setExperienceMeta(
      view
        ? timelinePlacementExperienceMeta(view)
        : { gameName: 'زمانها وين؟', gameIcon: '🕰️', phaseLabel: 'جارٍ التحميل…' },
    );
  }, [enabled, setExperienceMeta, view]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  return (
    <GameScreen ariaLabel="زمانها وين؟" maxWidth="6xl" className="min-w-0 gap-3">
      {view.phase === 'answer-reveal' ? (
        <DeadlineProgress
          deadlineAtMs={deadlineAtMs}
          totalDurationSeconds={TIMELINE_PLACEMENT_ANSWER_REVEAL_MS / 1000}
          className="h-2"
        />
      ) : null}

      {view.candidate ? (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-4 text-center">
          <p className="text-xs font-bold text-amber-100">ضع الحدث في موقعه الزمني</p>
          <p className="text-wanas-text-primary mx-auto mt-1 max-w-3xl text-lg font-black leading-relaxed sm:text-xl">
            {view.candidate.text}
          </p>
        </section>
      ) : null}

      {view.phase === 'completed' ? (
        <FinalResults view={view} />
      ) : (
        <TimelineBoard
          view={view}
          disabled={submitting}
          onChoose={(gapId) => void chooseGap(gapId)}
        />
      )}

      {view.phase === 'selecting' ? (
        <p className="text-wanas-text-muted text-center text-sm">
          اختار {view.submittedChoiceCount} من {view.eligiblePlayerCount}. تبقى المهلة كاملة حتى لو
          اختار الجميع، ويمكنك تغيير موقعك قبل انتهائها.
        </p>
      ) : null}

      {view.phase === 'placements-reveal' ? (
        <section className="rounded-2xl border border-sky-300/35 bg-sky-300/10 p-4 text-center">
          <h2 className="text-wanas-text-primary font-black">اختيارات اللاعبين</h2>
          <p className="text-wanas-text-muted mt-1 text-sm">
            تظهر الأسماء الآن أولًا؛ السنة والموقع الصحيح ما زالا مخفيين.
          </p>
        </section>
      ) : null}

      {view.phase === 'answer-reveal' && view.revealedAnswer ? (
        <section className="border-wanas-accent/50 bg-wanas-primary-surface rounded-2xl border p-4 text-center">
          <p className="text-wanas-text-muted text-xs">الموقع الصحيح</p>
          <h2 className="text-wanas-text-primary mt-1 text-xl font-black">
            {view.revealedAnswer.event.text} — {view.revealedAnswer.event.year}
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {view.placements.map((placement) => (
              <span
                key={placement.playerId}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-bold',
                  placement.isCorrect
                    ? 'border-emerald-300/60 bg-emerald-300/10 text-emerald-100'
                    : 'border-wanas-border bg-wanas-surface-soft text-wanas-text-muted',
                )}
              >
                {placement.name} {placement.isCorrect ? '+100' : '+0'}
              </span>
            ))}
          </div>
          {view.canAdvance ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void continueRound()}
              className="bg-wanas-accent mt-4 min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50 sm:w-auto sm:min-w-52"
            >
              {view.currentRound === view.totalRounds ? 'عرض النتائج' : 'الجولة التالية'}
            </button>
          ) : null}
        </section>
      ) : null}

      {view.isSpectator ? (
        <SpectatorNotice
          title="أنت متفرج في هذه المباراة"
          description="يمكنك متابعة الخط الزمني والنتائج، لكن لا يمكنك اختيار موقع حدث."
        />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-wanas-error/40 text-wanas-error rounded-xl border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}
    </GameScreen>
  );
}

function TimelineBoard(props: {
  view: TimelinePlacementPlayerView;
  disabled: boolean;
  onChoose: (gapId: string) => void;
}) {
  const { view } = props;
  const selectable = view.phase === 'selecting' && view.canChoose;
  const showPlacements = view.phase === 'placements-reveal';

  if (view.phase === 'answer-reveal') {
    return <OrderedEvents events={view.timeline} />;
  }

  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 sm:p-4">
      <div
        className="max-h-[62dvh] space-y-2 overflow-y-auto overscroll-contain px-1"
        dir="ltr"
        data-timeline-scroll=""
      >
        {view.availableGaps.map((gap, index) => (
          <div key={gap.id}>
            <GapControl
              gap={gap}
              selected={view.ownGapId === gap.id}
              disabled={!selectable || props.disabled}
              readOnly={!selectable}
              names={
                showPlacements
                  ? view.placements
                      .filter((placement) => placement.gapId === gap.id)
                      .map((placement) => placement.name)
                  : []
              }
              onChoose={props.onChoose}
            />
            {index < view.timeline.length ? <EventCard event={view.timeline[index]!} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function GapControl(props: {
  gap: TimelineGap;
  selected: boolean;
  disabled: boolean;
  readOnly: boolean;
  names: string[];
  onChoose: (gapId: string) => void;
}) {
  return (
    <div className="py-1" dir="rtl">
      <button
        type="button"
        disabled={props.disabled}
        aria-pressed={props.selected}
        onClick={() => props.onChoose(props.gap.id)}
        className={cn(
          'border-wanas-border bg-wanas-surface-soft text-wanas-text-muted min-h-12 w-full rounded-xl border-2 border-dashed px-3 py-2 text-sm font-bold transition-colors',
          props.selected &&
            'border-wanas-accent bg-wanas-primary-surface text-wanas-text-primary ring-wanas-accent/30 ring-2',
          !props.disabled &&
            'hover:border-wanas-accent focus-visible:ring-wanas-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        {props.selected
          ? 'اختيارك الحالي ✓'
          : props.readOnly
            ? 'اختيارات اللاعبين'
            : 'ضع الحدث هنا'}
      </button>
      {props.names.length ? (
        <div
          className="mt-1 flex flex-wrap justify-center gap-1.5"
          aria-label="اللاعبون الذين اختاروا هذا الموقع"
        >
          {props.names.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="rounded-full bg-sky-300/15 px-2.5 py-1 text-xs text-sky-100"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EventCard({ event }: { event: TimelinePublicEvent }) {
  return (
    <article
      className="border-wanas-border bg-wanas-surface-soft grid grid-cols-[4.5rem_1fr] items-center gap-3 rounded-xl border p-3"
      dir="ltr"
    >
      <span className="text-wanas-accent text-center text-lg font-black" dir="ltr">
        {event.year}
      </span>
      <p className="text-wanas-text-primary text-right text-sm font-bold" dir="rtl">
        {event.text}
      </p>
    </article>
  );
}

function OrderedEvents({ events }: { events: TimelinePublicEvent[] }) {
  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 sm:p-4">
      <div
        className="max-h-[62dvh] space-y-2 overflow-y-auto overscroll-contain"
        dir="ltr"
        data-timeline-scroll=""
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function FinalResults({ view }: { view: TimelinePlacementPlayerView }) {
  const winnerNames = view.leaderboard
    .filter((entry) => view.winnerPlayerIds.includes(entry.playerId))
    .map((entry) => entry.name);
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4">
      <div className="text-center">
        <p className="text-wanas-text-muted text-xs">النتائج النهائية</p>
        <h2 className="text-wanas-text-primary mt-1 text-xl font-black">
          {view.resultReason === 'insufficient-players'
            ? 'انتهت المباراة لعدم كفاية اللاعبين'
            : winnerNames.length > 1
              ? `الفائزون: ${winnerNames.join('، ')}`
              : `الفائز: ${winnerNames[0] ?? '—'}`}
        </h2>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {view.leaderboard.map((entry, index) => (
          <li
            key={entry.playerId}
            className={cn(
              'border-wanas-border bg-wanas-surface-soft flex items-center justify-between rounded-xl border p-3',
              view.winnerPlayerIds.includes(entry.playerId) && 'border-amber-300/60',
            )}
          >
            <span className="text-wanas-text-primary text-sm font-bold">
              {index + 1}. {entry.name}
            </span>
            <span className="text-wanas-text-muted text-xs">{entry.score} نقطة</span>
          </li>
        ))}
      </ol>
      <OrderedEvents events={view.timeline} />
    </section>
  );
}
