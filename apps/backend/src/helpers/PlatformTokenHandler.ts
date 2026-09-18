import {
  resolveAuthClientType,
  shouldIncludeRefreshTokenInLoginBody,
} from '@myorganizer/auth';
import { User } from '../models/User';
import { FilteredUserInterface, UserInterface } from '../types';
import apiTokens from './ApiTokens';
import filterUser from './filterUser';
import { ACCESS_TOKEN_EXPIRES_IN_MS } from './tokenLifetimes';

export type LoginResponseBody = {
  token: string;
  expires_in: number;
  user: FilteredUserInterface;
  refresh_token?: string;
};

export type IssuedLoginSession = {
  body: LoginResponseBody;
  refreshToken: string;
};

export class PlatformTokenHandler {
  static issueLoginSession(
    user: User,
    clientType?: string,
  ): IssuedLoginSession {
    const { token, refreshToken } = apiTokens.createTokens(user);

    if (token instanceof Error || refreshToken instanceof Error) {
      throw new Error('Failed to create auth tokens');
    }

    const filteredUser = filterUser(user as UserInterface);
    const authClientType = resolveAuthClientType(clientType);

    const body: LoginResponseBody = {
      token,
      expires_in: ACCESS_TOKEN_EXPIRES_IN_MS,
      user: filteredUser,
    };

    if (shouldIncludeRefreshTokenInLoginBody(authClientType)) {
      body.refresh_token = refreshToken;
    }

    return { body, refreshToken };
  }
}

export default PlatformTokenHandler;
