import type { GuessingChallengeMode, PregameTeamSnapshot } from '@wanasatna/shared';
import { getGameTeamCapability } from '@wanasatna/shared';
import { getClientGamePlugin } from '@/lib/game-plugins/registry';
import { registerAllClientGamePlugins } from '@/plugins';

// Same principle as GamePluginRenderer: register before any lookup can occur.
registerAllClientGamePlugins();

export function getGameStartPlayerRequirementReason(
  gameId: string | null,
  activeParticipantCount: number,
  mode?: GuessingChallengeMode,
  teamSnapshot?: PregameTeamSnapshot | null,
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
    } else if (activeParticipantCount !== 2) {
      return 'تحدي التخمين (1 ضد 1) يلزم لاعبان.';
    }

    const capability = getGameTeamCapability(gameId);
    if (capability) {
      const capacity = capability.capacityByMode[resolvedMode] ?? 1;
      if (!teamSnapshot || teamSnapshot.mode !== resolvedMode) {
        return 'يجب تجهيز توزيع الفرق قبل البدء.';
      }
      const blue = teamSnapshot.assignments.filter((entry) => entry.teamId === 'blue').length;
      const red = teamSnapshot.assignments.filter((entry) => entry.teamId === 'red').length;
      if (blue !== capacity || red !== capacity || teamSnapshot.unassignedPlayerIds.length > 0) {
        return 'وزّع كل اللاعبين على الفريقين قبل البدء.';
      }
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
