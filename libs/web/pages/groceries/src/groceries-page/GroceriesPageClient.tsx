'use client';

import { Button, Skeleton } from '@myorganizer/web-ui';
import type { VaultHandle } from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { LayoutGrid, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { formatMoney, summarizeListSpend } from '../shared/utils';
import {
  CreateListDialog,
  DeleteListConfirmDialog,
  RenameListDialog,
  TripBoardIndex,
} from './components';
import { useGroceriesVault } from '../shared/hooks';
import type { AddCatalogItemAndLineInput } from '../shared/hooks';
import type { CatalogItemEditChanges } from '../groceries-list-detail/components/CatalogItemEditDialog';

interface GroceriesInnerProps {
  handle: VaultHandle;
}

interface DialogState {
  type: 'create' | 'rename' | 'delete' | null;
  listId?: string;
  listName?: string;
  itemCount?: number;
}

function GroceriesInner({ handle }: GroceriesInnerProps) {
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const vault = useGroceriesVault({ handle });

  const handleOpenCreateDialog = useCallback(() => {
    setDialog({ type: 'create' });
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialog({ type: null });
  }, []);

  const handleRenameList = useCallback(
    (listId: string) => {
      const list = vault.lists.find((candidate) => candidate.id === listId);
      if (list) {
        setDialog({
          type: 'rename',
          listId,
          listName: list.name,
        });
      }
    },
    [vault.lists],
  );

  const handleDeleteList = useCallback(
    (listId: string) => {
      const list = vault.lists.find((candidate) => candidate.id === listId);
      if (list) {
        setDialog({
          type: 'delete',
          listId,
          listName: list.name,
          itemCount: list.lines.length,
        });
      }
    },
    [vault.lists],
  );

  const handleCreateList = useCallback(
    async (name: string) => {
      await vault.createList(name);
      setDialog({ type: null });
    },
    [vault.createList],
  );

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!dialog.listId) return;
      await vault.renameList(dialog.listId, newName);
      setDialog({ type: null });
    },
    [dialog.listId, vault.renameList],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!dialog.listId) return;
    await vault.deleteList(dialog.listId);
    setDialog({ type: null });
  }, [dialog.listId, vault.deleteList]);

  const handleAddExistingItem = useCallback(
    (catalogItemId: string, listIds: string[], amount?: string) =>
      vault.addExistingCatalogItemToLists(catalogItemId, listIds, amount),
    [vault.addExistingCatalogItemToLists],
  );

  const handleAddCatalogItem = useCallback(
    async (input: AddCatalogItemAndLineInput) => {
      await vault.addItemToLists([], input);
    },
    [vault.addItemToLists],
  );

  const handleUpdateCatalogItem = useCallback(
    (changes: CatalogItemEditChanges) => vault.updateCatalogItem(changes),
    [vault.updateCatalogItem],
  );

  const portfolio = useMemo(
    () =>
      vault.lists.reduce(
        (acc, list) => {
          const summary = summarizeListSpend(list.lines, vault.catalog);
          acc.known += summary.known;
          acc.unpriced += summary.unpricedCount;
          return acc;
        },
        { known: 0, unpriced: 0 },
      ),
    [vault.catalog, vault.lists],
  );

  if (vault.loading) {
    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-label="Loading groceries list"
      >
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {vault.error && (
          <div
            className="mb-4 flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive md:mb-6"
            role="alert"
            aria-live="polite"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 4v2m0-12a9 9 0 110-18 9 9 0 010 18z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-destructive">{vault.error}</p>
              <button
                onClick={() => vault.setError(null)}
                className="mt-2 text-sm font-medium text-destructive underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <LayoutGrid className="h-4 w-4" />
              Trip board
            </p>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              Active trips
            </h1>
            <p className="mt-1 text-muted-foreground">
              {formatMoney(portfolio.known)} known spend
              {portfolio.unpriced > 0
                ? ` · ${portfolio.unpriced} unpriced`
                : ''}
            </p>
          </div>
          <Button
            size="lg"
            className="w-full gap-2 md:w-auto"
            onClick={handleOpenCreateDialog}
            disabled={vault.loading}
          >
            <Plus className="h-5 w-5" />
            New trip
          </Button>
        </div>

        {vault.lists.length === 0 ? (
          <div
            className="rounded-lg border-2 border-dashed border-border bg-muted p-8 text-center md:p-12"
            role="status"
            aria-live="polite"
          >
            <div className="mb-4 inline-block rounded-full bg-muted p-3">
              <svg
                className="h-8 w-8 text-brand-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">
              No grocery lists yet
            </h2>
            <p className="mt-2 text-muted-foreground">
              Create your first list to get started organizing your shopping.
            </p>
            <Button className="mt-6" onClick={handleOpenCreateDialog}>
              Create Your First List
            </Button>
          </div>
        ) : (
          <TripBoardIndex
            lists={vault.lists}
            catalog={vault.catalog}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            onAddExistingItem={handleAddExistingItem}
            onAddCatalogItem={handleAddCatalogItem}
            onUpdateCatalogItem={handleUpdateCatalogItem}
            isLoading={vault.loading}
          />
        )}
      </div>

      <CreateListDialog
        isOpen={dialog.type === 'create'}
        onClose={handleCloseDialog}
        onSubmit={handleCreateList}
        isLoading={vault.loading}
      />

      {dialog.type === 'rename' && (
        <RenameListDialog
          isOpen={true}
          currentName={dialog.listName || ''}
          onClose={handleCloseDialog}
          onSubmit={handleRenameSubmit}
          isLoading={vault.loading}
        />
      )}

      {dialog.type === 'delete' && (
        <DeleteListConfirmDialog
          isOpen={true}
          listName={dialog.listName || ''}
          itemCount={dialog.itemCount || 0}
          onClose={handleCloseDialog}
          onConfirm={handleDeleteConfirm}
          isLoading={vault.loading}
        />
      )}
    </div>
  );
}

export function GroceriesPageClient() {
  return (
    <VaultGate title="Groceries">
      {({ handle }) => <GroceriesInner handle={handle!} />}
    </VaultGate>
  );
}
