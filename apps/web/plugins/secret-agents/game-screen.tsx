'use client';

import { useEffect, useState } from 'react';
import type {
  SecretAgentsCardType,
  SecretAgentsPlayerView,
  SecretAgentsRole,
  SecretAgentsTeam,
} from '@wanasatna/shared';
import { SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useGameShell } from '@/contexts/game-shell-context';
import { cn } from '@/lib/utils';
import { useSecretAgentsPlayerView } from './use-player-view';

const roleLabel: Record<SecretAgentsRole, string> = {
  spymaster: 'قائد',
  operative: 'مخمّن',
};

const typeLabel: Record<SecretAgentsCardType, string> = {
  red: 'عميل أحمر',
  blue: 'عميل أزرق',
  neutral: 'محايد',
  assassin: 'القاتل',
};

function useRemainingSeconds(deadlineAtMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineAtMs === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineAtMs]);
  return deadlineAtMs === null ? null : Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
}

export function SecretAgentsGameScreen() {
  const { state: shell } = useGameShell();
  const enabled = shell?.gameId === SECRET_AGENTS_GAME_ID && shell.phase === 'PLAYING';
  const {
    view,
    error,
    loading,
    submitting,
    assign,
    submitClue,
    toggleNomination,
    confirmCard,
    pass,
  } = useSecretAgentsPlayerView(enabled);
  const [clueWord, setClueWord] = useState('');
  const [clueValue, setClueValue] = useState<string>('1');
  const remainingSeconds = useRemainingSeconds(
    view?.phase === 'paused' ? (view.recoveryDeadlineAtMs ?? null) : (view?.deadlineAtMs ?? null),
  );

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  const isUnassigned = !view.selfAssignment;
  const activeTeamLabel = view.activeTeam === 'red' ? 'الأحمر' : 'الأزرق';

  return (
    <GameScreen ariaLabel="العملاء السريون" maxWidth="6xl" className="min-w-0 gap-3">
      <header className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-amber-300">اختبار مغلق</p>
            <h1 className="text-wanas-text-primary text-xl font-black">العملاء السريون</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-red-500/20 px-3 py-1.5 text-red-100">
              الأحمر: {view.remainingByTeam.red}
            </span>
            <span className="rounded-full bg-blue-500/20 px-3 py-1.5 text-blue-100">
              الأزرق: {view.remainingByTeam.blue}
            </span>
          </div>
        </div>
        <div className="text-wanas-text-muted mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>الدور {view.turnNumber}</span>
          <span>•</span>
          <span>فريق {activeTeamLabel}</span>
          <span>•</span>
          <span>
            {view.phase === 'clue'
              ? 'بانتظار التلميح'
              : view.phase === 'guessing'
                ? 'مرحلة التخمين'
                : view.phase === 'paused'
                  ? 'المباراة متوقفة مؤقتًا'
                  : 'انتهت المباراة'}
          </span>
          {remainingSeconds !== null ? (
            <span className="text-wanas-text-primary rounded-lg bg-black/20 px-2 py-1 font-mono font-black">
              {remainingSeconds}ث
            </span>
          ) : null}
        </div>
        {view.clue ? (
          <p className="border-wanas-accent/40 bg-wanas-primary-surface text-wanas-text-primary mt-3 rounded-xl border p-3 text-center font-bold">
            التلميح: {view.clue.word} — {view.clue.value === 'unlimited' ? '∞' : view.clue.value}
            {view.maxConfirmedGuesses !== null
              ? ` · المتبقي ${Math.max(0, view.maxConfirmedGuesses - view.confirmedGuesses)}`
              : ' · بلا حد عددي'}
          </p>
        ) : null}
      </header>

      {view.phase === 'paused' ? (
        <section className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-center">
          <h2 className="font-bold text-amber-100">توقف آمن بانتظار لاعب مؤهل</h2>
          <p className="text-wanas-text-muted mt-1 text-sm">
            {view.pauseReason === 'missing-spymaster'
              ? 'لا يوجد قائد متصل للفريق النشط.'
              : 'لا يوجد مخمّن متصل للفريق النشط.'}{' '}
            سيعود المؤقت من نفس الوقت عند عودة لاعب مؤهل.
          </p>
        </section>
      ) : null}

      {isUnassigned && view.phase !== 'completed' ? (
        <MidMatchAssignment busy={submitting} onAssign={assign} />
      ) : null}

      {view.canSubmitClue ? (
        <form
          className="border-wanas-border bg-wanas-surface rounded-2xl border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = clueValue === 'unlimited' ? 'unlimited' : Number(clueValue);
            void submitClue(clueWord, value).then((accepted) => {
              if (accepted) setClueWord('');
            });
          }}
        >
          <h2 className="text-wanas-text-primary text-sm font-bold">قدّم تلميحًا واحدًا</h2>
          <p className="text-wanas-text-muted mt-1 text-xs">
            كلمة واحدة مرتبطة بالمعنى، وليست كلمة ظاهرة على اللوح. الخلافات الدلالية يناقشها
            اللاعبون خارج الأزرار.
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <input
              value={clueWord}
              onChange={(event) => setClueWord(event.target.value)}
              maxLength={32}
              placeholder="كلمة التلميح"
              className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus:border-wanas-accent h-12 min-w-0 rounded-xl border px-3 outline-none"
            />
            <select
              value={clueValue}
              onChange={(event) => setClueValue(event.target.value)}
              className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary h-12 rounded-xl border px-2"
            >
              <option value="0">0</option>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              <option value="unlimited">∞</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !clueWord.trim()}
            className="bg-wanas-accent mt-2 min-h-11 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
          >
            اعتماد التلميح
          </button>
        </form>
      ) : null}

      {view.selfAssignment?.role === 'spymaster' && view.secretKey ? (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2 text-center text-xs font-bold text-amber-100">
          المفتاح السري ظاهر لك لأن دورك قائد. لا تشارك الألوان مع المخمّنين.
        </p>
      ) : null}

      <section className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="لوحة الكلمات 5 في 5">
        {view.cards
          .slice()
          .sort((left, right) => left.position - right.position)
          .map((card) => {
            const privateType = view.secretKey?.[card.id] ?? null;
            const visualType = card.revealedType ?? privateType;
            const selfNominated = card.nominations.some(
              (nomination) => nomination.playerId === view.selfPlayerId,
            );
            return (
              <article
                key={card.id}
                className={cn(
                  'relative flex min-h-24 min-w-0 flex-col items-stretch justify-between overflow-hidden rounded-xl border p-1.5 sm:min-h-28 sm:p-2',
                  cardColor(visualType, card.revealed),
                  selfNominated && !card.revealed && 'ring-2 ring-amber-300',
                )}
              >
                <button
                  type="button"
                  disabled={!view.canNominate || card.revealed || submitting}
                  onClick={() => void toggleNomination(card.id)}
                  className="text-wanas-text-primary flex min-h-12 flex-1 items-center justify-center break-words text-center text-[11px] font-black leading-tight disabled:cursor-default sm:text-base"
                  aria-label={`${card.word}${view.canNominate ? ' — تبديل ترشيحي' : ''}`}
                >
                  {card.word}
                </button>
                {card.nominations.length > 0 && !card.revealed ? (
                  <p className="line-clamp-2 text-center text-[9px] leading-tight text-amber-100 sm:text-[11px]">
                    {card.nominations.map((entry) => entry.name).join('، ')}
                  </p>
                ) : null}
                {view.canConfirm && !card.revealed ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void confirmCard(card.id)}
                    className="absolute left-1 top-1 flex size-8 items-center justify-center rounded-lg border border-emerald-200/50 bg-emerald-500 text-base font-black text-white shadow disabled:opacity-50"
                    aria-label={`تأكيد ${card.word} كإجابة نهائية`}
                  >
                    ✓
                  </button>
                ) : null}
                {card.revealedType ? (
                  <span className="text-center text-[9px] font-bold text-white/90 sm:text-xs">
                    {typeLabel[card.revealedType]}
                  </span>
                ) : null}
              </article>
            );
          })}
      </section>

      {view.canNominate ? (
        <p className="text-wanas-text-muted text-center text-xs">
          اضغط متن البطاقة لترشيحها لفريقك فقط. زر ✓ في الزاوية يثبت الإجابة فورًا.
        </p>
      ) : null}
      {view.canPass ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void pass()}
          className="border-wanas-border bg-wanas-surface text-wanas-text-primary min-h-12 rounded-xl border px-4 font-bold disabled:opacity-50"
        >
          إنهاء الدور
        </button>
      ) : null}

      {view.phase === 'completed' ? (
        <ResultPanel winner={view.winnerTeam} reason={view.resultReason} />
      ) : null}

      <TeamRoster view={view} />

      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3">
        <h2 className="text-wanas-text-primary text-sm font-bold">سجل المباراة</h2>
        <ol className="text-wanas-text-muted mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
          {view.log.map((entry) => (
            <li key={entry.id} className="bg-wanas-surface-soft rounded-lg px-2 py-1.5">
              <span className={entry.team === 'red' ? 'text-red-200' : 'text-blue-200'}>
                الدور {entry.turnNumber}:
              </span>{' '}
              {entry.text}
              {entry.revealedType ? ` (${typeLabel[entry.revealedType]})` : ''}
            </li>
          ))}
        </ol>
      </section>

      {isUnassigned ? (
        <SpectatorNotice
          title="أنت غير معيّن حاليًا"
          description="ترى الحالة العامة فقط حتى تختار فريقًا ودورًا مرة واحدة."
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

function cardColor(type: SecretAgentsCardType | null, revealed: boolean): string {
  if (type === 'red')
    return revealed ? 'border-red-300 bg-red-600' : 'border-red-400/50 bg-red-500/20';
  if (type === 'blue')
    return revealed ? 'border-blue-300 bg-blue-600' : 'border-blue-400/50 bg-blue-500/20';
  if (type === 'neutral')
    return revealed ? 'border-stone-300 bg-stone-500' : 'border-stone-300/40 bg-stone-400/15';
  if (type === 'assassin')
    return revealed ? 'border-white/30 bg-black' : 'border-purple-400/50 bg-purple-950/50';
  return 'border-wanas-border bg-wanas-surface';
}

function MidMatchAssignment(props: {
  busy: boolean;
  onAssign: (team: SecretAgentsTeam, role: SecretAgentsRole) => Promise<boolean>;
}) {
  return (
    <section className="border-wanas-accent/50 bg-wanas-primary-surface rounded-2xl border p-3">
      <h2 className="text-wanas-text-primary text-sm font-bold">
        انضم إلى المباراة من حالتها الحالية
      </h2>
      <p className="text-wanas-text-muted mt-1 text-xs">
        اختيارك يثبت مرة واحدة حتى نهاية المباراة.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['red', 'blue'] as const).flatMap((team) =>
          (['spymaster', 'operative'] as const).map((role) => (
            <button
              key={`${team}-${role}`}
              type="button"
              disabled={props.busy}
              onClick={() => void props.onAssign(team, role)}
              className={cn(
                'min-h-11 rounded-xl border px-2 text-xs font-bold disabled:opacity-50',
                team === 'red' ? 'border-red-400 text-red-100' : 'border-blue-400 text-blue-100',
              )}
            >
              {team === 'red' ? 'أحمر' : 'أزرق'} — {roleLabel[role]}
            </button>
          )),
        )}
      </div>
    </section>
  );
}

function TeamRoster({ view }: { view: SecretAgentsPlayerView }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2">
      {(['red', 'blue'] as const).map((team) => (
        <div
          key={team}
          className={cn(
            'rounded-xl border p-3',
            team === 'red' ? 'border-red-400/40' : 'border-blue-400/40',
          )}
        >
          <h2 className="text-wanas-text-primary text-sm font-bold">
            الفريق {team === 'red' ? 'الأحمر' : 'الأزرق'}
          </h2>
          <ul className="text-wanas-text-muted mt-2 space-y-1 text-xs">
            {view.roster
              .filter((entry) => entry.assignment?.team === team)
              .map((entry) => (
                <li key={entry.playerId} className={entry.isConnected ? '' : 'opacity-50'}>
                  {entry.name} — {entry.assignment ? roleLabel[entry.assignment.role] : ''}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ResultPanel(props: {
  winner: SecretAgentsTeam | null;
  reason: 'agents-found' | 'assassin' | 'opponent-agent' | 'recovery-expired' | null;
}) {
  const noWinner = props.winner === null;
  return (
    <section
      className={cn(
        'rounded-2xl border p-5 text-center',
        noWinner
          ? 'border-amber-400/50 bg-amber-400/10'
          : props.winner === 'red'
            ? 'border-red-300 bg-red-600/30'
            : 'border-blue-300 bg-blue-600/30',
      )}
    >
      <h2 className="text-wanas-text-primary text-2xl font-black">
        {noWinner
          ? 'انتهت المباراة بلا فائز'
          : `فاز الفريق ${props.winner === 'red' ? 'الأحمر' : 'الأزرق'}`}
      </h2>
      <p className="text-wanas-text-muted mt-2 text-sm">
        {props.reason === 'assassin'
          ? 'حُسمت المباراة بكشف القاتل.'
          : props.reason === 'opponent-agent'
            ? 'اكتملت بطاقات الفريق الفائز عبر تخمين الخصم.'
            : props.reason === 'recovery-expired'
              ? 'انتهت مهلة عودة اللاعب المؤهل.'
              : 'كُشفت جميع بطاقات الفريق.'}
      </p>
    </section>
  );
}
