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

import {
  getSubscriptionPaymentMethodLabel,
  getSubscriptionRenewalTypeLabel,
  getSubscriptionTierLabel,
} from '../utils/presentation';
import type { EditValues } from './SubscriptionDetailPageClient';

export interface EditSubscriptionPlanSectionProps {
  form: UseFormReturn<EditValues>;
}

export function EditSubscriptionPlanSection({
  form,
}: EditSubscriptionPlanSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="edit-payment">Payment method</Label>
        <Select
          value={form.watch('paymentMethod')}
          onValueChange={(v) =>
            form.setValue(
              'paymentMethod',
              v as EditValues['paymentMethod'],
              {
                shouldValidate: true,
              },
            )
          }
        >
          <SelectTrigger id="edit-payment">
            <SelectValue />
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
        <Label htmlFor="edit-renewal">Renewal type</Label>
        <Select
          value={form.watch('renewalType')}
          onValueChange={(v) =>
            form.setValue('renewalType', v as EditValues['renewalType'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="edit-renewal">
            <SelectValue />
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
        <Label htmlFor="edit-tier">Tier</Label>
        <Select
          value={form.watch('tier')}
          onValueChange={(v) =>
            form.setValue('tier', v as EditValues['tier'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="edit-tier">
            <SelectValue />
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
