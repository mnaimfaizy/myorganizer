import axios, { type AxiosError, type AxiosInstance } from 'axios';
import {
  AuthenticationApi,
  Configuration,
  type FilteredUserInterface,
  type Login200Response,
} from '@myorganizer/app-api-client';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'myorganizer_access_token';
const USER_KEY = 'myorganizer_user';
const TOKEN_STORAGE_KEY = 'myorganizer_token_storage';

type TokenStorageMode = 'local' | 'session';

export type AuthUser = FilteredUserInterface;

export type AuthSession = {
  token: string;
  expiresIn: number;
  user: AuthUser;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function getApiBasePath(): string {
  const rawBaseUrl = process.env['NEXT_PUBLIC_API_BASE_URL'];

  if (!rawBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsed = new URL(rawBaseUrl);

    if (
      process.env['NODE_ENV'] === 'production' &&
      parsed.protocol !== 'https:'
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        'NEXT_PUBLIC_API_BASE_URL is not using HTTPS in production. ' +
          'This may expose sensitive data over an insecure connection:',
        rawBaseUrl
      );
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      'Invalid NEXT_PUBLIC_API_BASE_URL value. Falling back to default:',
      rawBaseUrl,
      '(default:',
      DEFAULT_API_BASE_URL + ')'
    );
    return DEFAULT_API_BASE_URL;
  }
}

function getPreferredTokenStorageMode(): TokenStorageMode {
  if (!isBrowser()) return 'local';
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return stored === 'session' ? 'session' : 'local';
}

function setPreferredTokenStorageMode(mode: TokenStorageMode) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, mode);
}

function getStorage(mode: TokenStorageMode): Storage | undefined {
  if (!isBrowser()) return undefined;
  return mode === 'session' ? window.sessionStorage : window.localStorage;
}

export function getAccessToken(): string | undefined {
  if (!isBrowser()) return undefined;

  const preferred = getPreferredTokenStorageMode();
  const preferredStorage = getStorage(preferred);
  const tokenFromPreferred = preferredStorage?.getItem(ACCESS_TOKEN_KEY) || '';
  if (tokenFromPreferred) return tokenFromPreferred;

  const tokenFromSession =
    window.sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
  if (tokenFromSession) return tokenFromSession;

  const tokenFromLocal = window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  if (tokenFromLocal) return tokenFromLocal;

  return undefined;
}

export function setAccessToken(
  token: string | null,
  mode: TokenStorageMode = getPreferredTokenStorageMode()
) {
  if (!isBrowser()) return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);

  if (!token) {
    return;
  }

  setPreferredTokenStorageMode(mode);
  const storage = getStorage(mode);
  storage?.setItem(ACCESS_TOKEN_KEY, token);
}

export function getCurrentUser(): AuthUser | undefined {
  if (!isBrowser()) return undefined;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return undefined;
  }
}

export function setCurrentUser(user: AuthUser | null) {
  if (!isBrowser()) return;
  if (!user) {
    window.localStorage.removeItem(USER_KEY);
    return;
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  setAccessToken(null);
  setCurrentUser(null);
}

function toSession(response: Login200Response): AuthSession {
  return {
    token: response.token,
    expiresIn: response.expires_in,
    user: response.user,
  };
}

let sharedAxios: AxiosInstance | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;

function isAuthUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/register')
  );
}

export function getAuthAxios(): AxiosInstance {
  if (sharedAxios) return sharedAxios;

  const baseURL = getApiBasePath();
  const instance = axios.create({
    baseURL,
    withCredentials: true,
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const originalRequest = error.config as
        | (typeof error.config & {
            _retry?: boolean;
          })
        | null;

      if (!originalRequest || status !== 401) {
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isAuthUrl(originalRequest.url)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        if (!refreshInFlight) {
          refreshInFlight = refresh();
        }
        await refreshInFlight;
        refreshInFlight = null;
        return instance(originalRequest);
      } catch (refreshErr) {
        refreshInFlight = null;
        clearAuthSession();
        return Promise.reject(refreshErr);
      }
    }
  );

  sharedAxios = instance;
  return instance;
}

export function getAuthApi(): AuthenticationApi {
  const configuration = new Configuration({
    basePath: getApiBasePath(),
    accessToken: () => getAccessToken() ?? '',
  });

  return new AuthenticationApi(configuration, undefined, getAuthAxios());
}

function extractMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return 'Unexpected error.';
  const data = err.response?.data as any;
  if (data?.message && typeof data.message === 'string') return data.message;
  return err.message || 'Request failed.';
}

export async function login(args: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthSession> {
  const api = getAuthApi();

  try {
    const res = await api.login({
      userLoginBody: {
        email: args.email,
        password: args.password,
      },
    });

    const session = toSession(res.data);
    setAccessToken(session.token, args.rememberMe ? 'local' : 'session');
    setCurrentUser(session.user);
    return session;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function refresh(): Promise<AuthSession> {
  const api = getAuthApi();
  try {
    const res = await api.refreshToken({});
    const session = toSession(res.data);
    setAccessToken(session.token);
    setCurrentUser(session.user);
    return session;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function register(args: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthUser> {
  const api = getAuthApi();
  try {
    const res = await api.registerUser({
      userCreationBody: {
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        password: args.password,
        ...(args.phone ? { phone: args.phone } : {}),
      },
    });
    return res.data;
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function logout(): Promise<void> {
  const api = getAuthApi();
  const user = getCurrentUser();
  if (!user?.id) {
    clearAuthSession();
    return;
  }

  try {
    await api.logout({ userId: user.id });
  } finally {
    clearAuthSession();
  }
}
