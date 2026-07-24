import { describe, expect, test } from '@jest/globals';

import filterUser, { toAdminUserIdentity } from './filterUser';
import type { UserInterface } from '../types';

function makeUser(overrides: Partial<UserInterface> = {}): UserInterface {
  return {
    id: 'u1',
    name: 'Alice Example',
    email: 'alice@example.com',
    password: 'hashed',
    password_reset_token: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    first_name: 'Alice',
    last_name: 'Example',
    ...overrides,
  };
}

describe('filterUser', () => {
  test('includes role and disabled with defaults when missing', () => {
    const result = filterUser(makeUser());

    expect(result.role).toBe('user');
    expect(result.disabled).toBe(false);
  });

  test('preserves platform_admin role and disabled flag', () => {
    const result = filterUser(
      makeUser({ role: 'platform_admin', disabled: true } as UserInterface),
    );

    expect(result.role).toBe('platform_admin');
    expect(result.disabled).toBe(true);
  });
});

describe('toAdminUserIdentity', () => {
  test('maps snake_case fields and emailVerified from email_verification_timestamp', () => {
    const result = toAdminUserIdentity({
      id: 'u1',
      name: 'Alice Example',
      first_name: 'Alice',
      last_name: 'Example',
      email: 'alice@example.com',
      phone: null,
      role: 'user',
      disabled: false,
      email_verification_timestamp: new Date('2024-01-01'),
    });

    expect(result).toEqual({
      id: 'u1',
      name: 'Alice Example',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Example',
      phone: undefined,
      role: 'user',
      disabled: false,
      emailVerified: true,
    });
  });

  test('emailVerified is false when email_verification_timestamp is absent', () => {
    const result = toAdminUserIdentity({
      id: 'u2',
      name: 'Bob',
      first_name: 'Bob',
      last_name: 'User',
      email: 'bob@example.com',
    });

    expect(result.emailVerified).toBe(false);
  });
});
