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

import {
  getSubscriptionBillingCycleLabel,
  getSubscriptionStatusLabel,
} from '../utils/presentation';
import type { EditValues } from './SubscriptionDetailPageClient';

export interface EditSubscriptionGeneralSectionProps {
  form: UseFormReturn<EditValues>;
}

export function EditSubscriptionGeneralSection({
  form,
}: EditSubscriptionGeneralSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="edit-name">Name</Label>
        <Input id="edit-name" {...form.register('name')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-status">Status</Label>
          <Select
            value={form.watch('status')}
            onValueChange={(v) =>
              form.setValue('status', v as EditValues['status'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="edit-status">
              <SelectValue />
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
          <Label htmlFor="edit-billing">Billing cycle</Label>
          <Select
            value={form.watch('billingCycle')}
            onValueChange={(v) =>
              form.setValue(
                'billingCycle',
                v as EditValues['billingCycle'],
                {
                  shouldValidate: true,
                },
              )
            }
          >
            <SelectTrigger id="edit-billing">
              <SelectValue />
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
