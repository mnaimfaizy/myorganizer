'use client';

import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@myorganizer/web-ui';
import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
} from '@myorganizer/core';
import {
  subscriptionFormSchema,
  type SubscriptionFormValues,
} from '../schemas/subscription';
import { todayAsDateInput } from '../utils/date';
import { SubscriptionGeneralFields } from './SubscriptionGeneralFields';
import { SubscriptionScheduleFields } from './SubscriptionScheduleFields';
import { SubscriptionPlanFields } from './SubscriptionPlanFields';

interface SubscriptionFormProps {
  onSubmit: (values: SubscriptionFormValues) => void;
  initialValues?: Partial<SubscriptionFormValues>;
  submitLabel?: string;
  mode?: 'add' | 'edit';
}

export function SubscriptionForm({
  onSubmit,
  initialValues,
  submitLabel = 'Add Subscription',
  mode = 'add',
}: SubscriptionFormProps) {
  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      name: initialValues?.name ?? '',
      status: initialValues?.status ?? SubscriptionStatusEnum.Active,
      billingCycle:
        initialValues?.billingCycle ?? SubscriptionBillingCycleEnum.Monthly,
      amount: initialValues?.amount ?? 0,
      currency: initialValues?.currency ?? 'AUD',
      paymentMethod:
        initialValues?.paymentMethod ??
        SubscriptionPaymentMethodEnum.CreditCard,
      renewalType:
        initialValues?.renewalType ?? SubscriptionRenewalTypeEnum.AutoRenew,
      tier: initialValues?.tier ?? SubscriptionTierEnum.Basic,
      startDate: initialValues?.startDate ?? todayAsDateInput(),
      endDate: initialValues?.endDate ?? '',
      nextBillingDate: initialValues?.nextBillingDate ?? '',
      link: initialValues?.link ?? '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset({
      name: initialValues?.name ?? '',
      status: initialValues?.status ?? SubscriptionStatusEnum.Active,
      billingCycle:
        initialValues?.billingCycle ?? SubscriptionBillingCycleEnum.Monthly,
      amount: initialValues?.amount ?? 0,
      currency: initialValues?.currency ?? 'AUD',
      paymentMethod:
        initialValues?.paymentMethod ??
        SubscriptionPaymentMethodEnum.CreditCard,
      renewalType:
        initialValues?.renewalType ?? SubscriptionRenewalTypeEnum.AutoRenew,
      tier: initialValues?.tier ?? SubscriptionTierEnum.Basic,
      startDate: initialValues?.startDate ?? todayAsDateInput(),
      endDate: initialValues?.endDate ?? '',
      nextBillingDate: initialValues?.nextBillingDate ?? '',
      link: initialValues?.link ?? '',
    });
  }, [initialValues, form]);

  const handleSubmit = useCallback(
    (values: SubscriptionFormValues) => {
      onSubmit(values);
    },
    [onSubmit],
  );

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <SubscriptionGeneralFields form={form} />
      <SubscriptionScheduleFields form={form} showEndDate={mode === 'edit'} />
      <SubscriptionPlanFields form={form} />

      <Button
        type="submit"
        disabled={!form.formState.isValid}
        className="w-full"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
