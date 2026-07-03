import { Request as ExRequest } from 'express';
import { UserInterface } from '../types';

export class UnauthorizedError extends Error {
  status = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
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
