'use client';

import { SUPPORTED_CURRENCIES } from '@myorganizer/core';
import {
  DatePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { Controller, type UseFormReturn } from 'react-hook-form';

import type { SubscriptionFormValues } from '../schemas/subscription';

export interface SubscriptionScheduleFieldsProps {
  form: UseFormReturn<SubscriptionFormValues>;
  showEndDate?: boolean;
}

export function SubscriptionScheduleFields({
  form,
  showEndDate = true,
}: SubscriptionScheduleFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-amount">Amount</Label>
          <Input
            id="sub-amount"
            type="number"
            step="0.01"
            {...form.register('amount', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sub-currency">Currency</Label>
          <Select
            value={form.watch('currency')}
            onValueChange={(v) =>
              form.setValue(
                'currency',
                v as SubscriptionFormValues['currency'],
                {
                  shouldValidate: true,
                },
              )
            }
          >
            <SelectTrigger id="sub-currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sub-start">Start date *</Label>
          <Controller
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="sub-start"
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick a start date"
              />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {showEndDate && (
          <div className="space-y-2">
            <Label htmlFor="sub-end">End date</Label>
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  id="sub-end"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Pick an end date"
                />
              )}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="sub-next">Next billing date</Label>
          <Controller
            control={form.control}
            name="nextBillingDate"
            render={({ field }) => (
              <DatePicker
                id="sub-next"
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick a billing date"
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sub-link">Link</Label>
          <Input
            id="sub-link"
            {...form.register('link')}
            placeholder="https://..."
          />
        </div>
      </div>
    </>
  );
}
