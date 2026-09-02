'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@myorganizer/web-ui';
import { Plus, Trash2 } from 'lucide-react';
import { useCallback, type MouseEvent } from 'react';
import type {
  ArrayPath,
  Control,
  FieldArray,
  FieldValues,
  Path,
} from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';

interface LinksFormValues extends FieldValues {
  links: string[];
}

interface LinksInputProps<TFieldValues extends LinksFormValues> {
  control: Control<TFieldValues>;
  disabled?: boolean;
}

type LinksFieldName<TFieldValues extends LinksFormValues> = 'links' &
  ArrayPath<TFieldValues>;

type LinkFieldName<TFieldValues extends LinksFormValues> = `links.${number}` &
  Path<TFieldValues>;

export function LinksInput<TFieldValues extends LinksFormValues>({
  control,
  disabled = false,
}: LinksInputProps<TFieldValues>) {
  const linksFieldName = 'links' as LinksFieldName<TFieldValues>;
  const { fields, append, remove } = useFieldArray<
    TFieldValues,
    LinksFieldName<TFieldValues>
  >({
    control,
    name: linksFieldName,
  });

  const handleAddLink = useCallback(() => {
    append('' as FieldArray<TFieldValues, LinksFieldName<TFieldValues>>);
  }, [append]);

  const handleRemoveLink = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.linkIndex);
      remove(index);
    },
    [remove],
  );

  const canAddMore = fields.length < 10;

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <FormField<TFieldValues, LinkFieldName<TFieldValues>>
            control={control}
            name={`links.${index}` as LinkFieldName<TFieldValues>}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="sr-only">Link {index + 1}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="https://example.com"
                    className="flex-1 text-base md:text-sm"
                    type="url"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveLink}
            data-link-index={index}
            aria-label={`Remove link ${index + 1}`}
            className="text-destructive hover:text-destructive"
            disabled={disabled}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      {canAddMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddLink}
          className="gap-2 w-full"
          disabled={disabled}
        >
          <Plus className="w-4 h-4" />
          Add another link
        </Button>
      )}

      {fields.length >= 10 && (
        <p className="text-xs text-muted-foreground">
          Maximum 10 links reached
        </p>
      )}
    </div>
  );
}
