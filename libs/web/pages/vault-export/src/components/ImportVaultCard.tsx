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

import {
  bundleToLocalVault,
  createVaultApi,
  getHttpStatus,
  loadVault,
  saveVault,
  validateVaultExportBundleFromText,
  VAULT_EXPORT_MAX_BYTES,
} from '@myorganizer/web-vault';

import { formatBytes } from '../utils/formatBytes';
import { getErrorMessage } from '../utils/getErrorMessage';

export function ImportVaultCard() {
  const { toast } = useToast();

  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastServerNote, setLastServerNote] = useState<string | null>(null);

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
    } catch (error) {
      toast({
        title: 'Import failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
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
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] ?? null);
            }}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleImport} disabled={importing || !selectedFile}>
            {importing ? 'Importing…' : 'Import vault JSON'}
          </Button>
        </div>

        {lastServerNote && (
          <p className="text-sm text-muted-foreground">{lastServerNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
