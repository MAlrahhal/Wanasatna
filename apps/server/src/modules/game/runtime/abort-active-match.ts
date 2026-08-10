import type { Server } from 'socket.io';
import type { GameShellAbortReason } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { broadcastRoomPlayersSnapshot, loadActiveRoomPlayers } from '../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../game.lifecycle.js';
import { clearPlayerRecoveryForTeardown } from './player-recovery.js';
import { cleanupPluginMatchState } from './cleanup-plugin-match.js';

const ABORT_MESSAGES: Record<GameShellAbortReason, string | undefined> = {
  host_aborted: undefined,
  insufficient_players: 'تم إنهاء اللعبة لعدم توفر عدد كافٍ من اللاعبين.',
};

export async function abortActiveMatch(
  io: Server,
  roomId: string,
  reason: GameShellAbortReason,
): Promise<boolean> {
  const shell = getGameShellByRoomId(roomId);

  // Host end / insufficient-players abort may fire in WAITING or COUNTDOWN
  // (second-match start window) as well as PLAYING.
  if (
    !shell ||
    (shell.phase !== 'WAITING' && shell.phase !== 'COUNTDOWN' && shell.phase !== 'PLAYING')
  ) {
    return false;
  }

  const abortedShellId = shell.shellId;
  const abortedGameId = shell.gameId;

  // Clear recovery without resuming phase timers (resume would race teardown).
  clearPlayerRecoveryForTeardown(io, roomId);
  cleanupGameShellRuntime(roomId);
  cleanupPluginMatchState(roomId, abortedGameId);
  deleteGameShell(roomId);

  console.info('[game-restart]', {
    stage: 'old-shell-cleanup-complete',
    roomId,
    shellId: abortedShellId,
    reason,
  });

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { code: true, hostPlayerId: true },
  });

  // End GAME only — room membership is untouched. Roster must come from ACTIVE
  // Room players (not matchParticipantIds). Rebroadcast so every client
  // converging on /lobby shares the same authoritative list.
  const roster = room ? await loadActiveRoomPlayers(roomId, room.hostPlayerId) : [];

  await broadcastRoomPlayersSnapshot(io, roomId);

  navigateRoomToLobby(io, roomId, {
    roomCode: room?.code,
    reason,
    message: ABORT_MESSAGES[reason],
  });

  console.info('[room-lifecycle]', {
    stage: 'end-game-to-lobby',
    roomId,
    reason,
    playerCount: roster.length,
  });

  return true;
}
