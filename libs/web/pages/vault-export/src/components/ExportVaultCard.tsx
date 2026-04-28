'use client';

import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useToast,
} from '@myorganizer/web-ui';

import {
  createDefaultAuditReporter,
  exportVault,
  loadVault,
} from '@myorganizer/web-vault';

import { downloadJsonFile } from '../utils/downloadJsonFile';
import { getErrorMessage } from '../utils/getErrorMessage';

export function ExportVaultCard() {
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);

    try {
      const localVault = loadVault();
      if (!localVault) {
        throw new Error(
          'No local vault found. Create or unlock your vault first.',
        );
      }

      const filenameStamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `myorganizer-vault-export-${filenameStamp}.json`;

      // Hardened local export: stage → serialize → audit → download.
      // `strict: true` means a failed audit POST aborts the download so the
      // user never gets a file without a corresponding server audit row.
      const { text } = await exportVault({
        localVault,
        source: 'local-file',
        auditReporter: createDefaultAuditReporter(undefined, { strict: true }),
      });

      downloadJsonFile(filename, text);

      toast({
        title: 'Vault exported',
        description: 'Downloaded ciphertext bundle from local vault.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  }

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
