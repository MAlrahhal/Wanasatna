'use client';

import { useState } from 'react';
import type { OneWordOnlyPlayerView } from '@wanasatna/shared';
import { ONE_WORD_ONLY_GAME_ID } from '@wanasatna/shared';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameScreen } from '@/components/game/game-card';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useGameShell } from '@/contexts/game-shell-context';
import { useDeadlineClock } from '@/lib/game/use-deadline-clock';
import { cn } from '@/lib/utils';
import { useOneWordOnlyPlayerView } from './use-player-view';

export function OneWordOnlyGameScreen() {
  const { state: shell } = useGameShell();
  const enabled = shell?.gameId === ONE_WORD_ONLY_GAME_ID && shell.phase === 'PLAYING';
  const { view, error, loading, submitting, submitClue, confirmAnswer, advance } =
    useOneWordOnlyPlayerView(enabled);
  const [clueDraft, setClueDraft] = useState({ roundId: '', value: '' });
  const [optionSelection, setOptionSelection] = useState<{
    roundId: string;
    optionId: string | null;
  }>({ roundId: '', optionId: null });
  const remaining = useDeadlineClock(view?.deadlineAtMs ?? null, 200);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;
  const clue = clueDraft.roundId === view.roundId ? clueDraft.value : '';
  const selectedOptionId =
    optionSelection.roundId === view.roundId ? optionSelection.optionId : null;

  return (
    <GameScreen ariaLabel="كلمة وحدة بس" maxWidth="6xl" className="min-w-0 gap-3">
      {view.phase === 'round-reveal' ? (
        <DeadlineProgress
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={10}
          className="h-2"
        />
      ) : null}
      <header className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-amber-300">اختبار مغلق · تعاوني</p>
            <h1 className="text-wanas-text-primary text-xl font-black">كلمة وحدة بس</h1>
          </div>
          <div className="text-wanas-text-muted flex items-center gap-2 text-xs font-bold">
            <span>
              الجولة {view.currentRound} من {view.totalRounds}
            </span>
            {view.deadlineAtMs !== null ? (
              <span
                className="text-wanas-text-primary rounded-lg bg-black/20 px-2 py-1 font-mono text-base font-black"
                aria-label={`الوقت المتبقي ${Math.ceil(remaining)} ثانية`}
              >
                {Math.ceil(remaining)}ث
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-wanas-text-muted mt-2 text-sm">
          المخمّن: <strong className="text-wanas-text-primary">{view.guesserName}</strong> ·{' '}
          {view.correctRoundCount} صحيحة من {view.roundsPlayed} جولات
        </p>
      </header>

      {view.phase === 'clue-writing' ? (
        <ClueWriting
          view={view}
          clue={clue}
          setClue={(value) => setClueDraft({ roundId: view.roundId, value })}
          disabled={submitting}
          onSubmit={async () => {
            if (await submitClue(clue)) setClueDraft({ roundId: view.roundId, value: '' });
          }}
        />
      ) : null}

      {view.phase === 'guessing' ? (
        <Guessing
          view={view}
          selectedOptionId={selectedOptionId}
          setSelectedOptionId={(optionId) =>
            setOptionSelection({ roundId: view.roundId, optionId })
          }
          disabled={submitting}
          onConfirm={() => selectedOptionId && void confirmAnswer(selectedOptionId)}
        />
      ) : null}

      {view.phase === 'round-reveal' ? (
        <RoundReveal view={view} disabled={submitting} onAdvance={() => void advance()} />
      ) : null}

      {view.phase === 'completed' ? <FinalSummary view={view} /> : null}

      {view.isSpectator ? (
        <SpectatorNotice
          title="أنت متفرج في هذه الجولة"
          description="ستدخل ضمن المشاركين عند بداية الجولة التالية إذا بقيت المباراة مستمرة."
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

function ClueWriting(props: {
  view: OneWordOnlyPlayerView;
  clue: string;
  setClue: (value: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const { view } = props;
  if (view.isGuesser) {
    return (
      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-6 text-center">
        <p className="text-wanas-text-primary text-xl font-black">أنت المخمّن</p>
        <p className="text-wanas-text-muted mt-2">
          انتظر تلميحات اللاعبين. لن تظهر لك الإجابة أو كلماتهم الآن.
        </p>
        <p className="mt-3 text-sm text-amber-200">
          أرسل {view.submittedClueCount} من {view.eligibleClueWriterCount} تلميحات
        </p>
      </section>
    );
  }
  if (!view.canSubmitClue && view.ownSubmittedClue) {
    return (
      <section className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-5 text-center">
        <p className="font-bold text-emerald-100">تم تثبيت تلميحك: {view.ownSubmittedClue}</p>
        <p className="text-wanas-text-muted mt-2 text-sm">لا يمكن تعديله. انتظر بقية اللاعبين.</p>
      </section>
    );
  }
  if (!view.privateAnswer) return <WaitingProgress view={view} />;
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4 sm:p-5">
      <div className="border-wanas-accent/50 bg-wanas-primary-surface rounded-xl border p-4 text-center">
        <p className="text-wanas-text-muted text-xs">الكلمة السرية — لا تقلها</p>
        <p className="text-wanas-text-primary mt-1 text-3xl font-black">{view.privateAnswer}</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
        className="space-y-3"
      >
        <label className="text-wanas-text-primary block text-sm font-bold" htmlFor="one-word-clue">
          اكتب كلمة واحدة فقط
        </label>
        <input
          id="one-word-clue"
          value={props.clue}
          onChange={(event) => props.setClue(event.target.value)}
          maxLength={30}
          autoComplete="off"
          className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary min-h-12 w-full rounded-xl border px-4 text-base"
          placeholder="مثال: ساخن"
        />
        <button
          type="submit"
          disabled={props.disabled || !props.clue.trim()}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          إرسال التلميح
        </button>
      </form>
      <p className="text-wanas-text-muted text-xs">
        حروف عربية أو إنجليزية فقط، بلا مسافات أو أرقام أو رموز. بعد الإرسال يُقفل التلميح.
      </p>
    </section>
  );
}

function WaitingProgress({ view }: { view: OneWordOnlyPlayerView }) {
  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-5 text-center">
      <p className="text-wanas-text-primary font-bold">انتظر كتابة التلميحات</p>
      <p className="text-wanas-text-muted mt-2 text-sm">
        أرسل {view.submittedClueCount} من {view.eligibleClueWriterCount}
      </p>
    </section>
  );
}

function Guessing(props: {
  view: OneWordOnlyPlayerView;
  selectedOptionId: string | null;
  setSelectedOptionId: (value: string) => void;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const { view } = props;
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-3 sm:p-5">
      <div className="text-center">
        <h2 className="text-wanas-text-primary text-lg font-black">التلميحات الناجية</h2>
        {view.survivingClues.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="التلميحات الناجية">
            {view.survivingClues.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 font-bold text-emerald-100"
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-wanas-text-muted mt-2 text-sm">
            لم ينجُ أي تلميح. اختر من الخيارات الثمانية.
          </p>
        )}
      </div>
      {view.waitingForGuesser ? (
        <p
          role="status"
          className="rounded-xl bg-amber-300/10 p-3 text-center text-sm text-amber-100"
        >
          بانتظار عودة المخمّن؛ وقت التخمين متوقف ومحفوظ.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="خيارات الإجابة الثمانية">
        {view.answerOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={!view.canConfirmAnswer || props.disabled}
            aria-pressed={props.selectedOptionId === option.id}
            onClick={() => props.setSelectedOptionId(option.id)}
            className={cn(
              'border-wanas-border bg-wanas-surface-soft text-wanas-text-primary min-h-14 rounded-xl border-2 px-4 py-3 text-base font-bold',
              props.selectedOptionId === option.id &&
                'border-wanas-accent bg-wanas-primary-surface',
              view.canConfirmAnswer &&
                'hover:border-wanas-accent focus-visible:ring-wanas-accent focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            {option.text}
          </button>
        ))}
      </div>
      {view.canConfirmAnswer ? (
        <button
          type="button"
          disabled={!props.selectedOptionId || props.disabled}
          onClick={props.onConfirm}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          تأكيد الإجابة
        </button>
      ) : (
        <p className="text-wanas-text-muted text-center text-sm">
          {view.isGuesser
            ? 'بانتظار استئناف وقتك.'
            : `الاختيار والتأكيد للمخمّن ${view.guesserName} فقط.`}
        </p>
      )}
    </section>
  );
}

function RoundReveal({
  view,
  disabled,
  onAdvance,
}: {
  view: OneWordOnlyPlayerView;
  disabled: boolean;
  onAdvance: () => void;
}) {
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4 sm:p-5">
      <div className="text-center">
        <p
          className={cn(
            'text-2xl font-black',
            view.roundWasCorrect ? 'text-emerald-200' : 'text-red-200',
          )}
        >
          {view.roundWasCorrect ? 'إجابة صحيحة!' : 'لم تُحسب هذه الجولة'}
        </p>
        <p className="text-wanas-text-muted mt-2">
          الإجابة الصحيحة:{' '}
          <strong className="text-wanas-text-primary">{view.revealedCorrectAnswer}</strong>
        </p>
        <p className="text-wanas-text-muted">
          اختيار المخمّن:{' '}
          <strong className="text-wanas-text-primary">
            {view.revealedSelectedAnswer ?? 'لم يؤكد إجابة'}
          </strong>
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {view.revealClues.map((entry) => (
          <div
            key={entry.playerId}
            className={cn(
              'rounded-xl border p-3',
              entry.survived
                ? 'border-emerald-300/50 bg-emerald-300/10'
                : 'border-red-300/50 bg-red-300/10',
            )}
          >
            <p className={entry.survived ? 'text-emerald-100' : 'text-red-100'}>
              <strong>{entry.text}</strong> — {entry.playerName}
            </p>
            <p className="mt-1 text-xs opacity-80">
              {entry.survived ? 'ظهر للمخمّن' : 'حُذف بسبب التكرار'}
            </p>
          </div>
        ))}
      </div>
      <p className="text-wanas-text-muted text-center text-sm">
        {view.correctRoundCount} صحيحة من {view.roundsPlayed} جولات
      </p>
      {view.canAdvance ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onAdvance}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          {view.currentRound === view.totalRounds ? 'عرض الملخص' : 'الجولة التالية'}
        </button>
      ) : null}
    </section>
  );
}

function FinalSummary({ view }: { view: OneWordOnlyPlayerView }) {
  return (
    <section className="border-wanas-accent/50 bg-wanas-primary-surface rounded-2xl border p-6 text-center">
      <p className="text-wanas-text-muted text-sm">النتيجة التعاونية النهائية</p>
      <h2 className="text-wanas-text-primary mt-2 text-2xl font-black">
        تعرّفتم على {view.correctRoundCount} من {view.roundsPlayed} كلمات
      </h2>
      {view.resultReason === 'insufficient-players' ? (
        <p className="mt-3 text-sm text-amber-100">
          انتهت المباراة لأن عدد المشاركين أصبح أقل من ثلاثة.
        </p>
      ) : null}
      <p className="text-wanas-text-muted mt-3 text-sm">
        لا توجد نقاط فردية أو فائز؛ النتيجة للمجموعة كلها.
      </p>
    </section>
  );
}
