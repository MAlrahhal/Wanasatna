'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SameWavelengthPlayerView, SameWavelengthResultEntry } from '@wanasatna/shared';
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
import { SameWavelengthSpectrum, type SpectrumMarker } from './spectrum-control';
import { useSameWavelengthPlayerView } from './use-player-view';

const teamName = { red: 'الفريق الأحمر', blue: 'الفريق الأزرق' } as const;
const resultTones = ['cyan', 'violet', 'emerald'] as const;

export function SameWavelengthGameScreen() {
  const { state: shell } = useGameShell();
  const setExperienceMeta = useSetGameExperienceMeta();
  const enabled = shell?.gameId === SAME_WAVELENGTH_GAME_ID && shell.phase === 'PLAYING';
  const {
    view,
    error,
    loading,
    submitting,
    submitClue,
    propose,
    confirm,
    submitIndividualGuess,
    next,
  } = useSameWavelengthPlayerView(enabled);

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
      <TurnContext view={view} />

      {view.phase === 'clue-writing' ? (
        <CluePhase view={view} busy={submitting} submitClue={submitClue} />
      ) : view.phase === 'guessing' ? (
        <GuessingPhase
          key={view.turnId}
          view={view}
          busy={submitting}
          propose={propose}
          confirm={confirm}
          submitIndividualGuess={submitIndividualGuess}
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

function TurnContext({ view }: { view: SameWavelengthPlayerView }) {
  return (
    <div className="text-wanas-text-muted flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-bold">
      <span className="border-wanas-border bg-wanas-surface-soft rounded-full border px-3 py-1">
        الجولة {view.currentRound} من {view.totalRounds}
      </span>
      {view.mode === 'team' && view.activeTeam ? (
        <span
          className={cn(
            'rounded-full border px-3 py-1',
            view.activeTeam === 'red'
              ? 'border-red-400/50 bg-red-500/15 text-red-100'
              : 'border-blue-400/50 bg-blue-500/15 text-blue-100',
          )}
        >
          دور {teamName[view.activeTeam]}
        </span>
      ) : null}
    </div>
  );
}

function CluePhase(props: {
  view: SameWavelengthPlayerView;
  busy: boolean;
  submitClue: (clue: string) => Promise<unknown>;
}) {
  const [clue, setClue] = useState('');
  const target = props.view.privateTarget;

  if (!props.view.canSubmitClue || target === null) {
    return (
      <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4">
        <SameWavelengthSpectrum
          leftLabel={props.view.leftLabel}
          rightLabel={props.view.rightLabel}
          compact
        />
        <Waiting
          title="الملمّح يكتب التلميح الآن"
          description="لن تظهر النقطة السرية لأي لاعب آخر."
        />
      </section>
    );
  }

  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex justify-center">
        <h2 className="rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">
          الهدف السري: <bdi dir="ltr">{target}</bdi>
        </h2>
      </div>

      <SameWavelengthSpectrum
        leftLabel={props.view.leftLabel}
        rightLabel={props.view.rightLabel}
        markers={[{ id: 'target', position: target, label: 'الهدف السري', tone: 'target' }]}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (clue.trim()) void props.submitClue(clue);
        }}
        className="space-y-3"
      >
        <label htmlFor="same-wavelength-clue" className="text-wanas-text-primary block font-bold">
          اكتب مثالًا يلمّح إلى مكان الهدف
        </label>
        <input
          id="same-wavelength-clue"
          value={clue}
          onChange={(event) => setClue(event.target.value)}
          maxLength={120}
          autoComplete="off"
          className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus:border-wanas-accent focus:ring-wanas-accent h-12 w-full rounded-xl border px-3 outline-none focus:ring-2"
          placeholder="اكتب تلميحًا قصيرًا يناسب طرفي الطيف"
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-wanas-text-muted">التلميح يثبت بعد الإرسال.</span>
          <span className="text-wanas-text-muted" dir="ltr">
            {clue.length}/120
          </span>
        </div>
        <button
          type="submit"
          disabled={props.busy || !clue.trim()}
          className="bg-wanas-accent focus-visible:ring-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {props.busy ? 'جارٍ إرسال التلميح…' : 'إرسال التلميح'}
        </button>
      </form>
    </section>
  );
}

function GuessingPhase(props: {
  view: SameWavelengthPlayerView;
  busy: boolean;
  propose: (position: number) => Promise<unknown>;
  confirm: () => Promise<unknown>;
  submitIndividualGuess: (position: number) => Promise<unknown>;
}) {
  const [position, setPosition] = useState<number | null>(props.view.ownProposal);
  const individualLocked = props.view.mode === 'individual' && props.view.ownConfirmed;
  const canInteract = props.view.canPropose && !individualLocked;
  const proposalChanged = position !== props.view.ownProposal;

  return (
    <section className="space-y-3">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-2xl border px-4 py-3 text-center">
        <p className="text-wanas-text-muted text-xs">التلميح</p>
        <p className="text-wanas-text-primary mt-1 break-words text-xl font-black sm:text-2xl">
          {props.view.clue}
        </p>
      </div>

      <div className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4 sm:p-5">
        <SameWavelengthSpectrum
          leftLabel={props.view.leftLabel}
          rightLabel={props.view.rightLabel}
          value={position}
          onChange={canInteract ? setPosition : undefined}
          disabled={!canInteract}
          ariaLabel="اختر موقع تخمينك على الطيف من صفر إلى مئة"
        />

        {props.view.canPropose ? (
          props.view.mode === 'individual' ? (
            <IndividualGuessAction
              position={position}
              confirmedPosition={props.view.ownProposal}
              confirmed={props.view.ownConfirmed}
              busy={props.busy}
              submit={props.submitIndividualGuess}
            />
          ) : (
            <TeamGuessAction
              position={position}
              proposalChanged={proposalChanged}
              ownProposal={props.view.ownProposal}
              ownConfirmed={props.view.ownConfirmed}
              canConfirm={props.view.canConfirm}
              busy={props.busy}
              propose={props.propose}
              confirm={props.confirm}
            />
          )
        ) : (
          <Waiting
            title={props.view.isClueGiver ? 'التلميح مثبت' : 'متابعة الفريق النشط'}
            description={
              props.view.isClueGiver
                ? 'الملمّح لا يضع علامة في هذا الدور.'
                : 'هذه العلامة للعرض فقط؛ لا يمكنك التخمين في هذا الدور.'
            }
          />
        )}
      </div>

      {props.view.mode === 'team' && props.view.teamProposals.length > 0 ? (
        <TeamProposalProgress view={props.view} />
      ) : null}
    </section>
  );
}

function IndividualGuessAction(props: {
  position: number | null;
  confirmedPosition: number | null;
  confirmed: boolean;
  busy: boolean;
  submit: (position: number) => Promise<unknown>;
}) {
  if (props.confirmed) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-center">
        <p className="font-black text-emerald-100">
          تم تثبيت تخمينك: <bdi dir="ltr">{props.confirmedPosition}</bdi>
        </p>
        <p className="text-wanas-text-muted mt-1 text-xs">بانتظار بقية اللاعبين…</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-wanas-text-muted text-center text-sm">حرّك العلامة، ثم ثبّت تخمينك.</p>
      <button
        type="button"
        disabled={props.busy || props.position === null}
        onClick={() => props.position !== null && void props.submit(props.position)}
        className="bg-wanas-accent focus-visible:ring-wanas-accent min-h-12 w-full rounded-xl px-4 font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-45"
      >
        {props.busy
          ? 'جارٍ تأكيد التخمين…'
          : `تأكيد تخميني${props.position === null ? '' : `: ${props.position}`}`}
      </button>
    </div>
  );
}

function TeamGuessAction(props: {
  position: number | null;
  proposalChanged: boolean;
  ownProposal: number | null;
  ownConfirmed: boolean;
  canConfirm: boolean;
  busy: boolean;
  propose: (position: number) => Promise<unknown>;
  confirm: () => Promise<unknown>;
}) {
  if (props.position === null) {
    return <p className="text-wanas-text-muted text-center text-sm">اختر موقعًا لإرسال اقتراحك.</p>;
  }
  if (props.proposalChanged) {
    return (
      <button
        type="button"
        disabled={props.busy}
        onClick={() => void props.propose(props.position!)}
        className="border-wanas-accent text-wanas-text-primary focus-visible:ring-wanas-accent min-h-12 w-full rounded-xl border px-4 font-black focus-visible:outline-none focus-visible:ring-2 disabled:opacity-45"
      >
        {props.busy
          ? 'جارٍ إرسال الاقتراح…'
          : `${props.ownProposal === null ? 'إرسال اقتراحي' : 'تحديث اقتراحي'}: ${props.position}`}
      </button>
    );
  }
  if (props.ownConfirmed) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-center">
        <p className="font-black text-emerald-100">أكدت الاتفاق على {props.ownProposal}</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          تغيير العلامة وإرسال اقتراح جديد يلغي تأكيدك الحالي.
        </p>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={props.busy || !props.canConfirm}
      onClick={() => void props.confirm()}
      className="bg-wanas-accent focus-visible:ring-wanas-accent min-h-12 w-full rounded-xl px-4 font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-45"
    >
      {props.busy ? 'جارٍ تأكيد الاتفاق…' : `تأكيد الاتفاق على ${props.ownProposal}`}
    </button>
  );
}

function TeamProposalProgress({ view }: { view: SameWavelengthPlayerView }) {
  const confirmedCount = view.teamProposals.filter((proposal) => proposal.confirmed).length;
  return (
    <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-wanas-text-primary text-sm font-black">اتفاق الفريق النشط</h2>
          <p className="text-wanas-text-muted mt-1 text-xs">
            يجب أن يؤكد الجميع الموقع نفسه قبل انتهاء الوقت.
          </p>
        </div>
        <span className="border-wanas-accent/40 bg-wanas-accent/10 text-wanas-text-primary rounded-full border px-3 py-1 text-xs font-black">
          أكّد {confirmedCount} من {view.teamProposals.length}
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {view.teamProposals.map((proposal) => (
          <li
            key={proposal.playerId}
            className="border-wanas-border bg-wanas-surface-soft flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-sm"
          >
            <bdi dir="auto" className="min-w-0 truncate font-bold">
              {proposal.name}
            </bdi>
            <span className="shrink-0 text-left text-xs font-bold" dir="rtl">
              {proposal.position === null ? 'لم يقترح بعد' : `الاقتراح: ${proposal.position}`}
              <span
                className={cn(
                  'ms-2 inline-block rounded-full px-2 py-0.5',
                  proposal.confirmed
                    ? 'bg-emerald-400/15 text-emerald-200'
                    : 'bg-white/5 text-slate-300',
                )}
              >
                {proposal.confirmed ? 'مؤكد ✓' : 'بانتظار التأكيد'}
              </span>
            </span>
          </li>
        ))}
      </ul>
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
  const scored = props.view.resultReason === 'scored';
  const markers = useMemo<SpectrumMarker[]>(() => {
    const target = props.view.revealedTarget;
    const result: SpectrumMarker[] =
      target === null ? [] : [{ id: 'target', position: target, label: 'الهدف', tone: 'target' }];
    if (props.view.mode === 'team') {
      if (props.view.agreedGuess !== null) {
        result.push({
          id: 'team-guess',
          position: props.view.agreedGuess,
          label: 'تخمين الفريق',
          tone: 'cyan',
        });
      }
      return result;
    }
    props.view.roundResults.forEach((entry, index) => {
      if (entry.guess !== null) {
        result.push({
          id: entry.playerId,
          position: entry.guess,
          label: entry.name,
          tone: resultTones[index % resultTones.length],
        });
      }
    });
    return result;
  }, [props.view]);

  return (
    <section className="border-wanas-border bg-wanas-surface space-y-4 rounded-2xl border p-4 sm:p-5">
      {final && props.view.completedNormally === false ? (
        <ResultNotice>انتهت المباراة مبكرًا بسبب نقص الأدوار المطلوبة.</ResultNotice>
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

      {props.view.resultReason === 'no-clue' ? (
        <ResultNotice>انتهى الوقت بدون تلميح — لا نقاط لهذه الجولة.</ResultNotice>
      ) : props.view.resultReason === 'no-consensus' ? (
        <ResultNotice>
          لم يصل الفريق إلى تأكيد جماعي على الموقع نفسه قبل انتهاء الوقت — لا نقاط لهذا الدور.
        </ResultNotice>
      ) : scored ? (
        <SameWavelengthSpectrum
          leftLabel={props.view.leftLabel}
          rightLabel={props.view.rightLabel}
          markers={markers}
          showMarkerLegend
        />
      ) : null}

      <div className="text-center">
        <p className="text-wanas-text-muted text-xs">التلميح</p>
        <p className="text-wanas-text-primary break-words text-lg font-black sm:text-xl">
          {props.view.clue ?? 'لم يُرسل تلميح'}
        </p>
      </div>

      {props.view.mode === 'team' ? (
        <TeamResults view={props.view} final={final} />
      ) : (
        <IndividualResults view={props.view} final={final} />
      )}

      {!final && props.view.canAdvance ? (
        <button
          type="button"
          disabled={props.busy}
          onClick={() => void props.next()}
          className="bg-wanas-accent focus-visible:ring-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {props.busy ? 'جارٍ الانتقال…' : 'التالي'}
        </button>
      ) : null}
    </section>
  );
}

function TeamResults({ view, final }: { view: SameWavelengthPlayerView; final: boolean }) {
  const activeSummary = view.teamSummaries.find((team) => team.team === view.activeTeam);
  return (
    <div className="space-y-3">
      <div className="border-wanas-border bg-wanas-surface-soft grid grid-cols-2 gap-2 rounded-xl border p-3 text-center sm:grid-cols-5">
        <ResultMetric label="الهدف" value={view.revealedTarget ?? '—'} />
        <ResultMetric label="التخمين المؤكد" value={view.agreedGuess ?? 'لا يوجد'} />
        <ResultMetric label="المسافة" value={view.turnDistance ?? '—'} />
        <ResultMetric label="درجة القرب" value={view.turnCloseness ?? '—'} />
        <ResultMetric label="نقاط الدور" value={`+${view.turnPoints ?? 0}`} />
      </div>
      {view.activeTeam && activeSummary ? (
        <p className="text-wanas-text-primary text-center text-sm font-bold">
          {teamName[view.activeTeam]} أصبح رصيده {activeSummary.score} نقطة
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {view.teamSummaries.map((team) => (
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
              {team.memberNames.map((name, index) => (
                <span key={`${name}-${index}`}>
                  {index > 0 ? '، ' : ''}
                  <bdi dir="auto">{name}</bdi>
                </span>
              ))}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function IndividualResults({ view, final }: { view: SameWavelengthPlayerView; final: boolean }) {
  return (
    <div className="space-y-4">
      {view.roundResults.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {view.roundResults.map((entry, index) => (
            <IndividualRoundResult key={entry.playerId} entry={entry} index={index} />
          ))}
        </ul>
      ) : null}
      {final ? (
        <section>
          <h2 className="text-wanas-text-primary mb-2 text-sm font-black">الترتيب النهائي</h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {view.leaderboard.map((entry, index) => (
              <li
                key={entry.playerId}
                className="border-wanas-border bg-wanas-surface-soft flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3"
              >
                <span className="flex min-w-0 items-center gap-2 font-bold">
                  <span className="text-wanas-text-muted shrink-0" dir="ltr">
                    {index + 1}.
                  </span>
                  <bdi dir="auto" className="min-w-0 truncate">
                    {entry.isWinner ? '🏆 ' : ''}
                    {entry.name}
                  </bdi>
                </span>
                <span className="text-wanas-text-muted shrink-0 text-xs">{entry.score} نقطة</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function IndividualRoundResult(props: { entry: SameWavelengthResultEntry; index: number }) {
  const tone = resultTones[props.index % resultTones.length];
  const toneClass = {
    cyan: 'bg-cyan-400',
    violet: 'bg-violet-400',
    emerald: 'bg-emerald-400',
  }[tone];
  return (
    <li className="border-wanas-border bg-wanas-surface-soft min-w-0 rounded-xl border p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('size-2.5 shrink-0 rounded-full', toneClass)} aria-hidden="true" />
        <bdi dir="auto" className="text-wanas-text-primary min-w-0 truncate font-bold">
          {props.entry.name}
        </bdi>
      </div>
      <p className="text-wanas-text-muted mt-2 text-xs leading-5">
        {props.entry.guess === null
          ? 'لم يؤكد تخمينًا · +0'
          : `التخمين ${props.entry.guess} · المسافة ${props.entry.distance} · القرب ${props.entry.closeness} · +${props.entry.points}`}
      </p>
      <p className="text-wanas-text-primary mt-1 text-xs font-black">
        المجموع: {props.entry.totalPoints}
      </p>
    </li>
  );
}

function ResultNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-center font-bold text-amber-100"
    >
      {children}
    </p>
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

function Waiting({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-4 text-center">
      <h2 className="text-wanas-text-primary font-bold">{title}</h2>
      <p className="text-wanas-text-muted mt-2 text-sm">{description}</p>
    </div>
  );
}
