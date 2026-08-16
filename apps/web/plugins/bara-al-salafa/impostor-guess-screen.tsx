'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { cn } from '@/lib/utils';

export type ImpostorGuessOption = {
  id: string;
  label: string;
  emoji?: string;
};

export type ImpostorGuessScreenProps = {
  isImpostor: boolean;
  options: readonly ImpostorGuessOption[];
  selectedWord: string | null;
  hasSubmitted: boolean;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  gameIcon?: string;
  phaseLabel?: string;
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  showTimer?: boolean;
  heroTitle?: string;
  heroHelper?: string;
  /** When true, non-impostors see the same options as read-only. */
  showOptionsToObservers?: boolean;
  waitingTitle?: string;
  waitingHelper?: string;
  onSelectWord?: (optionId: string) => void;
  onSubmit?: () => void;
  className?: string;
};

function SelectionCheckIcon({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'absolute end-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all duration-200',
        selected
          ? 'border-wanas-accent bg-wanas-accent text-white shadow-sm'
          : 'border-transparent bg-transparent text-transparent',
      )}
      aria-hidden
    >
      ✓
    </span>
  );
}

function GuessOptionButton({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: ImpostorGuessOption;
  selected: boolean;
  disabled?: boolean;
  onSelect?: (optionId: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(option.id)}
      className={cn(
        'relative flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-[22px] border-2 px-3 py-5 text-center transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45 focus-visible:ring-offset-2',
        'active:scale-[0.98]',
        'disabled:cursor-not-allowed',
        selected
          ? 'scale-[1.02] border-wanas-accent bg-wanas-accent-soft shadow-[var(--wanas-game-shadow-hover)] ring-1 ring-wanas-accent/20'
          : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] hover:border-wanas-accent/25 hover:shadow-[var(--wanas-game-shadow)]',
        disabled && !selected && 'opacity-45',
      )}
      aria-pressed={selected}
      aria-label={selected ? `${option.label} — مختار` : `اختيار ${option.label}`}
    >
      <SelectionCheckIcon selected={selected} />
      <span className="max-w-full truncate px-1 text-base font-semibold leading-snug text-wanas-text-primary">
        {option.label}
      </span>
      {selected ? (
        <span className="text-xs font-medium text-wanas-accent-hover">مختار</span>
      ) : null}
    </button>
  );
}

function ImpostorGuessHero({
  heroTitle = 'خمّن الكلمة',
  heroHelper = 'اختر الكلمة التي تعتقد أنها كانت داخل السالفة.',
}: {
  heroTitle?: string;
  heroHelper?: string;
}) {
  return (
    <div className="wanas-game-card rounded-[2rem] px-6 py-8 text-center sm:px-8 sm:py-10">
      <div>
        <h2 className="text-2xl font-semibold text-wanas-text-primary sm:text-3xl">{heroTitle}</h2>
        <p className="mx-auto mt-3 max-w-md wanas-game-helper">{heroHelper}</p>
        <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-3 py-1 text-xs font-medium text-wanas-text-muted">
          <span aria-hidden>ℹ️</span>
          لديك محاولة واحدة فقط.
        </p>
      </div>
    </div>
  );
}

function SubmittedChoiceCard({ option }: { option: ImpostorGuessOption }) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-[22px] border-2 border-wanas-success-border bg-wanas-success-surface/40 px-5 py-6 text-center">
      <p className="text-xs font-medium text-wanas-success-dark">اختيارك</p>
      <p className="mt-3 truncate text-lg font-semibold leading-snug text-wanas-text-primary">
        {option.label}
      </p>
    </div>
  );
}

function ImpostorGuessSubmittedState({
  options,
  selectedWord,
}: {
  options: readonly ImpostorGuessOption[];
  selectedWord: string | null;
}) {
  const submittedOption = options.find((option) => option.id === selectedWord);

  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <GameCard className="border-wanas-success-border/70 bg-wanas-success-surface px-6 py-6 text-center sm:px-8">
        <span
          className="mx-auto flex size-11 items-center justify-center rounded-full bg-wanas-success/15 text-lg text-wanas-success-dark"
          aria-hidden
        >
          ✓
        </span>
        <p className="mt-4 text-xl font-semibold text-wanas-success-dark sm:text-2xl">تم إرسال اختيارك</p>
        <p className="mt-2 wanas-game-helper">بانتظار انتهاء المرحلة...</p>
      </GameCard>

      {submittedOption ? <SubmittedChoiceCard option={submittedOption} /> : null}
    </div>
  );
}

function ImpostorGuessActiveView({
  options,
  selectedWord,
  hasSubmitted,
  onSelectWord,
  onSubmit,
  heroTitle,
  heroHelper,
}: Pick<
  ImpostorGuessScreenProps,
  | 'options'
  | 'selectedWord'
  | 'hasSubmitted'
  | 'onSelectWord'
  | 'onSubmit'
  | 'heroTitle'
  | 'heroHelper'
>) {
  if (hasSubmitted) {
    return <ImpostorGuessSubmittedState options={options} selectedWord={selectedWord} />;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <ImpostorGuessHero heroTitle={heroTitle} heroHelper={heroHelper} />

      <div className="grid grid-cols-1 gap-3 min-[320px]:grid-cols-2 md:grid-cols-4">
        {options.map((option) => (
          <GuessOptionButton
            key={option.id}
            option={option}
            selected={option.id === selectedWord}
            onSelect={onSelectWord}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-md">
        <Button
          size="lg"
          className="w-full min-h-[44px] focus-visible:ring-offset-4 sm:min-h-14"
          disabled={!selectedWord}
          onClick={onSubmit}
        >
          تأكيد الاختيار
        </Button>
      </div>
    </div>
  );
}

function ImpostorGuessWaitingView({
  options,
  showOptions,
  waitingTitle = 'برا السالفة يحاول تخمين الكلمة',
  waitingHelper = 'بانتظار انتهاء المرحلة...',
}: {
  options: readonly ImpostorGuessOption[];
  showOptions: boolean;
  waitingTitle?: string;
  waitingHelper?: string;
}) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <div
        role="status"
        aria-live="polite"
        className="rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12"
      >
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-wanas-accent-soft text-2xl shadow-sm"
          aria-hidden
        >
          🤔
        </span>
        <h2 className="mt-5 text-xl font-semibold text-wanas-text-primary sm:text-2xl">
          {waitingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-md wanas-game-helper">{waitingHelper}</p>
      </div>

      {showOptions ? (
        <div className="grid grid-cols-1 gap-3 min-[320px]:grid-cols-2 md:grid-cols-4">
          {options.map((option) => (
            <GuessOptionButton key={option.id} option={option} selected={false} disabled />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ImpostorGuessScreen({
  isImpostor,
  options,
  selectedWord = null,
  hasSubmitted = false,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  gameIcon = BARA_AL_SALAFA_GAME_ICON,
  phaseLabel = 'تخمين الكلمة',
  remainingSeconds = 0,
  deadlineAtMs,
  showTimer = false,
  heroTitle,
  heroHelper,
  showOptionsToObservers = false,
  waitingTitle,
  waitingHelper,
  onSelectWord,
  onSubmit,
  className,
}: ImpostorGuessScreenProps) {
  return (
    <GameScreen ariaLabel="مرحلة تخمين الكلمة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName ?? 'برا السالفة'}
        gameIcon={gameIcon ?? BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel={phaseLabel}
        timer={
          showTimer
            ? resolveHeaderTimer({
                deadlineAtMs,
                remainingSeconds,
                format: 'seconds',
                lowTimeThreshold: 5,
              })
            : undefined
        }
      />

      {isImpostor ? (
        <ImpostorGuessActiveView
          options={options}
          selectedWord={selectedWord}
          hasSubmitted={hasSubmitted}
          onSelectWord={onSelectWord}
          onSubmit={onSubmit}
          heroTitle={heroTitle}
          heroHelper={heroHelper}
        />
      ) : (
        <ImpostorGuessWaitingView
          options={options}
          showOptions={showOptionsToObservers}
          waitingTitle={waitingTitle}
          waitingHelper={waitingHelper}
        />
      )}
    </GameScreen>
  );
}
