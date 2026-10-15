import type { AuthUser } from '@myorganiser/auth';

export function isPlatformAdmin(user: AuthUser | undefined | null): boolean {
  return user?.role === 'platform_admin';
}
