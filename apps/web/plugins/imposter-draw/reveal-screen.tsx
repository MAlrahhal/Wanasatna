'use client';

import type { ImposterDrawReferenceImage, ImposterDrawVoteTallyEntry } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';

export type ImposterDrawRevealScreenProps = {
  revealedImage: ImposterDrawReferenceImage;
  impostorName: string;
  impostorPlayerId: string;
  impostorVotedOut: boolean | null;
  voteTally: readonly ImposterDrawVoteTallyEntry[];
  remainingSeconds: number;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  className?: string;
};

export function ImposterDrawRevealScreen({
  revealedImage,
  impostorName,
  impostorPlayerId,
  impostorVotedOut,
  voteTally,
  remainingSeconds,
  currentRound,
  totalRounds,
  roomCode,
  className,
}: ImposterDrawRevealScreenProps) {
  const avatarColors = getPlayerAvatarColors(impostorPlayerId);

  return (
    <GameScreen ariaLabel="كشف الإمبوستر" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel="الكشف"
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 2 }}
      />

      <div className="flex flex-col gap-5 sm:gap-6">
        <GameCard className="px-5 py-6 text-center sm:px-8">
          <p className="text-xs font-medium text-wanas-text-muted">الصورة الأصلية</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={revealedImage.imageUrl}
            alt={revealedImage.label}
            className="mx-auto mt-3 max-h-52 w-full max-w-md rounded-2xl border border-[color:var(--wanas-game-card-border)] object-contain"
          />
          <p className="mt-3 text-lg font-semibold text-wanas-text-primary">{revealedImage.label}</p>
        </GameCard>

        <GameCard className="border-wanas-error-border/70 px-5 py-8 text-center sm:px-8">
          <div
            className="mx-auto flex size-24 items-center justify-center rounded-full text-3xl font-semibold"
            style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
          >
            {impostorName.charAt(0)}
          </div>
          <p className="mt-5 text-2xl font-bold text-wanas-text-primary sm:text-3xl">
            الإمبوستر هو: {impostorName}
          </p>
          <p className="mt-4 text-sm text-wanas-text-secondary">
            {impostorVotedOut
              ? 'تم كشف الإمبوستر بالتصويت.'
              : 'نجا الإمبوستر من التصويت.'}
          </p>
        </GameCard>

        <GameCard className="p-5 sm:p-6">
          <h2 className="wanas-game-title mb-4">توزيع الأصوات</h2>
          <ul className="space-y-2.5">
            {voteTally.map((entry) => (
              <li
                key={entry.playerId}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--wanas-game-card-border)] px-4 py-3"
              >
                <span className="font-medium text-wanas-text-primary">{entry.name}</span>
                <span className="text-sm text-wanas-text-secondary">{entry.voteCount} صوت</span>
              </li>
            ))}
          </ul>
        </GameCard>
      </div>
    </GameScreen>
  );
}
