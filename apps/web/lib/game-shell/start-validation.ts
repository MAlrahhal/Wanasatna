import type { GuessingChallengeMode } from '@wanasatna/shared';
import { getClientGamePlugin } from '@/lib/game-plugins/registry';
import { registerAllClientGamePlugins } from '@/plugins';

// Same principle as GamePluginRenderer: register before any lookup can occur.
registerAllClientGamePlugins();

export function getGameStartPlayerRequirementReason(
  gameId: string | null,
  activeParticipantCount: number,
  mode?: GuessingChallengeMode,
): string | null {
  if (!gameId) {
    return null;
  }

  const plugin = getClientGamePlugin(gameId);
  const minPlayers = plugin?.metadata.minPlayers;

  if (gameId === 'guessing-challenge') {
    const resolvedMode = mode ?? '1v1';
    if (resolvedMode === '2v2') {
      if (activeParticipantCount !== 4) {
        return 'تحدي التخمين (2 ضد 2) يلزم 4 لاعبين.';
      }
      return null;
    }
    if (activeParticipantCount !== 2) {
      return 'تحدي التخمين (1 ضد 1) يلزم لاعبان.';
    }
    return null;
  }

  if (minPlayers === undefined || activeParticipantCount >= minPlayers) {
    return null;
  }

  if (gameId === 'bara-al-salafa') {
    return 'تحتاج لعبة برا السالفة إلى 3 لاعبين على الأقل.';
  }

  return `تحتاج لعبة ${plugin!.metadata.title} إلى ${minPlayers} لاعبين على الأقل.`;
}
