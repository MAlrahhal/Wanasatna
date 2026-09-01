import type {
  AdminActionResponse,
  AdminAnalyticsData,
  AdminDashboardData,
  AdminForceCloseRoomData,
  AdminGameAvailability,
  AdminGamesData,
  AdminHistoryData,
  AdminHistoryMatchListItem,
  AdminHistoryParticipant,
  AdminKickPlayerData,
  AdminMatchDetails,
  AdminMeData,
  AdminRoomDetails,
  AdminLiveRoom,
  AdminRoomHistoryData,
  AdminRoomHistoryDetails,
  AdminRoomHistoryListItem,
  AdminRoomHistoryMatch,
  AdminRoomHistoryParticipant,
  AdminRoomHostAssignment,
  AdminRoomLockData,
  AdminRoomPlayer,
  AdminRoomsData,
  AdminSystemData,
  AdminUserDetails,
  AdminUserListItem,
  AdminUserMatchRow,
  AdminUsersData,
  AuthActionResponse,
  PublicUser,
} from '@wanasatna/shared';
import { getServerUrl } from '@/lib/config/server-url';

export type AdminMeResult = { ok: true; user: PublicUser } | { ok: false; status: number };

function adminUrl(path: string): string {
  return `${getServerUrl()}/api/admin${path}`;
}

function pickSafeAdminUser(value: unknown): PublicUser | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.email !== 'string' ||
    typeof record.preferredDisplayName !== 'string' ||
    (record.role !== 'USER' && record.role !== 'ADMIN')
  ) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    preferredDisplayName: record.preferredDisplayName,
    role: record.role,
  };
}

export async function fetchAdminMe(): Promise<AdminMeResult> {
  try {
    const response = await fetch(adminUrl('/me'), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const body = (await response.json()) as AuthActionResponse<AdminMeData>;
    const user = body.success ? pickSafeAdminUser(body.data.user) : null;

    if (!user || user.role !== 'ADMIN') {
      return { ok: false, status: 403 };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminDashboardResult =
  { ok: true; data: AdminDashboardData } | { ok: false; status: number };

export async function fetchAdminDashboard(): Promise<AdminDashboardResult> {
  try {
    const response = await fetch(adminUrl('/dashboard'), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const body = (await response.json()) as AuthActionResponse<AdminDashboardData>;
    if (!body.success || !body.data) {
      return { ok: false, status: response.status || 500 };
    }

    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

function pickSafePlayer(value: unknown): AdminRoomPlayer | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.status !== 'CONNECTED' && record.status !== 'DISCONNECTED') ||
    typeof record.isSpectator !== 'boolean' ||
    typeof record.isHost !== 'boolean'
  ) {
    return null;
  }

  return {
    id: record.id,
    displayName: record.displayName,
    status: record.status,
    isSpectator: record.isSpectator,
    isHost: record.isHost,
  };
}

function pickSafeLiveRoom(value: unknown): AdminLiveRoom | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.code !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.isLocked !== 'boolean' ||
    typeof record.playerCount !== 'number' ||
    typeof record.connectedCount !== 'number' ||
    typeof record.disconnectedCount !== 'number' ||
    typeof record.spectatorCount !== 'number' ||
    typeof record.hostDisplayName !== 'string' ||
    typeof record.playerCap !== 'number' ||
    (record.status !== 'LOBBY' && record.status !== 'PLAYING') ||
    (record.activity !== 'LOBBY' && record.activity !== 'IN_GAME') ||
    (record.gameId !== null && typeof record.gameId !== 'string') ||
    (record.gamePhase !== null && typeof record.gamePhase !== 'string')
  ) {
    return null;
  }

  return {
    id: record.id,
    code: record.code,
    createdAt: record.createdAt,
    isLocked: record.isLocked,
    playerCount: record.playerCount,
    connectedCount: record.connectedCount,
    disconnectedCount: record.disconnectedCount,
    spectatorCount: record.spectatorCount,
    hostDisplayName: record.hostDisplayName,
    playerCap: record.playerCap,
    status: record.status,
    activity: record.activity,
    gameId: record.gameId,
    gamePhase:
      typeof record.gamePhase === 'string'
        ? (record.gamePhase as AdminLiveRoom['gamePhase'])
        : null,
  };
}

function pickSafeRoomDetails(value: unknown): AdminRoomDetails | null {
  const room = pickSafeLiveRoom(value);
  if (!room || !value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.players)) {
    return null;
  }
  if (record.historyId !== null && typeof record.historyId !== 'string') {
    return null;
  }
  return {
    ...room,
    historyId: record.historyId,
    players: record.players
      .map(pickSafePlayer)
      .filter((player): player is AdminRoomPlayer => player !== null),
  };
}

export type AdminRoomsResult = { ok: true; data: AdminRoomsData } | { ok: false; status: number };

export type AdminRoomsQuery = {
  q?: string;
  locked?: string;
  page?: number;
};

export async function fetchAdminRooms(query: AdminRoomsQuery = {}): Promise<AdminRoomsResult> {
  try {
    const params = new URLSearchParams();
    if (query.q?.trim()) {
      params.set('q', query.q.trim());
    }
    if (query.locked === 'true' || query.locked === 'false') {
      params.set('locked', query.locked);
    }
    if (query.page && query.page > 1) {
      params.set('page', String(query.page));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(adminUrl(`/rooms${suffix}`), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const body = (await response.json()) as AdminActionResponse<AdminRoomsData>;
    if (!body.success || !body.data || !Array.isArray(body.data.rooms)) {
      return { ok: false, status: response.status || 500 };
    }

    return {
      ok: true,
      data: {
        page: body.data.page,
        pageSize: body.data.pageSize,
        total: body.data.total,
        rooms: body.data.rooms
          .map(pickSafeLiveRoom)
          .filter((room): room is AdminLiveRoom => room !== null),
      },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminRoomResult = { ok: true; data: AdminRoomDetails } | { ok: false; status: number };

export async function fetchAdminRoom(roomId: string): Promise<AdminRoomResult> {
  try {
    const response = await fetch(adminUrl(`/rooms/${roomId}`), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const body = (await response.json()) as AdminActionResponse<AdminRoomDetails>;
    const room = body.success ? pickSafeRoomDetails(body.data) : null;
    if (!room) {
      return { ok: false, status: response.status || 500 };
    }

    return { ok: true, data: room };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminMutationResult<T> =
  { ok: true; data: T } | { ok: false; status: number; message?: string };

async function postAdminAction<T>(path: string): Promise<AdminMutationResult<T>> {
  try {
    const response = await fetch(adminUrl(path), {
      method: 'POST',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<T>;
    if (!response.ok || !body.success) {
      return {
        ok: false,
        status: response.status,
        message: !body.success ? body.error.message : undefined,
      };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function lockAdminRoom(roomId: string): Promise<AdminMutationResult<AdminRoomLockData>> {
  return postAdminAction(`/rooms/${roomId}/lock`);
}

export function unlockAdminRoom(roomId: string): Promise<AdminMutationResult<AdminRoomLockData>> {
  return postAdminAction(`/rooms/${roomId}/unlock`);
}

export function kickAdminPlayer(
  roomId: string,
  playerId: string,
): Promise<AdminMutationResult<AdminKickPlayerData>> {
  return postAdminAction(`/rooms/${roomId}/players/${playerId}/kick`);
}

export async function forceCloseAdminRoom(
  roomId: string,
): Promise<AdminMutationResult<AdminForceCloseRoomData>> {
  try {
    const response = await fetch(adminUrl(`/rooms/${roomId}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminForceCloseRoomData>;
    if (!response.ok || !body.success) {
      return {
        ok: false,
        status: response.status,
        message: !body.success ? body.error.message : undefined,
      };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminGamesResult = { ok: true; data: AdminGamesData } | { ok: false; status: number };

export async function fetchAdminGames(): Promise<AdminGamesResult> {
  try {
    const response = await fetch(adminUrl('/games'), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminGamesData>;
    if (!response.ok || !body.success || !body.data?.games) {
      return { ok: false, status: response.status || 500 };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function patchAdminGameAvailability(
  gameId: string,
  isEnabled: boolean,
): Promise<AdminMutationResult<AdminGameAvailability>> {
  try {
    const response = await fetch(adminUrl(`/games/${encodeURIComponent(gameId)}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled }),
    });
    const body = (await response.json()) as AdminActionResponse<AdminGameAvailability>;
    if (!response.ok || !body.success) {
      return {
        ok: false,
        status: response.status,
        message: !body.success ? body.error.message : undefined,
      };
    }
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pickSafeUserListItem(value: unknown): AdminUserListItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.preferredDisplayName !== 'string' ||
    typeof record.email !== 'string' ||
    (record.role !== 'USER' && record.role !== 'ADMIN') ||
    typeof record.createdAt !== 'string' ||
    typeof record.matchCount !== 'number' ||
    (record.lastMatchAt !== null && typeof record.lastMatchAt !== 'string')
  ) {
    return null;
  }

  return {
    id: record.id,
    preferredDisplayName: record.preferredDisplayName,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
    matchCount: record.matchCount,
    lastMatchAt: asNullableString(record.lastMatchAt),
  };
}

function pickSafeUserMatchRow(value: unknown): AdminUserMatchRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.matchId !== 'string' ||
    typeof record.gameId !== 'string' ||
    typeof record.roomCode !== 'string' ||
    (record.status !== 'ACTIVE' && record.status !== 'COMPLETED' && record.status !== 'ABORTED') ||
    typeof record.startedAt !== 'string' ||
    (record.endedAt !== null && typeof record.endedAt !== 'string') ||
    typeof record.displayName !== 'string'
  ) {
    return null;
  }

  return {
    matchId: record.matchId,
    gameId: record.gameId,
    roomCode: record.roomCode,
    status: record.status,
    startedAt: record.startedAt,
    endedAt: asNullableString(record.endedAt),
    displayName: record.displayName,
    score: asNullableNumber(record.score),
    rank: asNullableNumber(record.rank),
    team: asNullableString(record.team),
    isWinner: asNullableBoolean(record.isWinner),
  };
}

function pickSafeUserDetails(value: unknown): AdminUserDetails | null {
  const user = pickSafeUserListItem(value);
  if (!user || !value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.matches)) {
    return null;
  }

  return {
    ...user,
    matches: record.matches
      .map(pickSafeUserMatchRow)
      .filter((row): row is AdminUserMatchRow => row !== null),
  };
}

function pickSafeHistoryMatch(value: unknown): AdminHistoryMatchListItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.gameId !== 'string' ||
    typeof record.roomCode !== 'string' ||
    (record.status !== 'ACTIVE' && record.status !== 'COMPLETED' && record.status !== 'ABORTED') ||
    typeof record.startedAt !== 'string' ||
    (record.endedAt !== null && typeof record.endedAt !== 'string') ||
    typeof record.participantCount !== 'number'
  ) {
    return null;
  }

  return {
    id: record.id,
    gameId: record.gameId,
    roomCode: record.roomCode,
    status: record.status,
    startedAt: record.startedAt,
    endedAt: asNullableString(record.endedAt),
    participantCount: record.participantCount,
  };
}

function pickSafeHistoryParticipant(value: unknown): AdminHistoryParticipant | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.displayName !== 'string' || typeof record.hasLinkedUser !== 'boolean') {
    return null;
  }

  return {
    displayName: record.displayName,
    hasLinkedUser: record.hasLinkedUser,
    userId: record.hasLinkedUser && typeof record.userId === 'string' ? record.userId : null,
    score: asNullableNumber(record.score),
    rank: asNullableNumber(record.rank),
    team: asNullableString(record.team),
    isWinner: asNullableBoolean(record.isWinner),
  };
}

function pickSafeMatchDetails(value: unknown): AdminMatchDetails | null {
  const match = pickSafeHistoryMatch(value);
  if (!match || !value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.participants)) {
    return null;
  }

  return {
    ...match,
    participants: record.participants
      .map(pickSafeHistoryParticipant)
      .filter((row): row is AdminHistoryParticipant => row !== null),
  };
}

export type AdminUsersQuery = {
  q?: string;
  page?: number;
};

export type AdminUsersResult = { ok: true; data: AdminUsersData } | { ok: false; status: number };

export async function fetchAdminUsers(query: AdminUsersQuery = {}): Promise<AdminUsersResult> {
  try {
    const params = new URLSearchParams();
    if (query.q?.trim()) {
      params.set('q', query.q.trim());
    }
    if (query.page && query.page > 1) {
      params.set('page', String(query.page));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(adminUrl(`/users${suffix}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminUsersData>;
    if (!response.ok || !body.success || !body.data || !Array.isArray(body.data.users)) {
      return { ok: false, status: response.status || 500 };
    }

    return {
      ok: true,
      data: {
        page: body.data.page,
        pageSize: body.data.pageSize,
        total: body.data.total,
        users: body.data.users
          .map(pickSafeUserListItem)
          .filter((user): user is AdminUserListItem => user !== null),
      },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminUserResult = { ok: true; data: AdminUserDetails } | { ok: false; status: number };

export async function fetchAdminUser(userId: string): Promise<AdminUserResult> {
  try {
    const response = await fetch(adminUrl(`/users/${encodeURIComponent(userId)}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminUserDetails>;
    const user = body.success ? pickSafeUserDetails(body.data) : null;
    if (!response.ok || !user) {
      return { ok: false, status: response.status || 500 };
    }
    return { ok: true, data: user };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminHistoryQuery = {
  gameId?: string;
  status?: string;
  page?: number;
};

export type AdminHistoryResult =
  { ok: true; data: AdminHistoryData } | { ok: false; status: number };

export async function fetchAdminHistory(
  query: AdminHistoryQuery = {},
): Promise<AdminHistoryResult> {
  try {
    const params = new URLSearchParams();
    if (query.gameId) {
      params.set('gameId', query.gameId);
    }
    if (query.status) {
      params.set('status', query.status);
    }
    if (query.page && query.page > 1) {
      params.set('page', String(query.page));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(adminUrl(`/history${suffix}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminHistoryData>;
    if (!response.ok || !body.success || !body.data || !Array.isArray(body.data.matches)) {
      return { ok: false, status: response.status || 500 };
    }

    return {
      ok: true,
      data: {
        page: body.data.page,
        pageSize: body.data.pageSize,
        total: body.data.total,
        matches: body.data.matches
          .map(pickSafeHistoryMatch)
          .filter((match): match is AdminHistoryMatchListItem => match !== null),
      },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminMatchResult =
  { ok: true; data: AdminMatchDetails } | { ok: false; status: number };

export async function fetchAdminMatch(matchId: string): Promise<AdminMatchResult> {
  try {
    const response = await fetch(adminUrl(`/history/${encodeURIComponent(matchId)}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminMatchDetails>;
    const match = body.success ? pickSafeMatchDetails(body.data) : null;
    if (!response.ok || !match) {
      return { ok: false, status: response.status || 500 };
    }
    return { ok: true, data: match };
  } catch {
    return { ok: false, status: 0 };
  }
}

const ROOM_CLOSE_REASONS = new Set([
  'ROOM_EMPTY',
  'HOST_ENDED',
  'ADMIN_FORCE_CLOSED',
  'STARTUP_RECONCILIATION',
]);

function pickSafeRoomHistoryListItem(value: unknown): AdminRoomHistoryListItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.roomCode !== 'string' ||
    (record.originalHostName !== null && typeof record.originalHostName !== 'string') ||
    typeof record.currentHostName !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.historyStartedAt !== 'string' ||
    (record.closedAt !== null && typeof record.closedAt !== 'string') ||
    (record.closeReason !== null &&
      (typeof record.closeReason !== 'string' || !ROOM_CLOSE_REASONS.has(record.closeReason))) ||
    typeof record.participantCount !== 'number' ||
    typeof record.matchCount !== 'number' ||
    typeof record.playerCap !== 'number' ||
    typeof record.isLocked !== 'boolean' ||
    typeof record.isComplete !== 'boolean' ||
    (record.state !== 'OPEN' && record.state !== 'CLOSED')
  ) {
    return null;
  }

  return {
    id: record.id,
    roomCode: record.roomCode,
    originalHostName: record.originalHostName,
    currentHostName: record.currentHostName,
    createdAt: record.createdAt,
    historyStartedAt: record.historyStartedAt,
    closedAt: record.closedAt,
    closeReason: record.closeReason as AdminRoomHistoryListItem['closeReason'],
    participantCount: record.participantCount,
    matchCount: record.matchCount,
    playerCap: record.playerCap,
    isLocked: record.isLocked,
    isComplete: record.isComplete,
    state: record.state,
  };
}

function pickSafeRoomHistoryParticipant(value: unknown): AdminRoomHistoryParticipant | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.displayName !== 'string' ||
    typeof record.joinedAt !== 'string' ||
    (record.leftAt !== null && typeof record.leftAt !== 'string') ||
    (record.joinedAsSpectator !== null && typeof record.joinedAsSpectator !== 'boolean') ||
    (record.wasHost !== null && typeof record.wasHost !== 'boolean')
  ) {
    return null;
  }
  return {
    id: record.id,
    displayName: record.displayName,
    joinedAt: record.joinedAt,
    leftAt: record.leftAt,
    joinedAsSpectator: record.joinedAsSpectator,
    wasHost: record.wasHost,
  };
}

function pickSafeRoomHostAssignment(value: unknown): AdminRoomHostAssignment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.displayName !== 'string' ||
    typeof record.assignedAt !== 'string'
  ) {
    return null;
  }
  return {
    id: record.id,
    displayName: record.displayName,
    assignedAt: record.assignedAt,
  };
}

function pickSafeRoomHistoryMatch(value: unknown): AdminRoomHistoryMatch | null {
  const match = pickSafeHistoryMatch(value);
  if (!match || !value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.winnerDisplayNames)) {
    return null;
  }
  return {
    ...match,
    winnerDisplayNames: record.winnerDisplayNames.filter(
      (name): name is string => typeof name === 'string',
    ),
  };
}

function pickSafeRoomHistoryDetails(value: unknown): AdminRoomHistoryDetails | null {
  const room = pickSafeRoomHistoryListItem(value);
  if (!room || !value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.liveRoomId !== 'string' ||
    typeof record.isCurrentlyLive !== 'boolean' ||
    (record.wasEverLocked !== null && typeof record.wasEverLocked !== 'boolean') ||
    (record.createdByAdmin !== null && typeof record.createdByAdmin !== 'boolean') ||
    !Array.isArray(record.participants) ||
    !Array.isArray(record.hostAssignments) ||
    !Array.isArray(record.matches)
  ) {
    return null;
  }
  return {
    ...room,
    liveRoomId: record.liveRoomId,
    isCurrentlyLive: record.isCurrentlyLive,
    wasEverLocked: record.wasEverLocked,
    createdByAdmin: record.createdByAdmin,
    participants: record.participants
      .map(pickSafeRoomHistoryParticipant)
      .filter((row): row is AdminRoomHistoryParticipant => row !== null),
    hostAssignments: record.hostAssignments
      .map(pickSafeRoomHostAssignment)
      .filter((row): row is AdminRoomHostAssignment => row !== null),
    matches: record.matches
      .map(pickSafeRoomHistoryMatch)
      .filter((row): row is AdminRoomHistoryMatch => row !== null),
  };
}

export type AdminRoomHistoryQuery = {
  roomCode?: string;
  participant?: string;
  host?: string;
  gameId?: string;
  createdFrom?: string;
  createdTo?: string;
  state?: string;
  page?: number;
};

export type AdminRoomHistoryResult =
  { ok: true; data: AdminRoomHistoryData } | { ok: false; status: number };

export async function fetchAdminRoomHistory(
  query: AdminRoomHistoryQuery = {},
): Promise<AdminRoomHistoryResult> {
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === 'page') {
        if (typeof value === 'number' && value > 1) {
          params.set(key, String(value));
        }
      } else if (typeof value === 'string' && value.trim()) {
        params.set(key, value.trim());
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(adminUrl(`/room-history${suffix}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminRoomHistoryData>;
    if (!response.ok || !body.success || !body.data || !Array.isArray(body.data.rooms)) {
      return { ok: false, status: response.status || 500 };
    }
    return {
      ok: true,
      data: {
        page: body.data.page,
        pageSize: body.data.pageSize,
        total: body.data.total,
        rooms: body.data.rooms
          .map(pickSafeRoomHistoryListItem)
          .filter((room): room is AdminRoomHistoryListItem => room !== null),
      },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminRoomHistoryDetailsResult =
  { ok: true; data: AdminRoomHistoryDetails } | { ok: false; status: number };

export async function fetchAdminRoomHistoryDetails(
  historyId: string,
): Promise<AdminRoomHistoryDetailsResult> {
  try {
    const response = await fetch(adminUrl(`/room-history/${encodeURIComponent(historyId)}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminRoomHistoryDetails>;
    const room = body.success ? pickSafeRoomHistoryDetails(body.data) : null;
    if (!response.ok || !room) {
      return { ok: false, status: response.status || 500 };
    }
    return { ok: true, data: room };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminSystemResult = { ok: true; data: AdminSystemData } | { ok: false; status: number };

function pickSafeSystem(value: unknown): AdminSystemData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const memory =
    record.memory && typeof record.memory === 'object'
      ? (record.memory as Record<string, unknown>)
      : null;
  if (
    typeof record.serverTime !== 'string' ||
    typeof record.uptimeSeconds !== 'number' ||
    (record.environment !== 'production' && record.environment !== 'development') ||
    typeof record.databaseReachable !== 'boolean' ||
    typeof record.connectedSockets !== 'number' ||
    typeof record.rooms !== 'number' ||
    typeof record.liveGameShells !== 'number' ||
    typeof record.activeMatches !== 'number' ||
    !memory ||
    typeof memory.rss !== 'number' ||
    typeof memory.heapUsed !== 'number' ||
    typeof memory.heapTotal !== 'number'
  ) {
    return null;
  }

  return {
    serverTime: record.serverTime,
    uptimeSeconds: record.uptimeSeconds,
    environment: record.environment,
    databaseReachable: record.databaseReachable,
    connectedSockets: record.connectedSockets,
    rooms: record.rooms,
    liveGameShells: record.liveGameShells,
    activeMatches: record.activeMatches,
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
    },
  };
}

export async function fetchAdminSystem(): Promise<AdminSystemResult> {
  try {
    const response = await fetch(adminUrl('/system'), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminSystemData>;
    const data = body.success ? pickSafeSystem(body.data) : null;
    if (!response.ok || !data) {
      return { ok: false, status: response.status || 500 };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminAnalyticsResult =
  { ok: true; data: AdminAnalyticsData } | { ok: false; status: number };

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickSafeAnalyticsGame(value: unknown): AdminAnalyticsData['games'][number] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.gameId !== 'string' ||
    typeof record.started !== 'number' ||
    typeof record.completed !== 'number' ||
    typeof record.aborted !== 'number' ||
    (record.completionRate !== null && typeof record.completionRate !== 'number')
  ) {
    return null;
  }
  return {
    gameId: record.gameId,
    started: record.started,
    completed: record.completed,
    aborted: record.aborted,
    completionRate: asFiniteNumber(record.completionRate),
  };
}

function pickSafeDailyPoint(value: unknown): AdminAnalyticsData['daily'][number] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.date !== 'string' ||
    typeof record.roomsCreated !== 'number' ||
    typeof record.matchesStarted !== 'number' ||
    typeof record.matchesCompleted !== 'number' ||
    typeof record.matchesAborted !== 'number'
  ) {
    return null;
  }
  return {
    date: record.date,
    roomsCreated: record.roomsCreated,
    matchesStarted: record.matchesStarted,
    matchesCompleted: record.matchesCompleted,
    matchesAborted: record.matchesAborted,
  };
}

function pickSafeAnalytics(value: unknown): AdminAnalyticsData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const overview =
    record.overview && typeof record.overview === 'object'
      ? (record.overview as Record<string, unknown>)
      : null;
  const participation =
    record.participation && typeof record.participation === 'object'
      ? (record.participation as Record<string, unknown>)
      : null;
  if (
    (record.range !== '24h' &&
      record.range !== '7d' &&
      record.range !== '30d' &&
      record.range !== 'all') ||
    (record.from !== null && typeof record.from !== 'string') ||
    typeof record.to !== 'string' ||
    !overview ||
    !participation ||
    !Array.isArray(record.games) ||
    !Array.isArray(record.daily) ||
    typeof overview.roomsCreated !== 'number' ||
    typeof overview.roomsJoined !== 'number' ||
    typeof overview.spectatorsJoined !== 'number' ||
    typeof overview.reconnectsSucceeded !== 'number' ||
    typeof overview.roomsClosed !== 'number' ||
    typeof overview.matchesStarted !== 'number' ||
    typeof overview.matchesCompleted !== 'number' ||
    typeof overview.matchesAborted !== 'number' ||
    typeof overview.matchesActive !== 'number' ||
    (overview.completionRate !== null && typeof overview.completionRate !== 'number') ||
    typeof participation.totalParticipations !== 'number' ||
    (participation.averageParticipants !== null &&
      typeof participation.averageParticipants !== 'number')
  ) {
    return null;
  }

  return {
    range: record.range,
    from: record.from,
    to: record.to,
    overview: {
      roomsCreated: overview.roomsCreated,
      roomsJoined: overview.roomsJoined,
      spectatorsJoined: overview.spectatorsJoined,
      reconnectsSucceeded: overview.reconnectsSucceeded,
      roomsClosed: overview.roomsClosed,
      matchesStarted: overview.matchesStarted,
      matchesCompleted: overview.matchesCompleted,
      matchesAborted: overview.matchesAborted,
      matchesActive: overview.matchesActive,
      completionRate: asFiniteNumber(overview.completionRate),
    },
    participation: {
      totalParticipations: participation.totalParticipations,
      averageParticipants: asFiniteNumber(participation.averageParticipants),
    },
    games: record.games
      .map(pickSafeAnalyticsGame)
      .filter((row): row is AdminAnalyticsData['games'][number] => row !== null),
    daily: record.daily
      .map(pickSafeDailyPoint)
      .filter((row): row is AdminAnalyticsData['daily'][number] => row !== null),
  };
}

export async function fetchAdminAnalytics(range = '7d'): Promise<AdminAnalyticsResult> {
  try {
    const params = new URLSearchParams();
    params.set('range', range);
    const response = await fetch(adminUrl(`/analytics?${params.toString()}`), {
      method: 'GET',
      credentials: 'include',
    });
    const body = (await response.json()) as AdminActionResponse<AdminAnalyticsData>;
    const data = body.success ? pickSafeAnalytics(body.data) : null;
    if (!response.ok || !data) {
      return { ok: false, status: response.status || 500 };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}
