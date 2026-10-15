'use client';

import { useCallback, useState } from 'react';

import {
  createDefaultAuditReporter,
  exportVault,
} from '@myorganiser/web-vault';
import { useToast } from '@myorganiser/web-ui';

import { downloadJsonFile } from './downloadFile';
import { useOptionalVaultSession } from './session';

/**
 * Hook for exporting a vault to a JSON file — the Escape Copy.
 * Here rather than in the vault page so the account page can offer one
 * before User Deletion; page libraries do not import each other.
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
        description: describeError(error),
        variant: 'destructive',
      });
      return false;
    } finally {
      setExporting(false);
    }
  }, [handle, toast]);

  return { exporting, exportVaultNow };
}

// What the vault page's getErrorMessage said before this hook moved here.
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
