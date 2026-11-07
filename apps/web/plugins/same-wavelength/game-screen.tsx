'use client';

import { useEffect, useState } from 'react';
import type { SameWavelengthPlayerView } from '@wanasatna/shared';
import { SAME_WAVELENGTH_GAME_ID } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { sameWavelengthExperienceMeta } from '@/lib/game/experimental-game-experience';
import { cn } from '@/lib/utils';
import { useSameWavelengthPlayerView } from './use-player-view';

const teamName = { red: 'الفريق الأحمر', blue: 'الفريق الأزرق' } as const;

export function SameWavelengthGameScreen() {
  const { state: shell } = useGameShell();
  const setExperienceMeta = useSetGameExperienceMeta();
  const enabled = shell?.gameId === SAME_WAVELENGTH_GAME_ID && shell.phase === 'PLAYING';
  const { view, error, loading, submitting, submitClue, propose, confirm, next } =
    useSameWavelengthPlayerView(enabled);

  useEffect(() => {
    if (!enabled) {
      setExperienceMeta(null);
      return;
    }
    setExperienceMeta(
      view
        ? sameWavelengthExperienceMeta(view)
        : { gameName: 'على نفس الموجة', gameIcon: '〰️', phaseLabel: 'جارٍ التحميل…' },
    );
  }, [enabled, setExperienceMeta, view]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  return (
    <GameScreen ariaLabel="على نفس الموجة" maxWidth="4xl" className="min-w-0 gap-3">
      <MatchHeader view={view} />

      {view.phase === 'clue-writing' ? (
        <CluePhase view={view} busy={submitting} submitClue={submitClue} />
      ) : view.phase === 'guessing' ? (
        <GuessingPhase
          key={view.turnId}
          view={view}
          busy={submitting}
          propose={propose}
          confirm={confirm}
        />
      ) : (
        <ResultsPhase view={view} busy={submitting} next={next} />
      )}

      {view.isSpectator ? (
        <SpectatorNotice
          title="أنت متفرج في هذه المباراة"
          description="يمكنك متابعة الطيف والتلميح والنتائج، لكن لا يمكنك إرسال علامة."
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

function MatchHeader({ view }: { view: SameWavelengthPlayerView }) {
  return (
    <section className="border-wanas-border bg-wanas-surface flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2.5">
      <div>
        <p className="text-wanas-text-primary text-sm font-bold">
          {view.mode === 'team'
            ? `الجولة ${view.currentRound} من ${view.totalRounds} — دور ${teamName[view.activeTeam!]}`
            : `الجولة ${view.currentRound} من ${view.totalRounds}`}
        </p>
        <p className="text-wanas-text-muted mt-0.5 text-xs">
          الملمّح: {view.clueGiverName ?? 'غير متاح'}
        </p>
      </div>
      {view.mode === 'team' ? (
        <div className="flex gap-2 text-xs font-bold">
          {view.teamSummaries.map((team) => (
            <span
              key={team.team}
              className={cn(
                'rounded-full border px-3 py-1',
                team.team === 'red'
                  ? 'border-red-400/60 bg-red-500/15 text-red-100'
                  : 'border-blue-400/60 bg-blue-500/15 text-blue-100',
              )}
            >
              {team.score} {team.team === 'red' ? 'أحمر' : 'أزرق'}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CluePhase(props: {
  view: SameWavelengthPlayerView;
  busy: boolean;
  submitClue: (clue: string) => Promise<unknown>;
}) {
  const [clue, setClue] = useState('');
  return props.view.canSubmitClue ? (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4">
      <Spectrum view={props.view} marker={props.view.privateTarget} markerLabel="النقطة السرية" />
      <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-center">
        <p className="text-xs font-bold text-amber-200">النقطة سرية لك وحدك</p>
        <p className="text-wanas-text-primary text-3xl font-black">{props.view.privateTarget}</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (clue.trim()) void props.submitClue(clue);
        }}
        className="space-y-2"
      >
        <label htmlFor="same-wavelength-clue" className="text-wanas-text-primary text-sm font-bold">
          مثال قصير يقود إلى موقع النقطة
        </label>
        <input
          id="same-wavelength-clue"
          value={clue}
          onChange={(event) => setClue(event.target.value)}
          maxLength={120}
          autoComplete="off"
          className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus:border-wanas-accent h-12 w-full rounded-xl border px-3 outline-none"
          placeholder="مثال: كوب شاي تُرك عشر دقائق"
        />
        <button
          type="submit"
          disabled={props.busy || !clue.trim()}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          إرسال التلميح
        </button>
      </form>
    </section>
  ) : (
    <Waiting title="الملمّح يكتب التلميح الآن" description="لن تظهر النقطة السرية لأي لاعب آخر." />
  );
}

function GuessingPhase(props: {
  view: SameWavelengthPlayerView;
  busy: boolean;
  propose: (position: number) => Promise<unknown>;
  confirm: () => Promise<unknown>;
}) {
  const [position, setPosition] = useState<number | null>(props.view.ownProposal);
  return (
    <section className="space-y-3">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-2xl border p-4 text-center">
        <p className="text-wanas-text-muted text-xs">التلميح المعتمد</p>
        <p className="text-wanas-text-primary mt-1 break-words text-xl font-black">
          {props.view.clue}
        </p>
      </div>
      <Spectrum view={props.view} marker={position} markerLabel="اختيارك" />

      {props.view.canPropose ? (
        <div className="border-wanas-border bg-wanas-surface space-y-3 rounded-2xl border p-4">
          <input
            dir="ltr"
            type="range"
            min={0}
            max={100}
            step={1}
            value={position ?? 50}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-label="اختر موقعًا من صفر إلى مئة"
            aria-valuetext={position === null ? 'لم يتم الاختيار' : `${position} من 100`}
            className="accent-wanas-accent h-11 w-full"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={props.busy || position === null || position === props.view.ownProposal}
              onClick={() => position !== null && void props.propose(position)}
              className="border-wanas-accent text-wanas-text-primary min-h-12 rounded-xl border px-3 font-bold disabled:opacity-45"
            >
              إرسال الاقتراح {position === null ? '' : position}
            </button>
            <button
              type="button"
              disabled={props.busy || !props.view.canConfirm || props.view.ownProposal !== position}
              onClick={() => void props.confirm()}
              className="bg-wanas-accent min-h-12 rounded-xl px-3 font-bold text-white disabled:opacity-45"
            >
              تأكيد الموقع نهائيًا
            </button>
          </div>
          {props.view.ownConfirmed ? (
            <p className="text-center text-sm font-bold text-emerald-300">تم تأكيد موقعك.</p>
          ) : null}
        </div>
      ) : (
        <Waiting
          title={props.view.isClueGiver ? 'التلميح مثبت' : 'شاهد اختيارات الفريق النشط'}
          description={
            props.view.isClueGiver
              ? 'لا يضع الملمّح علامة في دوره.'
              : 'لا يمكنك التحكم بعلامة الفريق النشط في هذا الدور.'
          }
        />
      )}

      {props.view.teamProposals.length > 0 ? (
        <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3">
          <h2 className="text-wanas-text-primary text-sm font-bold">اقتراحات فريقك</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {props.view.teamProposals.map((proposal) => (
              <li
                key={proposal.playerId}
                className="border-wanas-border bg-wanas-surface-soft flex justify-between gap-2 rounded-xl border p-2 text-sm"
              >
                <span className="min-w-0 truncate">{proposal.name}</span>
                <span className="font-bold">
                  {proposal.position} {proposal.confirmed ? '✓' : 'بانتظار التأكيد'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function ResultsPhase(props: {
  view: SameWavelengthPlayerView;
  busy: boolean;
  next: () => Promise<unknown>;
}) {
  const final = props.view.phase === 'completed';
  const winningTeams = props.view.teamSummaries.filter((team) => team.isWinner);
  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4">
      {final && props.view.completedNormally === false ? (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-center text-amber-100">
          انتهت المباراة مبكرًا بسبب نقص الأدوار المطلوبة.
        </p>
      ) : null}
      {final && props.view.completedNormally && props.view.mode === 'team' ? (
        <p
          role="status"
          className="rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-center font-black text-amber-100"
        >
          {winningTeams.length === 2
            ? 'تعادل الفريقان في مجموع النقاط'
            : `الفائز: ${winningTeams[0] ? teamName[winningTeams[0].team] : 'غير محدد'}`}
        </p>
      ) : null}
      <Spectrum
        view={props.view}
        marker={props.view.agreedGuess}
        markerLabel="التخمين النهائي"
        target={props.view.revealedTarget}
      />
      <div className="text-center">
        <p className="text-wanas-text-muted text-xs">التلميح</p>
        <p className="text-wanas-text-primary break-words text-lg font-black">
          {props.view.clue ?? 'لم يُرسل تلميح'}
        </p>
      </div>

      {props.view.mode === 'team' ? (
        <div className="space-y-3">
          <div className="border-wanas-border bg-wanas-surface-soft grid grid-cols-2 gap-2 rounded-xl border p-3 text-center sm:grid-cols-4">
            <ResultMetric label="التخمين" value={props.view.agreedGuess ?? 'لا يوجد'} />
            <ResultMetric label="المسافة" value={props.view.turnDistance ?? '—'} />
            <ResultMetric label="درجة القرب" value={props.view.turnCloseness ?? '—'} />
            <ResultMetric label="نقاط الدور" value={`+${props.view.turnPoints ?? 0}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {props.view.teamSummaries.map((team) => (
              <article
                key={team.team}
                className={cn(
                  'rounded-xl border p-3',
                  team.team === 'red'
                    ? 'border-red-400/50 bg-red-500/10'
                    : 'border-blue-400/50 bg-blue-500/10',
                  final && team.isWinner && 'ring-2 ring-amber-300',
                )}
              >
                <h2 className="text-wanas-text-primary font-black">
                  {teamName[team.team]} · {team.score} نقاط
                </h2>
                <p className="text-wanas-text-muted mt-1 break-words text-xs">
                  {team.memberNames.join('، ')}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {(final ? props.view.leaderboard : props.view.roundResults).map((entry, index) => (
            <li
              key={entry.playerId}
              className="border-wanas-border bg-wanas-surface-soft flex justify-between gap-2 rounded-xl border p-3"
            >
              <span className="min-w-0 truncate font-bold">
                {'isWinner' in entry && entry.isWinner ? '🏆 ' : ''}
                {index + 1}. {entry.name}
              </span>
              <span className="text-wanas-text-muted text-xs">
                {'guess' in entry
                  ? entry.guess === null
                    ? 'بلا تخمين · +0'
                    : `${entry.guess} · بُعد ${entry.distance} · قرب ${entry.closeness} · +${entry.points} · المجموع ${entry.totalPoints}`
                  : `${entry.score} نقطة`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!final && props.view.canAdvance ? (
        <button
          type="button"
          disabled={props.busy}
          onClick={() => void props.next()}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          التالي
        </button>
      ) : null}
    </section>
  );
}

function ResultMetric(props: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="text-wanas-text-muted text-[11px]">{props.label}</p>
      <p className="text-wanas-text-primary mt-1 truncate text-sm font-black">{props.value}</p>
    </div>
  );
}

function Spectrum(props: {
  view: SameWavelengthPlayerView;
  marker: number | null;
  markerLabel: string;
  target?: number | null;
}) {
  return (
    <div
      className="space-y-2"
      dir="ltr"
      aria-label={`${props.view.leftLabel} إلى ${props.view.rightLabel}`}
    >
      <div className="flex justify-between gap-3 text-sm font-black">
        <span className="max-w-[45%] break-words text-left">0 · {props.view.leftLabel}</span>
        <span className="max-w-[45%] break-words text-right">{props.view.rightLabel} · 100</span>
      </div>
      <div className="relative h-12 rounded-full border border-white/20 bg-gradient-to-r from-cyan-500 via-amber-300 to-red-500">
        {props.marker !== null ? (
          <span
            className="absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-900 shadow-lg"
            style={{ left: `${props.marker}%` }}
            title={`${props.marker}: ${props.markerLabel}`}
          />
        ) : null}
        {props.target !== undefined && props.target !== null ? (
          <span
            className="absolute top-0 h-full w-1 -translate-x-1/2 bg-black shadow-[0_0_0_2px_white]"
            style={{ left: `${props.target}%` }}
            title={`الهدف ${props.target}`}
          />
        ) : null}
      </div>
      <div className="text-wanas-text-muted flex justify-between text-xs">
        <span>
          {props.marker === null ? 'لا يوجد اختيار' : `${props.markerLabel}: ${props.marker}`}
        </span>
        {props.target !== undefined && props.target !== null ? (
          <span>الهدف: {props.target}</span>
        ) : null}
      </div>
    </div>
  );
}

function Waiting({ title, description }: { title: string; description: string }) {
  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-5 text-center">
      <h2 className="text-wanas-text-primary font-bold">{title}</h2>
      <p className="text-wanas-text-muted mt-2 text-sm">{description}</p>
    </section>
  );
}
