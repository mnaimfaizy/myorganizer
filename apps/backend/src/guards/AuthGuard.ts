import { Request as ExRequest } from 'express';
import { UserInterface, UserRole } from '../types';

export class UnauthorizedError extends Error {
  status = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  status = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function getAuthenticatedUser(req: ExRequest): UserInterface {
  const user = req.user as UserInterface | undefined;
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export function requireUserId(req: ExRequest): string {
  const user = getAuthenticatedUser(req);
  if (!user.id) {
    throw new UnauthorizedError();
  }
  return user.id;
}

export function isPlatformAdmin(
  user: UserInterface | { role?: UserRole },
): boolean {
  return user.role === 'platform_admin';
}

export function requirePlatformAdmin(req: ExRequest): UserInterface {
  const user = getAuthenticatedUser(req);
  if (!isPlatformAdmin(user)) {
    throw new ForbiddenError('Platform Admin role required');
  }
  if (user.disabled) {
    throw new UnauthorizedError('Account disabled');
  }
  return user;
}
