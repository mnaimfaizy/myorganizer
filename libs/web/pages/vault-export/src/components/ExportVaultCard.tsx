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
  buildLocalExportBundle,
  createVaultApi,
  getHttpStatus,
  loadVault,
  validateVaultExportBundleFromText,
} from '@myorganizer/web-vault';

import { downloadJsonFile } from '../utils/downloadJsonFile';
import { getErrorMessage } from '../utils/getErrorMessage';

type ExportSource = 'server' | 'local';

async function fetchServerExport(): Promise<{ bundle: unknown } | null> {
  const api = createVaultApi();
  try {
    const response = await api.exportVault();
    return { bundle: response.data };
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403 || status === 404) {
      return null; // allow local fallback when unauthenticated or empty
    }
    throw error;
  }
}

export function ExportVaultCard() {
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);
  const [exportServerNote, setExportServerNote] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportServerNote(null);

    try {
      let source: ExportSource = 'local';
      let bundle: unknown = null;
      let serverError: unknown = null;

      try {
        const serverResult = await fetchServerExport();
        if (serverResult) {
          source = 'server';
          bundle = serverResult.bundle;
        }
      } catch (error) {
        serverError = error;
      }

      if (!bundle) {
        const localVault = loadVault();
        if (!localVault) {
          if (serverError) throw serverError;
          throw new Error(
            'No local vault found. Create or unlock your vault first.'
          );
        }

        if (serverError) {
          setExportServerNote(
            'Server vault export failed; exported from local vault instead.'
          );
        }

        bundle = buildLocalExportBundle({ localVault });
      }

      const validated = validateVaultExportBundleFromText(
        JSON.stringify(bundle)
      );
      const filename = `myorganizer-vault-export-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.json`;

      downloadJsonFile(filename, JSON.stringify(validated, null, 2));

      toast({
        title: 'Vault exported',
        description:
          source === 'server'
            ? 'Downloaded ciphertext bundle from server copy.'
            : 'Downloaded ciphertext bundle from local vault.',
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
          We try the server export endpoint first (when signed in). If
          unavailable, we export from your local encrypted vault.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export vault JSON'}
          </Button>
        </div>
        {exportServerNote && (
          <p className="text-sm text-muted-foreground">{exportServerNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
