'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CountdownScreen } from '@/plugins/bara-al-salafa/countdown-screen';
import { DirectedQuestionsScreen } from '@/plugins/bara-al-salafa/directed-questions-screen';
import { FreeQuestionsScreen } from '@/plugins/bara-al-salafa/free-questions-screen';
import { ImpostorGuessScreen } from '@/plugins/bara-al-salafa/impostor-guess-screen';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { RevealImpostorScreen } from '@/plugins/bara-al-salafa/reveal-impostor-screen';
import { RoleRevealScreen } from '@/plugins/bara-al-salafa/role-reveal-screen';
import { RoundResultsScreen } from '@/plugins/bara-al-salafa/round-results-screen';
import { VotingScreen } from '@/plugins/bara-al-salafa/voting-screen';
import {
  countdownDemoDefaults,
  directedQuestionsDemoDefaults,
  freeQuestionsDemoDefaults,
  freeQuestionsWaitingDemoDefaults,
  impostorGuessDemoDefaults,
  impostorGuessDemoOptions,
  matchResultsSingleWinnerDemoDefaults,
  revealImpostorDemoDefaults,
  roleRevealDemoDefaults,
  roleRevealDemoPlayers,
  roundResultsCorrectDemoDefaults,
  votingConfirmedDemoDefaults,
  votingDemoDefaults,
} from '@/plugins/bara-al-salafa/role-reveal-demo-data';

const PHASES = [
  { id: 'countdown', label: 'Countdown' },
  { id: 'role-reveal', label: 'Role Reveal' },
  { id: 'directed-questions', label: 'Directed Questions' },
  { id: 'free-questions', label: 'Free Questions' },
  { id: 'voting', label: 'Voting' },
  { id: 'reveal-impostor', label: 'Reveal Impostor' },
  { id: 'impostor-guess', label: 'Impostor Guess' },
  { id: 'round-results', label: 'Round Results' },
  { id: 'match-results', label: 'Match Results' },
] as const;

type PhaseId = (typeof PHASES)[number]['id'];
type Perspective = 'normal' | 'impostor' | 'host' | 'non-host';

const HOST_ID = 'p1';
const IMPOSTOR_ID = 'p2';
const NORMAL_ID = 'p4';

export function BaraAlSalafaDevPreviewClient() {
  const [phaseId, setPhaseId] = useState<PhaseId>('role-reveal');
  const [perspective, setPerspective] = useState<Perspective>('normal');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [roundNumber, setRoundNumber] = useState(1);
  const [lowTime, setLowTime] = useState(false);
  const [roleAcknowledged, setRoleAcknowledged] = useState(false);
  const [directedActiveAsker, setDirectedActiveAsker] = useState(true);
  const [freeQuestionActive, setFreeQuestionActive] = useState(true);
  const [votingConfirmed, setVotingConfirmed] = useState(false);
  const [votingSelection, setVotingSelection] = useState<string | null>('p3');
  const [freeQuestionSelection, setFreeQuestionSelection] = useState<string | null>('p3');
  const [submittedVotesCount, setSubmittedVotesCount] = useState(2);

  const currentPlayerId =
    perspective === 'impostor' ? IMPOSTOR_ID : perspective === 'host' ? HOST_ID : NORMAL_ID;
  const isHostPerspective = perspective === 'host';
  const isImpostorPerspective = perspective === 'impostor';
  const isFinalRound = roundNumber >= 3;

  const preview = useMemo(() => {
    switch (phaseId) {
      case 'countdown':
        return (
          <CountdownScreen
            {...countdownDemoDefaults}
            roundNumber={roundNumber}
            totalRounds={3}
            currentNumber={lowTime ? 1 : 3}
          />
        );
      case 'role-reveal':
        return (
          <RoleRevealScreen
            {...roleRevealDemoDefaults}
            currentRound={roundNumber}
            totalRounds={3}
            remainingSeconds={lowTime ? 8 : 45}
            showFallbackTimer
            role={isImpostorPerspective ? 'impostor' : 'normal'}
            secretWord={isImpostorPerspective ? undefined : roleRevealDemoDefaults.secretWord}
            players={roleRevealDemoPlayers}
            currentPlayerId={currentPlayerId}
            acknowledged={roleAcknowledged}
            onAcknowledge={() => setRoleAcknowledged(true)}
            roleAcknowledgementCount={roleAcknowledged ? 2 : 1}
            eligibleRoleAcknowledgementCount={3}
          />
        );
      case 'directed-questions':
        return (
          <DirectedQuestionsScreen
            {...directedQuestionsDemoDefaults}
            roundNumber={roundNumber}
            totalRounds={3}
            currentPlayerId={directedActiveAsker ? directedQuestionsDemoDefaults.askerPlayerId : currentPlayerId}
            onAdvanceNext={directedActiveAsker ? () => undefined : undefined}
          />
        );
      case 'free-questions':
        return (
          <FreeQuestionsScreen
            {...(freeQuestionActive ? freeQuestionsDemoDefaults : freeQuestionsWaitingDemoDefaults)}
            roundNumber={roundNumber}
            totalRounds={3}
            currentPlayerId={freeQuestionActive ? freeQuestionsDemoDefaults.activePlayerId : currentPlayerId}
            activePlayerId={freeQuestionsDemoDefaults.activePlayerId}
            isActivePlayer={freeQuestionActive}
            selectedTargetPlayerId={freeQuestionSelection}
            onSelectPlayer={freeQuestionActive ? setFreeQuestionSelection : undefined}
            onConfirm={freeQuestionActive ? () => undefined : undefined}
            onSkip={freeQuestionActive ? () => undefined : undefined}
          />
        );
      case 'voting':
        return (
          <VotingScreen
            {...(votingConfirmed ? votingConfirmedDemoDefaults : votingDemoDefaults)}
            roundNumber={roundNumber}
            totalRounds={3}
            currentPlayerId={currentPlayerId}
            hasVoted={votingConfirmed}
            selectedPlayerId={votingConfirmed ? null : votingSelection}
            confirmedPlayerId={votingConfirmed ? votingSelection : null}
            submittedVotesCount={submittedVotesCount}
            eligibleVotersCount={3}
            showTimer={lowTime}
            remainingSeconds={lowTime ? 5 : 0}
            onSelectPlayer={votingConfirmed ? undefined : setVotingSelection}
            onConfirmVote={votingConfirmed ? undefined : () => setVotingConfirmed(true)}
          />
        );
      case 'reveal-impostor':
        return (
          <RevealImpostorScreen
            {...revealImpostorDemoDefaults}
            roundNumber={roundNumber}
            totalRounds={3}
            remainingSeconds={lowTime ? 1 : 5}
          />
        );
      case 'impostor-guess':
        return (
          <ImpostorGuessScreen
            {...impostorGuessDemoDefaults}
            options={impostorGuessDemoOptions}
            roundNumber={roundNumber}
            totalRounds={3}
            isImpostor={isImpostorPerspective}
            selectedWord={isImpostorPerspective ? 'car' : null}
          />
        );
      case 'round-results':
        return (
          <RoundResultsScreen
            {...roundResultsCorrectDemoDefaults}
            roundNumber={roundNumber}
            totalRounds={3}
            currentPlayerId={currentPlayerId}
            continueLabel={
              isHostPerspective
                ? isFinalRound
                  ? 'عرض النتائج النهائية'
                  : 'بدء الجولة التالية'
                : null
            }
            waitingMessage={
              !isHostPerspective
                ? isFinalRound
                  ? 'بانتظار المضيف لعرض النتائج النهائية.'
                  : 'بانتظار المضيف لبدء الجولة التالية.'
                : null
            }
            onContinue={isHostPerspective ? () => undefined : undefined}
          />
        );
      case 'match-results':
        return (
          <MatchResultsScreen
            {...matchResultsSingleWinnerDemoDefaults}
            totalRounds={3}
            currentPlayerId={currentPlayerId}
          />
        );
      default:
        return null;
    }
  }, [
    currentPlayerId,
    directedActiveAsker,
    freeQuestionActive,
    freeQuestionSelection,
    isFinalRound,
    isHostPerspective,
    isImpostorPerspective,
    lowTime,
    phaseId,
    roleAcknowledged,
    roundNumber,
    submittedVotesCount,
    votingConfirmed,
    votingSelection,
  ]);

  return (
    <div className="min-h-screen bg-wanas-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[24px] border border-dashed border-wanas-border bg-wanas-surface-soft p-5">
          <p className="text-sm font-semibold text-wanas-warning-dark">
            هذه معاينة تطويرية ولا تستخدم بيانات غرفة حقيقية.
          </p>
          <h1 className="mt-2 text-2xl font-bold text-wanas-text-primary">/dev/bara-al-salafa</h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[24px] border border-wanas-border bg-wanas-surface p-4">
            <div>
              <p className="mb-2 text-xs font-bold text-wanas-text-muted">Phase selector</p>
              <div className="flex flex-wrap gap-2">
                {PHASES.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setPhaseId(phase.id)}
                    className={cn(
                      'rounded-xl border px-2.5 py-1.5 text-xs font-semibold',
                      phaseId === phase.id
                        ? 'border-wanas-accent bg-wanas-accent text-white'
                        : 'border-wanas-border bg-wanas-surface-soft text-wanas-text-secondary',
                    )}
                  >
                    {phase.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-wanas-text-muted">Perspective</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['normal', 'لاعب عادي'],
                    ['impostor', 'برا السالفة'],
                    ['host', 'المضيف'],
                    ['non-host', 'لاعب غير مضيف'],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={perspective === id ? 'primary' : 'secondary'}
                    onClick={() => setPerspective(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Desktop/mobile width</span>
              <input
                type="checkbox"
                checked={previewWidth === 'mobile'}
                onChange={(e) => setPreviewWidth(e.target.checked ? 'mobile' : 'desktop')}
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Round</span>
              <select
                value={roundNumber}
                onChange={(e) => setRoundNumber(Number(e.target.value))}
                className="rounded-lg border border-wanas-border px-2 py-1"
              >
                {[1, 2, 3].map((round) => (
                  <option key={round} value={round}>
                    {round}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Low-time (timed phases)</span>
              <input type="checkbox" checked={lowTime} onChange={(e) => setLowTime(e.target.checked)} />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Role understood</span>
              <input
                type="checkbox"
                checked={roleAcknowledged}
                onChange={(e) => setRoleAcknowledged(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Directed asker active</span>
              <input
                type="checkbox"
                checked={directedActiveAsker}
                onChange={(e) => setDirectedActiveAsker(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Free-question active</span>
              <input
                type="checkbox"
                checked={freeQuestionActive}
                onChange={(e) => setFreeQuestionActive(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Voting confirmed</span>
              <input
                type="checkbox"
                checked={votingConfirmed}
                onChange={(e) => setVotingConfirmed(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-wanas-border px-3 py-2 text-sm">
              <span>Vote progress</span>
              <select
                value={submittedVotesCount}
                onChange={(e) => setSubmittedVotesCount(Number(e.target.value))}
                className="rounded-lg border border-wanas-border px-2 py-1"
              >
                {[0, 1, 2, 3].map((count) => (
                  <option key={count} value={count}>
                    {count}/3
                  </option>
                ))}
              </select>
            </label>
          </aside>

          <div
            className={cn(
              'overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background',
              previewWidth === 'mobile' ? 'mx-auto max-w-[390px]' : 'w-full',
            )}
          >
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
