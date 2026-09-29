'use client';

import { formatMoney } from '@myorganizer/core';
import {
  calculateMonthlyEquivalents,
  SubscriptionStatusEnum,
  type CurrencyCode,
} from '@myorganizer/vault-core';
import {
  normalizeSubscriptions,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { useLocalVaultRevision } from '@myorganizer/web-vault-ui';
import { CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

interface SubscriptionsOverviewCardProps {
  handle: VaultHandle | null;
}

export function SubscriptionsOverviewCard({
  handle,
}: SubscriptionsOverviewCardProps) {
  return (
    <VaultStatCard
      handle={handle}
      icon={<CreditCard className="h-4 w-4" />}
      title="Subscriptions"
    >
      {(h) => <SubscriptionsContent handle={h} />}
    </VaultStatCard>
  );
}

type Summary = {
  active: number;
  total: number;
  monthlyEquivalents: Array<{ currency: CurrencyCode; amount: number }>;
};

interface SubscriptionsContentProps {
  handle: VaultHandle;
}

function SubscriptionsContent({ handle }: SubscriptionsContentProps) {
  const [summary, setSummary] = useState<Summary | null>(null);

  // Read-only, so there is no overwrite to prevent here — but a dashboard
  // still showing the count from before convergence is the same staleness
  // wearing a quieter face (#587).
  const revision = useLocalVaultRevision();

  useEffect(() => {
    // Cancellation matters now that this effect re-fires on every convergence:
    // without it, an earlier read resolving late can put a stale count back
    // over the one a later read just applied.
    let isActive = true;

    handle
      .loadDecryptedData<unknown>({
        type: 'subscriptions',
        defaultValue: [],
      })
      .then((raw) => {
        if (!isActive) return;
        const { value } = normalizeSubscriptions(raw);
        const activeCount = value.filter(
          (s) => s.status === SubscriptionStatusEnum.Active,
        ).length;

        setSummary({
          active: activeCount,
          total: value.length,
          monthlyEquivalents: calculateMonthlyEquivalents(value),
        });
      })
      .catch(() => {
        if (isActive)
          setSummary({ active: 0, total: 0, monthlyEquivalents: [] });
      });

    return () => {
      isActive = false;
    };
  }, [handle, revision]);

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <p className="text-2xl font-bold">{summary.active}</p>
      <p className="text-xs text-muted-foreground">
        active of {summary.total} total
      </p>
      {summary.monthlyEquivalents.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {summary.monthlyEquivalents.map(({ currency, amount }) => (
            <p key={currency} className="text-xs text-muted-foreground">
              {formatMoney({ amount, currency })} / mo
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
