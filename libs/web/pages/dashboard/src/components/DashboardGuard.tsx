'use client';

import {
  authSession,
  onSessionEnded,
  type OutboundGuardOutcome,
  resolveOutboundGuard,
} from '@myorganiser/auth';
import { type GateDecision, RetryableGate } from '@myorganiser/web-ui';
import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';

interface DashboardGuardProps {
  children: ReactNode;
}

// One table over the outcome kinds (ADR 0053), not an if-chain.
const outcomeDecision = {
  allow: { kind: 'allow' },
  redirect_login: { kind: 'redirect', to: '/login' },
  restore_unavailable: { kind: 'unavailable' },
} as const satisfies Record<OutboundGuardOutcome['kind'], GateDecision>;

async function checkOutbound(): Promise<GateDecision> {
  const outcome = await resolveOutboundGuard(authSession);
  return outcomeDecision[outcome.kind];
}

export default function DashboardGuard(props: DashboardGuardProps) {
  const router = useRouter();

  return (
    <RetryableGate
      check={checkOutbound}
      navigate={router.replace}
      subscribeToEnd={onSessionEnded}
      endedRedirect="/login"
    >
      {props.children}
    </RetryableGate>
  );
}
