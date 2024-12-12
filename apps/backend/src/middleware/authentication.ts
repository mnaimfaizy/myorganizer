import * as express from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { decodeToken } from '../helpers/jwtHelper';
import userService from '../services/UserService';

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[]
): Promise<any> {
  if (securityName === 'jwt') {
    if (!request.headers.authorization) {
      const token = request.body.token;

      return new Promise((resolve, reject) => {
        if (token) {
          const decoded = decodeToken(
            token,
            process.env.ACCESS_JWT_SECRET as string
          ) as JwtPayload;

          if (decoded instanceof Error) {
            reject(decoded);
          }

          const user = userService.getById(decoded.userId);

          if (!user) {
            reject('User not found');
          }

          request.headers.authorization = `Bearer ${token}`;
          resolve(token);
        } else {
          reject('No token provided');
        }
      });
    }
  }
}
