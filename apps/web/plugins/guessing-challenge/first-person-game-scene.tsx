'use client';

import { cn } from '@/lib/utils';
import { CharacterFigure } from './character-figure';
import { GuessingChallengeIdentityCard } from './identity-card';
import type { GuessingChallengeSceneProps } from './scene-props';
import { SpecialCardButton } from './special-card-button';
import './first-person-scene.css';

export type FirstPersonGameSceneProps = GuessingChallengeSceneProps;

export function FirstPersonGameScene({
  mode,
  matchMode = '1v1',
  selfTeam,
  selfSeat = 0,
  teammate = null,
  opponents,
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
  const is2v2 = matchMode === '2v2';
  const resolvedOpponents =
    opponents && opponents.length > 0
      ? opponents
      : [{ playerId: 'opponent', name: opponentName, seat: 0 as const }];

  const teammateOnRight = selfSeat === 0;

  return (
    <section
      className={cn('gc-fp-scene', className)}
      aria-label={revealed ? 'كشف الهويات' : 'مشهد التخمين'}
      data-testid="gc-first-person-scene"
      data-mode={mode}
      data-match-mode={matchMode}
    >
      <div className="gc-fp-stage">
        {/* Optional teammate strip */}
        {is2v2 && teammate ? (
          <div
            className={cn('gc-fp-teammate-strip', teammateOnRight ? 'is-right' : 'is-left')}
            data-testid="gc-teammate-strip"
          >
            <CharacterFigure
              name={teammate.name}
              accent="self"
              size="distant"
              className="gc-fp-teammate-figure"
            />
            <span
              className={cn(
                'gc-fp-team-dot',
                selfTeam === 'red' ? 'is-red' : 'is-blue',
              )}
              aria-hidden
            />
          </div>
        ) : null}

        <div
          className={cn(
            'gc-fp-opponents',
            resolvedOpponents.length > 1 && 'is-duo',
          )}
        >
          {resolvedOpponents.length > 1 ? (
            <GuessingChallengeIdentityCard
              className="gc-fp-opponent-card gc-fp-shared-identity"
              label={revealed ? 'كانوا' : 'هوية الخصوم'}
              identity={opponentIdentity}
              highlight={opponentHighlight}
              size="distant"
              data-testid="gc-opponent-identity"
            />
          ) : null}
          <div className="gc-fp-opponent-row">
            {resolvedOpponents.slice(0, 2).map((opp, index) => (
              <div
                key={opp.playerId}
                className="gc-fp-opponent"
                data-testid={`gc-opponent-slot-${index}`}
              >
                {resolvedOpponents.length === 1 ? (
                  <GuessingChallengeIdentityCard
                    className="gc-fp-opponent-card"
                    label={revealed ? `${opp.name} كان` : 'هوية الخصم'}
                    identity={opponentIdentity}
                    highlight={opponentHighlight}
                    size="distant"
                    data-testid="gc-opponent-identity"
                  />
                ) : null}
                <CharacterFigure name={opp.name} accent="opponent" size="distant" />
              </div>
            ))}
          </div>
        </div>

        {/* Soft floor / rug hint — no giant table */}
        <div className="gc-fp-floor" aria-hidden>
          <div className="gc-fp-rug" />
        </div>

        {showSpecialCards ? (
          <div className="gc-fp-side-cards" data-testid="gc-fp-special-cards">
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

        <div className="gc-fp-foreground">
          <div className="gc-fp-hands" aria-hidden>
            <span className="gc-fp-glove is-left" />
            <span className="gc-fp-glove is-right" />
          </div>
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
              <p className="text-sm font-semibold text-orange-100">{turnTitle}</p>
              {turnInstruction ? (
                <p className="mt-0.5 text-xs text-violet-100/75">{turnInstruction}</p>
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
