import type { GameShellState, MarathonState } from '@wanasatna/shared';
import { buildLobbyUrl } from './session';

export type AuthoritativeRuntimeSnapshot<T> =
  { status: 'unknown' } | { status: 'ready'; state: T | null };

export type AuthoritativeRoomRouteSnapshot = {
  gameShell: AuthoritativeRuntimeSnapshot<GameShellState>;
  marathon: AuthoritativeRuntimeSnapshot<MarathonState>;
};

export type AuthoritativeRoomRoutePlan = {
  pathname: '/lobby' | '/game' | '/marathon';
  href: string;
};

function marathonDestination(state: MarathonState): '/game' | '/marathon' {
  return state.status === 'PLAYING' && state.activeShellId ? '/game' : '/marathon';
}

function isRuntimePath(pathname: string): pathname is '/game' | '/marathon' {
  return pathname === '/game' || pathname === '/marathon';
}

/**
 * Converts the latest acknowledged runtime state into an idempotent route correction.
 * A null runtime is only terminal when both independent stores were synchronized.
 */
export function planAuthoritativeRoomRoute({
  pathname,
  roomCode,
  snapshot,
}: {
  pathname: string;
  roomCode?: string | null;
  snapshot: AuthoritativeRoomRouteSnapshot;
}): AuthoritativeRoomRoutePlan | null {
  let destination: '/lobby' | '/game' | '/marathon' | null = null;

  if (snapshot.marathon.status === 'ready' && snapshot.marathon.state) {
    destination = marathonDestination(snapshot.marathon.state);
  } else if (
    snapshot.gameShell.status === 'ready' &&
    snapshot.gameShell.state &&
    snapshot.gameShell.state.phase !== 'FINISHED'
  ) {
    destination = '/game';
  } else if (
    snapshot.gameShell.status === 'ready' &&
    snapshot.gameShell.state === null &&
    snapshot.marathon.status === 'ready' &&
    snapshot.marathon.state === null &&
    isRuntimePath(pathname) &&
    roomCode
  ) {
    destination = '/lobby';
  }

  if (!destination || destination === pathname) {
    return null;
  }

  return {
    pathname: destination,
    href: destination === '/lobby' ? buildLobbyUrl(roomCode!) : destination,
  };
}
