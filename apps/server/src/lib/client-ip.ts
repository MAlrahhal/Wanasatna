import { BlockList, isIP } from 'node:net';
import type { Request } from 'express';
import type { Socket } from 'socket.io';

export type ClientIpInput = {
  remoteAddress?: unknown;
  railwayEdge?: unknown;
  xRealIp?: unknown;
  cfConnectingIp?: unknown;
};

function buildBlockList(ranges: readonly string[]): BlockList {
  const blockList = new BlockList();
  for (const range of ranges) {
    const [address, prefixText] = range.split('/');
    if (!address || !prefixText) {
      continue;
    }
    const family = isIP(address);
    if (family === 4) {
      blockList.addSubnet(address, Number(prefixText), 'ipv4');
    } else if (family === 6) {
      blockList.addSubnet(address, Number(prefixText), 'ipv6');
    }
  }
  return blockList;
}

const TRUSTED_RAILWAY_HOPS = buildBlockList([
  '127.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
]);

// Cloudflare's published proxy ranges. They are used only to authenticate the
// proxy hop before accepting CF-Connecting-IP; they do not block traffic.
const CLOUDFLARE_PROXY_RANGES = buildBlockList([
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]);

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

function asSingleHeaderValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value.length === 1 && typeof value[0] === 'string' ? value[0] : null;
  }
  return typeof value === 'string' ? value : null;
}

function asSingleValidIp(value: unknown): string | null {
  const headerValue = asSingleHeaderValue(value);
  if (headerValue === null) {
    return null;
  }

  const candidate = headerValue.trim();
  if (!candidate || candidate.includes(',')) {
    return null;
  }

  const normalized = normalizeIp(candidate);
  return isIP(normalized) ? normalized : null;
}

function blockListContains(blockList: BlockList, ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    return blockList.check(ip, 'ipv4');
  }
  return family === 6 && blockList.check(ip, 'ipv6');
}

function isRailwayEdgeHeader(value: unknown): boolean {
  const headerValue = asSingleHeaderValue(value);
  return Boolean(headerValue && /^[a-z]{3}\d+$/i.test(headerValue.trim()));
}

/**
 * Resolves an abuse-limit identity for the deployed proxy path:
 * Cloudflare (optional) -> Railway edge -> this process.
 *
 * Railway's X-Real-IP is accepted only when the socket peer is an internal
 * proxy address and Railway supplied X-Railway-Edge. CF-Connecting-IP is
 * accepted only when that authenticated X-Real-IP belongs to Cloudflare.
 * X-Forwarded-For is intentionally never read.
 */
export function resolveClientIp(input: ClientIpInput): string {
  const remote = asSingleValidIp(input.remoteAddress) ?? '0.0.0.0';
  if (
    remote === '0.0.0.0' ||
    !blockListContains(TRUSTED_RAILWAY_HOPS, remote) ||
    !isRailwayEdgeHeader(input.railwayEdge)
  ) {
    return remote;
  }

  const railwayClient = asSingleValidIp(input.xRealIp);
  if (!railwayClient) {
    return remote;
  }

  if (blockListContains(CLOUDFLARE_PROXY_RANGES, railwayClient)) {
    return asSingleValidIp(input.cfConnectingIp) ?? railwayClient;
  }

  return railwayClient;
}

export function getClientIp(socket: Socket): string {
  return resolveClientIp({
    remoteAddress: socket.handshake.address || socket.conn.remoteAddress,
    railwayEdge: socket.handshake.headers['x-railway-edge'],
    xRealIp: socket.handshake.headers['x-real-ip'],
    cfConnectingIp: socket.handshake.headers['cf-connecting-ip'],
  });
}

export function getHttpClientIp(req: Request): string {
  return resolveClientIp({
    remoteAddress: req.socket.remoteAddress,
    railwayEdge: req.headers['x-railway-edge'],
    xRealIp: req.headers['x-real-ip'],
    cfConnectingIp: req.headers['cf-connecting-ip'],
  });
}
