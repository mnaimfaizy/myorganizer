'use client';

import {
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionTierEnum,
} from '@myorganizer/core';
import {
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
  getSubscriptionPaymentMethodLabel,
  getSubscriptionRenewalTypeLabel,
  getSubscriptionTierLabel,
} from '../utils/presentation';
import type { SubscriptionFormValues } from '../schemas/subscription';

export interface SubscriptionPlanFieldsProps {
  form: UseFormReturn<SubscriptionFormValues>;
}

export function SubscriptionPlanFields({ form }: SubscriptionPlanFieldsProps) {
  const handlePaymentMethodChange = useCallback(
    (value: string) => {
      form.setValue(
        'paymentMethod',
        value as SubscriptionFormValues['paymentMethod'],
        { shouldValidate: true },
      );
    },
    [form],
  );

  const handleRenewalTypeChange = useCallback(
    (value: string) => {
      form.setValue(
        'renewalType',
        value as SubscriptionFormValues['renewalType'],
        { shouldValidate: true },
      );
    },
    [form],
  );

  const handleTierChange = useCallback(
    (value: string) => {
      form.setValue('tier', value as SubscriptionFormValues['tier'], {
        shouldValidate: true,
      });
    },
    [form],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="sub-payment">Payment method</Label>
        <Select
          value={form.watch('paymentMethod')}
          onValueChange={handlePaymentMethodChange}
        >
          <SelectTrigger id="sub-payment">
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(SubscriptionPaymentMethodEnum).map((v) => (
              <SelectItem key={v} value={v}>
                {getSubscriptionPaymentMethodLabel(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sub-renewal">Renewal type</Label>
        <Select
          value={form.watch('renewalType')}
          onValueChange={handleRenewalTypeChange}
        >
          <SelectTrigger id="sub-renewal">
            <SelectValue placeholder="Select renewal" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(SubscriptionRenewalTypeEnum).map((v) => (
              <SelectItem key={v} value={v}>
                {getSubscriptionRenewalTypeLabel(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sub-tier">Tier</Label>
        <Select value={form.watch('tier')} onValueChange={handleTierChange}>
          <SelectTrigger id="sub-tier">
            <SelectValue placeholder="Select tier" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(SubscriptionTierEnum).map((v) => (
              <SelectItem key={v} value={v}>
                {getSubscriptionTierLabel(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
