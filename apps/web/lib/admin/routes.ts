export const ADMIN_ROUTES = {
  root: '/admin',
  login: '/admin/login',
  rooms: '/admin/rooms',
  users: '/admin/users',
  games: '/admin/games',
  history: '/admin/history',
} as const;

export function adminRoomPath(roomId: string): string {
  return `${ADMIN_ROUTES.rooms}/${roomId}`;
}

export function adminUserPath(userId: string): string {
  return `${ADMIN_ROUTES.users}/${userId}`;
}

export function adminHistoryPath(matchId: string): string {
  return `${ADMIN_ROUTES.history}/${matchId}`;
}

export const ADMIN_NAV_ITEMS = [
  { id: 'home', label: 'الرئيسية', href: ADMIN_ROUTES.root, placeholder: false },
  { id: 'rooms', label: 'الغرف', href: ADMIN_ROUTES.rooms, placeholder: false },
  { id: 'users', label: 'المستخدمون', href: ADMIN_ROUTES.users, placeholder: false },
  { id: 'games', label: 'الألعاب', href: ADMIN_ROUTES.games, placeholder: false },
  { id: 'log', label: 'السجل', href: ADMIN_ROUTES.history, placeholder: false },
] as const;
