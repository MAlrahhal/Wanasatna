import { io, type Socket } from 'socket.io-client';
import { getServerUrl } from '@/lib/config/server-url';

/**
 * Isolated from Room Client Core V2.
 * Admin Spectate must never bind a Player session.
 */
export function createAdminSpectateSocket(): Socket {
  return io(getServerUrl(), {
    autoConnect: false,
    reconnection: true,
    withCredentials: true,
  });
}
