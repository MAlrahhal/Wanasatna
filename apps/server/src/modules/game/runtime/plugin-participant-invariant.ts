import type { GameShellState } from '@wanasatna/shared';
import { logGameShellDiagnostic } from '../game.diagnostics.js';

export function pluginParticipantsMatchShell(
  shell: Pick<GameShellState, 'roomId' | 'gameId' | 'matchParticipantIds'>,
  pluginPlayerIds: readonly string[],
): boolean {
  const shellPlayerIds = shell.matchParticipantIds;

  if (!shellPlayerIds) {
    logGameShellDiagnostic('plugin-participant-mismatch', {
      roomId: shell.roomId,
      gameId: shell.gameId,
      reason: 'missing-shell-lock',
      pluginParticipantCount: pluginPlayerIds.length,
    });
    return false;
  }

  const shellSet = new Set(shellPlayerIds);
  const pluginSet = new Set(pluginPlayerIds);
  const matches =
    shellSet.size === shellPlayerIds.length &&
    pluginSet.size === pluginPlayerIds.length &&
    shellSet.size === pluginSet.size &&
    shellPlayerIds.every((playerId) => pluginSet.has(playerId));

  if (!matches) {
    logGameShellDiagnostic('plugin-participant-mismatch', {
      roomId: shell.roomId,
      gameId: shell.gameId,
      shellParticipantCount: shellPlayerIds.length,
      pluginParticipantCount: pluginPlayerIds.length,
    });
  }

  return matches;
}
