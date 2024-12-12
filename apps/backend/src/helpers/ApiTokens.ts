import dotenv from 'dotenv';
import { generateToken } from '../helpers/jwtHelper';
import { User } from '../models/User';
import { LoginTokensInterface } from '../types';
dotenv.config();

class ApiTokens {
  public generatePasswordResetToken(userId: string): string | Error {
    const token: string | Error = generateToken(
      { userId: userId },
      process.env.RESET_JWT_SECRET,
      '10m'
    );

    return token;
  }

  public generateEmailVerificationToken(userId: string): string | Error {
    const token: string | Error = generateToken(
      { userId: userId },
      process.env.VERIFY_JWT_SECRET,
      '10m'
    );

    return token;
  }

  public createTokens = (user: User): LoginTokensInterface => {
    const token: string | Error = generateToken(
      { userId: user.id },
      process.env.ACCESS_JWT_SECRET,
      '10m'
    );
    const refreshToken: string | Error = generateToken(
      { userId: user.id },
      process.env.REFRESH_JWT_SECRET,
      '7d'
    );

    return {
      token: token,
      refreshToken: refreshToken,
    };
  };
}

const apiTokens = new ApiTokens();
export default apiTokens;
