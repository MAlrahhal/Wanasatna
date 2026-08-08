import { getClientGamePlugin } from '@/lib/game-plugins/registry';
import { registerAllClientGamePlugins } from '@/plugins';

// Same principle as GamePluginRenderer: register before any lookup can occur.
registerAllClientGamePlugins();

export function getGameStartPlayerRequirementReason(
  gameId: string | null,
  activeParticipantCount: number,
): string | null {
  if (!gameId) {
    return null;
  }

  const plugin = getClientGamePlugin(gameId);
  const minPlayers = plugin?.metadata.minPlayers;

  if (minPlayers === undefined || activeParticipantCount >= minPlayers) {
    return null;
  }

  if (gameId === 'bara-al-salafa') {
    return 'تحتاج لعبة برا السالفة إلى 3 لاعبين على الأقل.';
  }

  return `تحتاج لعبة ${plugin!.metadata.title} إلى ${minPlayers} لاعبين على الأقل.`;
}
