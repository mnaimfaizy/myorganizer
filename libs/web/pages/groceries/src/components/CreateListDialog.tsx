'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@myorganizer/web-ui';
import { useState } from 'react';
import { z } from 'zod';

interface CreateListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  isLoading?: boolean;
}

const createListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'List name is required')
    .max(100, 'List name must be 100 characters or less'),
});

type CreateListFormData = z.infer<typeof createListSchema>;

export function CreateListDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateListDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = createListSchema.parse({ name });
      setSubmitting(true);
      await onSubmit(result.name);
      setName('');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message || 'Invalid input');
      } else {
        setError('Failed to create list');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] md:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Give your list a name to get started
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              placeholder="e.g., Weekly Shopping"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={submitting || isLoading}
              maxLength={100}
              className="text-base md:text-sm"
              autoFocus
            />
            {error && <p className="text-xs text-error">{error}</p>}
            <p className="text-xs text-text-muted">
              {name.length} / 100 characters
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting || isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || isLoading || !name.trim()}
            >
              {submitting || isLoading ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
