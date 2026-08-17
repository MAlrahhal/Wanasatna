export const ADMIN_ROUTES = {
  root: '/admin',
  login: '/admin/login',
} as const;

export const ADMIN_NAV_ITEMS = [
  { id: 'home', label: 'الرئيسية', href: ADMIN_ROUTES.root, placeholder: false },
  { id: 'rooms', label: 'الغرف', href: ADMIN_ROUTES.root, placeholder: true },
  { id: 'users', label: 'المستخدمون', href: ADMIN_ROUTES.root, placeholder: true },
  { id: 'games', label: 'الألعاب', href: ADMIN_ROUTES.root, placeholder: true },
  { id: 'log', label: 'السجل', href: ADMIN_ROUTES.root, placeholder: true },
] as const;
