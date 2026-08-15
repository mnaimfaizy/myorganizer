import { generateToken } from '../helpers/jwtHelper';
import { User } from '../models/User';
import { LoginTokensInterface } from '../types';

import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  RESET_TOKEN_TTL,
  VERIFY_TOKEN_TTL,
} from './tokenLifetimes';

class ApiTokens {
  public generatePasswordResetToken(userId: string): string | Error {
    const token: string | Error = generateToken(
      { userId: userId },
      process.env.RESET_JWT_SECRET,
      RESET_TOKEN_TTL,
    );

    return token;
  }

  public generateEmailVerificationToken(userId: string): string | Error {
    const token: string | Error = generateToken(
      { userId: userId },
      process.env.VERIFY_JWT_SECRET,
      VERIFY_TOKEN_TTL,
    );

    return token;
  }

  public createTokens = (user: User): LoginTokensInterface => {
    const token: string | Error = generateToken(
      { userId: user.id },
      process.env.ACCESS_JWT_SECRET,
      ACCESS_TOKEN_TTL,
    );
    const refreshToken: string | Error = generateToken(
      { userId: user.id },
      process.env.REFRESH_JWT_SECRET,
      REFRESH_TOKEN_TTL,
    );

    return {
      token: token,
      refreshToken: refreshToken,
    };
  };
}

const apiTokens = new ApiTokens();
export default apiTokens;
