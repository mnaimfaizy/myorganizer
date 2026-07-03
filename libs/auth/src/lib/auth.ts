import type { AxiosInstance } from 'axios';

import { AuthenticationApi } from '@myorganizer/app-api-client';

import {
  createAuthSessionModule,
  type AuthSessionModule,
} from './auth-session-module';
import type { AuthSessionStorageAdapter } from './auth-session-storage-adapter';
import { createBrowserAuthSessionStorageAdapter } from './auth-session-storage-adapter';
import { createAuthSessionTransportAdapter } from './auth-session-transport-adapter';
import type { AuthOperationResult, AuthUser } from './auth-session-types';

export type { AuthUser } from './auth-session-types';
export type ResetPasswordResponse = {
  message: string;
  status: number;
};

export type AuthSession = {
  token: string;
  expiresIn: number;
  user: AuthUser;
};

const defaultStorage = createBrowserAuthSessionStorageAdapter();
const defaultTransport = createAuthSessionTransportAdapter(defaultStorage);

export const authSession: AuthSessionModule = createAuthSessionModule({
  storage: defaultStorage,
  transport: defaultTransport,
});

export function getAccessToken(): string | undefined {
  return defaultStorage.getAccessToken();
}

export function setAccessToken(
  token: string | null,
  mode?: 'local' | 'session',
) {
  defaultStorage.setAccessToken(token, mode);
}

export function getCurrentUser(): AuthUser | undefined {
  return defaultStorage.getCurrentUser();
}

export function setCurrentUser(user: AuthUser | null) {
  defaultStorage.setCurrentUser(user);
}

export function clearAuthSession() {
  defaultStorage.clearSession();
}

export function getAuthAxios(): AxiosInstance {
  return defaultTransport.getAuthAxios();
}

export function getAuthApi(): AuthenticationApi {
  return defaultTransport.getAuthApi();
}

function unwrapAuthResult<T>(result: AuthOperationResult<T>): T {
  if ('error' in result) {
    throw new Error(result.error.message);
  }

  return result.value;
}

export async function login(args: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthSession> {
  const result = await authSession.signIn(args);
  return unwrapAuthResult(result);
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ message: string }> {
  const result = await authSession.resendVerificationEmail(email);
  return unwrapAuthResult(result);
}

export async function refresh(): Promise<AuthSession> {
  const result = await authSession.refreshAccessToken();
  return unwrapAuthResult(result);
}

export async function register(args: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<{ message: string; user?: AuthUser }> {
  const result = await authSession.signUp(args);
  return unwrapAuthResult(result);
}

export async function logout(): Promise<void> {
  await authSession.signOut();
}

export async function requestPasswordReset(args: {
  email: string;
}): Promise<ResetPasswordResponse> {
  const result = await authSession.requestPasswordReset(args);
  return unwrapAuthResult(result);
}

export async function confirmPasswordReset(args: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<ResetPasswordResponse> {
  const result = await authSession.confirmPasswordReset(args);
  return unwrapAuthResult(result);
}

export { createBrowserAuthSessionStorageAdapter };
export type { AuthSessionStorageAdapter };
