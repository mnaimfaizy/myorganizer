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
import { useEffect, useState } from 'react';
import { z } from 'zod';

interface RenameListDialogProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
  isLoading?: boolean;
}

const renameListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'List name is required')
    .max(100, 'List name must be 100 characters or less'),
});

type RenameListFormData = z.infer<typeof renameListSchema>;

export function RenameListDialog({
  isOpen,
  currentName,
  onClose,
  onSubmit,
  isLoading = false,
}: RenameListDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Update name when currentName changes
  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = renameListSchema.parse({ name });

      // Check if name actually changed
      if (result.name === currentName) {
        onClose();
        return;
      }

      setSubmitting(true);
      await onSubmit(result.name);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message || 'Invalid input');
      } else {
        setError('Failed to rename list');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName(currentName);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] md:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
            <DialogDescription>
              Enter a new name for your grocery list
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
              disabled={
                submitting || isLoading || !name.trim() || name === currentName
              }
            >
              {submitting || isLoading ? 'Saving...' : 'Rename List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
