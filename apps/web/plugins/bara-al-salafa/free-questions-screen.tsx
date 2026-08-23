'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { Button } from '@/components/ui/button';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';
import { QuestionTurnPanel } from './question-turn-panel';

export type FreeQuestionsScreenProps = {
  players: LobbyPlayer[];
  currentPlayerId: string;
  activePlayerId: string;
  activePlayerName: string;
  /** Server-authoritative active flag; falls back to id match when omitted. */
  isActivePlayer?: boolean;
  conversationTargetPlayerId?: string | null;
  conversationTargetPlayerName?: string | null;
  selectedTargetPlayerId?: string | null;
  completedPlayerIds: readonly string[];
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  showTimer?: boolean;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  isSubmittingAdvance?: boolean;
  onSelectPlayer?: (playerId: string) => void;
  onConfirm?: () => void;
  onSkip?: () => void;
  onAdvanceNext?: () => void;
  className?: string;
};

type TurnStatus = 'completed' | 'current' | 'waiting';

function getTurnStatus(
  playerId: string,
  activePlayerId: string,
  completedPlayerIds: readonly string[],
): TurnStatus {
  if (completedPlayerIds.includes(playerId)) {
    return 'completed';
  }
  if (playerId === activePlayerId) {
    return 'current';
  }
  return 'waiting';
}

const turnStatusLabels: Record<TurnStatus, string> = {
  completed: 'أكمل',
  current: 'الدور',
  waiting: 'بانتظار',
};

function SelectionCheckIcon({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200',
        selected
          ? 'border-wanas-accent bg-wanas-accent text-white shadow-sm'
          : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] text-transparent',
      )}
      aria-hidden
    >
      ✓
    </span>
  );
}

function SelectablePlayerCard({
  player,
  selected,
  onSelect,
}: {
  player: LobbyPlayer;
  selected: boolean;
  onSelect?: (playerId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(player.id)}
      className={cn(
        'flex min-h-[80px] w-full items-center gap-3.5 rounded-[22px] border-2 px-4 py-4 text-start transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45 focus-visible:ring-offset-2',
        'active:scale-[0.99]',
        selected
          ? 'scale-[1.02] border-wanas-accent bg-wanas-accent-soft shadow-[var(--wanas-game-shadow-hover)] ring-1 ring-wanas-accent/20'
          : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] hover:border-wanas-accent/25 hover:shadow-[var(--wanas-game-shadow)]',
      )}
      aria-pressed={selected}
      aria-label={selected ? `${player.name} — مختار` : `اختيار ${player.name}`}
    >
      <PlayerAvatar playerId={player.id} avatarId={player.avatarId} playerName={player.name} className="size-12 ring-2 ring-[color:var(--wanas-game-card-border)]" sizes="48px" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-wanas-text-primary">{player.name}</p>
        {selected ? <p className="mt-0.5 text-xs font-medium text-wanas-accent-hover">مختار</p> : null}
      </div>
      <SelectionCheckIcon selected={selected} />
    </button>
  );
}

function FreeQuestionsActiveHero() {
  return (
    <div className="wanas-game-card rounded-[2rem] px-6 py-8 text-center sm:px-8 sm:py-10">
      <div>
        <span className="inline-flex min-h-8 items-center rounded-full border border-wanas-accent bg-wanas-accent px-4 py-1.5 text-sm font-semibold text-white">
          دورك الآن
        </span>
        <p className="mx-auto mt-4 max-w-sm wanas-game-helper">
          اختر لاعبًا تسأله، أو تخطَّ دورك.
        </p>
      </div>
    </div>
  );
}

function FreeQuestionsActiveView({
  players,
  activePlayerId,
  selectedTargetPlayerId,
  onSelectPlayer,
  onConfirm,
  onSkip,
}: Pick<
  FreeQuestionsScreenProps,
  | 'players'
  | 'activePlayerId'
  | 'selectedTargetPlayerId'
  | 'onSelectPlayer'
  | 'onConfirm'
  | 'onSkip'
>) {
  const selectablePlayers = players.filter((player) => player.id !== activePlayerId);

  return (
    <div className="flex flex-col gap-7">
      <FreeQuestionsActiveHero />

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {selectablePlayers.map((player) => (
          <SelectablePlayerCard
            key={player.id}
            player={player}
            selected={player.id === selectedTargetPlayerId}
            onSelect={onSelectPlayer}
          />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="min-h-11 w-full flex-1 focus-visible:ring-offset-4 sm:min-h-14"
          onClick={onConfirm}
          disabled={!selectedTargetPlayerId}
        >
          تأكيد الاختيار
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="min-h-11 w-full flex-1 sm:min-h-14"
          onClick={onSkip}
        >
          تخطي الدور
        </Button>
      </div>
    </div>
  );
}

function FreeQuestionsWaitingView({ activePlayerName }: { activePlayerName: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
    >
      <span
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-wanas-accent-soft/60 text-xl"
        aria-hidden
      >
        ⏳
      </span>
      <p className="mt-4 text-lg font-semibold leading-relaxed text-wanas-text-primary sm:text-xl">
        {activePlayerName} يختار لاعبًا ليسأله
      </p>
      <p className="mx-auto mt-3 max-w-md wanas-game-helper">بانتظار اختيار اللاعب الحالي...</p>
    </div>
  );
}

function FreeQuestionsTurnFooter({
  players,
  activePlayerId,
  completedPlayerIds,
}: Pick<FreeQuestionsScreenProps, 'players' | 'activePlayerId' | 'completedPlayerIds'>) {
  return (
    <GameCard className="p-4 sm:p-5">
      <p className="text-xs font-medium text-wanas-text-muted">
        أكمل {completedPlayerIds.length} من {players.length} لاعبين دورهم
      </p>
      <ul className="mt-3 space-y-2">
        {players.map((player) => {
          const status = getTurnStatus(player.id, activePlayerId, completedPlayerIds);
          return (
            <li
              key={player.id}
              className={cn(
                'flex items-center gap-3 rounded-[16px] border px-3 py-2.5',
                status === 'completed' && 'border-wanas-success-border/50 bg-wanas-success-surface/25',
                status === 'current' && 'border-wanas-accent/25 bg-wanas-accent-soft/25',
                status === 'waiting' && 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)]',
              )}
            >
              <PlayerAvatar playerId={player.id} avatarId={player.avatarId} playerName={player.name} className="size-9 ring-2 ring-[color:var(--wanas-game-card-border)]" sizes="36px" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-wanas-text-primary">
                {player.name}
              </p>
              <span
                className={cn(
                  'shrink-0 text-[10px] font-semibold',
                  status === 'completed' && 'text-wanas-success-dark',
                  status === 'current' && 'text-wanas-accent-hover',
                  status === 'waiting' && 'text-wanas-text-muted',
                )}
              >
                {turnStatusLabels[status]}
              </span>
            </li>
          );
        })}
      </ul>
    </GameCard>
  );
}

export function FreeQuestionsScreen({
  players,
  currentPlayerId,
  activePlayerId,
  activePlayerName,
  isActivePlayer: isActivePlayerProp,
  conversationTargetPlayerId = null,
  conversationTargetPlayerName = null,
  selectedTargetPlayerId = null,
  completedPlayerIds,
  remainingSeconds = 0,
  deadlineAtMs,
  showTimer = false,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  isSubmittingAdvance = false,
  onSelectPlayer,
  onConfirm,
  onSkip,
  onAdvanceNext,
  className,
}: FreeQuestionsScreenProps) {
  const isActivePlayer = isActivePlayerProp ?? currentPlayerId === activePlayerId;
  const isConversationActive =
    conversationTargetPlayerId !== null && conversationTargetPlayerName !== null;

  return (
    <GameScreen ariaLabel="مرحلة الأسئلة الحرة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName ?? 'برا السالفة'}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="الأسئلة الحرة"
        timer={
          showTimer
            ? resolveHeaderTimer({
                deadlineAtMs,
                remainingSeconds,
                format: 'seconds',
                lowTimeThreshold: 10,
              })
            : undefined
        }
      />

      <div className="flex flex-col gap-6 sm:gap-7">
        {isConversationActive ? (
          <QuestionTurnPanel
            askerName={activePlayerName}
            targetName={conversationTargetPlayerName}
            askerPlayerId={activePlayerId}
            targetPlayerId={conversationTargetPlayerId}
            currentPlayerId={currentPlayerId}
            isSubmittingAdvance={isSubmittingAdvance}
            onAdvanceNext={isActivePlayer ? onAdvanceNext : undefined}
          />
        ) : isActivePlayer ? (
          <FreeQuestionsActiveView
            players={players}
            activePlayerId={activePlayerId}
            selectedTargetPlayerId={selectedTargetPlayerId}
            onSelectPlayer={onSelectPlayer}
            onConfirm={onConfirm}
            onSkip={onSkip}
          />
        ) : (
          <FreeQuestionsWaitingView activePlayerName={activePlayerName} />
        )}

        <FreeQuestionsTurnFooter
          players={players}
          activePlayerId={activePlayerId}
          completedPlayerIds={completedPlayerIds}
        />
      </div>
    </GameScreen>
  );
}
