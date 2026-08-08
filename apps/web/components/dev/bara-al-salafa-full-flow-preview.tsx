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
  impostorGuessDemoDefaults,
  impostorGuessDemoOptions,
  matchResultsSingleWinnerDemoDefaults,
  revealImpostorDemoDefaults,
  roleRevealDemoDefaults,
  roleRevealDemoPlayers,
  roundResultsCorrectDemoDefaults,
  votingDemoDefaults,
} from '@/plugins/bara-al-salafa/role-reveal-demo-data';

const FLOW_STEPS = [
  { id: 'countdown', label: 'العد التنازلي' },
  { id: 'role-reveal', label: 'كشف الدور' },
  { id: 'directed-questions', label: 'الأسئلة الموجّهة' },
  { id: 'free-questions', label: 'الأسئلة الحرة' },
  { id: 'voting', label: 'التصويت' },
  { id: 'reveal-impostor', label: 'كشف برا السالفة' },
  { id: 'impostor-guess', label: 'تخمين الكلمة' },
  { id: 'round-results', label: 'نتائج الجولة' },
  { id: 'match-results', label: 'النتائج النهائية' },
] as const;

type FlowStepId = (typeof FLOW_STEPS)[number]['id'];
type PlayerPerspective = 'normal' | 'impostor';
type PreviewWidth = 'desktop' | 'mobile';

const NORMAL_PLAYER_ID = 'p4';
const IMPOSTOR_PLAYER_ID = 'p2';
const TOTAL_ROUNDS = 3;

type FlowPreviewContext = {
  roundNumber: number;
  lowTime: boolean;
  perspective: PlayerPerspective;
  currentPlayerId: string;
  isImpostorPerspective: boolean;
  freeQuestionsSelection: string | null;
  votingSelection: string | null;
  onFreeQuestionsSelect: (playerId: string) => void;
  onVotingSelect: (playerId: string) => void;
};

function renderFlowStep(stepId: FlowStepId, ctx: FlowPreviewContext) {
  const {
    roundNumber,
    lowTime,
    currentPlayerId,
    isImpostorPerspective,
    freeQuestionsSelection,
    votingSelection,
    onFreeQuestionsSelect,
    onVotingSelect,
  } = ctx;

  switch (stepId) {
    case 'countdown':
      return (
        <CountdownScreen
          {...countdownDemoDefaults}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          currentNumber={3}
        />
      );
    case 'role-reveal':
      return (
        <RoleRevealScreen
          {...roleRevealDemoDefaults}
          gameName="برا السالفة"
          currentRound={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          remainingSeconds={lowTime ? 15 : 45}
          role={isImpostorPerspective ? 'impostor' : 'normal'}
          secretWord={isImpostorPerspective ? undefined : roleRevealDemoDefaults.secretWord}
          players={roleRevealDemoPlayers}
          currentPlayerId={currentPlayerId}
        />
      );
    case 'directed-questions':
      return (
        <DirectedQuestionsScreen
          {...directedQuestionsDemoDefaults}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          remainingSeconds={lowTime ? 8 : 38}
          currentPlayerId={currentPlayerId}
        />
      );
    case 'free-questions':
      return (
        <FreeQuestionsScreen
          {...freeQuestionsDemoDefaults}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          activePlayerId={IMPOSTOR_PLAYER_ID}
          currentPlayerId={currentPlayerId}
          selectedTargetPlayerId={freeQuestionsSelection}
          onSelectPlayer={onFreeQuestionsSelect}
        />
      );
    case 'voting':
      return (
        <VotingScreen
          {...votingDemoDefaults}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          remainingSeconds={lowTime ? 5 : 30}
          currentPlayerId={currentPlayerId}
          selectedPlayerId={votingSelection}
          hasVoted={false}
          onSelectPlayer={onVotingSelect}
        />
      );
    case 'reveal-impostor':
      return (
        <RevealImpostorScreen
          {...revealImpostorDemoDefaults}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          remainingSeconds={lowTime ? 1 : 5}
        />
      );
    case 'impostor-guess':
      return (
        <ImpostorGuessScreen
          {...impostorGuessDemoDefaults}
          options={impostorGuessDemoOptions}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          isImpostor={isImpostorPerspective}
          selectedWord={isImpostorPerspective ? 'car' : null}
          hasSubmitted={false}
        />
      );
    case 'round-results':
      return (
        <RoundResultsScreen
          {...roundResultsCorrectDemoDefaults}
          roundNumber={roundNumber}
          totalRounds={TOTAL_ROUNDS}
          remainingSeconds={lowTime ? 3 : 10}
          currentPlayerId={currentPlayerId}
          impostorGuessedCorrectly={isImpostorPerspective}
        />
      );
    case 'match-results':
      return (
        <MatchResultsScreen
          {...matchResultsSingleWinnerDemoDefaults}
          totalRounds={TOTAL_ROUNDS}
          currentPlayerId={currentPlayerId}
        />
      );
    default:
      return null;
  }
}

export function BaraAlSalafaFullFlowPreview() {
  const [stepIndex, setStepIndex] = useState(0);
  const [perspective, setPerspective] = useState<PlayerPerspective>('normal');
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>('desktop');
  const [roundNumber, setRoundNumber] = useState(1);
  const [lowTime, setLowTime] = useState(false);
  const [previewFinished, setPreviewFinished] = useState(false);
  const [freeQuestionsSelection, setFreeQuestionsSelection] = useState<string | null>('p3');
  const [votingSelection, setVotingSelection] = useState<string | null>('p3');

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === FLOW_STEPS.length - 1;
  const currentStep = FLOW_STEPS[stepIndex]!;
  const isImpostorPerspective = perspective === 'impostor';
  const currentPlayerId = isImpostorPerspective ? IMPOSTOR_PLAYER_ID : NORMAL_PLAYER_ID;

  const flowContext = useMemo<FlowPreviewContext>(
    () => ({
      roundNumber,
      lowTime,
      perspective,
      currentPlayerId,
      isImpostorPerspective,
      freeQuestionsSelection,
      votingSelection,
      onFreeQuestionsSelect: setFreeQuestionsSelection,
      onVotingSelect: setVotingSelection,
    }),
    [
      roundNumber,
      lowTime,
      perspective,
      currentPlayerId,
      isImpostorPerspective,
      freeQuestionsSelection,
      votingSelection,
    ],
  );

  const resetPreview = () => {
    setStepIndex(0);
    setPreviewFinished(false);
    setFreeQuestionsSelection('p3');
    setVotingSelection('p3');
  };

  const goNext = () => {
    if (isLastStep) {
      setPreviewFinished(true);
      return;
    }
    setStepIndex((index) => Math.min(index + 1, FLOW_STEPS.length - 1));
    setPreviewFinished(false);
  };

  const goPrevious = () => {
    setStepIndex((index) => Math.max(index - 1, 0));
    setPreviewFinished(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-dashed border-wanas-border bg-wanas-surface-soft p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-wanas-text-muted">
              Developer Flow Preview
            </p>
            <p className="mt-1 text-sm font-semibold text-wanas-text-primary">
              المرحلة {stepIndex + 1} من {FLOW_STEPS.length} — {currentStep.label}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={perspective === 'normal' ? 'primary' : 'secondary'}
              onClick={() => setPerspective('normal')}
            >
              لاعب عادي
            </Button>
            <Button
              size="sm"
              variant={perspective === 'impostor' ? 'primary' : 'secondary'}
              onClick={() => setPerspective('impostor')}
            >
              برا السالفة
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FLOW_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setStepIndex(index);
                setPreviewFinished(false);
              }}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-semibold motion-safe:transition-colors motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
                index === stepIndex
                  ? 'border-wanas-accent bg-wanas-accent text-white'
                  : 'border-wanas-border bg-wanas-surface text-wanas-text-secondary hover:bg-wanas-surface-soft',
              )}
            >
              {index + 1}. {step.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-wanas-border bg-wanas-surface px-3 py-2 text-sm">
            <span className="font-semibold text-wanas-text-secondary">الجولة</span>
            <select
              value={roundNumber}
              onChange={(event) => setRoundNumber(Number(event.target.value))}
              className="min-h-9 flex-1 rounded-lg border border-wanas-border bg-wanas-surface-soft px-2 text-sm font-semibold text-wanas-text-primary"
            >
              {[1, 2, 3].map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-wanas-border bg-wanas-surface px-3 py-2 text-sm">
            <span className="font-semibold text-wanas-text-secondary">عرض جوال</span>
            <input
              type="checkbox"
              checked={previewWidth === 'mobile'}
              onChange={(event) => setPreviewWidth(event.target.checked ? 'mobile' : 'desktop')}
              className="size-4 accent-wanas-accent"
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-wanas-border bg-wanas-surface px-3 py-2 text-sm">
            <span className="font-semibold text-wanas-text-secondary">وقت منخفض</span>
            <input
              type="checkbox"
              checked={lowTime}
              onChange={(event) => setLowTime(event.target.checked)}
              className="size-4 accent-wanas-accent"
            />
          </label>

          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
            <Button size="sm" variant="secondary" disabled={isFirstStep} onClick={goPrevious}>
              السابق
            </Button>
            <Button size="sm" onClick={goNext}>
              {isLastStep ? 'إنهاء المعاينة' : 'التالي'}
            </Button>
            <Button size="sm" variant="outline" onClick={resetPreview}>
              إعادة من البداية
            </Button>
          </div>
        </div>

        {previewFinished ? (
          <p className="mt-4 rounded-xl border border-wanas-success-border bg-wanas-success-surface px-4 py-3 text-sm font-semibold text-wanas-success-dark">
            انتهت المعاينة — استخدم «إعادة من البداية» لمراجعة الرحلة من جديد.
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background',
          previewWidth === 'mobile' ? 'mx-auto max-w-[390px]' : 'w-full',
        )}
      >
        <div className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
          {currentStep.label} — {perspective === 'impostor' ? 'برا السالفة' : 'لاعب عادي'}
        </div>
        <div key={`${currentStep.id}-${perspective}-${roundNumber}-${lowTime ? 'low' : 'normal'}`}>
          {renderFlowStep(currentStep.id, flowContext)}
        </div>
      </div>
    </div>
  );
}
