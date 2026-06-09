'use client';

import { Button, Input } from '@myorganizer/web-ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';

interface LinksInputProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}

/**
 * Dynamic links input component
 * Allows adding/removing up to 10 URL links for grocery items
 */
export function LinksInput({ control }: LinksInputProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'links',
  });

  const canAddMore = fields.length < 10;

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input
            placeholder="https://example.com"
            {...control.register(`links.${index}`)}
            className="flex-1 text-base md:text-sm"
            type="url"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(index)}
            aria-label={`Remove link ${index + 1}`}
            className="text-destructive hover:text-destructive"
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
          onClick={() => append('')}
          className="gap-2 w-full"
        >
          <Plus className="w-4 h-4" />
          Add another link
        </Button>
      )}

      {fields.length >= 10 && (
        <p className="text-xs text-text-muted">Maximum 10 links reached</p>
      )}
    </div>
  );
}
