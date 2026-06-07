'use client';

import { Button, Input } from '@myorganizer/web-ui';
import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { z } from 'zod';

interface AddItemInlineFormProps {
  onAdd: (name: string) => void;
  isLoading?: boolean;
}

const addItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be 200 characters or less'),
});

/**
 * Quick-add form for grocery items
 * Allows users to add items with just a name
 */
export function AddItemInlineForm({
  onAdd,
  isLoading = false,
}: AddItemInlineFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = addItemSchema.parse({ name });
      setIsSubmitting(true);
      onAdd(result.name);
      setName('');
      // Refocus input for quick re-entry
      inputRef.current?.focus();
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message || 'Invalid input');
      } else {
        setError('Failed to add item');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <form
        onSubmit={handleSubmit}
        className="flex gap-sm flex-col sm:flex-row"
      >
        <Input
          ref={inputRef}
          type="text"
          placeholder="Add to list..."
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          disabled={isSubmitting || isLoading}
          maxLength={200}
          className="grow text-base sm:text-sm"
          aria-describedby={error ? 'add-item-error' : undefined}
          aria-label="Item name"
          autoFocus
        />
        <Button
          type="submit"
          disabled={isSubmitting || isLoading || !name.trim()}
          size="sm"
          className="gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>

      {error && (
        <p
          id="add-item-error"
          className="text-xs text-error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}
