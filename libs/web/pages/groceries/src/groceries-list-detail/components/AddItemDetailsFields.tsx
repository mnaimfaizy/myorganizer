'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@myorganizer/web-ui';
import type { Control } from 'react-hook-form';
import { useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import type { AddItemFormValues } from '../schemas';
import { LinksInput } from './LinksInput';

interface AddItemDetailsFieldsProps {
  control: Control<AddItemFormValues>;
  imageUrl: string;
  isLoading: boolean;
  showAmount?: boolean;
}

export function AddItemDetailsFields({
  control,
  imageUrl,
  isLoading,
  showAmount = true,
}: AddItemDetailsFieldsProps) {
  const handleImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      event.currentTarget.style.display = 'none';
    },
    [],
  );

  return (
    <>
      <div className={showAmount ? 'grid grid-cols-2 gap-4' : undefined}>
        {showAmount ? (
          <FormField
            control={control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quantity / Amount
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. 2, 500g"
                    disabled={isLoading}
                    className="text-base md:text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estimated Price
              </FormLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-bold text-muted-foreground">
                  $
                </span>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isLoading}
                    className="pl-6 text-base md:text-sm"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </FormLabel>
            <FormControl>
              <textarea
                {...field}
                placeholder="Add specific brands, sizes or dietary requirements..."
                disabled={isLoading}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand md:text-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Image URL{' '}
              <span className="text-xs font-normal normal-case text-muted-foreground">
                (optional)
              </span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="https://example.com/image.jpg"
                type="url"
                disabled={isLoading}
                className="text-base md:text-sm"
              />
            </FormControl>
            <FormMessage />
            {imageUrl.startsWith('http') && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <img
                  src={imageUrl}
                  alt="Item preview"
                  className="max-h-48 max-w-xs rounded"
                  onError={handleImageError}
                />
              </div>
            )}
          </FormItem>
        )}
      />

      <FormItem>
        <FormLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Links{' '}
          <span className="text-xs font-normal normal-case text-muted-foreground">
            (optional, max 10)
          </span>
        </FormLabel>
        <LinksInput control={control} disabled={isLoading} />
      </FormItem>
    </>
  );
}
