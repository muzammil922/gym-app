import { create } from 'zustand';
import type { AuthTokens, LoginPayload, OtpVerifyPayload, User } from '@/src/api/types';
import { apiRequest } from '@/src/api/client';
import { mapAuthSession, mapAuthTokensOnly } from '@/src/api/mappers';
import {
  clearSessionUser,
  clearTokens,
  loadSessionUser,
  loadTokens,
  saveSessionUser,
  saveTokens,
} from '@/src/utils/storage';

type AuthState = {
  user: User | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  /** True after an OTP login on an account with no password set yet. */
  needsPassword: boolean;
  clearNeedsPassword: () => void;
  hydrate: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  verifyOtp: (payload: OtpVerifyPayload) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ demoOtp?: string }>;
  setPassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  setSession: (user: User, tokens: AuthTokens) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  hydrated: false,
  isAuthenticated: false,
  needsPassword: false,

  clearNeedsPassword: () => set({ needsPassword: false }),

  setSession: async (user, tokens) => {
    await saveTokens(JSON.stringify(tokens));
    await saveSessionUser(JSON.stringify(user));
    set({ user, tokens, isAuthenticated: true });
  },

  hydrate: async () => {
    try {
      const [tokenJson, userJson] = await Promise.all([loadTokens(), loadSessionUser()]);
      if (tokenJson && userJson) {
        const tokens = JSON.parse(tokenJson) as AuthTokens;
        const user = JSON.parse(userJson) as User;
        set({ tokens, user, isAuthenticated: true, hydrated: true });
        if (tokens.expiresAt < Date.now() + 60_000) {
          await get().refreshSession().catch(() => get().logout());
        }
        return;
      }
    } catch {
      // ignore corrupt storage
    }
    set({ hydrated: true, isAuthenticated: false, user: null, tokens: null });
  },

  login: async (payload) => {
    const raw = await apiRequest<{
      user?: User;
      tokens?: AuthTokens;
      accessToken?: string;
      refreshToken?: string;
    }>({
      method: 'POST',
      path: '/auth/login',
      data: payload,
    });
    if (raw.user && raw.tokens) {
      await get().setSession(raw.user, raw.tokens);
      return;
    }
    const session = mapAuthSession(
      raw as { accessToken: string; refreshToken: string; user?: Record<string, unknown> },
    );
    await get().setSession(session.user, session.tokens);
  },

  requestOtp: async (phone) => {
    return apiRequest<{ ok: boolean; demoOtp?: string }>({
      method: 'POST',
      path: '/auth/otp/request',
      data: { phone },
    });
  },

  verifyOtp: async (payload) => {
    const raw = await apiRequest<{
      user?: User;
      tokens?: AuthTokens;
      accessToken?: string;
      refreshToken?: string;
      needsPassword?: boolean;
    }>({
      method: 'POST',
      path: '/auth/otp/verify',
      data: payload,
    });
    if (raw.user && raw.tokens) {
      await get().setSession(raw.user, raw.tokens);
      set({ needsPassword: !!raw.needsPassword });
      return;
    }
    const session = mapAuthSession(
      raw as {
        accessToken: string;
        refreshToken: string;
        user?: Record<string, unknown>;
        needsPassword?: boolean;
      },
    );
    await get().setSession(session.user, session.tokens);
    set({ needsPassword: !!session.needsPassword });
  },

  setPassword: async (newPassword) => {
    await apiRequest({
      method: 'POST',
      path: '/auth/password',
      data: { newPassword, userId: get().user?.id },
    });
    set({ needsPassword: false });
  },

  refreshSession: async () => {
    const refreshToken = get().tokens?.refreshToken;
    if (!refreshToken) throw new Error('No refresh token');
    const raw = await apiRequest<{
      user?: User;
      tokens?: AuthTokens;
      accessToken?: string;
      refreshToken?: string;
    }>({
      method: 'POST',
      path: '/auth/refresh',
      data: { refreshToken },
    });
    if (raw.user && raw.tokens) {
      await get().setSession(raw.user, raw.tokens);
      return;
    }
    if (raw.accessToken && raw.refreshToken) {
      const tokens = mapAuthTokensOnly(
        { accessToken: raw.accessToken, refreshToken: raw.refreshToken },
        get().tokens,
      );
      const user = get().user;
      if (!user) throw new Error('No user in session');
      await get().setSession(user, tokens);
      return;
    }
    const session = mapAuthSession(
      raw as { accessToken: string; refreshToken: string; user?: Record<string, unknown> },
      get().user,
    );
    await get().setSession(session.user, session.tokens);
  },

  logout: async () => {
    try {
      await apiRequest({ method: 'POST', path: '/auth/logout' });
    } catch {
      // ignore
    }
    await clearTokens();
    await clearSessionUser();
    set({ user: null, tokens: null, isAuthenticated: false, needsPassword: false });
  },
}));
