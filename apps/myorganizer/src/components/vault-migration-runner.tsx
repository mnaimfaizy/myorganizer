'use client';

import { useToast } from '@myorganizer/web-ui';
import { useEffect } from 'react';

import { createVaultApi } from '../lib/api/apiClient';
import { loadVault, saveVault } from '../lib/vault/vault';
import { migrateVaultPhase1ToPhase2 } from '../lib/vault/vaultMigration';

const SESSION_FLAG = 'myorganizer_vault_migration_ran_v1';

export function VaultMigrationRunner() {
  const { toast } = useToast();

  useEffect(() => {
    // Run once per browser tab/session
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(SESSION_FLAG)) return;

    const api = createVaultApi();
    const localVault = loadVault();

    migrateVaultPhase1ToPhase2({
      api,
      localVault,
      prompt: async ({ message }) => {
        if (typeof window.confirm !== 'function') return 'keep-server';

        const keepLocal = window.confirm(
          `${message}\n\nOK = Keep LOCAL (overwrite server)\nCancel = Keep SERVER (overwrite local)`
        );

        return keepLocal ? 'keep-local' : 'keep-server';
      },
    })
      .then((result) => {
        // Mark as ran for this session, except when we weren't authenticated.
        if (result.kind !== 'skipped-not-authenticated') {
          window.sessionStorage.setItem(SESSION_FLAG, '1');
        }

        if (result.kind === 'downloaded-server-to-local') {
          saveVault(result.nextLocalVault);
          toast({
            title: 'Vault synced',
            description: 'Downloaded your server vault to this device.',
          });
        } else if (result.kind === 'uploaded-local-to-server') {
          toast({
            title: 'Vault migrated',
            description:
              'Your local encrypted vault was uploaded to the server.',
          });
        } else if (result.kind === 'kept-server-overwrote-local') {
          saveVault(result.nextLocalVault);
          toast({
            title: 'Vault updated',
            description: 'Using the server vault on this device.',
          });
        } else if (result.kind === 'kept-local-overwrote-server') {
          toast({
            title: 'Vault updated',
            description:
              'Your local vault was kept and uploaded to the server.',
          });
        } else if (result.kind === 'skipped-not-authenticated') {
          // Silent: user might not be logged in yet
        } else if (result.kind === 'noop-already-in-sync') {
          // Silent
        } else if (result.kind === 'skipped-no-local-vault') {
          // Silent
        }
      })
      .catch((e: any) => {
        // Avoid infinite retries on hard failures.
        window.sessionStorage.setItem(SESSION_FLAG, '1');

        toast({
          title: 'Vault sync failed',
          description:
            e?.message ??
            'Could not migrate/sync your vault. Your local data is unchanged.',
          variant: 'destructive',
        });
      });
  }, [toast]);

  return null;
}
