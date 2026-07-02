import type { AuthSessionModule } from './auth-session-module';
import type {
  InboundGuardOutcome,
  OutboundGuardOutcome,
} from './auth-session-types';

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
  return restored.kind === 'authenticated'
    ? { kind: 'redirect_dashboard' }
    : { kind: 'show_guest' };
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
  return restored.kind === 'authenticated'
    ? { kind: 'allow' }
    : { kind: 'redirect_login' };
}
