import type { AdminAuditAction } from '@myorganizer/app-api-client';

const AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  disable: 'Disable',
  enable: 'Enable',
  force_logout: 'Force logout',
  resend_verification: 'Resend verification',
  promote: 'Promote',
  demote: 'Demote',
  youtube_access_grant: 'Grant YouTube Access',
  youtube_access_withdraw: 'Withdraw YouTube Access',
};

export function formatAuditAction(action: AdminAuditAction): string {
  return AUDIT_ACTION_LABELS[action];
}

export function formatAuditTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}
