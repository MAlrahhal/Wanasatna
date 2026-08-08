import { KeyIcon, MailIcon, UserIcon } from '@/components/public/public-field';

export { KeyIcon, MailIcon, UserIcon };

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2Z" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export const projectIcons = [
  { name: 'UserIcon', Icon: UserIcon },
  { name: 'KeyIcon', Icon: KeyIcon },
  { name: 'MailIcon', Icon: MailIcon },
  { name: 'SearchIcon', Icon: SearchIcon },
  { name: 'InfoIcon', Icon: InfoIcon },
  { name: 'StarIcon', Icon: StarIcon },
  { name: 'MenuIcon', Icon: MenuIcon },
] as const;
