import { ADMIN_GAME_TITLES } from './copy';

export function formatAdminDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('ar', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  });
}

export function adminGameTitle(gameId: string | null | undefined): string {
  if (!gameId) {
    return '—';
  }

  return ADMIN_GAME_TITLES[gameId] ?? gameId;
}
