'use client';

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import { ToastAction, useToast } from '@myorganizer/web-ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { AddCatalogItemAndLineInput } from '../../shared/hooks';
import { formatMoney, summarizeListSpend } from '../../shared/utils';
import { AddExistingItemDialog } from './AddExistingItemDialog';
import type { AddItemFormResult } from './AddItemDialog';
import { AddItemDialog } from './AddItemDialog';
import { DeleteCatalogItemDialog } from './DeleteCatalogItemDialog';
import { TripBoardCatalogAddStrip } from './TripBoardCatalogAddStrip';
import { TripBoardLifecycleToolbar } from './TripBoardLifecycleToolbar';
import { TripBoardLineColumns } from './TripBoardLineColumns';
import { TripBoardSpendFooter } from './TripBoardSpendFooter';
import { CatalogItemEditDialog } from './CatalogItemEditDialog';
import type { CatalogItemEditChanges } from './CatalogItemEditDialog';
import { ListLineEditDialog } from './ListLineEditDialog';

interface GroceryListViewProps {
  list: GroceryList;
  catalog: CatalogItem[];
  allLists: GroceryList[];
  onClose: () => void;
  onToggleChecked: (listId: string, lineId: string) => Promise<void>;
  onUncheckAll: (listId: string) => Promise<void>;
  onRemoveChecked: (listId: string) => Promise<ListLine[]>;
  onRestoreLines: (listId: string, lines: ListLine[]) => Promise<void>;
  onDeleteLine: (listId: string, lineId: string) => Promise<void>;
  onAddItem: (
    listId: string,
    input: AddCatalogItemAndLineInput,
  ) => Promise<void>;
  onAddExistingItem: (
    catalogItemId: string,
    listIds: string[],
    amount?: string,
  ) => Promise<string[]>;
  onDeleteFromCatalog: (catalogItemId: string) => Promise<void>;
  onUpdateCatalogItem: (changes: CatalogItemEditChanges) => Promise<void>;
  onUpdateListLine: (
    listId: string,
    changes: { id: string; amount?: string },
  ) => Promise<void>;
}

/**
 * Trip Board detail view — manages the List Lines within a single Grocery
 * List (Active vs Checked, spend summary, and lifecycle actions).
 */
export function GroceryListView({
  list,
  catalog,
  allLists,
  onToggleChecked,
  onUncheckAll,
  onRemoveChecked,
  onRestoreLines,
  onDeleteLine,
  onAddItem,
  onAddExistingItem,
  onDeleteFromCatalog,
  onUpdateCatalogItem,
  onUpdateListLine,
}: GroceryListViewProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddExistingDialogOpen, setIsAddExistingDialogOpen] = useState(false);
  const [catalogItemPendingDelete, setCatalogItemPendingDelete] =
    useState<CatalogItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [linePendingEdit, setLinePendingEdit] = useState<ListLine | null>(null);
  const [catalogItemPendingEdit, setCatalogItemPendingEdit] =
    useState<CatalogItem | null>(null);

  const active = useMemo(
    () => list.lines.filter((line) => !line.checked),
    [list.lines],
  );
  const checked = useMemo(
    () => list.lines.filter((line) => line.checked),
    [list.lines],
  );
  const summary = useMemo(
    () => summarizeListSpend(list.lines, catalog),
    [list.lines, catalog],
  );

  const showErrorToast = useCallback(() => {
    toast({
      title: 'Error',
      description: 'Failed to save your changes. Please try again.',
      variant: 'destructive',
    });
  }, [toast]);

  const handleToggleChecked = useCallback(
    async (lineId: string) => {
      setIsLoading(true);
      try {
        await onToggleChecked(list.id, lineId);
      } catch (err) {
        console.error('Failed to toggle list line:', err);
        showErrorToast();
      } finally {
        setIsLoading(false);
      }
    },
    [list.id, onToggleChecked, showErrorToast],
  );

  const handleUncheckAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await onUncheckAll(list.id);
    } catch (err) {
      console.error('Failed to uncheck all list lines:', err);
      showErrorToast();
    } finally {
      setIsLoading(false);
    }
  }, [list.id, onUncheckAll, showErrorToast]);

  const createUndoHandler = useCallback(
    (listId: string, lines: ListLine[]) => () => {
      void onRestoreLines(listId, lines);
    },
    [onRestoreLines],
  );

  const handleRemoveChecked = useCallback(async () => {
    setIsLoading(true);
    try {
      const removed = await onRemoveChecked(list.id);
      if (removed.length === 0) {
        toast({
          title: 'No checked items to remove.',
        });
        return;
      }
      toast({
        title: 'Checked items removed',
        description: `${removed.length} Checked Item${removed.length !== 1 ? 's' : ''} removed from this Grocery List.`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={createUndoHandler(list.id, removed)}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (err) {
      console.error('Failed to remove checked list lines:', err);
      showErrorToast();
    } finally {
      setIsLoading(false);
    }
  }, [createUndoHandler, list.id, onRemoveChecked, showErrorToast, toast]);

  const handleDeleteLine = useCallback(
    async (lineId: string) => {
      setIsLoading(true);
      try {
        await onDeleteLine(list.id, lineId);
      } catch (err) {
        console.error('Failed to delete list line:', err);
        showErrorToast();
      } finally {
        setIsLoading(false);
      }
    },
    [list.id, onDeleteLine, showErrorToast],
  );

  const handleAddItem = useCallback(
    async (values: AddItemFormResult) => {
      setIsLoading(true);
      try {
        await onAddItem(list.id, values);
        setIsAddDialogOpen(false);
      } catch (err) {
        console.error('Failed to add item to list:', err);
        showErrorToast();
      } finally {
        setIsLoading(false);
      }
    },
    [list.id, onAddItem, showErrorToast],
  );

  const handleOpenAddDialog = useCallback(() => {
    setIsAddDialogOpen(true);
  }, []);

  const handleCloseAddDialog = useCallback(() => {
    setIsAddDialogOpen(false);
  }, []);

  const handleOpenAddExistingDialog = useCallback(() => {
    setIsAddExistingDialogOpen(true);
  }, []);

  const handleCloseAddExistingDialog = useCallback(() => {
    setIsAddExistingDialogOpen(false);
  }, []);

  const handleAddExistingItem = useCallback(
    async (catalogItemId: string, listIds: string[], amount?: string) => {
      setIsLoading(true);
      try {
        const addedListIds = await onAddExistingItem(
          catalogItemId,
          listIds,
          amount,
        );
        setIsAddExistingDialogOpen(false);
        if (addedListIds.length === 0) {
          toast({
            title: 'Already on every selected list.',
          });
        } else if (addedListIds.length === listIds.length) {
          toast({
            title: 'Added to lists',
            description: `Added to ${addedListIds.length} list${addedListIds.length !== 1 ? 's' : ''}.`,
          });
        } else {
          toast({
            title: 'Added to lists',
            description: `Added to ${addedListIds.length} of ${listIds.length} lists (already on the rest).`,
          });
        }
      } catch (err) {
        console.error('Failed to add existing catalog item to lists:', err);
        showErrorToast();
      } finally {
        setIsLoading(false);
      }
    },
    [onAddExistingItem, showErrorToast, toast],
  );

  const handleAddFromCatalogStrip = useCallback(
    async (catalogItemId: string) => {
      setIsLoading(true);
      try {
        const addedListIds = await onAddExistingItem(catalogItemId, [list.id]);
        if (addedListIds.length === 0) {
          toast({
            title: 'Already on this list.',
          });
        }
      } catch (err) {
        console.error('Failed to add catalog item to list:', err);
        showErrorToast();
      } finally {
        setIsLoading(false);
      }
    },
    [list.id, onAddExistingItem, showErrorToast, toast],
  );

  const handleRequestDeleteFromCatalog = useCallback(
    (catalogItemId: string) => {
      const item = catalog.find((c) => c.id === catalogItemId);
      if (item) {
        setCatalogItemPendingDelete(item);
      }
    },
    [catalog],
  );

  const handleUpdateCatalogItem = useCallback(
    async (changes: CatalogItemEditChanges) => {
      setIsLoading(true);
      try {
        await onUpdateCatalogItem(changes);
        setCatalogItemPendingEdit(null);
      } catch (err) {
        console.error('Failed to update catalog item:', err);
        showErrorToast();
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onUpdateCatalogItem, showErrorToast],
  );

  const handleUpdateListLine = useCallback(
    async (changes: { id: string; amount?: string }) => {
      setIsLoading(true);
      try {
        await onUpdateListLine(list.id, changes);
        setLinePendingEdit(null);
      } catch (err) {
        console.error('Failed to update list line:', err);
        showErrorToast();
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [list.id, onUpdateListLine, showErrorToast],
  );

  const handleEditListLine = useCallback(
    (lineId: string) => {
      setLinePendingEdit(list.lines.find((line) => line.id === lineId) ?? null);
    },
    [list.lines],
  );

  const handleEditCatalogItem = useCallback(
    (catalogItemId: string) => {
      setCatalogItemPendingEdit(
        catalog.find((item) => item.id === catalogItemId) ?? null,
      );
    },
    [catalog],
  );

  const handleCloseCatalogEdit = useCallback(() => {
    setCatalogItemPendingEdit(null);
  }, []);

  const handleCloseLineEdit = useCallback(() => {
    setLinePendingEdit(null);
  }, []);

  const handleCloseDeleteCatalogDialog = useCallback(() => {
    setCatalogItemPendingDelete(null);
  }, []);

  const handleConfirmDeleteFromCatalog = useCallback(async () => {
    if (!catalogItemPendingDelete) return;
    setIsLoading(true);
    try {
      await onDeleteFromCatalog(catalogItemPendingDelete.id);
      toast({
        title: `Deleted "${catalogItemPendingDelete.name}" from Catalog`,
      });
    } catch (err) {
      console.error('Failed to delete catalog item:', err);
      showErrorToast();
    } finally {
      setIsLoading(false);
      setCatalogItemPendingDelete(null);
    }
  }, [catalogItemPendingDelete, onDeleteFromCatalog, showErrorToast, toast]);

  const affectedListCount = useMemo(() => {
    if (!catalogItemPendingDelete) return 0;
    const totalLists = allLists.filter((otherList) =>
      otherList.lines.some(
        (line) => line.catalogItemId === catalogItemPendingDelete.id,
      ),
    ).length;
    const includesCurrentList = list.lines.some(
      (line) => line.catalogItemId === catalogItemPendingDelete.id,
    );
    return includesCurrentList ? totalLists - 1 : totalLists;
  }, [allLists, catalogItemPendingDelete, list.lines]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/groceries"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline focus-visible:underline"
            aria-label="Back to groceries"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Groceries
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-foreground">
            {list.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active · {checked.length} checked ·{' '}
            {formatMoney(summary.known)} known
          </p>
        </div>
        <TripBoardLifecycleToolbar
          checkedCount={checked.length}
          onUncheckAll={handleUncheckAll}
          onRemoveChecked={handleRemoveChecked}
          onAddItem={handleOpenAddDialog}
          isLoading={isLoading}
        />
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Add from catalog
        </h2>
        <TripBoardCatalogAddStrip
          catalog={catalog}
          lists={allLists}
          currentListId={list.id}
          onAdd={handleAddFromCatalogStrip}
          onOpenMultiListDialog={handleOpenAddExistingDialog}
          isLoading={isLoading}
        />
      </section>

      <TripBoardLineColumns
        active={active}
        checked={checked}
        catalog={catalog}
        onToggleChecked={handleToggleChecked}
        onDeleteLine={handleDeleteLine}
        onDeleteFromCatalog={handleRequestDeleteFromCatalog}
        onEditListLine={handleEditListLine}
        onEditCatalogItem={handleEditCatalogItem}
        isLoading={isLoading}
      />

      <TripBoardSpendFooter summary={summary} />

      <AddItemDialog
        isOpen={isAddDialogOpen}
        onClose={handleCloseAddDialog}
        onAdd={handleAddItem}
        isLoading={isLoading}
        catalog={catalog}
      />

      <AddExistingItemDialog
        isOpen={isAddExistingDialogOpen}
        onClose={handleCloseAddExistingDialog}
        catalog={catalog}
        lists={allLists}
        defaultListId={list.id}
        onAdd={handleAddExistingItem}
        isLoading={isLoading}
      />

      <DeleteCatalogItemDialog
        isOpen={catalogItemPendingDelete !== null}
        catalogItem={catalogItemPendingDelete}
        affectedListCount={affectedListCount}
        onClose={handleCloseDeleteCatalogDialog}
        onConfirm={handleConfirmDeleteFromCatalog}
        isLoading={isLoading}
      />

      <CatalogItemEditDialog
        item={catalogItemPendingEdit}
        isOpen={catalogItemPendingEdit !== null}
        onClose={handleCloseCatalogEdit}
        onSave={handleUpdateCatalogItem}
        isLoading={isLoading}
      />
      <ListLineEditDialog
        line={linePendingEdit}
        catalogItem={
          linePendingEdit
            ? catalog.find((item) => item.id === linePendingEdit.catalogItemId)
            : undefined
        }
        isOpen={linePendingEdit !== null}
        onClose={handleCloseLineEdit}
        onSave={handleUpdateListLine}
        isLoading={isLoading}
      />
    </div>
  );
}
