import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.store';

export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333/api' });

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

function redirectToLogin() {
  useAuthStore.getState().logout();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

async function refreshSession() {
  const currentRefreshToken = useAuthStore.getState().refreshToken;
  if (!currentRefreshToken) throw new Error('Refresh token não encontrado.');

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${import.meta.env.VITE_API_URL || 'http://localhost:3333/api'}/auth/refresh`, { refreshToken: currentRefreshToken })
      .then(response => {
        const tokens = response.data as { accessToken: string; refreshToken: string };
        useAuthStore.setState({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        return tokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

http.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  config.headers = AxiosHeaders.from(config.headers);
  if (state.accessToken) config.headers.Authorization = `Bearer ${state.accessToken}`;
  if (state.organization?.id) config.headers['x-organization-id'] = state.organization.id;
  return config;
});

http.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;
    const url = originalRequest?.url || '';

    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      try {
        const tokens = await refreshSession();
        originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return http(originalRequest);
      } catch {
        redirectToLogin();
      }
    }

    if (status === 401 && !url.includes('/auth/login')) {
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);
