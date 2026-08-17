import type { AuthError } from '@wanasatna/shared';
import { AUTH_COPY } from './copy';

export function presentAuthError(error: AuthError | null | undefined): string {
  if (!error) {
    return AUTH_COPY.genericError;
  }

  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return AUTH_COPY.invalidCredentials;
    case 'EMAIL_TAKEN':
      return AUTH_COPY.emailTaken;
    case 'RATE_LIMITED':
      return AUTH_COPY.rateLimited;
    case 'VALIDATION_ERROR':
      return /[\u0600-\u06FF]/.test(error.message) ? error.message : AUTH_COPY.invalidInput;
    case 'INTERNAL_ERROR':
      return error.message === AUTH_COPY.connectionFailed
        ? AUTH_COPY.connectionFailed
        : AUTH_COPY.genericError;
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return AUTH_COPY.genericError;
    default:
      return AUTH_COPY.genericError;
  }
}
