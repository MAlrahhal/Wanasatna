import type { Socket } from 'socket.io';
import type { PublicUser } from '@wanasatna/shared';
import { AUTH_COOKIE_NAME, parseCookies } from './auth.cookie.js';
import { resolveAuthSession } from './auth.service.js';

function readHandshakeAuthToken(socket: Socket): string | undefined {
  const token = parseCookies(socket.handshake.headers.cookie)[AUTH_COOKIE_NAME];
  return token && token.length > 0 ? token : undefined;
}

/**
 * Optional website-account identity for this socket.
 * Missing/invalid/expired cookies are Guest — never reject the handshake.
 */
export async function attachOptionalSocketAuth(socket: Socket): Promise<void> {
  try {
    socket.data.authUser = await resolveAuthSession(readHandshakeAuthToken(socket));
  } catch {
    socket.data.authUser = null;
  }
}

/**
 * Re-resolve the handshake cookie against AuthSession at Create/Join time.
 * Logout revokes the DB row even if the Engine.IO handshake cookie is stale.
 * Never used to reclaim a Player seat.
 */
export async function resolveSocketAccountUser(socket: Socket): Promise<PublicUser | null> {
  try {
    const user = await resolveAuthSession(readHandshakeAuthToken(socket));
    socket.data.authUser = user;
    return user;
  } catch {
    socket.data.authUser = null;
    return null;
  }
}
