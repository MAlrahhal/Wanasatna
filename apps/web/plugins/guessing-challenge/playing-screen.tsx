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
import { CharacterFigure } from './character-figure';
import { GuessingChallengeIdentityCard } from './identity-card';
import { SpecialCardButton } from './special-card-button';

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

      <div className="flex flex-col gap-5 sm:gap-6">
        {view.identityChangedNotice ? (
          <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-100">
            تم تغيير هويتك بواسطة البطاقة الحمراء
          </p>
        ) : null}

        <section className="wanas-game-card relative overflow-hidden rounded-[2rem] border border-border px-4 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-6 md:gap-8">
            <div className="flex w-full flex-col items-center gap-3">
              <GuessingChallengeIdentityCard
                label="هوية الخصم"
                identity={view.opponent.visibleIdentity}
              />
              <CharacterFigure name={view.opponent.name} accent="opponent" />
            </div>

            <div className="flex items-center gap-3 text-sm font-semibold text-cyan-300">
              <span className="h-px w-8 bg-cyan-400/40" />
              VS
              <span className="h-px w-8 bg-cyan-400/40" />
            </div>

            <div className="flex w-full flex-col items-center gap-3">
              <CharacterFigure name={view.self.name} accent="self" />
              <GuessingChallengeIdentityCard label="هويتك" identity={null} hidden />
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-card px-4 py-4 text-center sm:px-6">
          <p className="text-base font-semibold text-wanas-text-primary">
            {view.isMyTurn ? 'دورك' : `دور ${view.currentTurnPlayerName ?? 'الخصم'}`}
          </p>
          <p className="mt-1 text-sm text-wanas-text-muted">{view.turnInstruction}</p>
          {view.yellowQuestionsRemaining !== null ? (
            <p className="mt-2 text-sm font-medium text-amber-200">
              🟨 الأسئلة المتبقية: {view.yellowQuestionsRemaining}
            </p>
          ) : null}
        </div>

        {guessFeedback ? (
          <p className="text-center text-sm font-medium text-rose-300">{guessFeedback}</p>
        ) : null}
        {actionError ? (
          <p className="text-center text-sm font-medium text-rose-300">{actionError}</p>
        ) : null}

        {showGuessForm ? (
          <div className="wanas-game-card rounded-2xl border border-border p-4 sm:p-5">
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

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            disabled={!view.canEndQuestion || isSubmittingAction || showGuessForm}
            onClick={onEndQuestion}
            className="w-full"
          >
            أنهيت سؤالي
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!view.canGuess || isSubmittingAction}
            onClick={() => setShowGuessForm(true)}
            className="w-full"
          >
            🎯 عرفت الإجابة
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SpecialCardButton
            variant="yellow"
            title="🟨 البطاقة الصفراء"
            description="3 أسئلة متتالية"
            available={view.self.yellowCardAvailable}
            disabled={!view.canUseYellow || isSubmittingAction}
            onClick={() => setConfirmCard('yellow')}
          />
          <SpecialCardButton
            variant="red"
            title="🟥 البطاقة الحمراء"
            description="غيّر هوية خصمك"
            available={view.self.redCardAvailable}
            disabled={!view.canUseRed || isSubmittingAction}
            onClick={() => setConfirmCard('red')}
          />
        </div>
      </div>
    </GameScreen>
  );
}
