import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { mockRequest } from '@/src/mocks/handlers';
import { normalizeApiParams } from './mappers';

// Lazy accessor prevents top-level circular dependency with auth-store
const getAuthStore = () => require('@/src/store/auth-store').useAuthStore;

const USE_MOCK =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? process.env.USE_MOCK ?? 'false').toLowerCase() ===
  'true';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthStore().getState().tokens?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<boolean> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing ??= getAuthStore()
        .getState()
        .refreshSession()
        .then(() => true)
        .catch(() => false)
        .finally(() => {
          refreshing = null;
        });
      const ok = await refreshing;
      if (ok) return apiClient(original);
      await getAuthStore().getState().logout();
    }
    return Promise.reject(error);
  },
);

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  data?: unknown;
  params?: Record<string, unknown>;
};

export async function apiRequest<T>({
  method = 'GET',
  path,
  data,
  params,
}: ApiRequestOptions): Promise<T> {
  if (USE_MOCK) {
    try {
      return await mockRequest<T>(method, path, data, params);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      throw Object.assign(new Error(e.message || 'Request failed'), {
        status: e.status || 500,
        isApiError: true,
      });
    }
  }

  try {
    const res = await apiClient.request<T>({
      method,
      url: path,
      data,
      params: normalizeApiParams(params),
    });
    return res.data;
  } catch (err) {
    const ax = err as AxiosError<{ message?: string | string[] }>;
    const raw = ax.response?.data?.message;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : raw || ax.message || 'Request failed';
    throw Object.assign(new Error(message), {
      status: ax.response?.status || 500,
      isApiError: true,
    });
  }
}

export function isMockMode() {
  return USE_MOCK;
}

export { normalizeApiParams };
