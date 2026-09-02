import type { UserRole } from '../auth/types.js';
import type { GamePhase } from '../game/enums.js';

export const ADMIN_DASHBOARD_GAME_IDS = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'timing-challenge',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
  'fast-answer',
] as const;

export type AdminDashboardGameId = (typeof ADMIN_DASHBOARD_GAME_IDS)[number];

export const ADMIN_DASHBOARD_RECENT_USERS_LIMIT = 10;
export const ADMIN_DASHBOARD_RECENT_MATCHES_LIMIT = 15;
export const ADMIN_DASHBOARD_POLL_MS = 12_000;
export const ADMIN_USERS_PAGE_SIZE = 25;
export const ADMIN_USER_MATCH_HISTORY_LIMIT = 20;
export const ADMIN_HISTORY_PAGE_SIZE = 25;
export const ADMIN_LIVE_ROOMS_PAGE_SIZE = 25;
export const ADMIN_ROOM_HISTORY_PAGE_SIZE = 25;
export const ADMIN_SEARCH_QUERY_MAX_LENGTH = 80;
export const ADMIN_SYSTEM_POLL_MS = 25_000;
export const ADMIN_ANALYTICS_POLL_MS = 60_000;
export const ADMIN_ANALYTICS_DEFAULT_RANGE = '7d';
export const ADMIN_ANALYTICS_RANGES = ['24h', '7d', '30d', 'all'] as const;
export const ADMIN_AUDIT_PAGE_SIZE = 50;

export const ADMIN_AUDIT_ACTIONS = [
  'ROLE_PROMOTED',
  'MFA_ENROLLMENT_STARTED',
  'MFA_ENABLED',
  'MFA_LOGIN_SUCCESS',
  'MFA_LOGIN_FAILURE',
  'MFA_RECOVERY_USED',
  'GAME_AVAILABILITY_SET',
  'ROOM_LOCK',
  'ROOM_UNLOCK',
  'ROOM_KICK',
  'ROOM_FORCE_CLOSE',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];
export type AdminAuditOutcome = 'SUCCESS' | 'FAILURE';
export type AdminAuditMetadataValue = string | number | boolean | null;
export type AdminAuditMetadata = Record<string, AdminAuditMetadataValue>;

export type AdminAuditEntry = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  action: AdminAuditAction;
  targetType: string | null;
  targetId: string | null;
  outcome: AdminAuditOutcome;
  requestId: string | null;
  metadata: AdminAuditMetadata | null;
};

export type AdminAuditData = {
  entries: AdminAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAnalyticsRange = (typeof ADMIN_ANALYTICS_RANGES)[number];

export type AdminRoomActivity = 'LOBBY' | 'IN_GAME';
export type AdminRoomStatus = 'LOBBY' | 'PLAYING';

export type AdminMatchStatus = 'ACTIVE' | 'COMPLETED' | 'ABORTED';

export type AdminDashboardSummary = {
  registeredUsers: number;
  currentRooms: number;
  currentSeats: number;
  connectedPlayers: number;
  disconnectedPlayers: number;
  spectators: number;
  completedMatches: number;
  abortedMatches: number;
  matchesStartedTodayUtc: number;
  roomsWithLiveGame: number;
};

export type AdminLiveRoom = {
  id: string;
  code: string;
  createdAt: string;
  isLocked: boolean;
  playerCount: number;
  connectedCount: number;
  disconnectedCount: number;
  spectatorCount: number;
  hostDisplayName: string;
  playerCap: number;
  status: AdminRoomStatus;
  activity: AdminRoomActivity;
  gameId: string | null;
  gamePhase: GamePhase | null;
};

export type AdminRecentUser = {
  id: string;
  email: string;
  preferredDisplayName: string;
  role: UserRole;
  createdAt: string;
};

export type AdminRecentMatch = {
  id: string;
  gameId: string;
  roomCode: string;
  status: AdminMatchStatus;
  startedAt: string;
  endedAt: string | null;
  participantCount: number;
  winnerDisplayNames: string[];
};

export type AdminGameUsage = {
  gameId: string;
  completedCount: number;
  abortedCount: number;
  totalCount: number;
};

export type AdminDashboardData = {
  summary: AdminDashboardSummary;
  liveRooms: AdminLiveRoom[];
  recentUsers: AdminRecentUser[];
  recentMatches: AdminRecentMatch[];
  gameUsage: AdminGameUsage[];
};

export const ADMIN_ROOM_CLOSED_MESSAGE = 'تم إغلاق الغرفة من الإدارة.';

export type AdminErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'ROOM_NOT_FOUND'
  | 'PLAYER_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'MATCH_NOT_FOUND'
  | 'ROOM_HISTORY_NOT_FOUND'
  | 'INTERNAL_ERROR';

export type AdminActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: AdminErrorCode; message: string; requestId?: string } };

export type AdminRoomPlayerStatus = 'CONNECTED' | 'DISCONNECTED';

export type AdminRoomPlayer = {
  id: string;
  displayName: string;
  status: AdminRoomPlayerStatus;
  isSpectator: boolean;
  isHost: boolean;
};

export type AdminRoomDetails = AdminLiveRoom & {
  historyId: string | null;
  players: AdminRoomPlayer[];
};

export type AdminRoomsData = {
  rooms: AdminLiveRoom[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminRoomCloseReason =
  'ROOM_EMPTY' | 'HOST_ENDED' | 'ADMIN_FORCE_CLOSED' | 'STARTUP_RECONCILIATION';

export type AdminRoomHistoryState = 'OPEN' | 'CLOSED';

export type AdminRoomHistoryListItem = {
  id: string;
  roomCode: string;
  originalHostName: string | null;
  currentHostName: string;
  createdAt: string;
  historyStartedAt: string;
  closedAt: string | null;
  closeReason: AdminRoomCloseReason | null;
  participantCount: number;
  matchCount: number;
  playerCap: number;
  isLocked: boolean;
  isComplete: boolean;
  state: AdminRoomHistoryState;
};

export type AdminRoomHistoryData = {
  rooms: AdminRoomHistoryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminRoomHistoryParticipant = {
  id: string;
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
  joinedAsSpectator: boolean | null;
  wasHost: boolean | null;
};

export type AdminRoomHostAssignment = {
  id: string;
  displayName: string;
  assignedAt: string;
};

export type AdminRoomHistoryMatch = AdminHistoryMatchListItem & {
  winnerDisplayNames: string[];
};

export type AdminRoomHistoryDetails = AdminRoomHistoryListItem & {
  liveRoomId: string;
  isCurrentlyLive: boolean;
  wasEverLocked: boolean | null;
  createdByAdmin: boolean | null;
  participants: AdminRoomHistoryParticipant[];
  hostAssignments: AdminRoomHostAssignment[];
  matches: AdminRoomHistoryMatch[];
};

export type AdminRoomLockData = {
  roomId: string;
  isLocked: boolean;
};

export type AdminKickPlayerData = {
  roomId: string;
  playerId: string;
  roomDeleted: boolean;
};

export type AdminForceCloseRoomData = {
  roomId: string;
  alreadyClosed: boolean;
};

export type AdminGameAvailability = {
  gameId: string;
  isEnabled: boolean;
};

export type AdminGamesData = {
  games: AdminGameAvailability[];
};

export type AdminGameAvailabilityUpdateData = AdminGameAvailability;

export type AdminUserListItem = {
  id: string;
  preferredDisplayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  matchCount: number;
  lastMatchAt: string | null;
};

export type AdminUsersData = {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserMatchRow = {
  matchId: string;
  gameId: string;
  roomCode: string;
  status: AdminMatchStatus;
  startedAt: string;
  endedAt: string | null;
  displayName: string;
  score: number | null;
  rank: number | null;
  team: string | null;
  isWinner: boolean | null;
};

export type AdminUserDetails = AdminUserListItem & {
  matches: AdminUserMatchRow[];
};

export type AdminHistoryMatchListItem = {
  id: string;
  gameId: string;
  roomCode: string;
  status: AdminMatchStatus;
  startedAt: string;
  endedAt: string | null;
  participantCount: number;
};

export type AdminHistoryData = {
  matches: AdminHistoryMatchListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminHistoryParticipant = {
  displayName: string;
  hasLinkedUser: boolean;
  userId: string | null;
  score: number | null;
  rank: number | null;
  team: string | null;
  isWinner: boolean | null;
};

export type AdminMatchDetails = AdminHistoryMatchListItem & {
  participants: AdminHistoryParticipant[];
};

export type AdminSystemEnvironment = 'production' | 'development';

export type AdminSystemMemory = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
};

export type AdminSystemData = {
  serverTime: string;
  uptimeSeconds: number;
  environment: AdminSystemEnvironment;
  databaseReachable: boolean;
  connectedSockets: number;
  rooms: number;
  liveGameShells: number;
  activeMatches: number;
  memory: AdminSystemMemory;
};

export type AdminAnalyticsOverview = {
  roomsCreated: number;
  roomsJoined: number;
  spectatorsJoined: number;
  reconnectsSucceeded: number;
  roomsClosed: number;
  matchesStarted: number;
  matchesCompleted: number;
  matchesAborted: number;
  matchesActive: number;
  completionRate: number | null;
};

export type AdminAnalyticsGameUsage = {
  gameId: string;
  started: number;
  completed: number;
  aborted: number;
  completionRate: number | null;
  matchShare: number;
  lastPlayedAt: string | null;
  averageParticipants: number | null;
  averageDurationSeconds: number | null;
};

export type AdminAnalyticsParticipation = {
  totalParticipations: number;
  averageParticipants: number | null;
};

export type AdminAnalyticsDailyPoint = {
  date: string;
  roomsCreated: number;
  matchesStarted: number;
  matchesCompleted: number;
  matchesAborted: number;
};

export type AdminAnalyticsActivityPoint = {
  bucket: string;
  label: string;
  matchesStarted: number;
  matchesCompleted: number;
  matchesAborted: number;
};

export type AdminAnalyticsMatchSizePoint = {
  size: number;
  matchCount: number;
};

export type AdminAnalyticsDuration = {
  averageSeconds: number | null;
  measuredMatchCount: number;
};

export type AdminRoomHistoryCloseReasonPoint = {
  reason: AdminRoomCloseReason;
  roomCount: number;
};

export type AdminAnalyticsRoomActivityPoint = {
  date: string;
  roomsCreated: number;
};

export type AdminRoomHistoryAnalytics = {
  coverageStartedAt: string | null;
  isPartialForRange: boolean;
  roomsCreated: number | null;
  averageDurationSeconds: number | null;
  measuredRoomCount: number;
  averageParticipants: number | null;
  closeReasons: AdminRoomHistoryCloseReasonPoint[];
  activity: AdminAnalyticsRoomActivityPoint[];
};

export type AdminAnalyticsData = {
  range: AdminAnalyticsRange;
  from: string | null;
  to: string;
  overview: AdminAnalyticsOverview;
  participation: AdminAnalyticsParticipation;
  games: AdminAnalyticsGameUsage[];
  daily: AdminAnalyticsDailyPoint[];
  activity: AdminAnalyticsActivityPoint[];
  matchSizeDistribution: AdminAnalyticsMatchSizePoint[];
  duration: AdminAnalyticsDuration;
  startsBySaudiHour: number[];
  roomHistory: AdminRoomHistoryAnalytics;
};
