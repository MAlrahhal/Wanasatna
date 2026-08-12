'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type QuestionTurnPanelProps = {
  askerName: string;
  targetName: string;
  askerPlayerId: string;
  targetPlayerId: string;
  currentPlayerId: string;
  isSubmittingAdvance?: boolean;
  onAdvanceNext?: () => void;
};

type TurnRole = 'asker' | 'target' | 'neutral';

export function getQuestionTurnRole(
  playerId: string,
  askerPlayerId: string,
  targetPlayerId: string,
): TurnRole {
  if (playerId === askerPlayerId) {
    return 'asker';
  }
  if (playerId === targetPlayerId) {
    return 'target';
  }
  return 'neutral';
}

function ConversationHeading({ askerName, targetName }: { askerName: string; targetName: string }) {
  return (
    <p className="text-pretty break-words text-lg font-semibold leading-relaxed text-wanas-text-primary sm:text-xl">
      {askerName} اسأل {targetName}
    </p>
  );
}

export function QuestionTurnPanel({
  askerName,
  targetName,
  askerPlayerId,
  targetPlayerId,
  currentPlayerId,
  isSubmittingAdvance = false,
  onAdvanceNext,
}: QuestionTurnPanelProps) {
  const role = getQuestionTurnRole(currentPlayerId, askerPlayerId, targetPlayerId);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-md rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-5 py-6 text-center shadow-sm sm:px-6 sm:py-7"
    >
      <ConversationHeading askerName={askerName} targetName={targetName} />

      {role === 'asker' ? (
        <div className="mt-4 flex flex-col items-center gap-4">
          <span className="inline-flex min-h-7 items-center rounded-full border border-wanas-accent/30 bg-wanas-accent-soft/60 px-3 py-0.5 text-xs font-semibold text-wanas-accent-hover">
            دورك
          </span>
          <p className="wanas-game-helper max-w-sm">
            اسأل سؤالًا يساعدك في اكتشاف برا السالفة.
          </p>
          <Button
            size="lg"
            className="w-full min-h-[44px] focus-visible:ring-offset-4 sm:min-h-14"
            onClick={onAdvanceNext}
            disabled={!onAdvanceNext}
            loading={isSubmittingAdvance}
          >
            التالي
          </Button>
        </div>
      ) : null}

      {role === 'target' ? (
        <p className={cn('mt-4 wanas-game-helper')}>
          أجب عن السؤال دون كشف الكلمة مباشرة.
        </p>
      ) : null}

      {role === 'neutral' ? (
        <p className={cn('mt-4 wanas-game-helper')}>
          استمع للإجابة وحاول اكتشاف برا السالفة.
        </p>
      ) : null}
    </div>
  );
}
