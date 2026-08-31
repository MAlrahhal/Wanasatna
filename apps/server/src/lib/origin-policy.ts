import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { IncomingMessage } from 'node:http';

export type OriginPolicy = Readonly<{
  nodeEnv: string;
  clientOrigin: string;
}>;

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function canonicalHttpOrigin(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function isRequestOriginAllowed(
  origin: string | string[] | undefined,
  policy: OriginPolicy,
): boolean {
  if (policy.nodeEnv !== 'production') {
    return true;
  }

  const trustedOrigin = canonicalHttpOrigin(policy.clientOrigin);
  const requestOrigin = canonicalHttpOrigin(origin);
  return trustedOrigin !== null && requestOrigin === trustedOrigin;
}

export function createRequireTrustedMutationOrigin(policy: OriginPolicy): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (
      !STATE_CHANGING_METHODS.has(req.method.toUpperCase()) ||
      isRequestOriginAllowed(req.headers.origin, policy)
    ) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'الطلب غير مسموح.' },
    });
  };
}

type SocketAllowRequestCallback = (error: string | null | undefined, success: boolean) => void;

export function createSocketOriginAllowRequest(policy: OriginPolicy) {
  return (request: IncomingMessage, callback: SocketAllowRequestCallback): void => {
    callback(null, isRequestOriginAllowed(request.headers.origin, policy));
  };
}
