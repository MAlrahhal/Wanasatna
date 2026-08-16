import type { Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'wanasatna_sid';

function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production';
}

function cookieSameSite(): 'Lax' | 'None' {
  return cookieSecure() ? 'None' : 'Lax';
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function readAuthCookie(req: Request): string | undefined {
  const token = parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME];
  return token && token.length > 0 ? token : undefined;
}

export function setAuthCookie(res: Response, token: string, expiresAt: Date): void {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    `SameSite=${cookieSameSite()}`,
  ];

  if (cookieSecure()) {
    parts.push('Secure');
  }

  res.append('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(res: Response): void {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    `SameSite=${cookieSameSite()}`,
  ];

  if (cookieSecure()) {
    parts.push('Secure');
  }

  res.append('Set-Cookie', parts.join('; '));
}
