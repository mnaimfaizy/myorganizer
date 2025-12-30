'use client';

import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from '@myorganizer/web-ui';

import { createVaultApi } from '../../lib/api/apiClient';
import { getHttpStatus } from '../../lib/http/getHttpStatus';
import { loadVault, saveVault } from '../../lib/vault/vault';
import {
  VAULT_EXPORT_MAX_BYTES,
  buildLocalExportBundle,
  bundleToLocalVault,
  validateVaultExportBundleFromText,
} from '../../lib/vault/vaultExportImport';

type ExportSource = 'server' | 'local';

function downloadJsonFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}

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

export default function VaultExportImportPage() {
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportServerNote, setExportServerNote] = useState<string | null>(null);
  const [lastServerNote, setLastServerNote] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportServerNote(null);
    setLastServerNote(null);

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
          // eslint-disable-next-line no-console
          console.error(
            'Server vault export failed; falling back to local vault export.',
            serverError
          );
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
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error?.message ?? String(error),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      toast({
        title: 'Choose a file',
        description: 'Select a vault export bundle (.json) to import.',
      });
      return;
    }

    if (selectedFile.size > VAULT_EXPORT_MAX_BYTES) {
      toast({
        title: 'File too large',
        description: `Max supported size is ${formatBytes(
          VAULT_EXPORT_MAX_BYTES
        )}.`,
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setLastServerNote(null);

    try {
      const text = await selectedFile.text();
      const bundle = validateVaultExportBundleFromText(text);

      const existingLocalVault = loadVault();
      if (existingLocalVault) {
        const confirmed = window.confirm(
          'Importing will replace your current local vault data. Continue?'
        );
        if (!confirmed) {
          toast({
            title: 'Import canceled',
            description: 'Your local vault was not changed.',
          });
          return;
        }
      }

      const nextLocalVault = bundleToLocalVault(bundle);
      saveVault(nextLocalVault);

      let serverNote = 'Imported locally.';

      try {
        const api = createVaultApi();
        await api.importVault({ vaultExportV1: bundle });
        serverNote = 'Imported locally and synced to server.';
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 401 || status === 403) {
          serverNote = 'Imported locally. Sign in to sync with the server.';
        } else {
          serverNote = 'Imported locally. Server sync failed; try again later.';
        }
      }

      setLastServerNote(serverNote);
      toast({
        title: 'Import complete',
        description: serverNote,
      });

      setSelectedFile(null);
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error?.message ?? String(error),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
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

      <Card>
        <CardHeader>
          <CardTitle>Import encrypted vault</CardTitle>
          <CardDescription>
            Validate and load a previously exported ciphertext bundle. After
            import, unlock with your passphrase or recovery key.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="vault-import-file">Vault export file (.json)</Label>
            <Input
              id="vault-import-file"
              type="file"
              accept="application/json"
              disabled={importing}
              onClick={(event) => {
                event.currentTarget.value = '';
              }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setLastServerNote(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Max size {formatBytes(VAULT_EXPORT_MAX_BYTES)}. Only ciphertext
              and metadata are accepted.
            </p>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : 'Import bundle'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedFile(null);
                setLastServerNote(null);
              }}
            >
              Clear selection
            </Button>
          </div>

          {lastServerNote && (
            <p className="text-sm text-muted-foreground">{lastServerNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
