import { type SubscriptionRecord } from '@myorganizer/core';
import {
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

import { SubscriptionRow } from './SubscriptionRow';

export interface SubscriptionsListCardProps {
  subscriptions: SubscriptionRecord[];
  onEditSubscription: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

export function SubscriptionsListCard({
  subscriptions,
  onEditSubscription,
  onRequestDelete,
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
                <SubscriptionRow
                  key={s.id}
                  subscription={s}
                  onEditSubscription={onEditSubscription}
                  onRequestDelete={onRequestDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
