export const USER_ROLES = ['USER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type PublicUser = {
  id: string;
  email: string;
  preferredDisplayName: string;
  role: UserRole;
};

export type AuthErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type AuthError = {
  code: AuthErrorCode;
  message: string;
};

export type AuthSuccessResponse<T> = {
  success: true;
  data: T;
};

export type AuthErrorResponse = {
  success: false;
  error: AuthError;
};

export type AuthActionResponse<T> = AuthSuccessResponse<T> | AuthErrorResponse;

export type AuthSessionData = {
  user: PublicUser;
};

export type AuthMeData = {
  user: PublicUser | null;
};
