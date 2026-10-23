'use client';

import { useEffect, useState } from 'react';
import type {
  MostLikelyToAggregateResult,
  MostLikelyToPlayerView,
  MostLikelyToQuestionResult,
} from '@wanasatna/shared';
import { MOST_LIKELY_TO_GAME_ID } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { PlayerAvatar } from '@/components/player/player-avatar';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useGameShell } from '@/contexts/game-shell-context';
import { cn } from '@/lib/utils';
import { useMostLikelyToPlayerView } from './use-player-view';

function useRemainingSeconds(deadlineAtMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineAtMs === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineAtMs]);
  return deadlineAtMs === null ? null : Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
}

export function MostLikelyToGameScreen() {
  const { state: shell } = useGameShell();
  const enabled = shell?.gameId === MOST_LIKELY_TO_GAME_ID && shell.phase === 'PLAYING';
  const { view, error, loading, submitting, vote, advance } = useMostLikelyToPlayerView(enabled);
  const remainingSeconds = useRemainingSeconds(view?.deadlineAtMs ?? null);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  return (
    <GameScreen ariaLabel="مين أكثر واحد؟" maxWidth="6xl" className="min-w-0 gap-3">
      <header className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-center">
        <p className="text-xs font-bold text-amber-300">للاختبار المغلق · محتوى مؤقت</p>
        <h1 className="text-wanas-text-primary mt-1 text-2xl font-black">مين أكثر واحد؟</h1>
        <p className="text-wanas-accent mt-2 text-sm font-black">
          السؤال {view.questionNumber} من {view.totalQuestions}
        </p>
        <p className="text-wanas-text-primary mx-auto mt-3 max-w-3xl text-lg font-bold leading-relaxed sm:text-2xl">
          {view.question}
        </p>
        {view.phase === 'voting' ? (
          <div className="text-wanas-text-muted mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="bg-wanas-surface-soft rounded-full px-3 py-1.5 font-bold">
              صوّت {view.submittedVoteCount} من {view.eligibleVoterCount}
            </span>
            <span className="bg-wanas-primary-surface text-wanas-text-primary rounded-full px-3 py-1.5 font-mono font-black">
              {remainingSeconds ?? 0}ث
            </span>
          </div>
        ) : null}
      </header>

      {view.phase === 'voting' ? (
        <VotingPanel view={view} busy={submitting} onVote={vote} />
      ) : (
        <RevealPanel result={view.result} />
      )}

      {view.phase === 'completed' ? (
        <MatchRecap view={view} busy={submitting} onReturn={advance} />
      ) : view.phase === 'reveal' && view.canAdvance ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void advance()}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 text-base font-black text-white disabled:opacity-50"
        >
          السؤال التالي
        </button>
      ) : view.phase === 'reveal' ? (
        <p className="text-wanas-text-muted text-center text-sm">بانتظار المضيف للسؤال التالي.</p>
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

function VotingPanel(props: {
  view: MostLikelyToPlayerView;
  busy: boolean;
  onVote: (playerId: string) => Promise<boolean>;
}) {
  return (
    <>
      <section
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        aria-label="خيارات التصويت"
      >
        {props.view.nominees.map((nominee) => {
          const selected = props.view.ownVotePlayerId === nominee.playerId;
          const self = props.view.selfPlayerId === nominee.playerId;
          return (
            <button
              key={nominee.playerId}
              type="button"
              aria-pressed={selected}
              disabled={!props.view.canVote || props.busy}
              onClick={() => void props.onVote(nominee.playerId)}
              className={cn(
                'border-wanas-border bg-wanas-surface relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition disabled:cursor-default',
                props.view.canVote &&
                  'hover:border-wanas-accent focus-visible:outline-wanas-accent focus-visible:outline-2',
                selected && 'border-wanas-accent bg-wanas-primary-surface ring-wanas-accent ring-2',
              )}
            >
              <PlayerAvatar
                playerId={nominee.playerId}
                playerName={nominee.name}
                className="size-14 sm:size-16"
              />
              <span className="text-wanas-text-primary text-sm font-black">{nominee.name}</span>
              {self ? <span className="text-wanas-text-muted text-[11px]">أنت</span> : null}
              {selected ? (
                <span className="bg-wanas-accent absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold text-white">
                  اختيارك
                </span>
              ) : null}
            </button>
          );
        })}
      </section>
      {props.busy ? (
        <p className="text-wanas-accent text-center text-xs font-bold">جارٍ تثبيت اختيارك…</p>
      ) : props.view.isWaitingForNextQuestion ? (
        <SpectatorNotice
          title="بانتظار السؤال التالي"
          description="انضممت أثناء هذا السؤال؛ ستدخل قائمة التصويت والترشيح في السؤال التالي."
        />
      ) : !props.view.canVote ? (
        <SpectatorNotice
          title="مشاهدة فقط"
          description="ترى السؤال والتقدم، لكنك لست ضمن لقطة المشاركين لهذا السؤال."
        />
      ) : (
        <p className="text-wanas-text-muted text-center text-xs">
          يمكنك تغيير اختيارك حتى ينتهي التصويت. لن يظهر اختيارك للآخرين قبل الكشف.
        </p>
      )}
    </>
  );
}

function RevealPanel({ result }: { result: MostLikelyToQuestionResult | null }) {
  if (!result) return null;
  if (result.totalVotes === 0) {
    return (
      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🤷
        </p>
        <h2 className="text-wanas-text-primary mt-2 text-xl font-black">
          لا توجد أصوات لهذا السؤال
        </h2>
        <p className="text-wanas-text-muted mt-1 text-sm">ولا أحد يحصل على التاج هذه المرة.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="نتيجة السؤال">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {result.nominees
          .slice()
          .sort((left, right) => right.voteCount - left.voteCount)
          .map((nominee) => {
            const top = result.topNomineePlayerIds.includes(nominee.playerId);
            return (
              <article
                key={nominee.playerId}
                className={cn(
                  'border-wanas-border bg-wanas-surface relative flex min-h-40 flex-col items-center rounded-2xl border p-3 text-center',
                  top && 'border-red-400 bg-red-500/15 shadow-[0_0_28px_rgba(239,68,68,0.28)]',
                )}
              >
                {top ? (
                  <span
                    className="absolute -top-3 text-3xl motion-safe:animate-bounce"
                    aria-label="من الأكثر ترشيحًا"
                  >
                    👑
                  </span>
                ) : null}
                <PlayerAvatar
                  playerId={nominee.playerId}
                  playerName={nominee.name}
                  className="mt-2 size-14"
                />
                <h2 className="text-wanas-text-primary mt-2 font-black">{nominee.name}</h2>
                <p className="text-wanas-accent text-lg font-black">{nominee.voteCount} صوت</p>
                <p className="text-wanas-text-muted mt-1 text-xs leading-relaxed">
                  {nominee.voterNames.length > 0
                    ? `صوّت له: ${nominee.voterNames.join('، ')}`
                    : 'لم يصوّت له أحد'}
                </p>
              </article>
            );
          })}
      </div>
      <details className="border-wanas-border bg-wanas-surface rounded-xl border p-3">
        <summary className="text-wanas-text-primary cursor-pointer text-sm font-bold">
          عرض كل اختيارات اللاعبين
        </summary>
        <ul className="text-wanas-text-muted mt-2 space-y-1 text-sm">
          {result.votes.map((vote) => (
            <li key={vote.voterPlayerId} className="bg-wanas-surface-soft rounded-lg px-3 py-2">
              {vote.voterName} صوّت لـ {vote.nomineeName}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function MatchRecap(props: {
  view: MostLikelyToPlayerView;
  busy: boolean;
  onReturn: () => Promise<boolean>;
}) {
  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-4">
      <h2 className="text-wanas-text-primary text-center text-2xl font-black">
        خلاصة الأسئلة العشرة
      </h2>
      <AggregateSummary aggregate={props.view.aggregate} />
      <ol className="mt-4 space-y-2">
        {props.view.recap.map((result) => (
          <li key={result.questionId} className="bg-wanas-surface-soft rounded-xl p-3">
            <p className="text-wanas-text-primary text-sm font-bold">
              {result.questionNumber}. {result.question}
            </p>
            <p className="text-wanas-text-muted mt-1 text-xs">
              {result.totalVotes === 0
                ? 'لم يصوّت أحد.'
                : result.topNomineePlayerIds
                    .map((playerId) => {
                      const nominee = result.nominees.find((entry) => entry.playerId === playerId);
                      return nominee ? `${nominee.name} (${nominee.voteCount} صوت)` : null;
                    })
                    .filter(Boolean)
                    .join('، ')}
            </p>
          </li>
        ))}
      </ol>
      {props.view.canAdvance ? (
        <button
          type="button"
          disabled={props.busy}
          onClick={() => void props.onReturn()}
          className="bg-wanas-accent mt-4 min-h-12 w-full rounded-xl px-4 font-black text-white disabled:opacity-50"
        >
          العودة إلى الغرفة
        </button>
      ) : (
        <p className="text-wanas-text-muted mt-4 text-center text-sm">
          بانتظار المضيف للعودة إلى الغرفة.
        </p>
      )}
    </section>
  );
}

function AggregateSummary({ aggregate }: { aggregate: MostLikelyToAggregateResult | null }) {
  if (!aggregate || aggregate.totalVotes === 0) {
    return (
      <p className="text-wanas-text-muted mt-2 text-center text-sm">
        لا توجد ترشيحات مجمعة في هذه المباراة.
      </p>
    );
  }
  const names = aggregate.topNomineePlayerIds
    .map((playerId) => aggregate.nominees.find((entry) => entry.playerId === playerId)?.name)
    .filter(Boolean)
    .join('، ');
  return (
    <div className="border-wanas-accent/40 bg-wanas-primary-surface mt-3 rounded-xl border p-3 text-center">
      <p className="text-3xl" aria-hidden>
        👑
      </p>
      <p className="text-wanas-text-primary font-black">الأكثر ترشيحًا خلال الجلسة: {names}</p>
      <p className="text-wanas-text-muted mt-1 text-xs">
        ملخص مرح فقط — لا توجد نقاط أو فائز رسمي.
      </p>
    </div>
  );
}
