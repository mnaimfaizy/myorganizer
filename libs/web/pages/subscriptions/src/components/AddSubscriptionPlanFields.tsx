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
import { type AddSubscriptionFormValues } from './AddSubscriptionCard';

export interface AddSubscriptionPlanFieldsProps {
  form: UseFormReturn<AddSubscriptionFormValues>;
}

export function AddSubscriptionPlanFields({
  form,
}: AddSubscriptionPlanFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="sub-payment">Payment method</Label>
        <Select
          value={form.watch('paymentMethod')}
          onValueChange={(v) =>
            form.setValue(
              'paymentMethod',
              v as AddSubscriptionFormValues['paymentMethod'],
              { shouldValidate: true },
            )
          }
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
          onValueChange={(v) =>
            form.setValue(
              'renewalType',
              v as AddSubscriptionFormValues['renewalType'],
              { shouldValidate: true },
            )
          }
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
        <Select
          value={form.watch('tier')}
          onValueChange={(v) =>
            form.setValue(
              'tier',
              v as AddSubscriptionFormValues['tier'],
              {
                shouldValidate: true,
              },
            )
          }
        >
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
