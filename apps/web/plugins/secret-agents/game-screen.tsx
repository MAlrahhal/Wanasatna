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
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { secretAgentsExperienceMeta } from '@/lib/game/experimental-game-experience';
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

export function SecretAgentsGameScreen() {
  const { state: shell } = useGameShell();
  const setExperienceMeta = useSetGameExperienceMeta();
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

  useEffect(() => {
    if (!enabled) {
      setExperienceMeta(null);
      return;
    }
    setExperienceMeta(
      view
        ? secretAgentsExperienceMeta(view)
        : { gameName: 'العملاء السريون', gameIcon: '🕵️', phaseLabel: 'جارٍ التحميل…' },
    );
  }, [enabled, setExperienceMeta, view]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  const isUnassigned = !view.selfAssignment;
  const activeTeamLabel = view.activeTeam === 'red' ? 'الأحمر' : 'الأزرق';

  return (
    <GameScreen ariaLabel="العملاء السريون" maxWidth="6xl" className="min-w-0 gap-3">
      <section
        className={cn(
          'grid gap-3 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4',
          view.activeTeam === 'red'
            ? 'border-red-400/35 bg-red-500/10'
            : 'border-blue-400/35 bg-blue-500/10',
        )}
        aria-label="حالة الدور"
      >
        <div className="min-w-0 text-center sm:text-right">
          <p className="text-wanas-text-muted text-xs font-bold">
            {view.phase === 'clue'
              ? `بانتظار تلميح قائد ${activeTeamLabel}`
              : view.phase === 'guessing'
                ? `مخمّنو ${activeTeamLabel} يختارون الآن`
                : view.phase === 'paused'
                  ? 'الدور محفوظ حتى عودة لاعب مؤهل'
                  : 'اكتملت المباراة'}
          </p>
          {view.clue ? (
            <p className="text-wanas-text-primary mt-1 truncate text-xl font-black sm:text-2xl">
              {view.clue.word}{' '}
              <span className="text-wanas-accent">
                · {view.clue.value === 'unlimited' ? '∞' : view.clue.value}
              </span>
            </p>
          ) : (
            <p className="text-wanas-text-primary mt-1 text-lg font-black">
              {view.selfAssignment
                ? `دورك: ${roleLabel[view.selfAssignment.role]} — ${view.selfAssignment.team === 'red' ? 'الأحمر' : 'الأزرق'}`
                : 'تابع اللوحة واختر دورًا متاحًا'}
            </p>
          )}
          {view.clue ? (
            <p className="text-wanas-text-muted mt-1 text-xs">
              {view.maxConfirmedGuesses !== null
                ? `باقي ${Math.max(0, view.maxConfirmedGuesses - view.confirmedGuesses)} تخمينات مؤكدة`
                : 'عدد التخمينات غير محدود'}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <span className="min-w-24 rounded-xl border border-red-300/25 bg-red-500/15 px-3 py-2 text-center text-xs font-black text-red-100">
            🔴 {view.remainingByTeam.red} متبقٍ
          </span>
          <span className="min-w-24 rounded-xl border border-blue-300/25 bg-blue-500/15 px-3 py-2 text-center text-xs font-black text-blue-100">
            🔵 {view.remainingByTeam.blue} متبقٍ
          </span>
        </div>
      </section>

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

      <section
        className="rounded-2xl border border-white/5 bg-black/10 p-1.5 shadow-inner sm:p-2"
        aria-label="لوحة العملاء السريين"
      >
        <div className="grid grid-cols-5 gap-1 sm:gap-2" aria-label="لوحة الكلمات 5 في 5">
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
                    'relative flex min-h-[4.75rem] min-w-0 flex-col items-stretch justify-between overflow-hidden rounded-lg border p-1 sm:min-h-28 sm:rounded-xl sm:p-2',
                    cardColor(visualType, card.revealed),
                    selfNominated && !card.revealed && 'ring-2 ring-amber-300',
                  )}
                >
                  <button
                    type="button"
                    disabled={!view.canNominate || card.revealed || submitting}
                    onClick={() => void toggleNomination(card.id)}
                    className="text-wanas-text-primary flex min-h-10 flex-1 items-center justify-center text-center text-xs font-black leading-tight [overflow-wrap:anywhere] disabled:cursor-default sm:min-h-12 sm:text-base"
                    aria-label={`${card.word}${view.canNominate ? ' — تبديل ترشيحي' : ''}`}
                  >
                    {card.word}
                  </button>
                  {card.nominations.length > 0 && !card.revealed ? (
                    <p className="line-clamp-1 text-center text-[9px] font-bold leading-tight text-amber-100 sm:text-[11px]">
                      ترشيحات: {card.nominations.length}
                    </p>
                  ) : null}
                  {view.canConfirm && !card.revealed ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void confirmCard(card.id)}
                      className="absolute inset-x-1 bottom-1 flex min-h-8 items-center justify-center rounded-md border border-emerald-200/50 bg-emerald-500/95 px-1 text-[10px] font-black text-white shadow disabled:opacity-50 sm:inset-x-2 sm:min-h-9 sm:text-xs"
                      aria-label={`تأكيد ${card.word} كإجابة نهائية`}
                    >
                      تأكيد ✓
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
        </div>
      </section>

      {view.canNominate ? (
        <p className="text-wanas-text-muted text-center text-xs">
          اضغط الكلمة لترشيحها لفريقك فقط. زر «تأكيد ✓» إجراء نهائي منفصل.
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

      <details className="border-wanas-border bg-wanas-surface rounded-2xl border p-3">
        <summary className="text-wanas-text-primary cursor-pointer text-sm font-bold">
          سجل المباراة ({view.log.length})
        </summary>
        <ol className="text-wanas-text-muted mt-2 max-h-52 space-y-1 overflow-y-auto text-xs">
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
      </details>

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
                <li
                  key={entry.playerId}
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-lg bg-black/10 px-2 py-1.5',
                    !entry.isConnected && 'opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      entry.isConnected ? 'bg-emerald-300' : 'bg-slate-500',
                    )}
                    aria-label={entry.isConnected ? 'متصل' : 'غير متصل'}
                  />
                  <span className="min-w-0 flex-1 truncate" title={entry.name}>
                    {entry.name}
                  </span>
                  <span className="shrink-0 font-bold">
                    {entry.assignment ? roleLabel[entry.assignment.role] : ''}
                  </span>
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
