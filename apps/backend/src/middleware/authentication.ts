import * as express from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { decodeToken } from '../helpers/jwtHelper';
import userService from '../services/UserService';

function unauthorized(message = 'Unauthorized') {
  const err = new Error(message) as Error & { status?: number };
  err.status = 401;
  return err;
}

function getBearerToken(request: express.Request): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return undefined;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function authenticateCronSecret(request: express.Request): Promise<void> {
  const secret = request.headers['x-cron-secret'];
  const expectedSecret = process.env.YOUTUBE_CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return Promise.reject(unauthorized());
  }

  return Promise.resolve();
}

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[],
): Promise<any> {
  if (securityName === 'cron-secret') {
    return authenticateCronSecret(request);
  }

  if (securityName !== 'jwt') {
    return Promise.reject(unauthorized('Unsupported security scheme'));
  }

  return (async () => {
    const tokenFromHeader = getBearerToken(request);

    // Fallback: allow passing `token` in body for legacy clients.
    // Header remains the primary/expected mechanism.
    const tokenFromBody =
      !tokenFromHeader &&
      request.body &&
      typeof (request.body as any).token === 'string'
        ? ((request.body as any).token as string)
        : undefined;

    const token = tokenFromHeader ?? tokenFromBody;
    if (!token) {
      throw unauthorized();
    }

    const decoded = decodeToken(token, process.env.ACCESS_JWT_SECRET as string);

    if (!decoded || decoded instanceof Error) {
      throw unauthorized();
    }

    const payload = decoded as JwtPayload;
    if (!payload.userId) {
      throw unauthorized();
    }

    const user = await userService.getById(payload.userId);
    if (!user) {
      throw unauthorized();
    }

    // Ensure downstream authZ can consistently rely on request.user.
    (request as any).user = user;

    // If the token came from body fallback, normalize auth header for any other middleware.
    if (!request.headers.authorization) {
      request.headers.authorization = `Bearer ${token}`;
    }

    return user;
  })().catch((err: unknown) => {
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      (err as { status?: unknown }).status === 401
    ) {
      throw err;
    }

    throw unauthorized();
  });
}
