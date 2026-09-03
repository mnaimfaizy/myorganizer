'use client';

import type { ListLine } from '@myorganizer/core';
import type { VaultHandle } from '@myorganizer/web-vault';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { CatalogItemEditChanges } from './components/CatalogItemEditDialog';

import { useGroceriesVault } from '../shared/hooks';
import type { AddCatalogItemAndLineInput } from '../shared/hooks';
import type { UpdateListLineInput } from '../shared/hooks';
import { GroceryListView } from './components';

interface GroceriesListDetailClientProps {
  listId: string;
  handle: VaultHandle;
}

export function GroceriesListDetailClient({
  listId,
  handle,
}: GroceriesListDetailClientProps) {
  const router = useRouter();
  const vault = useGroceriesVault({ handle });

  const handleClose = useCallback(() => {
    router.push('/dashboard/groceries');
  }, [router]);

  const handleToggleChecked = useCallback(
    (currentListId: string, lineId: string) =>
      vault.toggleLineChecked(currentListId, lineId),
    [vault.toggleLineChecked],
  );
  const handleUncheckAll = useCallback(
    (currentListId: string) => vault.uncheckAllLines(currentListId),
    [vault.uncheckAllLines],
  );
  const handleRemoveChecked = useCallback(
    (currentListId: string) => vault.removeCheckedLines(currentListId),
    [vault.removeCheckedLines],
  );
  const handleRestoreLines = useCallback(
    (currentListId: string, lines: ListLine[]) =>
      vault.restoreLines(currentListId, lines),
    [vault.restoreLines],
  );
  const handleDeleteLine = useCallback(
    (currentListId: string, lineId: string) =>
      vault.deleteListLine(currentListId, lineId),
    [vault.deleteListLine],
  );
  const handleAddItem = useCallback(
    (currentListId: string, input: AddCatalogItemAndLineInput) =>
      vault.addCatalogItemAndLine(currentListId, input),
    [vault.addCatalogItemAndLine],
  );
  const handleAddExistingItem = useCallback(
    (catalogItemId: string, listIds: string[], amount?: string) =>
      vault.addExistingCatalogItemToLists(catalogItemId, listIds, amount),
    [vault.addExistingCatalogItemToLists],
  );
  const handleDeleteFromCatalog = useCallback(
    (catalogItemId: string) => vault.deleteCatalogItem(catalogItemId),
    [vault.deleteCatalogItem],
  );
  const handleUpdateCatalogItem = useCallback(
    (changes: CatalogItemEditChanges) => vault.updateCatalogItem(changes),
    [vault.updateCatalogItem],
  );
  const handleUpdateListLine = useCallback(
    (currentListId: string, changes: UpdateListLineInput) =>
      vault.updateListLine(currentListId, changes),
    [vault.updateListLine],
  );

  if (vault.loading) {
    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-label="Loading grocery list"
      >
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const list = vault.lists.find((l) => l.id === listId);

  if (!list) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <Link
          href="/dashboard/groceries"
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/20 focus-visible:underline"
          aria-label="Back to groceries"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groceries
        </Link>
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            List not found
          </h2>
          <p className="mt-2 text-muted-foreground">
            The grocery list you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <GroceryListView
        list={list}
        catalog={vault.catalog}
        allLists={vault.lists}
        onClose={handleClose}
        onToggleChecked={handleToggleChecked}
        onUncheckAll={handleUncheckAll}
        onRemoveChecked={handleRemoveChecked}
        onRestoreLines={handleRestoreLines}
        onDeleteLine={handleDeleteLine}
        onAddItem={handleAddItem}
        onAddExistingItem={handleAddExistingItem}
        onDeleteFromCatalog={handleDeleteFromCatalog}
        onUpdateCatalogItem={handleUpdateCatalogItem}
        onUpdateListLine={handleUpdateListLine}
      />
    </div>
  );
}
