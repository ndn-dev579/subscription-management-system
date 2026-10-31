/**
 * AuthContext — JWT-backed authentication.
 *
 * Replaces the mock login/signup in StoreProvider.
 * The Guard component in App.tsx and all pages that need `me` should
 * switch from `useStore().me` to `useAuth().me`.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, tokenStorage } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'customer';
  company?: string;
}

interface AuthState {
  me: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: {
    name: string;
    email: string;
    password: string;
    company?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to restore session from stored tokens
  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .getMe()
      .then(({ data }) => setMe(data))
      .catch(() => {
        tokenStorage.clear();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });
    tokenStorage.setAccess(data.access);
    tokenStorage.setRefresh(data.refresh);
    const { data: user } = await authApi.getMe();
    setMe(user);
  }, []);

  const signup = useCallback(
    async (payload: { name: string; email: string; password: string; company?: string }) => {
      await authApi.register(payload);
      const { data } = await authApi.login({ email: payload.email, password: payload.password });
      tokenStorage.setAccess(data.access);
      tokenStorage.setRefresh(data.refresh);
      const { data: user } = await authApi.getMe();
      setMe(user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore backend errors on logout
    }
    tokenStorage.clear();
    setMe(null);
  }, []);

  const requestReset = useCallback(async (email: string) => {
    await authApi.requestPasswordReset(email);
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    await authApi.confirmPasswordReset({ token, password });
  }, []);

  return (
    <AuthContext.Provider
      value={{ me, isLoading, login, signup, logout, requestReset, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
