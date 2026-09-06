'use client';

import {
  SubscriptionBillingCycleEnum,
  SubscriptionStatusEnum,
} from '@myorganizer/core';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { type UseFormReturn } from 'react-hook-form';
import { useCallback } from 'react';

import {
  getSubscriptionBillingCycleLabel,
  getSubscriptionStatusLabel,
} from '../utils/presentation';
import type { SubscriptionFormValues } from '../schemas/subscription';

export interface SubscriptionGeneralFieldsProps {
  form: UseFormReturn<SubscriptionFormValues>;
}

export function SubscriptionGeneralFields({
  form,
}: SubscriptionGeneralFieldsProps) {
  const handleStatusChange = useCallback(
    (value: string) => {
      form.setValue('status', value as SubscriptionFormValues['status'], {
        shouldValidate: true,
      });
    },
    [form],
  );

  const handleBillingCycleChange = useCallback(
    (value: string) => {
      form.setValue(
        'billingCycle',
        value as SubscriptionFormValues['billingCycle'],
        { shouldValidate: true },
      );
    },
    [form],
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="sub-name">Name *</Label>
        <Input id="sub-name" {...form.register('name')} placeholder="Netflix" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-status">Status</Label>
          <Select
            value={form.watch('status')}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger id="sub-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(SubscriptionStatusEnum).map((v) => (
                <SelectItem key={v} value={v}>
                  {getSubscriptionStatusLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sub-billing">Billing cycle</Label>
          <Select
            value={form.watch('billingCycle')}
            onValueChange={handleBillingCycleChange}
          >
            <SelectTrigger id="sub-billing">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(SubscriptionBillingCycleEnum).map((v) => (
                <SelectItem key={v} value={v}>
                  {getSubscriptionBillingCycleLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
