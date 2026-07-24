import type { AuthUser } from '@myorganizer/auth';

export function isPlatformAdmin(user: AuthUser | undefined | null): boolean {
  return user?.role === 'platform_admin';
}
