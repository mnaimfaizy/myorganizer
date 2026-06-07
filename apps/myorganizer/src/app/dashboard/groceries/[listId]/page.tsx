'use client';

import {
  GroceryListView,
  useGroceriesVault,
} from '@myorganizer/web-pages/groceries';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, use } from 'react';

interface GroceriesDetailPageProps {
  params: Promise<{
    listId: string;
  }>;
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
        onListUpdated={() => {
          // List is updated via persistLists in GroceryListView
        }}
        onClose={() => router.push('/dashboard/groceries')}
        persistLists={vault.persistLists}
        allLists={vault.lists}
      />
    </div>
  );
}

export default function GroceriesDetailPage({
  params,
}: GroceriesDetailPageProps): ReactNode {
  const { listId } = use(params);

  return (
    <VaultGate title="Grocery List">
      {({ masterKeyBytes }) => (
        <GroceriesDetailInner listId={listId} masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
