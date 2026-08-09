'use client';

import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { cn } from '@/lib/utils';
import { CharacterFigure } from './character-figure';
import { GuessingChallengeIdentityCard } from './identity-card';
import { SpecialCardButton } from './special-card-button';
import './first-person-scene.css';

export type FirstPersonGameSceneProps = {
  mode: 'playing' | 'reveal';
  opponentName: string;
  selfName: string;
  opponentIdentity: GuessingChallengeVisibleIdentity | null;
  selfIdentity: GuessingChallengeVisibleIdentity | null;
  selfHidden: boolean;
  opponentHighlight?: boolean;
  selfHighlight?: boolean;
  isMyTurn?: boolean;
  turnTitle?: string | null;
  turnInstruction?: string | null;
  yellowQuestionsRemaining?: number | null;
  yellowAvailable?: boolean;
  redAvailable?: boolean;
  canUseYellow?: boolean;
  canUseRed?: boolean;
  yellowDisabled?: boolean;
  redDisabled?: boolean;
  onUseYellow?: () => void;
  onUseRed?: () => void;
  showSpecialCards?: boolean;
  className?: string;
};

export function FirstPersonGameScene({
  mode,
  opponentName,
  selfName,
  opponentIdentity,
  selfIdentity,
  selfHidden,
  opponentHighlight = false,
  selfHighlight = false,
  isMyTurn = false,
  turnTitle = null,
  turnInstruction = null,
  yellowQuestionsRemaining = null,
  yellowAvailable = true,
  redAvailable = true,
  canUseYellow = false,
  canUseRed = false,
  yellowDisabled = true,
  redDisabled = true,
  onUseYellow,
  onUseRed,
  showSpecialCards = true,
  className,
}: FirstPersonGameSceneProps) {
  const revealed = mode === 'reveal';

  return (
    <section
      className={cn('gc-fp-scene', className)}
      aria-label={revealed ? 'كشف الهويات' : 'مشهد التخمين'}
      data-testid="gc-first-person-scene"
      data-mode={mode}
    >
      <div className="gc-fp-stage">
        <div className="gc-fp-opponent">
          <GuessingChallengeIdentityCard
            className="gc-fp-opponent-card"
            label={revealed ? `${opponentName} كان` : 'هوية الخصم'}
            identity={opponentIdentity}
            highlight={opponentHighlight}
            size="distant"
            data-testid="gc-opponent-identity"
          />
          <CharacterFigure name={opponentName} accent="opponent" size="distant" />
        </div>

        <div className="gc-fp-table-wrap" aria-hidden={!showSpecialCards}>
          <div className="gc-fp-table">
            <div className="gc-fp-table-edge" />
          </div>

          {showSpecialCards ? (
            <div className="gc-fp-table-cards">
              <SpecialCardButton
                variant="yellow"
                title="🟨 الصفراء"
                description="3 أسئلة متتالية"
                available={yellowAvailable}
                disabled={yellowDisabled || !canUseYellow}
                compact
                onClick={onUseYellow}
              />
              <SpecialCardButton
                variant="red"
                title="🟥 الحمراء"
                description="غيّر هوية خصمك"
                available={redAvailable}
                disabled={redDisabled || !canUseRed}
                compact
                onClick={onUseRed}
              />
            </div>
          ) : null}
        </div>

        <div className="gc-fp-foreground">
          <div className="gc-fp-hands" aria-hidden />
          <div
            className={cn(
              'gc-fp-self-card relative w-full max-w-[18rem]',
              revealed && 'is-revealed gc-fp-reveal-in',
            )}
          >
            {revealed ? (
              <GuessingChallengeIdentityCard
                label="كنت"
                identity={selfIdentity}
                highlight={selfHighlight}
                size="foreground"
                data-testid="gc-self-identity"
              />
            ) : (
              <GuessingChallengeIdentityCard
                label={`${selfName} · هويتك`}
                identity={null}
                hidden={selfHidden}
                size="foreground"
                data-testid="gc-self-identity"
              />
            )}
          </div>

          {!revealed && turnTitle ? (
            <div
              className={cn('gc-fp-turn', !isMyTurn && 'is-waiting')}
              data-testid="gc-turn-indicator"
            >
              <p className="text-sm font-semibold text-cyan-200">{turnTitle}</p>
              {turnInstruction ? (
                <p className="mt-0.5 text-xs text-wanas-text-muted">{turnInstruction}</p>
              ) : null}
              {yellowQuestionsRemaining !== null ? (
                <p className="mt-1 text-xs font-medium text-amber-200">
                  🟨 الأسئلة المتبقية: {yellowQuestionsRemaining}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
