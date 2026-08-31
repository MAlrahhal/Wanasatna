'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AdminMfaVerifyInput,
  AuthActionResponse,
  AuthLoginData,
  AuthSessionData,
  PublicUser,
} from '@wanasatna/shared';
import {
  fetchAuthMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  verifyAdminMfa,
} from '@/lib/auth/api';
import { refreshIdleRoomSocketForAccountAuth } from '@/lib/auth/refresh-idle-socket';

type AuthStatus = 'loading' | 'ready';

type AuthContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<AuthActionResponse<AuthLoginData>>;
  verifyAdminMfa: (input: AdminMfaVerifyInput) => Promise<AuthActionResponse<AuthSessionData>>;
  register: (input: {
    email: string;
    password: string;
    preferredDisplayName: string;
  }) => Promise<AuthActionResponse<AuthSessionData>>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchAuthMe()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatus('ready');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginAccount({ email, password });
    if (result.success && 'user' in result.data) {
      setUser(result.data.user);
      setStatus('ready');
      refreshIdleRoomSocketForAccountAuth();
    }
    return result;
  }, []);

  const confirmAdminMfa = useCallback(async (input: AdminMfaVerifyInput) => {
    const result = await verifyAdminMfa(input);
    if (result.success) {
      setUser(result.data.user);
      setStatus('ready');
      refreshIdleRoomSocketForAccountAuth();
    }
    return result;
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; preferredDisplayName: string }) => {
      const result = await registerAccount(input);
      if (result.success) {
        setUser(result.data.user);
        setStatus('ready');
        refreshIdleRoomSocketForAccountAuth();
      }
      return result;
    },
    [],
  );

  const logout = useCallback(async () => {
    // Account cookie only — do not Leave, clear Room session, or drop reconnect claims.
    await logoutAccount();
    setUser(null);
    setStatus('ready');
    refreshIdleRoomSocketForAccountAuth();
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      verifyAdminMfa: confirmAdminMfa,
      register,
      logout,
    }),
    [status, user, login, confirmAdminMfa, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
