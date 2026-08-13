'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { GameplayScene } from './gameplay-scene';
import { GuessingChallengeSpecialCardsPanel } from './special-cards-panel';

export type GuessingChallengePlayingScreenProps = {
  view: GuessingChallengePlayerView;
  roomCode: string;
  actionError: string | null;
  guessFeedback: string | null;
  isSubmittingAction: boolean;
  onEndQuestion: () => void;
  onSubmitGuess: (guess: string) => void;
  onUseYellow: () => void;
  onUseRed: () => void;
  onRejectCard?: () => void;
  onLookChange?: (yaw: number, pitch: number) => void;
};

export function GuessingChallengePlayingScreen({
  view,
  roomCode,
  actionError,
  guessFeedback,
  isSubmittingAction,
  onEndQuestion,
  onSubmitGuess,
  onUseYellow,
  onUseRed,
  onRejectCard,
  onLookChange,
}: GuessingChallengePlayingScreenProps) {
  const [showGuessForm, setShowGuessForm] = useState(false);
  const [guess, setGuess] = useState('');
  const [activationMessage, setActivationMessage] = useState<string | null>(null);
  const prevYellow = useRef(view.self.yellowCardAvailable);
  const prevRed = useRef(view.self.redCardAvailable);

  useEffect(() => {
    if (prevYellow.current && !view.self.yellowCardAvailable) {
      setActivationMessage('تم تفعيل البطاقة الصفراء');
    }
    if (prevRed.current && !view.self.redCardAvailable) {
      setActivationMessage('تم تفعيل البطاقة الحمراء');
    }
    prevYellow.current = view.self.yellowCardAvailable;
    prevRed.current = view.self.redCardAvailable;
  }, [view.self.yellowCardAvailable, view.self.redCardAvailable]);

  useEffect(() => {
    if (!activationMessage) {
      return;
    }
    const timer = window.setTimeout(() => setActivationMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [activationMessage]);

  const mappedTeammate = useMemo(() => {
    if (!view.teammate) {
      return null;
    }
    return {
      playerId: view.teammate.playerId,
      name: view.teammate.name,
      seat: view.teammate.seat,
      lookYaw: view.teammate.lookYaw,
      lookPitch: view.teammate.lookPitch,
    };
  }, [view.teammate]);

  const mappedOpponents = useMemo(
    () =>
      view.opponents.map((opponent) => ({
        playerId: opponent.playerId,
        name: opponent.name,
        seat: opponent.seat,
        lookYaw: opponent.lookYaw,
        lookPitch: opponent.lookPitch,
      })),
    [view.opponents],
  );

  const identityNotice =
    view.mode === '2v2'
      ? 'تم تغيير هويتكم بواسطة البطاقة الحمراء'
      : 'تم تغيير هويتك بواسطة البطاقة الحمراء';

  const guessPrompt = view.mode === '2v2' ? 'ما هي هوية فريقكم؟' : 'من تعتقد أنك؟';

  return (
    <GameScreen ariaLabel="تحدي التخمين" maxWidth="4xl">
      <GameHeader
        gameName={GUESSING_CHALLENGE_GAME_NAME}
        gameIcon={GUESSING_CHALLENGE_GAME_ICON}
        roomCode={roomCode}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        phaseLabel={view.isMyTurn ? 'دورك' : `دور ${view.currentTurnPlayerName ?? 'الخصم'}`}
      />

      <div className="flex flex-col gap-3 sm:gap-4">
        {view.identityChangedNotice ? (
          <p
            className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-100"
            data-testid="gc-red-card-notice"
          >
            {identityNotice}
          </p>
        ) : null}

        <div className="relative rounded-[1.5rem]">
          <GameplayScene
            mode="playing"
            matchMode={view.mode}
            selfTeam={view.selfTeam ?? undefined}
            selfSeat={view.selfSeat ?? undefined}
            teammate={mappedTeammate}
            opponents={mappedOpponents}
            opponentName={view.opponent.name}
            selfName={view.self.name}
            opponentIdentity={view.opponent.visibleIdentity}
            selfIdentity={null}
            selfHidden
            isMyTurn={view.isMyTurn}
            turnTitle={view.isMyTurn ? 'دورك' : `دور ${view.currentTurnPlayerName ?? 'الخصم'}`}
            turnInstruction={view.turnInstruction}
            yellowQuestionsRemaining={view.yellowQuestionsRemaining}
            showSpecialCards={false}
            onLookChange={onLookChange}
          />

          <GuessingChallengeSpecialCardsPanel
            className="absolute inset-0 z-10"
            yellowAvailable={view.self.yellowCardAvailable}
            redAvailable={view.self.redCardAvailable}
            canUseYellow={view.canUseYellow}
            canUseRed={view.canUseRed}
            disabled={isSubmittingAction || showGuessForm}
            cardConfirmStatus={view.cardConfirmStatus}
            activationMessage={activationMessage}
            onUseYellow={onUseYellow}
            onUseRed={onUseRed}
            onRejectCard={onRejectCard}
          />
        </div>

        {guessFeedback ? (
          <p className="text-center text-sm font-medium text-rose-300" data-testid="gc-guess-feedback">
            {guessFeedback}
          </p>
        ) : null}
        {actionError ? (
          <p className="text-center text-sm font-medium text-rose-300">{actionError}</p>
        ) : null}

        {showGuessForm ? (
          <div
            className="wanas-game-card rounded-2xl border border-border p-4 sm:p-5"
            data-testid="gc-final-guess-panel"
          >
            <p className="mb-3 text-sm font-semibold text-wanas-text-primary">{guessPrompt}</p>
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              maxLength={80}
              placeholder="اكتب إجابتك..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-wanas-text-primary outline-none focus:border-cyan-400/60"
              dir="rtl"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                data-testid="gc-confirm-guess"
                disabled={isSubmittingAction || !guess.trim()}
                onClick={() => {
                  onSubmitGuess(guess);
                  setGuess('');
                  setShowGuessForm(false);
                }}
              >
                تأكيد التخمين
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingAction}
                onClick={() => {
                  setShowGuessForm(false);
                  setGuess('');
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:gap-3" data-testid="gc-primary-actions">
          <Button
            type="button"
            size="lg"
            data-testid="gc-end-question"
            disabled={!view.canEndQuestion || isSubmittingAction || showGuessForm}
            onClick={onEndQuestion}
            className="w-full"
          >
            أنهيت سؤالي
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="gc-open-guess"
            disabled={!view.canGuess || isSubmittingAction}
            onClick={() => setShowGuessForm(true)}
            className="w-full"
          >
            🎯 عرفت الإجابة
          </Button>
        </div>
      </div>
    </GameScreen>
  );
}
