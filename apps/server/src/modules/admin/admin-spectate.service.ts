import { RoomStatus } from '@prisma/client';
import type { AdminActionResponse, AdminErrorCode, AdminSpectateData } from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import { getGameShellByRoomId } from '../game/game.service.js';
import { getPregameTeamSnapshot } from '../game/runtime/pregame-teams.service.js';
import { toMarathonClientState } from '../marathon/marathon.runtime.js';
import { getMarathonState } from '../marathon/marathon.store.js';
import { buildAdminSpectatePluginView } from './admin-spectate-plugin-view.js';
import { getAdminRoomById } from './admin-rooms.service.js';

export const ADMIN_SPECTATE_DENIED_MESSAGE = 'غير مصرح لك بمشاهدة هذه الغرفة.';
export const ADMIN_SPECTATE_CLOSED_MESSAGE = 'لا يمكن مشاهدة غرفة مغلقة.';
export const ADMIN_SPECTATE_PLAYER_SESSION_MESSAGE =
  'لا يمكن بدء المشاهدة المباشرة من جلسة لاعب.';
export const ADMIN_SPECTATE_FAILED_MESSAGE = 'تعذر بدء المشاهدة المباشرة.';

function fail(code: AdminErrorCode, message: string): AdminActionResponse<never> {
  return { success: false, error: { code, message } };
}

export async function loadAdminSpectateSnapshot(
  roomId: string,
): Promise<AdminActionResponse<AdminSpectateData>> {
  const row = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, status: true },
  });

  if (!row) {
    return fail('ROOM_NOT_FOUND', 'الغرفة غير موجودة.');
  }

  if (row.status === RoomStatus.CLOSED) {
    return fail('ROOM_CLOSED', ADMIN_SPECTATE_CLOSED_MESSAGE);
  }

  const details = await getAdminRoomById(roomId);
  if (!details.success) {
    if (details.error.code === 'ROOM_NOT_FOUND') {
      return fail('ROOM_NOT_FOUND', details.error.message);
    }
    return fail('INTERNAL_ERROR', ADMIN_SPECTATE_FAILED_MESSAGE);
  }

  const shell = getGameShellByRoomId(roomId);
  const marathon = getMarathonState(roomId);
  const eligiblePlayerIds = details.data.players
    .filter((player) => !player.isSpectator)
    .map((player) => player.id);

  return {
    success: true,
    data: {
      room: details.data,
      shell,
      marathon: marathon ? toMarathonClientState(marathon) : null,
      teams: getPregameTeamSnapshot(roomId, eligiblePlayerIds),
      pluginView: buildAdminSpectatePluginView(roomId, shell),
    },
  };
}
