import { getServerUrl } from '@/lib/config/server-url';
import { canonicalizeJoinRoomCode } from '@/lib/room-v2/join-intent';
import type { ActiveRoomSession } from '@/lib/room-v2/types';

export type RoomReturnability = 'returnable' | 'not_returnable' | 'unknown';

type ReturnableResponseBody = {
  success?: boolean;
  data?: { returnable?: boolean };
};

export function decideVerifiedResumeDisplay(
  discovered: ActiveRoomSession[],
  returnability: RoomReturnability,
): { claimsToShow: ActiveRoomSession[]; claimToDiscard: ActiveRoomSession | null } {
  const claim = discovered[0];
  if (!claim) {
    return { claimsToShow: [], claimToDiscard: null };
  }

  if (returnability === 'returnable') {
    return { claimsToShow: [claim], claimToDiscard: null };
  }

  if (returnability === 'not_returnable') {
    return { claimsToShow: [], claimToDiscard: claim };
  }

  return { claimsToShow: [], claimToDiscard: null };
}

export async function fetchRoomReturnability(roomCode: string): Promise<RoomReturnability> {
  const code = canonicalizeJoinRoomCode(roomCode);
  if (!/^\d{6}$/.test(code)) {
    return 'not_returnable';
  }

  try {
    const response = await fetch(`${getServerUrl()}/api/rooms/${encodeURIComponent(code)}/returnable`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return 'unknown';
    }

    const body = (await response.json()) as ReturnableResponseBody;
    if (!body.success || typeof body.data?.returnable !== 'boolean') {
      return 'unknown';
    }

    return body.data.returnable ? 'returnable' : 'not_returnable';
  } catch {
    return 'unknown';
  }
}
