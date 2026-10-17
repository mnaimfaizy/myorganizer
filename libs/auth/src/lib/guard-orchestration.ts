import type { AuthSessionModule } from './auth-session-module';
import type {
  InboundGuardOutcome,
  OutboundGuardOutcome,
  RestoreSessionOutcome,
} from './auth-session-types';

type RestoreKind = RestoreSessionOutcome['kind'];

const INBOUND_AFTER_RESTORE = {
  authenticated: { kind: 'redirect_dashboard' },
  session_cleared: { kind: 'show_guest' },
  not_restored: { kind: 'restore_unavailable' },
} as const satisfies Record<RestoreKind, InboundGuardOutcome>;

const OUTBOUND_AFTER_RESTORE = {
  authenticated: { kind: 'allow' },
  session_cleared: { kind: 'redirect_login' },
  not_restored: { kind: 'restore_unavailable' },
} as const satisfies Record<RestoreKind, OutboundGuardOutcome>;

export async function resolveInboundGuard(
  session: AuthSessionModule,
): Promise<InboundGuardOutcome> {
  const snapshot = session.getSnapshot();

  if (snapshot.status === 'authenticated') {
    return { kind: 'redirect_dashboard' };
  }

  if (snapshot.status === 'guest') {
    return { kind: 'show_guest' };
  }

  const restored = await session.restoreSession();
  return INBOUND_AFTER_RESTORE[restored.kind];
}

export async function resolveOutboundGuard(
  session: AuthSessionModule,
): Promise<OutboundGuardOutcome> {
  const snapshot = session.getSnapshot();

  if (snapshot.status === 'authenticated') {
    return { kind: 'allow' };
  }

  if (snapshot.status === 'guest') {
    return { kind: 'redirect_login' };
  }

  const restored = await session.restoreSession();
  return OUTBOUND_AFTER_RESTORE[restored.kind];
}
