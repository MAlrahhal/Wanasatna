'use client';

import { useEffect, useState } from 'react';
import type { EmojiLanguagePlayerView } from '@wanasatna/shared';
import { EMOJI_LANGUAGE_GAME_ID, EMOJI_LANGUAGE_PICKER } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useGameShell } from '@/contexts/game-shell-context';
import { cn } from '@/lib/utils';
import { useEmojiLanguagePlayerView } from './use-player-view';

function useRemainingSeconds(deadlineAtMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineAtMs === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineAtMs]);
  return deadlineAtMs === null ? null : Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
}

function EmojiSequence({ emojis, label }: { emojis: readonly string[]; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="border-wanas-accent/40 bg-wanas-primary-surface flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl border p-4 text-4xl leading-none sm:text-5xl"
    >
      {emojis.map((emoji, index) => (
        <span key={`${emoji}-${index}`} aria-hidden>
          {emoji}
        </span>
      ))}
    </div>
  );
}

export function EmojiLanguageGameScreen() {
  const { state: shell } = useGameShell();
  const enabled = shell?.gameId === EMOJI_LANGUAGE_GAME_ID && shell.phase === 'PLAYING';
  const { view, error, feedback, loading, submitting, clearFeedback, submitClue, submitGuess } =
    useEmojiLanguagePlayerView(enabled);
  const remainingSeconds = useRemainingSeconds(view?.deadlineAtMs ?? null);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  return (
    <GameScreen ariaLabel="لغة الإيموجي" maxWidth="4xl" className="min-w-0 gap-3">
      <header className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-amber-300">اختبار مغلق</p>
            <h1 className="text-wanas-text-primary text-xl font-black">لغة الإيموجي</h1>
          </div>
          <div className="text-wanas-text-muted flex items-center gap-2 text-xs font-bold">
            <span>
              الجولة {view.currentRound}/{view.totalRounds}
            </span>
            <span className="border-wanas-border bg-wanas-surface-soft rounded-full border px-3 py-1.5">
              {view.mode === 'player-clue' ? 'لاعب يشرح' : 'لغز جاهز'}
            </span>
            {remainingSeconds !== null ? (
              <span className="text-wanas-text-primary rounded-lg bg-black/20 px-2 py-1 font-mono text-base font-black">
                {remainingSeconds}ث
              </span>
            ) : null}
          </div>
        </div>
        {view.writerName ? (
          <p className="text-wanas-text-muted mt-2 text-sm">
            كاتب الجولة:{' '}
            <span className="text-wanas-text-primary font-bold">{view.writerName}</span>
          </p>
        ) : null}
      </header>

      <InteractiveRound
        key={view.roundId}
        view={view}
        submitting={submitting}
        feedback={feedback}
        clearFeedback={clearFeedback}
        submitClue={submitClue}
        submitGuess={submitGuess}
      />

      {view.phase === 'round-results' || view.phase === 'completed' ? (
        <ResultsPanel view={view} />
      ) : null}

      {view.isSpectator ? (
        <SpectatorNotice
          title="أنت متفرج في هذه المباراة"
          description="يمكنك متابعة التلميح والنتائج، لكن لا يمكنك إرسال رمز أو تخمين."
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

function InteractiveRound(props: {
  view: EmojiLanguagePlayerView;
  submitting: boolean;
  feedback: { correct: boolean } | null;
  clearFeedback: () => void;
  submitClue: (emojis: string[]) => Promise<unknown>;
  submitGuess: (answer: string) => Promise<{ feedback?: { correct: boolean } } | null>;
}) {
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const { view } = props;

  if (view.phase === 'preparation') {
    return view.canSubmitClue ? (
      <WriterComposer
        answer={view.privateAnswer ?? ''}
        selected={selectedEmojis}
        busy={props.submitting}
        onAdd={(emoji) => {
          if (selectedEmojis.length < 10) setSelectedEmojis([...selectedEmojis, emoji]);
        }}
        onRemove={(index) =>
          setSelectedEmojis(selectedEmojis.filter((_, candidate) => candidate !== index))
        }
        onSubmit={() => void props.submitClue(selectedEmojis)}
      />
    ) : (
      <WaitingPanel
        title="الكاتب يجهّز التلميح الآن"
        description="ستظهر الرموز هنا فور اعتمادها. الإجابة لا تظهر للمخمّنين أو المتفرجين."
      />
    );
  }

  if (view.phase !== 'guessing') return null;

  return (
    <section className="space-y-3">
      {view.clue ? <EmojiSequence emojis={view.clue} label="تلميح الإيموجي الثابت" /> : null}
      <p className="text-wanas-text-muted text-center text-xs">
        أُجيبت إجابات صحيحة: {view.correctAnswerCount}. تستمر الجولة حتى انتهاء المؤقت.
      </p>
      {view.isWriter ? (
        <WaitingPanel
          title="تم تثبيت تلميحك"
          description={`الإجابة الخاصة بك: ${view.privateAnswer ?? ''}. لا يمكنك التخمين في جولتك.`}
        />
      ) : view.canGuess ? (
        <GuessForm
          answer={answer}
          busy={props.submitting}
          feedback={
            props.feedback?.correct === true
              ? 'إجابة صحيحة واعتمد ترتيبك!'
              : props.feedback
                ? 'ليست الإجابة، حاول مجددًا بعد لحظة.'
                : null
          }
          onAnswer={(value) => {
            setAnswer(value);
            if (props.feedback) props.clearFeedback();
          }}
          onSubmit={() => {
            void props.submitGuess(answer).then((result) => {
              if (result?.feedback?.correct) setAnswer('');
            });
          }}
        />
      ) : view.ownCorrect ? (
        <WaitingPanel
          title={`إجابة صحيحة — ترتيبك ${view.ownPlacement}`}
          description="ثبتت إجابتك. تستمر الجولة حتى انتهاء الوقت لإتاحة الفرصة للجميع."
        />
      ) : null}
    </section>
  );
}

function WriterComposer(props: {
  answer: string;
  selected: string[];
  busy: boolean;
  onAdd: (emoji: string) => void;
  onRemove: (index: number) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-3 rounded-2xl border p-3 sm:p-4">
      <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-center">
        <p className="text-xs font-bold text-amber-200">الإجابة الخاصة بك — لا تعرضها للآخرين</p>
        <p className="text-wanas-text-primary mt-1 text-xl font-black">{props.answer}</p>
      </div>
      <div className="border-wanas-border bg-wanas-surface-soft min-h-20 rounded-xl border p-3">
        {props.selected.length ? (
          <div
            className="flex flex-wrap justify-center gap-2"
            aria-label="الرموز المختارة بالترتيب"
          >
            {props.selected.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => props.onRemove(index)}
                className="border-wanas-border bg-wanas-surface flex size-12 items-center justify-center rounded-xl border text-2xl"
                aria-label={`حذف الرمز رقم ${index + 1}: ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-wanas-text-muted py-3 text-center text-sm">اختر من 1 إلى 10 رموز.</p>
        )}
      </div>
      <div
        className="grid max-h-64 grid-cols-7 gap-1.5 overflow-y-auto rounded-xl p-1 sm:grid-cols-10"
        aria-label="لوحة إيموجي اللعبة"
      >
        {EMOJI_LANGUAGE_PICKER.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={props.selected.length >= 10}
            onClick={() => props.onAdd(emoji)}
            className="border-wanas-border bg-wanas-surface-soft hover:border-wanas-accent flex aspect-square min-h-11 items-center justify-center rounded-xl border text-xl disabled:opacity-35 sm:text-2xl"
            aria-label={`إضافة ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={props.busy || props.selected.length < 1 || props.selected.length > 10}
        onClick={props.onSubmit}
        className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
      >
        اعتماد التلميح نهائيًا ({props.selected.length}/10)
      </button>
    </section>
  );
}

function GuessForm(props: {
  answer: string;
  busy: boolean;
  feedback: string | null;
  onAnswer: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="border-wanas-border bg-wanas-surface rounded-2xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (props.answer.trim()) props.onSubmit();
      }}
    >
      <label className="text-wanas-text-primary text-sm font-bold" htmlFor="emoji-language-answer">
        اكتب الإجابة
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="emoji-language-answer"
          value={props.answer}
          onChange={(event) => props.onAnswer(event.target.value)}
          maxLength={100}
          autoComplete="off"
          className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus:border-wanas-accent h-12 min-w-0 flex-1 rounded-xl border px-3 outline-none"
          placeholder="ما معنى الرموز؟"
        />
        <button
          type="submit"
          disabled={props.busy || !props.answer.trim()}
          className="bg-wanas-accent min-h-12 rounded-xl px-6 font-bold text-white disabled:opacity-50"
        >
          إرسال التخمين
        </button>
      </div>
      {props.feedback ? (
        <p className="text-wanas-text-muted mt-2 text-sm">{props.feedback}</p>
      ) : null}
    </form>
  );
}

function WaitingPanel({ title, description }: { title: string; description: string }) {
  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-5 text-center">
      <h2 className="text-wanas-text-primary font-bold">{title}</h2>
      <p className="text-wanas-text-muted mt-2 text-sm">{description}</p>
    </section>
  );
}

function ResultsPanel({ view }: { view: EmojiLanguagePlayerView }) {
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-3 rounded-2xl border p-4">
      <div className="text-center">
        <p className="text-wanas-text-muted text-xs">
          {view.phase === 'completed' ? 'النتائج النهائية' : 'نتيجة الجولة'}
        </p>
        <h2 className="text-wanas-text-primary mt-1 text-xl font-black">{view.revealedAnswer}</h2>
        {view.clue ? (
          <div className="mt-3">
            <EmojiSequence emojis={view.clue} label="تلميح الجولة بعد كشف الإجابة" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-200">انتهى وقت الكاتب دون تلميح.</p>
        )}
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {(view.phase === 'completed' ? view.leaderboard : view.roundResults).map((entry, index) => {
          const total = 'score' in entry ? entry.score : entry.totalPoints;
          return (
            <li
              key={entry.playerId}
              className={cn(
                'border-wanas-border bg-wanas-surface-soft flex items-center justify-between rounded-xl border p-3',
                index === 0 && view.phase === 'completed' && 'border-amber-300/60',
              )}
            >
              <span className="text-wanas-text-primary text-sm font-bold">
                {index + 1}. {entry.name}
              </span>
              <span className="text-wanas-text-muted text-xs">
                {'roundPoints' in entry ? `+${entry.roundPoints} · ` : ''}
                {total} نقطة
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
