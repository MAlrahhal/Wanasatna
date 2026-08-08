import type { Server } from 'socket.io';
import type { GameShellAbortReason } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { deleteGameShell, getGameShellByRoomId } from '../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../game.lifecycle.js';
import { cancelPlayerRecovery } from './player-recovery.js';
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

  if (!shell || shell.phase !== 'PLAYING') {
    return false;
  }

  cancelPlayerRecovery(io, roomId);
  cleanupGameShellRuntime(roomId);
  cleanupPluginMatchState(roomId, shell.gameId);
  deleteGameShell(roomId);

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { code: true },
  });

  navigateRoomToLobby(io, roomId, {
    roomCode: room?.code,
    reason,
    message: ABORT_MESSAGES[reason],
  });

  return true;
}
