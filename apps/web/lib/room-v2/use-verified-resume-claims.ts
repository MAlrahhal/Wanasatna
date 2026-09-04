'use client';

import { useEffect, useState } from 'react';
import { EMPTY_RESUME_CLAIMS, notifyResumeDiscovery } from '@/lib/room-v2/discover-claim';
import { removeReconnectClaimForSession } from '@/lib/room-v2/reconnect-claims';
import {
  decideVerifiedResumeDisplay,
  fetchRoomReturnability,
} from '@/lib/room-v2/room-returnability';
import type { ActiveRoomSession } from '@/lib/room-v2/types';

function claimIdentity(claim: ActiveRoomSession | null | undefined): string {
  if (!claim) {
    return '';
  }

  return `${claim.playerId}\u001f${claim.roomId}\u001f${claim.roomCode}\u001f${claim.playerName}\u001f${claim.reconnectToken}`;
}

/**
 * Display gate only: hide the open-room card until the server confirms the room is returnable.
 * Does not reconnect and does not replace join/reconnect authorization.
 */
export function useVerifiedResumeClaims(discovered: ActiveRoomSession[]): ActiveRoomSession[] {
  const claim = discovered[0] ?? null;
  const identity = claimIdentity(claim);
  const [verifiedIdentity, setVerifiedIdentity] = useState('');
  const [verifiedClaims, setVerifiedClaims] = useState<ActiveRoomSession[]>(EMPTY_RESUME_CLAIMS);

  useEffect(() => {
    if (!claim) {
      return;
    }

    let cancelled = false;

    void fetchRoomReturnability(claim.roomCode).then((returnability) => {
      if (cancelled) {
        return;
      }

      const decision = decideVerifiedResumeDisplay([claim], returnability);
      if (decision.claimToDiscard) {
        removeReconnectClaimForSession(decision.claimToDiscard);
        notifyResumeDiscovery();
        return;
      }

      setVerifiedClaims(
        decision.claimsToShow.length > 0 ? decision.claimsToShow : EMPTY_RESUME_CLAIMS,
      );
      setVerifiedIdentity(identity);
    });

    return () => {
      cancelled = true;
    };
  }, [claim, identity]);

  if (!claim || verifiedIdentity !== identity) {
    return EMPTY_RESUME_CLAIMS;
  }

  return verifiedClaims;
}
