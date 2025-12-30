'use client';

import { useToast } from '@myorganizer/web-ui';
import { useEffect, useRef } from 'react';

import { createVaultApi } from '../lib/api/apiClient';
import { getHttpStatus } from '../lib/http/getHttpStatus';
import { loadVault, saveVault } from '../lib/vault/vault';
import { migrateVaultPhase1ToPhase2 } from '../lib/vault/vaultMigration';

const VAULT_MIGRATION_VERSION = 1;
const SESSION_FLAG = `myorganizer_vault_migration_ran_v${VAULT_MIGRATION_VERSION}`;

function getUserFacingErrorMessage(error: unknown): string {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) {
    return 'Please sign in and try again.';
  }
  if (status === 409) {
    return 'Your vault changed on another device. Reload and try again.';
  }
  if (status && status >= 500) {
    return 'Server error while syncing your vault. Please try again later.';
  }
  if (status) {
    return `Vault sync failed (HTTP ${status}). Your local data is unchanged.`;
  }

  const message = (error as any)?.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return 'Could not migrate/sync your vault. Your local data is unchanged.';
}

export function VaultMigrationRunner() {
  const { toast } = useToast();
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

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
          `${message}\n\nYour data is different on this device and on the server.\n\nChoose which version to keep:\n\nOK = Keep data on this device (replace the copy on the server)\nCancel = Keep data from the server (replace the copy on this device)`
        );

        return keepLocal ? 'keep-local' : 'keep-server';
      },
    })
      .then((result) => {
        if (cancelled) return;

        // Mark as ran for this session, except when we weren't authenticated.
        if (result.kind !== 'skipped-not-authenticated') {
          window.sessionStorage.setItem(SESSION_FLAG, '1');
        }

        if (result.kind === 'downloaded-server-to-local') {
          saveVault(result.nextLocalVault);
          toastRef.current({
            title: 'Vault synced',
            description: 'Downloaded your server vault to this device.',
          });
        } else if (result.kind === 'uploaded-local-to-server') {
          toastRef.current({
            title: 'Vault migrated',
            description:
              'Your local encrypted vault was uploaded to the server.',
          });
        } else if (result.kind === 'kept-server-overwrote-local') {
          saveVault(result.nextLocalVault);
          toastRef.current({
            title: 'Vault updated',
            description: 'Using the server vault on this device.',
          });
        } else if (result.kind === 'kept-local-overwrote-server') {
          toastRef.current({
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
        if (cancelled) return;

        // Avoid infinite retries on hard failures.
        window.sessionStorage.setItem(SESSION_FLAG, '1');

        toastRef.current({
          title: 'Vault sync failed',
          description: getUserFacingErrorMessage(e),
          variant: 'destructive',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
