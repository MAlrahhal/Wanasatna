export const PUBLIC_ROUTES = {
  home: '/',
  games: '/games',
  faq: '/faq',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  login: '/login',
} as const;

export function getGameInformationPath(gameId: string) {
  return `${PUBLIC_ROUTES.games}/${gameId}`;
}

export type PublicRoute = (typeof PUBLIC_ROUTES)[keyof typeof PUBLIC_ROUTES];

export const PUBLIC_NAV_LINKS = [
  { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
  { href: PUBLIC_ROUTES.games, label: 'الألعاب' },
  { href: PUBLIC_ROUTES.faq, label: 'الأسئلة الشائعة' },
  { href: PUBLIC_ROUTES.contact, label: 'تواصل معنا' },
] as const;

export const HOME_ROOM_ACTIONS_ID = 'start-play';
