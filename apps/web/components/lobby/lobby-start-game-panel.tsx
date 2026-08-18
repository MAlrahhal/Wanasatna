'use client';

import { useMemo, useRef, useState } from 'react';
import { GUESSING_CHALLENGE_GAME_ID, TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { useRoom } from '@/contexts/room-context';
import { getGameStartPlayerRequirementReason } from '@/lib/game-shell/start-validation';
import { splitGameStartPlayerRequirementReason } from '@/lib/game-shell/start-requirement-copy';
import { usePlayableGameAvailability } from '@/lib/games/use-game-availability';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/components/ui/system-status';
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
  const { isGameEnabled } = usePlayableGameAvailability();
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
    if (selectedGameId && !isGameEnabled(selectedGameId)) {
      return 'غير متاحة حالياً';
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
    isGameEnabled,
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
      <section className="rounded-xl border border-wanas-border bg-wanas-surface px-3 py-2">
        <SystemStatus tone="info" title="بانتظار المضيف لبدء اللعبة." />
      </section>
    );
  }

  const startDisabled = Boolean(disabledReason) || isStarting;

  function renderDisabledReason(reason: string) {
    const parts = splitGameStartPlayerRequirementReason(reason);

    return (
      <p className="mt-1.5 text-center text-xs font-medium text-wanas-text-muted">
        {parts ? (
          <>
            {parts.before}
            <span className="font-semibold text-white">{parts.gameName}</span>
            {parts.after}
          </>
        ) : (
          reason
        )}
      </p>
    );
  }

  function renderStartButton() {
    return (
      <Button
        type="button"
        size="lg"
        className="w-full text-white"
        disabled={startDisabled}
        loading={isStarting}
        onClick={() => void handleStartGame()}
      >
        {isStarting ? 'جاري البدء…' : 'بدء اللعبة'}
      </Button>
    );
  }

  return (
    <>
      <section className="hidden rounded-xl border-2 border-wanas-accent/45 bg-wanas-surface px-3 py-3 xl:block">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-wanas-text-primary">بدء اللعبة</p>
          {selectedGame ? (
            <p className="truncate text-[11px] text-wanas-text-muted">{selectedGame.title}</p>
          ) : (
            <p className="text-[11px] text-wanas-text-muted">اختر لعبة من القائمة ثم ابدأ.</p>
          )}
        </div>
        {renderStartButton()}
        {disabledReason ? renderDisabledReason(disabledReason) : null}
      </section>

      <div
        aria-hidden
        className={cn(
          'xl:hidden',
          disabledReason
            ? 'h-[calc(7.25rem+env(safe-area-inset-bottom,0px))]'
            : 'h-[calc(5.5rem+env(safe-area-inset-bottom,0px))]',
        )}
      />
      <div
        data-lobby-sticky-start=""
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-wanas-accent/40 bg-wanas-surface/95 px-3 pt-2.5 backdrop-blur-sm xl:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {renderStartButton()}
        {disabledReason ? renderDisabledReason(disabledReason) : null}
      </div>
    </>
  );
}
