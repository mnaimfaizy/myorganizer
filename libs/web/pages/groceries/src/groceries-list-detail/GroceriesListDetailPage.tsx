'use client';

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { GroceryList } from '@myorganizer/core';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { GroceryListView } from './components';
import { useGroceriesVault } from '../shared/hooks';

interface GroceriesListDetailPageProps {
  listId: string;
}

function GroceriesDetailInner({
  listId,
  masterKeyBytes,
}: {
  listId: string;
  masterKeyBytes: Uint8Array;
}): ReactNode {
  const vault = useGroceriesVault({ masterKeyBytes });
  const router = useRouter();
  const handleListUpdated = useCallback((_updated: GroceryList) => {}, []);
  const handleClose = useCallback(() => router.push('/dashboard/groceries'), [router]);

  if (vault.loading) {
    return (
      <div
        className="min-h-screen bg-surface"
        aria-busy="true"
        aria-label="Loading grocery list"
      >
        <div className="mx-auto max-w-2xl p-4 md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-surface-container-highest animate-pulse" />
            <div className="h-8 w-48 rounded bg-surface-container-highest animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const list = vault.lists.find((l) => l.id === listId);

  if (!list) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <Link
          href="/dashboard/groceries"
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-secondary-container/20"
          aria-label="Back to groceries"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groceries
        </Link>

        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-8 text-center">
          <h2 className="text-xl font-semibold text-on-surface">
            List not found
          </h2>
          <p className="mt-2 text-on-surface-variant">
            The grocery list you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <Link
        href="/dashboard/groceries"
        className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-secondary-container/20"
        aria-label="Back to groceries"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Groceries
      </Link>

      <GroceryListView
        list={list}
        masterKeyBytes={masterKeyBytes}
        onListUpdated={handleListUpdated}
        onClose={handleClose}
        persistLists={vault.persistLists}
        allLists={vault.lists}
      />
    </div>
  );
}

export function GroceriesListDetailPage({
  listId,
}: GroceriesListDetailPageProps): ReactNode {
  return (
    <VaultGate title="Grocery List">
      {({ masterKeyBytes }) => (
        <GroceriesDetailInner listId={listId} masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
