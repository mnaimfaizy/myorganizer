'use client';

import { useCallback, useState } from 'react';

import {
  createDefaultAuditReporter,
  exportVault,
} from '@myorganizer/web-vault';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';

import { downloadJsonFile } from '../utils/downloadJsonFile';
import { getErrorMessage } from '../utils/getErrorMessage';
import { useToast } from '@myorganizer/web-ui';

/**
 * Hook for exporting a vault to a JSON file.
 * Handles loading, validation, audit reporting, and downloading.
 *
 * Returns `{ exporting, exportVaultNow }` where:
 * - `exporting`: boolean indicating if an export is in progress
 * - `exportVaultNow`: async function to trigger the export; returns `Promise<boolean>`
 *   (true on success, false if an error occurred)
 */
export function useExportVault() {
  const { toast } = useToast();
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;

  const [exporting, setExporting] = useState(false);

  const exportVaultNow = useCallback(async (): Promise<boolean> => {
    if (!handle) {
      toast({
        title: 'Export failed',
        description: 'Sign in to export your vault.',
        variant: 'destructive',
      });
      return false;
    }

    setExporting(true);

    try {
      const localVault = handle.loadVault();
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

      return true;
    } catch (error) {
      toast({
        title: 'Export failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    } finally {
      setExporting(false);
    }
  }, [handle, toast]);

  return { exporting, exportVaultNow };
}
