'use client';

import { useCallback, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorganizer/web-ui';

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
      <CardHeader>
        <CardTitle className="text-lg">Delete account</CardTitle>
        <CardDescription>
          Deleting your account removes the account itself, its Sessions, and
          everything stored on the server for it, including your encrypted
          vault. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
