'use client';

import { ResultsAdPlacement } from '@/components/ads/results-ad-placement';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { Button } from '@/components/ui/button';
import { FinalResultsFeedbackCta } from '@/components/feedback/feedback-button';
import { useGameExperienceShellActive } from '@/contexts/game-experience-context';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { useDeadlineClock } from '@/lib/game/use-deadline-clock';
import { presentSystemCopy } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

export type MatchLeaderboardEntry = {
  id: string;
  name: string;
  totalPoints: number;
  rank: number;
  isFirstPlace: boolean;
  isCurrentPlayer: boolean;
};

export type MatchTeamResultEntry = {
  teamId: string;
  teamLabel: string;
  totalPoints: number;
  members: Array<{
    id: string;
    name: string;
    score: number;
  }>;
};

export type MatchTeamResults = {
  isTie: boolean;
  winningTeamId: string | null;
  teams: readonly MatchTeamResultEntry[];
};

export type MatchResultsScreenProps = {
  leaderboard: readonly MatchLeaderboardEntry[];
  teamResults?: MatchTeamResults | null;
  currentTeamId?: string | null;
  currentPlayerId: string;
  totalRounds: number;
  playerCount: number;
  roomCode: string;
  gameName?: string;
  returnStatusMessage?: string | null;
  autoReturnSeconds?: number;
  autoReturnDeadlineAtMs?: number | null;
  autoReturnTotalSeconds?: number;
  isReturnToLobbyLoading?: boolean;
  onReturnToLobby?: () => void;
  onPlayAgain?: () => void;
  className?: string;
};

function getRankMedal(rank: number, isFirstPlace: boolean): string {
  if (isFirstPlace || rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function teamResultTone(teamId: string): string {
  return teamId === 'red' ? 'border-red-400/50 bg-red-500/10' : 'border-blue-400/50 bg-blue-500/10';
}

function TeamWinnerHero({ teamResults }: { teamResults: MatchTeamResults }) {
  const winner = teamResults.teams.find((team) => team.teamId === teamResults.winningTeamId);
  const featuredTeams = teamResults.isTie ? teamResults.teams : winner ? [winner] : [];

  return (
    <div className="wanas-game-card border-wanas-warning-border/70 bg-wanas-warning-surface rounded-[1.5rem] px-4 py-4 text-center sm:rounded-[2rem] sm:px-8 sm:py-8">
      <div className="flex flex-col items-center gap-3 sm:gap-5">
        <span className="text-4xl sm:text-6xl" aria-hidden>
          {teamResults.isTie ? '⚖️' : '🏆'}
        </span>
        <h2 className="text-wanas-warning-dark text-xl font-semibold sm:text-2xl">
          {teamResults.isTie ? 'تعادل الفريقان!' : `الفائز: ${winner?.teamLabel ?? ''}`}
        </h2>
        <div
          className={cn(
            'grid w-full gap-3',
            featuredTeams.length > 1 ? 'max-w-2xl grid-cols-1 sm:grid-cols-2' : 'max-w-sm',
          )}
        >
          {featuredTeams.map((team) => (
            <div
              key={team.teamId}
              className={cn('rounded-[1.25rem] border-2 px-4 py-4', teamResultTone(team.teamId))}
            >
              <p className="text-wanas-text-primary text-lg font-bold">{team.teamLabel}</p>
              <p className="text-wanas-text-primary mt-1 font-mono text-3xl font-black tabular-nums">
                {team.totalPoints}
              </p>
              <p className="text-wanas-text-muted text-xs font-medium">نقطة</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrentTeamSummary({
  teamResults,
  currentTeamId,
}: {
  teamResults: MatchTeamResults;
  currentTeamId: string | null;
}) {
  const currentTeam = teamResults.teams.find((team) => team.teamId === currentTeamId);
  if (!currentTeam) {
    return null;
  }

  const outcome = teamResults.isTie
    ? 'تعادل فريقك'
    : teamResults.winningTeamId === currentTeam.teamId
      ? 'فاز فريقك'
      : 'خسر فريقك';

  return (
    <div className="border-wanas-accent/25 bg-wanas-accent-soft/35 rounded-[1.25rem] border-2 px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-wanas-text-muted text-xs font-medium">نتيجة فريقك</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-wanas-text-primary text-lg font-semibold">{outcome}</p>
          <p className="text-wanas-accent-hover mt-0.5 text-sm font-medium">
            {currentTeam.teamLabel}
          </p>
        </div>
        <div className="text-end">
          <p className="text-wanas-text-muted text-xs font-medium">مجموع الفريق</p>
          <p className="text-wanas-text-primary font-mono text-2xl font-bold tabular-nums">
            {currentTeam.totalPoints}
          </p>
        </div>
      </div>
    </div>
  );
}

function FinalTeamLeaderboard({
  teamResults,
  currentPlayerId,
}: {
  teamResults: MatchTeamResults;
  currentPlayerId: string;
}) {
  const rankedTeams = [...teamResults.teams].sort((left, right) => {
    if (right.totalPoints !== left.totalPoints) {
      return right.totalPoints - left.totalPoints;
    }
    return left.teamId.localeCompare(right.teamId);
  });

  return (
    <GameCard className="p-5 sm:p-6">
      <h2 className="wanas-game-title mb-4">النتيجة النهائية للفرق</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {rankedTeams.map((team, index) => {
          const rank = teamResults.isTie ? 1 : index + 1;
          return (
            <section
              key={team.teamId}
              className={cn('rounded-[1.25rem] border-2 p-4', teamResultTone(team.teamId))}
              aria-label={`${team.teamLabel}، المركز ${rank}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-wanas-text-primary text-base font-bold">{team.teamLabel}</p>
                  <p className="text-wanas-text-muted text-xs">
                    {teamResults.isTie ? 'متعادل' : `المركز ${rank}`}
                  </p>
                </div>
                <p className="text-wanas-text-primary font-mono text-2xl font-black tabular-nums">
                  {team.totalPoints}
                </p>
              </div>
              <ul className="mt-4 space-y-2" aria-label={`لاعبو ${team.teamLabel}`}>
                {team.members.map((member) => {
                  const isCurrentPlayer = member.id === currentPlayerId;
                  return (
                    <li
                      key={member.id}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-3 py-2',
                        isCurrentPlayer && 'ring-wanas-accent/35 ring-2',
                      )}
                      aria-current={isCurrentPlayer ? 'true' : undefined}
                    >
                      <PlayerAvatar
                        playerId={member.id}
                        playerName={member.name}
                        className="size-9 ring-2 ring-[color:var(--wanas-game-card-border)]"
                        sizes="36px"
                      />
                      <p className="text-wanas-text-primary min-w-0 flex-1 truncate text-sm font-semibold">
                        {member.name}
                        {isCurrentPlayer ? ` · أنت` : ''}
                      </p>
                      <span className="text-wanas-text-muted shrink-0 font-mono text-sm font-bold tabular-nums">
                        {member.score}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-wanas-text-muted mt-3 text-center text-xs">
        النتيجة الرسمية تُحسب بمجموع كل فريق؛ ونقاط اللاعبين تفصيل إضافي.
      </p>
    </GameCard>
  );
}

function getArabicRankLabel(rank: number): string {
  if (rank === 1) return 'المركز الأول';
  if (rank === 2) return 'المركز الثاني';
  if (rank === 3) return 'المركز الثالث';
  return `المركز ${rank}`;
}

function WinnerHeroCard({ entry }: { entry: MatchLeaderboardEntry }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <PlayerAvatar
        playerId={entry.id}
        playerName={entry.name}
        className="size-16 shadow-lg ring-4 ring-[color:var(--wanas-game-card-border)] sm:size-24"
        sizes="(max-width: 640px) 64px, 96px"
      />
      <div>
        <p className="text-wanas-text-primary text-2xl font-bold sm:text-3xl">{entry.name}</p>
        <p className="text-wanas-warning-dark mt-1.5 font-mono text-lg font-semibold tabular-nums">
          {entry.totalPoints} نقطة
        </p>
      </div>
    </div>
  );
}

function WinnerHero({ winners }: { winners: MatchLeaderboardEntry[] }) {
  const isTie = winners.length > 1;

  return (
    <div className="wanas-game-card border-wanas-warning-border/70 bg-wanas-warning-surface rounded-[1.5rem] px-4 py-4 text-center sm:rounded-[2rem] sm:px-8 sm:py-8">
      <div className="flex flex-col items-center gap-3 sm:gap-5">
        <span className="text-4xl sm:text-6xl" aria-hidden>
          👑
        </span>
        <h2 className="text-wanas-warning-dark text-xl font-semibold sm:text-2xl">
          {isTie ? 'تعادل في المركز الأول!' : 'الفائز'}
        </h2>

        <div
          className={cn(
            'grid w-full gap-6',
            isTie ? 'max-w-2xl grid-cols-1 sm:grid-cols-2' : 'max-w-sm grid-cols-1',
          )}
        >
          {winners.map((entry) => (
            <WinnerHeroCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrentPlayerSummary({ entry }: { entry: MatchLeaderboardEntry | undefined }) {
  if (!entry) {
    return null;
  }

  return (
    <div className="border-wanas-accent/25 bg-wanas-accent-soft/35 rounded-[1.25rem] border-2 px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-wanas-text-muted text-xs font-medium">ترتيبك</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-wanas-text-primary text-lg font-semibold">
            {getArabicRankLabel(entry.rank)}
          </p>
          <p className="text-wanas-accent-hover mt-0.5 text-sm font-medium">
            {getRankMedal(entry.rank, entry.isFirstPlace)} أنت
          </p>
        </div>
        <div className="text-end">
          <p className="text-wanas-text-muted text-xs font-medium">النقاط</p>
          <p className="text-wanas-text-primary font-mono text-2xl font-bold tabular-nums">
            {entry.totalPoints}
          </p>
        </div>
      </div>
    </div>
  );
}

function FinalLeaderboard({
  leaderboard,
  currentPlayerId,
}: Pick<MatchResultsScreenProps, 'leaderboard' | 'currentPlayerId'>) {
  return (
    <GameCard className="p-5 sm:p-6">
      <h2 className="wanas-game-title mb-4">الترتيب النهائي</h2>
      <ul className="space-y-2.5">
        {leaderboard.map((entry) => {
          const isCurrentPlayer = entry.id === currentPlayerId;
          const isTopThree = entry.rank <= 3;

          return (
            <li
              key={entry.id}
              className={cn(
                'flex items-center gap-3 rounded-[18px] border px-3.5 py-3',
                entry.rank === 1 || entry.isFirstPlace
                  ? 'border-wanas-warning-border bg-wanas-warning-surface/60'
                  : entry.rank === 2
                    ? 'border-wanas-border bg-wanas-surface-soft'
                    : entry.rank === 3
                      ? 'border-wanas-border bg-wanas-surface-soft/80'
                      : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)]',
                isCurrentPlayer && 'ring-wanas-accent/35 ring-2',
              )}
              aria-current={isCurrentPlayer ? 'true' : undefined}
            >
              <span
                className={cn(
                  'flex w-9 shrink-0 items-center justify-center text-base font-bold',
                  isTopThree ? 'text-wanas-warning-dark' : 'text-wanas-text-muted text-sm',
                )}
                aria-label={`المركز ${entry.rank}`}
              >
                {getRankMedal(entry.rank, entry.isFirstPlace)}
              </span>
              <PlayerAvatar
                playerId={entry.id}
                playerName={entry.name}
                className="size-10 ring-2 ring-[color:var(--wanas-game-card-border)]"
                sizes="40px"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-wanas-text-primary truncate text-sm font-semibold">
                    {entry.name}
                  </p>
                  {isCurrentPlayer ? (
                    <span className="border-wanas-accent/30 bg-wanas-accent rounded-full border px-2 py-0.5 text-xs font-semibold text-white">
                      أنت
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="text-wanas-text-primary shrink-0 font-mono text-sm font-bold tabular-nums">
                {entry.totalPoints}
              </span>
            </li>
          );
        })}
      </ul>
    </GameCard>
  );
}

function MatchStats({
  totalRounds,
  playerCount,
  highestScore,
}: {
  totalRounds: number;
  playerCount: number;
  highestScore: number;
}) {
  const stats = [
    { label: 'عدد الجولات', value: totalRounds },
    { label: 'عدد اللاعبين', value: playerCount },
    { label: 'أعلى نتيجة', value: highestScore },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="min-w-0 rounded-[1.1rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-2 py-3 text-center shadow-sm sm:px-4 sm:py-4"
        >
          <p className="text-wanas-text-muted truncate text-xs font-medium">{stat.label}</p>
          <p className="text-wanas-text-primary mt-1 font-mono text-base font-bold tabular-nums sm:text-lg">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function MatchActionsFooter({
  returnStatusMessage,
  autoReturnSeconds,
  autoReturnDeadlineAtMs,
  autoReturnTotalSeconds,
  isReturnToLobbyLoading,
  onReturnToLobby,
  onPlayAgain,
}: Pick<
  MatchResultsScreenProps,
  | 'returnStatusMessage'
  | 'autoReturnSeconds'
  | 'autoReturnDeadlineAtMs'
  | 'autoReturnTotalSeconds'
  | 'isReturnToLobbyLoading'
  | 'onReturnToLobby'
  | 'onPlayAgain'
>) {
  const liveRemaining = useDeadlineClock(autoReturnDeadlineAtMs);
  const total = Math.max(autoReturnTotalSeconds ?? 30, 1);
  const remaining = Math.max(
    0,
    autoReturnDeadlineAtMs != null ? liveRemaining : (autoReturnSeconds ?? 0),
  );
  const hasAutoReturn = autoReturnDeadlineAtMs != null || typeof autoReturnSeconds === 'number';
  const progressPercent = hasAutoReturn
    ? Math.round((Math.min(remaining, total) / total) * 100)
    : null;

  const progressBar =
    progressPercent === null ? null : (
      <div
        className="bg-wanas-surface-muted h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={remaining}
        aria-label={`العودة إلى اللوبي خلال ${remaining} ثانية`}
      >
        <div
          className="bg-wanas-accent h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );

  const autoMessage = hasAutoReturn ? `العودة إلى اللوبي تلقائياً خلال ${remaining} ثانية` : null;

  if (onReturnToLobby && !returnStatusMessage) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {autoMessage ? (
          <p className="text-wanas-text-muted text-center text-xs font-medium sm:text-sm">
            {autoMessage}
          </p>
        ) : null}
        {progressBar}
        <Button
          size="lg"
          className="min-h-14 w-full focus-visible:ring-offset-4"
          onClick={onReturnToLobby}
          loading={isReturnToLobbyLoading}
        >
          العودة إلى اللوبي
        </Button>
        {onPlayAgain ? (
          <Button size="lg" variant="secondary" className="min-h-14 w-full" onClick={onPlayAgain}>
            إعادة اللعب
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-md space-y-3 rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-5 py-5 text-center shadow-sm"
    >
      <p className="wanas-game-helper text-wanas-text-secondary font-medium">
        {presentSystemCopy(autoMessage ?? returnStatusMessage, 'بانتظار المضيف…')}
      </p>
      {progressBar}
    </div>
  );
}

export function MatchResultsScreen({
  leaderboard,
  teamResults = null,
  currentTeamId = null,
  currentPlayerId,
  totalRounds,
  playerCount,
  roomCode,
  gameName = 'برا السالفة',
  returnStatusMessage = null,
  autoReturnSeconds,
  autoReturnDeadlineAtMs,
  autoReturnTotalSeconds,
  isReturnToLobbyLoading = false,
  onReturnToLobby,
  onPlayAgain,
  className,
}: MatchResultsScreenProps) {
  const shellActive = useGameExperienceShellActive();
  const activeTeamResults = teamResults && teamResults.teams.length > 0 ? teamResults : null;
  const winners = leaderboard.filter((entry) => entry.isFirstPlace);
  const currentPlayerEntry = leaderboard.find((entry) => entry.id === currentPlayerId);
  const highestScore = activeTeamResults
    ? activeTeamResults.teams.reduce((max, team) => Math.max(max, team.totalPoints), 0)
    : leaderboard.reduce((max, entry) => Math.max(max, entry.totalPoints), 0);

  return (
    <GameScreen ariaLabel="النتائج النهائية" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={totalRounds}
        totalRounds={totalRounds}
        phaseLabel="النتائج النهائية"
      />

      <div className="flex flex-col gap-6 sm:gap-7">
        <p className="text-wanas-accent text-center text-sm font-bold">النتائج النهائية</p>
        {activeTeamResults ? (
          <TeamWinnerHero teamResults={activeTeamResults} />
        ) : winners.length > 0 ? (
          <WinnerHero winners={winners} />
        ) : null}

        {activeTeamResults ? (
          <CurrentTeamSummary teamResults={activeTeamResults} currentTeamId={currentTeamId} />
        ) : (
          <CurrentPlayerSummary entry={currentPlayerEntry} />
        )}

        {activeTeamResults ? (
          <FinalTeamLeaderboard teamResults={activeTeamResults} currentPlayerId={currentPlayerId} />
        ) : (
          <FinalLeaderboard leaderboard={leaderboard} currentPlayerId={currentPlayerId} />
        )}

        <ResultsAdPlacement />

        <MatchStats
          totalRounds={totalRounds}
          playerCount={playerCount}
          highestScore={highestScore}
        />

        <MatchActionsFooter
          returnStatusMessage={returnStatusMessage}
          autoReturnSeconds={autoReturnSeconds}
          autoReturnDeadlineAtMs={autoReturnDeadlineAtMs}
          autoReturnTotalSeconds={autoReturnTotalSeconds}
          isReturnToLobbyLoading={isReturnToLobbyLoading}
          onReturnToLobby={onReturnToLobby}
          onPlayAgain={onPlayAgain}
        />
        {shellActive ? <FinalResultsFeedbackCta /> : null}
      </div>
    </GameScreen>
  );
}
