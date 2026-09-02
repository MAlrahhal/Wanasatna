export const ADMIN_ROUTES = {
  root: '/admin',
  login: '/admin/login',
  system: '/admin/system',
  analytics: '/admin/analytics',
  rooms: '/admin/rooms',
  roomHistory: '/admin/room-history',
  users: '/admin/users',
  games: '/admin/games',
  history: '/admin/history',
  auditLogs: '/admin/audit-logs',
} as const;

export function adminRoomPath(roomId: string): string {
  return `${ADMIN_ROUTES.rooms}/${roomId}`;
}

export function adminRoomSpectatePath(roomId: string): string {
  return `${ADMIN_ROUTES.rooms}/${roomId}/spectate`;
}

export function adminRoomHistoryPath(historyId: string): string {
  return `${ADMIN_ROUTES.roomHistory}/${historyId}`;
}

export function adminUserPath(userId: string): string {
  return `${ADMIN_ROUTES.users}/${userId}`;
}

export function adminHistoryPath(matchId: string): string {
  return `${ADMIN_ROUTES.history}/${matchId}`;
}

export const ADMIN_NAV_ITEMS = [
  { id: 'home', label: 'الرئيسية', href: ADMIN_ROUTES.root, placeholder: false },
  { id: 'system', label: 'حالة النظام', href: ADMIN_ROUTES.system, placeholder: false },
  { id: 'analytics', label: 'التحليلات', href: ADMIN_ROUTES.analytics, placeholder: false },
  { id: 'rooms', label: 'الغرف المباشرة', href: ADMIN_ROUTES.rooms, placeholder: false },
  {
    id: 'roomHistory',
    label: 'سجل الغرف',
    href: ADMIN_ROUTES.roomHistory,
    placeholder: false,
  },
  { id: 'log', label: 'سجل المباريات', href: ADMIN_ROUTES.history, placeholder: false },
  { id: 'auditLogs', label: 'سجل التدقيق', href: ADMIN_ROUTES.auditLogs, placeholder: false },
  { id: 'users', label: 'المستخدمون', href: ADMIN_ROUTES.users, placeholder: false },
  { id: 'games', label: 'الألعاب', href: ADMIN_ROUTES.games, placeholder: false },
] as const;
