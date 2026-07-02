import {
  resolveAuthClientType,
  shouldIncludeRefreshTokenInLoginBody,
} from '@myorganizer/auth';
import { User } from '../models/User';
import { FilteredUserInterface, UserInterface } from '../types';
import apiTokens from './ApiTokens';
import filterUser from './filterUser';

const ACCESS_TOKEN_EXPIRES_IN_MS = 600_000;

export type LoginResponseBody = {
  token: string;
  expires_in: number;
  user: FilteredUserInterface;
  refresh_token?: string;
};

export class PlatformTokenHandler {
  static buildLoginResponse(
    user: User,
    clientType?: string,
  ): LoginResponseBody {
    const { token, refreshToken } = apiTokens.createTokens(user);

    if (token instanceof Error) {
      throw new Error('Failed to create access token');
    }

    const filteredUser = filterUser(user as UserInterface);
    const authClientType = resolveAuthClientType(clientType);

    const response: LoginResponseBody = {
      token,
      expires_in: ACCESS_TOKEN_EXPIRES_IN_MS,
      user: filteredUser,
    };

    if (
      shouldIncludeRefreshTokenInLoginBody(authClientType) &&
      !(refreshToken instanceof Error)
    ) {
      response.refresh_token = refreshToken;
    }

    return response;
  }
}

export default PlatformTokenHandler;
