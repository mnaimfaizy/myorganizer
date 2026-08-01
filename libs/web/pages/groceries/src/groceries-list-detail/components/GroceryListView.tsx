'use client';

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import { ToastAction, useToast } from '@myorganizer/web-ui';
import { useCallback, useMemo, useState } from 'react';
import type { AddCatalogItemAndLineInput } from '../../shared/hooks';
import { summarizeListSpend } from '../../shared/utils';
import { AddExistingItemDialog } from './AddExistingItemDialog';
import type { AddItemFormResult } from './AddItemDialog';
import { AddItemDialog } from './AddItemDialog';
import { DeleteCatalogItemDialog } from './DeleteCatalogItemDialog';
import { TripBoardLifecycleToolbar } from './TripBoardLifecycleToolbar';
import { TripBoardLineRow } from './TripBoardLineRow';
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
    <div className="space-y-lg">
      <div className="space-y-1 pb-md border-b border-outline-variant">
        <h2 className="text-lg font-semibold text-on-surface md:text-xl">
          {list.name}
        </h2>
        <p className="text-xs text-on-surface-variant">
          {active.length} active · {checked.length} checked ·{' '}
          {summary.known ? `$${summary.known.toFixed(2)}` : '$0.00'} known
        </p>
      </div>

      <TripBoardLifecycleToolbar
        checkedCount={checked.length}
        onUncheckAll={handleUncheckAll}
        onRemoveChecked={handleRemoveChecked}
        onAddItem={handleOpenAddDialog}
        onAddExisting={handleOpenAddExistingDialog}
        isLoading={isLoading}
      />

      {list.lines.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-on-surface mb-2">
            No items yet
          </h3>
          <p className="text-sm text-on-surface-variant">
            Use Add Item to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 pb-1">
              Active ({active.length})
            </h3>
            {active.length === 0 ? (
              <p className="px-1 text-sm text-on-surface-variant">
                Nothing left in cart
              </p>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border shadow-sm">
                {active.map((line) => (
                  <TripBoardLineRow
                    key={line.id}
                    line={line}
                    catalogItem={catalog.find(
                      (item) => item.id === line.catalogItemId,
                    )}
                    onToggleChecked={handleToggleChecked}
                    onDeleteLine={handleDeleteLine}
                    onDeleteFromCatalog={handleRequestDeleteFromCatalog}
                    onEditListLine={handleEditListLine}
                    onEditCatalogItem={handleEditCatalogItem}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 pb-1">
              Checked ({checked.length}) — visible until removed
            </h3>
            {checked.length === 0 ? (
              <p className="px-1 text-sm text-on-surface-variant">
                None bought yet
              </p>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border shadow-sm">
                {checked.map((line) => (
                  <TripBoardLineRow
                    key={line.id}
                    line={line}
                    catalogItem={catalog.find(
                      (item) => item.id === line.catalogItemId,
                    )}
                    onToggleChecked={handleToggleChecked}
                    onDeleteLine={handleDeleteLine}
                    onDeleteFromCatalog={handleRequestDeleteFromCatalog}
                    onEditListLine={handleEditListLine}
                    onEditCatalogItem={handleEditCatalogItem}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
