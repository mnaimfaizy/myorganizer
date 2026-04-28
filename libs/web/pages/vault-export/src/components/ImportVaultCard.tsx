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
  createDefaultAuditReporter,
  createDefaultReplayTracker,
  importVault,
  isVaultImportError,
  loadVault,
  VAULT_CORE_EXPORT_MAX_BYTES,
} from '@myorganizer/web-vault';
import { getVaultImportErrorMessage } from '@myorganizer/web-vault-ui';

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

    if (selectedFile.size > VAULT_CORE_EXPORT_MAX_BYTES) {
      toast({
        title: 'File too large',
        description: `Max supported size is ${formatBytes(
          VAULT_CORE_EXPORT_MAX_BYTES,
        )}.`,
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setLastServerNote(null);

    try {
      const text = await selectedFile.text();

      const existingLocalVault = loadVault();
      if (existingLocalVault) {
        const confirmed = window.confirm(
          'Importing will replace your current local vault data. Continue?',
        );
        if (!confirmed) {
          toast({
            title: 'Import canceled',
            description: 'Your local vault was not changed.',
          });
          return;
        }
      }

      // Hardened import: parse → validate → migrate → stage → atomic commit.
      // The default audit reporter records a success/failed event with the
      // classified VaultImportError code; the default replay tracker rejects
      // re-importing the same envelope within the recent window.
      // For import, audit reporting stays non-strict: by the time the audit
      // POST runs the local vault has already been committed, so a strict
      // throw would surface "Import failed" while the user's data is in fact
      // updated. The default reporter logs failures via console.warn.
      await importVault({
        text,
        source: 'local-file',
        replayTracker: createDefaultReplayTracker(),
        auditReporter: createDefaultAuditReporter(),
      });

      const note = 'Imported locally. Audit recorded on server.';
      setLastServerNote(note);
      toast({
        title: 'Import complete',
        description: note,
      });

      setSelectedFile(null);
    } catch (error) {
      const description = isVaultImportError(error)
        ? getVaultImportErrorMessage(error.code)
        : getErrorMessage(error);
      toast({
        title: 'Import failed',
        description,
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
            data-testid="import-vault-file"
            type="file"
            accept="application/json"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] ?? null);
            }}
          />
        </div>

        <div className="flex gap-2">
          <Button
            data-testid="import-vault-button"
            onClick={handleImport}
            disabled={importing || !selectedFile}
          >
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
