'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import { BARA_AL_SALAFA_GAME_ICON, BARA_AL_SALAFA_GAME_NAME } from '@/lib/game/bara-al-salafa-brand';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';

export type RoleRevealRole = 'normal' | 'impostor';

export type RoleRevealScreenProps = {
  gameName: string;
  currentRound: number;
  totalRounds: number;
  remainingSeconds: number;
  deadlineAtMs?: number | null;
  roomCode: string;
  role: RoleRevealRole;
  secretWord?: string;
  players: LobbyPlayer[];
  currentPlayerId: string;
  onAcknowledge?: () => void;
  acknowledged?: boolean;
  roleAcknowledgementCount?: number;
  eligibleRoleAcknowledgementCount?: number;
  showFallbackTimer?: boolean;
  className?: string;
};

function RoleIcon({ role }: { role: RoleRevealRole }) {
  return (
    <span
      className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--wanas-game-card)] text-xl shadow-sm ring-1 ring-[color:var(--wanas-game-card-border)] sm:size-12 sm:text-2xl"
      aria-hidden
    >
      {role === 'impostor' ? '🕵️' : '🎭'}
    </span>
  );
}

function RoleHeading({ role }: { role: RoleRevealRole }) {
  const isImpostor = role === 'impostor';

  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-xs font-medium tracking-wide text-wanas-text-muted">دورك</p>
      <div className="flex items-center gap-3">
        <RoleIcon role={role} />
        <h2
          className={cn(
            'text-2xl font-semibold sm:text-3xl',
            isImpostor ? 'text-wanas-accent-hover' : 'text-wanas-primary-dark',
          )}
        >
          {isImpostor ? 'برا السالفة' : 'داخل السالفة'}
        </h2>
      </div>
    </div>
  );
}

function SecretWordDisplay({ secretWord }: { secretWord?: string }) {
  return (
    <div className="mt-4 w-full max-w-sm sm:mt-10">
      <div className="rounded-[1.35rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-4 py-5 shadow-[var(--wanas-game-shadow)] sm:px-8 sm:py-8">
        <p className="text-2xl font-bold leading-tight tracking-tight text-wanas-text-primary min-[360px]:text-3xl sm:text-5xl md:text-[3.25rem]">
          {secretWord}
        </p>
      </div>
    </div>
  );
}

function ImpostorMysteryDisplay() {
  return (
    <div className="mt-4 w-full max-w-sm sm:mt-10">
      <div className="rounded-[1.35rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-4 py-5 sm:px-8 sm:py-10">
        <p className="text-5xl leading-none sm:text-7xl" aria-hidden>
          ❓
        </p>
        <p className="mt-4 text-sm font-medium text-wanas-text-muted">الكلمة مخفية عنك</p>
      </div>
    </div>
  );
}

function RoleRevealInstruction({ role }: { role: RoleRevealRole }) {
  return (
    <p className="mt-4 max-w-sm text-sm leading-relaxed text-wanas-text-secondary sm:mt-8">
      {role === 'impostor'
        ? 'حاول تسمع إجابات اللاعبين وتكتشف الكلمة المخفية دون أن تكشف نفسك.'
        : 'احفظ الكلمة جيدًا.'}
    </p>
  );
}

function RoleRevealWaitingState() {
  return (
    <div
      className="flex min-h-12 items-center justify-center gap-2.5 rounded-2xl border border-wanas-success-border/80 bg-wanas-success-surface/50 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span
        className="flex size-7 items-center justify-center rounded-full bg-wanas-success/15 text-sm text-wanas-success-dark"
        aria-hidden
      >
        ✓
      </span>
      <p className="text-sm font-medium text-wanas-success-dark">بانتظار بقية اللاعبين...</p>
    </div>
  );
}

function RoleRevealCard({ role, secretWord }: { role: RoleRevealRole; secretWord?: string }) {
  const isImpostor = role === 'impostor';

  return (
    <div className="wanas-game-card rounded-[1.5rem] px-4 py-5 sm:rounded-[2rem] sm:px-10 sm:py-14 md:px-12 md:py-16">
      <div className="flex flex-col items-center text-center">
        <RoleHeading role={role} />
        {isImpostor ? <ImpostorMysteryDisplay /> : <SecretWordDisplay secretWord={secretWord} />}
        <RoleRevealInstruction role={role} />
      </div>
    </div>
  );
}

export function RoleRevealScreen({
  gameName = BARA_AL_SALAFA_GAME_NAME,
  currentRound,
  totalRounds,
  remainingSeconds,
  deadlineAtMs,
  roomCode,
  role,
  secretWord,
  players: _players,
  currentPlayerId: _currentPlayerId,
  onAcknowledge,
  acknowledged = false,
  showFallbackTimer = true,
  className,
}: RoleRevealScreenProps) {
  return (
    <GameScreen ariaLabel="كشف الدور" className={className}>
      <GameHeader
        gameName={gameName}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel="كشف الدور"
        timer={
          showFallbackTimer
            ? resolveHeaderTimer({
                deadlineAtMs,
                remainingSeconds: remainingSeconds || 30,
                format: 'mm:ss',
                lowTimeThreshold: 10,
              })
            : undefined
        }
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 sm:gap-7">
        <RoleRevealCard role={role} secretWord={secretWord} />

        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          {acknowledged ? <RoleRevealWaitingState /> : null}

          <Button
            size="lg"
            className="min-h-11 w-full text-white focus-visible:ring-offset-4 sm:min-h-14"
            onClick={onAcknowledge}
            disabled={acknowledged || !onAcknowledge}
          >
            {acknowledged ? 'تم التأكيد' : 'فهمت'}
          </Button>
        </div>
      </div>
    </GameScreen>
  );
}
