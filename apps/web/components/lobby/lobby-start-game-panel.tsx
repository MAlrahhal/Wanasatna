'use client';

import { useMemo, useRef, useState } from 'react';
import { GUESSING_CHALLENGE_GAME_ID, TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { useRoom } from '@/contexts/room-context';
import { getGameStartPlayerRequirementReason } from '@/lib/game-shell/start-validation';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { LobbyPanel } from './lobby-ui';
import { cn } from '@/lib/utils';

export function LobbyStartGamePanel() {
  const {
    isHost,
    selectedGameId,
    status,
    startGame,
    players,
    isWaitingForNextMatch,
    timingChallengeSettings,
    guessingChallengeMode,
    teamSnapshot,
  } = useRoom();
  const [isStarting, setIsStarting] = useState(false);
  const startingRef = useRef(false);

  const selectedGame = mockLobbyGames.find((game) => game.id === selectedGameId) ?? null;
  const catalogEntry = selectedGameId ? getGameCatalogEntry(selectedGameId) : null;

  const activeParticipantCount = useMemo(
    () => players.filter((player) => !player.isSpectator).length,
    [players],
  );

  const disabledReason = useMemo(() => {
    if (isWaitingForNextMatch) {
      return 'هناك مباراة جارية حاليًا';
    }
    if (status !== 'connected') {
      return 'الاتصال غير جاهز';
    }
    if (!selectedGameId) {
      return 'لم يتم اختيار لعبة';
    }
    if (catalogEntry?.availability === 'coming-soon') {
      return 'اللعبة غير متاحة';
    }

    const playerRequirementReason = getGameStartPlayerRequirementReason(
      selectedGameId,
      activeParticipantCount,
      selectedGameId === GUESSING_CHALLENGE_GAME_ID ? guessingChallengeMode : undefined,
      teamSnapshot,
    );

    if (playerRequirementReason) {
      return playerRequirementReason;
    }

    if (
      selectedGameId === TIMING_CHALLENGE_GAME_ID &&
      timingChallengeSettings.minSeconds >= timingChallengeSettings.maxSeconds
    ) {
      return 'نطاق الوقت غير صالح';
    }

    return null;
  }, [
    activeParticipantCount,
    catalogEntry?.availability,
    guessingChallengeMode,
    isWaitingForNextMatch,
    selectedGameId,
    status,
    teamSnapshot,
    timingChallengeSettings.maxSeconds,
    timingChallengeSettings.minSeconds,
  ]);

  async function handleStartGame() {
    if (startingRef.current || disabledReason) {
      return;
    }

    startingRef.current = true;
    setIsStarting(true);

    try {
      await startGame();
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  }

  if (!isHost) {
    return (
      <LobbyPanel title="بدء اللعبة" bodyClassName="p-4">
        <div className="flex items-center gap-2.5 rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-wanas-surface text-base" aria-hidden>
            ⏳
          </span>
          <p className="text-xs font-semibold text-wanas-text-secondary sm:text-sm">
            بانتظار المضيف لبدء اللعبة.
          </p>
        </div>
      </LobbyPanel>
    );
  }

  return (
    <LobbyPanel
      title="بدء اللعبة"
      description={selectedGame ? `اللعبة المختارة: ${selectedGame.title}` : 'اختر لعبة من القائمة ثم ابدأ.'}
      bodyClassName="p-4"
    >
      <button
        type="button"
        disabled={Boolean(disabledReason) || isStarting}
        aria-busy={isStarting}
        onClick={() => void handleStartGame()}
        className={cn(
          'inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-wanas-accent text-sm font-bold text-[color:var(--wanas-background)]',
          'hover:bg-wanas-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {isStarting ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-[color:var(--wanas-background)]/30 border-t-[color:var(--wanas-background)]" />
            جاري البدء...
          </>
        ) : (
          'بدء اللعبة'
        )}
      </button>
      {disabledReason ? (
        <p className="mt-2 text-center text-xs font-medium text-wanas-text-muted">{disabledReason}</p>
      ) : null}
    </LobbyPanel>
  );
}
