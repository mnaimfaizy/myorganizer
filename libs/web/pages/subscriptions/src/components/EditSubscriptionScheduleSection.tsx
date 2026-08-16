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

import type { EditValues } from './SubscriptionDetailPageClient';

export interface EditSubscriptionScheduleSectionProps {
  form: UseFormReturn<EditValues>;
}

export function EditSubscriptionScheduleSection({
  form,
}: EditSubscriptionScheduleSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-amount">Amount</Label>
          <Input
            id="edit-amount"
            type="number"
            step="0.01"
            {...form.register('amount', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-currency">Currency</Label>
          <Select
            value={form.watch('currency')}
            onValueChange={(v) =>
              form.setValue('currency', v as EditValues['currency'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="edit-currency">
              <SelectValue />
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
          <Label htmlFor="edit-start">Start date</Label>
          <Controller
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="edit-start"
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick a start date"
              />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-end">End date</Label>
          <Controller
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <DatePicker
                id="edit-end"
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick an end date"
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-next">Next billing date</Label>
          <Controller
            control={form.control}
            name="nextBillingDate"
            render={({ field }) => (
              <DatePicker
                id="edit-next"
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick a billing date"
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-link">Link</Label>
          <Input id="edit-link" {...form.register('link')} />
        </div>
      </div>
    </>
  );
}
