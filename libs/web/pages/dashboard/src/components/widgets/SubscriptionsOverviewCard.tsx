'use client';

import {
  SubscriptionStatusEnum,
  formatMoney,
  type CurrencyCode,
} from '@myorganizer/core';
import {
  loadDecryptedData,
  normalizeSubscriptions,
} from '@myorganizer/web-vault';
import { CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

export function SubscriptionsOverviewCard({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array | null;
}) {
  return (
    <VaultStatCard
      masterKeyBytes={masterKeyBytes}
      icon={<CreditCard className="h-4 w-4" />}
      title="Subscriptions"
    >
      {(mk) => <SubscriptionsContent masterKeyBytes={mk} />}
    </VaultStatCard>
  );
}

type Summary = {
  active: number;
  total: number;
  monthlyCosts: Array<{ currency: CurrencyCode; amount: number }>;
};

const MONTHLY_MULTIPLIERS: Record<string, number> = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  twoYears: 1 / 24,
  threeYears: 1 / 36,
};

function SubscriptionsContent({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'subscriptions',
      defaultValue: [],
    })
      .then((raw) => {
        const { value } = normalizeSubscriptions(raw);
        const active = value.filter(
          (s) => s.status === SubscriptionStatusEnum.Active,
        );

        const costMap = new Map<CurrencyCode, number>();
        for (const s of active) {
          const multiplier = MONTHLY_MULTIPLIERS[s.billingCycle] ?? 1;
          const monthly = s.amount * multiplier;
          costMap.set(s.currency, (costMap.get(s.currency) ?? 0) + monthly);
        }

        setSummary({
          active: active.length,
          total: value.length,
          monthlyCosts: Array.from(costMap.entries()).map(
            ([currency, amount]) => ({ currency, amount }),
          ),
        });
      })
      .catch(() => setSummary({ active: 0, total: 0, monthlyCosts: [] }));
  }, [masterKeyBytes]);

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <p className="text-2xl font-bold">{summary.active}</p>
      <p className="text-xs text-muted-foreground">
        active of {summary.total} total
      </p>
      {summary.monthlyCosts.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {summary.monthlyCosts.map(({ currency, amount }) => (
            <p key={currency} className="text-xs text-muted-foreground">
              {formatMoney({ amount, currency })} / mo
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
