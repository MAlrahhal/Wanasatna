export const PUBLIC_ROUTES = {
  home: '/',
  games: '/games',
  faq: '/faq',
  contact: '/contact',
  premium: '/premium',
  login: '/login',
} as const;

export type PublicRoute = (typeof PUBLIC_ROUTES)[keyof typeof PUBLIC_ROUTES];

export const PUBLIC_NAV_LINKS = [
  { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
  { href: PUBLIC_ROUTES.games, label: 'الألعاب' },
  { href: PUBLIC_ROUTES.faq, label: 'الأسئلة الشائعة' },
  { href: PUBLIC_ROUTES.contact, label: 'تواصل معنا' },
  { href: PUBLIC_ROUTES.premium, label: 'بريميوم', premium: true },
] as const;

export const HOME_ROOM_ACTIONS_ID = 'start-play';
