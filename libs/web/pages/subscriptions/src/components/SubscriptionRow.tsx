'use client';

import { type SubscriptionRecord, formatMoney } from '@myorganizer/core';
import { Button } from '@myorganizer/web-ui';
import { useCallback } from 'react';
import { TableCell, TableRow } from '@myorganizer/web-ui';

import {
  formatIsoDateForDisplay,
  getSubscriptionBillingCycleLabel,
  getSubscriptionStatusLabel,
} from '../utils/presentation';

export interface SubscriptionRowProps {
  subscription: SubscriptionRecord;
  onEditSubscription: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

export function SubscriptionRow({
  subscription,
  onEditSubscription,
  onRequestDelete,
}: SubscriptionRowProps) {
  const handleEdit = useCallback(
    () => onEditSubscription(subscription.id),
    [onEditSubscription, subscription.id],
  );

  const handleDelete = useCallback(
    () => onRequestDelete(subscription.id),
    [onRequestDelete, subscription.id],
  );

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{subscription.name}</span>
          {subscription.link ? (
            <a
              href={subscription.link}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              {subscription.link}
            </a>
          ) : null}
        </div>
      </TableCell>
      <TableCell>{getSubscriptionStatusLabel(subscription.status)}</TableCell>
      <TableCell>
        {getSubscriptionBillingCycleLabel(subscription.billingCycle)}
      </TableCell>
      <TableCell className="text-right">
        {formatMoney({
          amount: subscription.amount,
          currency: subscription.currency,
        })}
      </TableCell>
      <TableCell>
        {formatIsoDateForDisplay(subscription.nextBillingDate)}
      </TableCell>
      <TableCell className="text-right space-x-2">
        <Button variant="outline" onClick={handleEdit}>
          Edit
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}
