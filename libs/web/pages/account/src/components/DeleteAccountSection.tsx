'use client';

import { useCallback, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@myorganiser/web-ui';

import { DeleteAccountDialog } from './DeleteAccountDialog';

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Delete account</CardTitle>
      <CardDescription className="mt-1.5">
        Deleting your account removes the account itself, its Sessions, and
        everything stored on the server for it, including your encrypted vault.
        This cannot be undone.
      </CardDescription>
      <CardContent className="mt-4">
        <Button
          variant="destructive"
          data-testid="delete-account-button"
          onClick={handleOpen}
        >
          Delete account…
        </Button>
        <DeleteAccountDialog open={open} onOpenChange={handleOpenChange} />
      </CardContent>
    </Card>
  );
}
