import type { AdminUserIdentity } from '@myorganizer/app-api-client';

export function formatUserDisplayName(user: AdminUserIdentity): string {
  if (user.name.trim()) {
    return user.name;
  }

  const combined = `${user.firstName} ${user.lastName}`.trim();
  return combined || user.email;
}

export function formatUserRole(role: AdminUserIdentity['role']): string {
  if (role === 'platform_admin') {
    return 'Platform Admin';
  }

  return 'User';
}

export function formatBooleanLabel(value: boolean): string {
  return value ? 'Yes' : 'No';
}
