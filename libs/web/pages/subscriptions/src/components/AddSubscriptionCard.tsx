import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  type CurrencyCode,
} from '@myorganizer/core';
import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { AddSubscriptionBillingFields } from './AddSubscriptionBillingFields';
import { AddSubscriptionGeneralFields } from './AddSubscriptionGeneralFields';
import { AddSubscriptionPlanFields } from './AddSubscriptionPlanFields';

export const addSubscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  status: z.enum([
    SubscriptionStatusEnum.Active,
    SubscriptionStatusEnum.Inactive,
    SubscriptionStatusEnum.Cancelled,
    SubscriptionStatusEnum.Expired,
    SubscriptionStatusEnum.Pending,
  ]),
  billingCycle: z.enum([
    SubscriptionBillingCycleEnum.Weekly,
    SubscriptionBillingCycleEnum.Fortnightly,
    SubscriptionBillingCycleEnum.Monthly,
    SubscriptionBillingCycleEnum.Quarterly,
    SubscriptionBillingCycleEnum.Yearly,
    SubscriptionBillingCycleEnum.TwoYears,
    SubscriptionBillingCycleEnum.ThreeYears,
  ]),
  amount: z.number().finite().min(0, 'Amount must be >= 0'),
  currency: z.custom<CurrencyCode>(
    (v) => typeof v === 'string' && v.length > 0,
  ),
  paymentMethod: z.enum([
    SubscriptionPaymentMethodEnum.CreditCard,
    SubscriptionPaymentMethodEnum.PayPal,
    SubscriptionPaymentMethodEnum.BankTransfer,
  ]),
  renewalType: z.enum([
    SubscriptionRenewalTypeEnum.AutoRenew,
    SubscriptionRenewalTypeEnum.Manual,
  ]),
  tier: z.enum([
    SubscriptionTierEnum.Free,
    SubscriptionTierEnum.Basic,
    SubscriptionTierEnum.Pro,
    SubscriptionTierEnum.Enterprise,
    SubscriptionTierEnum.Individual,
    SubscriptionTierEnum.Family,
  ]),
  startDate: z.string().trim().min(1, 'Start date is required'),
  nextBillingDate: z.string().trim().optional(),
  link: z.string().trim().url().optional().or(z.literal('')),
});

export type AddSubscriptionFormValues = z.infer<typeof addSubscriptionSchema>;

export interface AddSubscriptionCardProps {
  form: UseFormReturn<AddSubscriptionFormValues>;
  canAdd: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

export function AddSubscriptionCard({
  form,
  canAdd,
  onSubmit,
}: AddSubscriptionCardProps) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Add subscription</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <AddSubscriptionGeneralFields form={form} />
        <AddSubscriptionBillingFields form={form} />
        <AddSubscriptionPlanFields form={form} />

        <Button disabled={!canAdd} onClick={onSubmit} className="w-full">
          Add Subscription
        </Button>
      </CardContent>
    </Card>
  );
}
