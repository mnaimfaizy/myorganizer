import { type SubscriptionRecord, formatMoney } from '@myorganizer/core';
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
import Link from 'next/link';

import {
  formatIsoDateForDisplay,
  getSubscriptionBillingCycleLabel,
  getSubscriptionStatusLabel,
} from '../utils/presentation';

export interface SubscriptionsListCardProps {
  subscriptions: SubscriptionRecord[];
  onDeleteSubscription: (id: string) => void;
}

export function SubscriptionsListCard({
  subscriptions,
  onDeleteSubscription,
}: SubscriptionsListCardProps) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Subscriptions</CardTitle>
      <CardContent className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Next Billing</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No subscriptions yet.
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/dashboard/subscriptions/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      {s.link ? (
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          {s.link}
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getSubscriptionStatusLabel(s.status)}
                  </TableCell>
                  <TableCell>
                    {getSubscriptionBillingCycleLabel(s.billingCycle)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney({ amount: s.amount, currency: s.currency })}
                  </TableCell>
                  <TableCell>
                    {formatIsoDateForDisplay(s.nextBillingDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      onClick={() => onDeleteSubscription(s.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
