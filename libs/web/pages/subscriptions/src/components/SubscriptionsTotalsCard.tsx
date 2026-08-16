import {
  formatMoney,
  type CurrencyCode,
  type SubscriptionRecord,
} from '@myorganizer/core';
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@myorganizer/web-ui';

import { getSubscriptionBillingCycleLabel } from '../utils/presentation';

export type CycleCurrencySubtotal = {
  billingCycle: SubscriptionRecord['billingCycle'];
  currency: CurrencyCode;
  total: number;
  count: number;
};

export type CycleConvertedSubtotal = {
  billingCycle: SubscriptionRecord['billingCycle'];
  currency: CurrencyCode;
  total: number;
  count: number;
};

export interface SubscriptionsTotalsCardProps {
  preferredCurrency: CurrencyCode;
  convertedTotals: {
    enabled: boolean;
    loading: boolean;
    error?: string;
    totals: CycleConvertedSubtotal[];
  };
  nativeSubtotals: CycleCurrencySubtotal[];
  hasActiveSubscriptions: boolean;
  onConvertTotals: () => void;
  onResetConversion: () => void;
}

export function SubscriptionsTotalsCard({
  preferredCurrency,
  convertedTotals,
  nativeSubtotals,
  hasActiveSubscriptions,
  onConvertTotals,
  onResetConversion,
}: SubscriptionsTotalsCardProps) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Totals (active)</CardTitle>
      <CardContent className="mt-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Preferred currency:{' '}
            <span className="font-medium">{preferredCurrency}</span>
          </div>
          <div className="flex gap-2">
            {convertedTotals.enabled ? (
              <Button
                variant="secondary"
                onClick={onResetConversion}
                disabled={convertedTotals.loading}
              >
                Show original
              </Button>
            ) : (
              <Button
                onClick={onConvertTotals}
                disabled={convertedTotals.loading || !hasActiveSubscriptions}
              >
                {convertedTotals.loading
                  ? 'Converting…'
                  : `Convert totals to ${preferredCurrency}`}
              </Button>
            )}
          </div>
        </div>

        {convertedTotals.enabled ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Billing cycle</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">
                  Total ({preferredCurrency})
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convertedTotals.totals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {convertedTotals.loading
                      ? 'Loading FX rates…'
                      : convertedTotals.error
                        ? convertedTotals.error
                        : 'No active subscriptions.'}
                  </TableCell>
                </TableRow>
              ) : (
                convertedTotals.totals.map((t) => (
                  <TableRow key={t.billingCycle}>
                    <TableCell>
                      {getSubscriptionBillingCycleLabel(t.billingCycle)}
                    </TableCell>
                    <TableCell className="text-right">{t.count}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney({
                        amount: t.total,
                        currency: preferredCurrency,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Billing cycle</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nativeSubtotals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No active subscriptions.
                  </TableCell>
                </TableRow>
              ) : (
                nativeSubtotals.map((t) => (
                  <TableRow key={`${t.billingCycle}|${t.currency}`}>
                    <TableCell>
                      {getSubscriptionBillingCycleLabel(t.billingCycle)}
                    </TableCell>
                    <TableCell>{t.currency}</TableCell>
                    <TableCell className="text-right">{t.count}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney({ amount: t.total, currency: t.currency })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
