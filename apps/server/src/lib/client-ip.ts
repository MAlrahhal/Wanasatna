import { isIP } from 'node:net';
import type { Socket } from 'socket.io';

function normalizeIp(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('::ffff:')) {
    const mapped = trimmed.slice('::ffff:'.length);
    if (isIP(mapped) === 4) {
      return mapped;
    }
  }

  return trimmed;
}

function asSingleValidIp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.trim();

  if (!candidate || candidate.includes(',')) {
    return null;
  }

  const normalized = normalizeIp(candidate);
  return isIP(normalized) ? normalized : null;
}

/**
 * Ephemeral abuse-limit identity. Prefers Railway `X-Real-IP` when it is a
 * single valid address; never trusts comma-separated `X-Forwarded-For`.
 */
export function getClientIp(socket: Socket): string {
  const header = socket.handshake.headers['x-real-ip'];
  const fromHeader = asSingleValidIp(Array.isArray(header) ? header[0] : header);

  if (fromHeader) {
    return fromHeader;
  }

  const remote =
    socket.handshake.address ||
    socket.conn.remoteAddress ||
    '';

  return asSingleValidIp(remote) ?? '0.0.0.0';
}
