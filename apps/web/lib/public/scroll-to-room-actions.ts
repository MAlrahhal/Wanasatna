import { HOME_ROOM_ACTIONS_ID, PUBLIC_ROUTES } from '@/lib/public/routes';

export function getHomeRoomActionsHref() {
  return `${PUBLIC_ROUTES.home}#${HOME_ROOM_ACTIONS_ID}`;
}

export function scrollToHomeRoomActions() {
  document.getElementById(HOME_ROOM_ACTIONS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
