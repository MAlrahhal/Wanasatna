import type { GameActionResponse, GameErrorCode, RoomStatus, UserRole } from '@wanasatna/shared';

export type ExperimentalGameAuthority = {
  accountUserId: string | null;
  accountRole: UserRole | null;
};

export type ExperimentalAccessFacts = ExperimentalGameAuthority & {
  enabled: boolean;
  registered: boolean;
  roomCreatedByAdmin: boolean;
  roomStatus: RoomStatus;
  roomHostPlayerId: string;
  requestingPlayerId: string;
  linkedHostUserId: string | null;
  linkedHostUserRole: UserRole | null;
  linkedHostAdminMfaEnabled: boolean;
};

export type ExperimentalAccessFailure = Extract<GameActionResponse<never>, { success: false }>;

export function experimentalAccessError(
  code: GameErrorCode,
  message: string,
): ExperimentalAccessFailure {
  return { success: false, error: { code, message } };
}

export function evaluateExperimentalGameAccess(
  facts: ExperimentalAccessFacts,
): ExperimentalAccessFailure | null {
  if (!facts.enabled || !facts.registered) {
    return experimentalAccessError('GAME_DISABLED', 'Experimental games are unavailable.');
  }
  if (
    !facts.accountUserId ||
    facts.accountRole !== 'ADMIN' ||
    facts.linkedHostUserRole !== 'ADMIN' ||
    !facts.linkedHostAdminMfaEnabled ||
    facts.linkedHostUserId !== facts.accountUserId
  ) {
    return experimentalAccessError(
      'FORBIDDEN',
      'Only an authenticated admin can use experimental games.',
    );
  }
  if (facts.roomHostPlayerId !== facts.requestingPlayerId) {
    return experimentalAccessError('NOT_HOST', 'Only the current host can perform this action.');
  }
  if (!facts.roomCreatedByAdmin) {
    return experimentalAccessError(
      'FORBIDDEN',
      'Experimental games require an admin-created test room.',
    );
  }
  if (facts.roomStatus !== 'LOBBY') {
    return experimentalAccessError(
      'INVALID_PHASE',
      'Experimental games can only be selected from the lobby.',
    );
  }
  return null;
}
