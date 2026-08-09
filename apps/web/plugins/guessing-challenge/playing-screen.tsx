'use client';

import { useState } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { FirstPersonGameScene } from './first-person-game-scene';

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
}: GuessingChallengePlayingScreenProps) {
  const [showGuessForm, setShowGuessForm] = useState(false);
  const [guess, setGuess] = useState('');
  const [confirmCard, setConfirmCard] = useState<'yellow' | 'red' | null>(null);

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
            تم تغيير هويتك بواسطة البطاقة الحمراء
          </p>
        ) : null}

        <FirstPersonGameScene
          mode="playing"
          opponentName={view.opponent.name}
          selfName={view.self.name}
          opponentIdentity={view.opponent.visibleIdentity}
          selfIdentity={null}
          selfHidden
          isMyTurn={view.isMyTurn}
          turnTitle={view.isMyTurn ? 'دورك' : `دور ${view.currentTurnPlayerName ?? 'الخصم'}`}
          turnInstruction={view.turnInstruction}
          yellowQuestionsRemaining={view.yellowQuestionsRemaining}
          yellowAvailable={view.self.yellowCardAvailable}
          redAvailable={view.self.redCardAvailable}
          canUseYellow={view.canUseYellow}
          canUseRed={view.canUseRed}
          yellowDisabled={isSubmittingAction || showGuessForm}
          redDisabled={isSubmittingAction || showGuessForm}
          onUseYellow={() => setConfirmCard('yellow')}
          onUseRed={() => setConfirmCard('red')}
        />

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
            <p className="mb-3 text-sm font-semibold text-wanas-text-primary">من تعتقد أنك؟</p>
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

        {confirmCard ? (
          <div className="wanas-game-card rounded-2xl border border-border p-4 sm:p-5">
            <p className="text-sm font-semibold text-wanas-text-primary">
              {confirmCard === 'yellow'
                ? 'استخدام البطاقة الصفراء؟'
                : 'استخدام البطاقة الحمراء؟'}
            </p>
            <p className="mt-1 text-xs text-wanas-text-muted">
              {confirmCard === 'yellow'
                ? 'ستحصل على 3 أسئلة متتالية.'
                : 'سيتم تغيير هوية خصمك.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => {
                  if (confirmCard === 'yellow') {
                    onUseYellow();
                  } else {
                    onUseRed();
                  }
                  setConfirmCard(null);
                }}
              >
                تأكيد
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingAction}
                onClick={() => setConfirmCard(null)}
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
