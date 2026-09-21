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

import { useExportVault, useVaultOperationAvailability } from '../hooks';
import { VAULT_OPERATIONS } from '../policy';
import { VaultUnavailableNotice } from './VaultUnavailableNotice';

interface ExportVaultCardProps {
  /**
   * Optional callback invoked when the export succeeds. Not called if the
   * export fails (errors are already toasted by the hook).
   */
  onEscapeCopyMade?: () => void;
}

export function ExportVaultCard({ onEscapeCopyMade }: ExportVaultCardProps) {
  const { exporting, exportVaultNow } = useExportVault();
  const { allowed, unavailableReason } = useVaultOperationAvailability(
    VAULT_OPERATIONS.Export,
  );

  const handleExport = useCallback(async () => {
    const success = await exportVaultNow();
    if (success && onEscapeCopyMade) {
      onEscapeCopyMade();
    }
  }, [exportVaultNow, onEscapeCopyMade]);

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
        <VaultUnavailableNotice
          reason={unavailableReason}
          testId="export-vault-unavailable"
        />
        <div className="flex gap-2">
          <Button
            data-testid="export-vault-button"
            onClick={handleExport}
            disabled={exporting || !allowed}
          >
            {exporting ? 'Exporting…' : 'Export vault JSON'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
