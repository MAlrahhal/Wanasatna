'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { AdPlacement } from '@/components/ads/ad-placement';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { Button } from '@/components/ui/button';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';

export type VotingScreenProps = {
  players: LobbyPlayer[];
  currentPlayerId: string;
  selectedPlayerId?: string | null;
  confirmedPlayerId?: string | null;
  hasVoted: boolean;
  remainingSeconds?: number;
  deadlineAtMs?: number | null;
  showTimer?: boolean;
  submittedVotesCount: number;
  eligibleVotersCount: number;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  gameIcon?: string;
  questionTitle?: string;
  questionHelper?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  isSpectator?: boolean;
  onSelectPlayer?: (playerId: string) => void;
  onConfirmVote?: () => void;
  className?: string;
};

function VotingProgress({
  submittedVotesCount,
  eligibleVotersCount,
}: Pick<VotingScreenProps, 'submittedVotesCount' | 'eligibleVotersCount'>) {
  const progressPercent = Math.min(
    100,
    Math.round((submittedVotesCount / Math.max(eligibleVotersCount, 1)) * 100),
  );

  return (
    <div className="space-y-2.5" role="status" aria-live="polite">
      <p className="wanas-game-helper text-wanas-text-secondary text-center font-medium">
        صوّت {submittedVotesCount} من {eligibleVotersCount}
      </p>
      <div
        className="bg-wanas-surface-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={eligibleVotersCount}
        aria-valuenow={submittedVotesCount}
        aria-label={`تقدّم التصويت ${submittedVotesCount} من ${eligibleVotersCount}`}
      >
        <div
          className="bg-wanas-accent h-full rounded-full transition-[width] duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

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

function VotablePlayerCard({
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
        'flex min-h-14 w-full items-center gap-3 rounded-[18px] border-2 px-3 py-2.5 text-start transition-all duration-200 sm:min-h-[80px] sm:gap-3.5 sm:rounded-[22px] sm:px-4 sm:py-4',
        'focus-visible:ring-wanas-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'active:scale-[0.99]',
        selected
          ? 'border-wanas-accent bg-wanas-accent-soft ring-wanas-accent/20 scale-[1.02] shadow-[var(--wanas-game-shadow-hover)] ring-1'
          : 'hover:border-wanas-accent/25 border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] hover:shadow-[var(--wanas-game-shadow)]',
      )}
      aria-pressed={selected}
      aria-label={selected ? `${player.name} — مختار للتصويت` : `تصويت على ${player.name}`}
    >
      <PlayerAvatar
        playerId={player.id}
        avatarId={player.avatarId}
        playerName={player.name}
        className="size-12 ring-2 ring-[color:var(--wanas-game-card-border)]"
        sizes="48px"
      />
      <div className="min-w-0 flex-1">
        <p className="text-wanas-text-primary truncate text-base font-semibold">{player.name}</p>
        {selected ? (
          <p className="text-wanas-accent-hover mt-0.5 text-xs font-medium">مختار</p>
        ) : null}
      </div>
      <SelectionCheckIcon selected={selected} />
    </button>
  );
}

function ConfirmedVoteCard({ player }: { player: LobbyPlayer }) {
  return (
    <div className="border-wanas-success-border flex min-h-14 items-center gap-3 rounded-[18px] border bg-[color:var(--wanas-game-card)] px-3 py-2.5 shadow-sm sm:min-h-[80px] sm:gap-3.5 sm:rounded-[22px] sm:px-4 sm:py-4">
      <PlayerAvatar
        playerId={player.id}
        avatarId={player.avatarId}
        playerName={player.name}
        className="size-12 ring-2 ring-[color:var(--wanas-game-card-border)]"
        sizes="48px"
      />
      <div className="min-w-0 flex-1">
        <p className="text-wanas-text-primary truncate text-base font-semibold">{player.name}</p>
        <p className="text-wanas-success-dark mt-0.5 text-xs font-medium">اختيارك</p>
      </div>
      <span
        className="bg-wanas-success/15 text-wanas-success-dark flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        aria-hidden
      >
        ✓
      </span>
    </div>
  );
}

function VotingQuestionHero({
  questionTitle,
  questionHelper,
}: {
  questionTitle: string;
  questionHelper?: string;
}) {
  return (
    <div className="text-center">
      <h2 className="text-wanas-text-primary text-xl font-semibold sm:text-3xl">{questionTitle}</h2>
      {questionHelper ? (
        <p className="wanas-game-helper mx-auto mt-3 max-w-md">{questionHelper}</p>
      ) : null}
    </div>
  );
}

function VotingNotVotedView({
  players,
  currentPlayerId,
  selectedPlayerId,
  isSubmitting,
  errorMessage,
  onSelectPlayer,
  onConfirmVote,
  questionTitle,
  questionHelper,
}: Pick<
  VotingScreenProps,
  | 'players'
  | 'currentPlayerId'
  | 'selectedPlayerId'
  | 'isSubmitting'
  | 'errorMessage'
  | 'onSelectPlayer'
  | 'onConfirmVote'
  | 'questionTitle'
  | 'questionHelper'
>) {
  const votablePlayers = players.filter((player) => player.id !== currentPlayerId);

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <VotingQuestionHero
        questionTitle={questionTitle ?? 'من هو برا السالفة؟'}
        questionHelper={questionHelper ?? 'اختر اللاعب الذي تشك أنه خارج السالفة.'}
      />

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {votablePlayers.map((player) => (
          <VotablePlayerCard
            key={player.id}
            player={player}
            selected={player.id === selectedPlayerId}
            onSelect={onSelectPlayer}
          />
        ))}
      </div>

      <AdPlacement placement="game-player-list" />

      <div className="bg-[color:var(--wanas-game-bg-from)]/95 sticky bottom-0 z-10 -mx-[max(0.75rem,env(safe-area-inset-left,0px))] border-t border-[color:var(--wanas-game-card-border)] px-[max(0.75rem,env(safe-area-inset-left,0px))] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <Button
            size="lg"
            className="min-h-14 w-full focus-visible:ring-offset-4"
            onClick={onConfirmVote}
            disabled={!selectedPlayerId}
            loading={isSubmitting}
          >
            تأكيد التصويت
          </Button>
          <p className="text-wanas-text-muted flex items-center justify-center gap-1.5 text-center text-xs leading-relaxed">
            <span aria-hidden>ℹ️</span>
            لا يمكنك تغيير صوتك بعد التأكيد.
          </p>
          {errorMessage ? (
            <p
              className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-2xl border px-4 py-3 text-center text-sm font-semibold"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VotingSpectatorView({
  submittedVotesCount,
  eligibleVotersCount,
  questionTitle,
  questionHelper,
}: Pick<
  VotingScreenProps,
  'submittedVotesCount' | 'eligibleVotersCount' | 'questionTitle' | 'questionHelper'
>) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <VotingQuestionHero
        questionTitle={questionTitle ?? 'من هو برا السالفة؟'}
        questionHelper={questionHelper ?? 'اللاعبون يصوّتون الآن'}
      />
      <GameCard className="px-5 py-6 text-center sm:px-8 sm:py-10">
        <div className="mx-auto max-w-sm">
          <VotingProgress
            submittedVotesCount={submittedVotesCount}
            eligibleVotersCount={eligibleVotersCount}
          />
        </div>
      </GameCard>
    </div>
  );
}

function VotingConfirmedView({
  players,
  confirmedPlayerId,
  submittedVotesCount,
  eligibleVotersCount,
}: Pick<
  VotingScreenProps,
  'players' | 'confirmedPlayerId' | 'submittedVotesCount' | 'eligibleVotersCount'
>) {
  const confirmedPlayer = players.find((player) => player.id === confirmedPlayerId);

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <GameCard className="border-wanas-success-border/70 bg-wanas-success-surface px-5 py-6 text-center sm:px-8 sm:py-12">
        <span
          className="bg-wanas-success/15 text-wanas-success-dark mx-auto flex size-12 items-center justify-center rounded-full text-xl"
          aria-hidden
        >
          ✓
        </span>
        <p className="text-wanas-success-dark mt-5 text-2xl font-semibold sm:text-3xl">
          تم تسجيل صوتك
        </p>
        <p className="wanas-game-helper text-wanas-text-secondary mx-auto mt-3 max-w-md">
          بانتظار تصويت بقية اللاعبين...
        </p>
        <div className="mx-auto mt-6 max-w-sm">
          <VotingProgress
            submittedVotesCount={submittedVotesCount}
            eligibleVotersCount={eligibleVotersCount}
          />
        </div>
      </GameCard>

      {confirmedPlayer ? (
        <div className="mx-auto w-full max-w-md space-y-2.5">
          <p className="wanas-game-helper text-wanas-text-secondary font-medium">صوتك المؤكّد</p>
          <ConfirmedVoteCard player={confirmedPlayer} />
        </div>
      ) : null}
    </div>
  );
}

export function VotingScreen({
  players,
  currentPlayerId,
  selectedPlayerId = null,
  confirmedPlayerId = null,
  hasVoted,
  remainingSeconds = 0,
  deadlineAtMs,
  showTimer = false,
  submittedVotesCount,
  eligibleVotersCount,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  gameIcon = BARA_AL_SALAFA_GAME_ICON,
  questionTitle = 'من هو برا السالفة؟',
  questionHelper = 'صوّت لمين تتوقع أنه برا السالفة',
  isSubmitting = false,
  errorMessage = null,
  isSpectator = false,
  onSelectPlayer,
  onConfirmVote,
  className,
}: VotingScreenProps) {
  return (
    <GameScreen ariaLabel="مرحلة التصويت" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName ?? 'برا السالفة'}
        gameIcon={gameIcon ?? BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="التصويت"
        timer={
          showTimer
            ? resolveHeaderTimer({
                deadlineAtMs,
                remainingSeconds,
                format: 'seconds',
              })
            : undefined
        }
      />

      {isSpectator ? (
        <VotingSpectatorView
          submittedVotesCount={submittedVotesCount}
          eligibleVotersCount={eligibleVotersCount}
          questionTitle={questionTitle}
          questionHelper="اللاعبون يصوّتون الآن"
        />
      ) : hasVoted ? (
        <VotingConfirmedView
          players={players}
          confirmedPlayerId={confirmedPlayerId}
          submittedVotesCount={submittedVotesCount}
          eligibleVotersCount={eligibleVotersCount}
        />
      ) : (
        <VotingNotVotedView
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlayerId={selectedPlayerId}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onSelectPlayer={onSelectPlayer}
          onConfirmVote={onConfirmVote}
          questionTitle={questionTitle}
          questionHelper={questionHelper}
        />
      )}
    </GameScreen>
  );
}
