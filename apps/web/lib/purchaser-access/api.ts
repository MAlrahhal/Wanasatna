import type {
  AuthActionResponse,
  AuthSessionData,
  PurchaserOtpRequestData,
  PurchaserOtpVerifyInput,
} from '@wanasatna/shared';
import { getServerUrl } from '@/lib/config/server-url';
import { PURCHASER_ACCESS_COPY } from './copy';

function purchaserAccessUrl(path: string): string {
  return `${getServerUrl()}/api/auth/purchaser${path}`;
}

function connectionFailure<T>(): AuthActionResponse<T> {
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: PURCHASER_ACCESS_COPY.connectionFailed,
    },
  };
}

async function parseResponse<T>(response: Response): Promise<AuthActionResponse<T>> {
  try {
    const body = (await response.json()) as AuthActionResponse<T>;
    if (body && typeof body === 'object' && 'success' in body) {
      return body;
    }
  } catch {
    // Fall through to the safe connection error.
  }
  return connectionFailure<T>();
}

export async function requestPurchaserOtpCode(
  email: string,
): Promise<AuthActionResponse<PurchaserOtpRequestData>> {
  try {
    const response = await fetch(purchaserAccessUrl('/request-code'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return parseResponse<PurchaserOtpRequestData>(response);
  } catch {
    return connectionFailure();
  }
}

export async function verifyPurchaserOtpCode(
  input: PurchaserOtpVerifyInput,
): Promise<AuthActionResponse<AuthSessionData>> {
  try {
    const response = await fetch(purchaserAccessUrl('/verify-code'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseResponse<AuthSessionData>(response);
  } catch {
    return connectionFailure();
  }
}
