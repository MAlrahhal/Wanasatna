'use client';

import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { QuestionTurnPanel } from './question-turn-panel';

export type DirectedQuestionsScreenProps = {
  askerName: string;
  targetName: string;
  askerPlayerId: string;
  targetPlayerId: string;
  currentPlayerId: string;
  players: LobbyPlayer[];
  currentTurn: number;
  totalTurns: number;
  remainingSeconds?: number;
  showTimer?: boolean;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  isSubmittingAdvance?: boolean;
  onAdvanceNext?: () => void;
  className?: string;
};

function DirectedQuestionsTurnProgress({
  currentTurn,
  totalTurns,
}: Pick<DirectedQuestionsScreenProps, 'currentTurn' | 'totalTurns'>) {
  return (
    <p className="text-center text-xs font-medium text-wanas-text-muted sm:text-start">
      السؤال {currentTurn} من {totalTurns}
    </p>
  );
}

export function DirectedQuestionsScreen({
  askerName,
  targetName,
  askerPlayerId,
  targetPlayerId,
  currentPlayerId,
  currentTurn,
  totalTurns,
  remainingSeconds = 0,
  showTimer = false,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  isSubmittingAdvance = false,
  onAdvanceNext,
  className,
}: DirectedQuestionsScreenProps) {
  return (
    <GameScreen ariaLabel="مرحلة الأسئلة الموجّهة" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={gameName ?? 'برا السالفة'}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="الأسئلة الموجّهة"
        timer={
          showTimer
            ? { remainingSeconds: remainingSeconds ?? 0, format: 'seconds', lowTimeThreshold: 10 }
            : undefined
        }
      />

      <DirectedQuestionsTurnProgress currentTurn={currentTurn} totalTurns={totalTurns} />

      <QuestionTurnPanel
        askerName={askerName}
        targetName={targetName}
        askerPlayerId={askerPlayerId}
        targetPlayerId={targetPlayerId}
        currentPlayerId={currentPlayerId}
        isSubmittingAdvance={isSubmittingAdvance}
        onAdvanceNext={onAdvanceNext}
      />
    </GameScreen>
  );
}
