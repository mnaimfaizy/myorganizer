'use client';

import { useCallback } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorganizer/web-ui';

import { useExportVault } from '../hooks';

export function ExportVaultCard() {
  const { exporting, exportVaultNow } = useExportVault();

  const handleExport = useCallback(async () => {
    await exportVaultNow();
  }, [exportVaultNow]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export encrypted vault</CardTitle>
        <CardDescription>
          Download a ciphertext-only JSON bundle. The file never contains
          plaintext addresses or phone numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          The exported file is decrypted only on this device using your
          passphrase or recovery key. The server stores audit metadata only —
          never the bundle itself.
        </p>
        <div className="flex gap-2">
          <Button
            data-testid="export-vault-button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export vault JSON'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
