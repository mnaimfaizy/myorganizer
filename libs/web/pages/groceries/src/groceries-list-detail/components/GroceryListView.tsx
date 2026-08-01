'use client';

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import { ToastAction, useToast } from '@myorganizer/web-ui';
import { useCallback, useMemo, useState } from 'react';
import type { AddCatalogItemAndLineInput } from '../../shared/hooks';
import { summarizeListSpend } from '../../shared/utils';
import type { AddItemFormResult } from './AddItemDialog';
import { AddItemDialog } from './AddItemDialog';
import { TripBoardLifecycleToolbar } from './TripBoardLifecycleToolbar';
import { TripBoardLineRow } from './TripBoardLineRow';
import { TripBoardSpendFooter } from './TripBoardSpendFooter';

interface GroceryListViewProps {
  list: GroceryList;
  catalog: CatalogItem[];
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
}

/**
 * Trip Board detail view — manages the List Lines within a single Grocery
 * List (Active vs Checked, spend summary, and lifecycle actions).
 */
export function GroceryListView({
  list,
  catalog,
  onToggleChecked,
  onUncheckAll,
  onRemoveChecked,
  onRestoreLines,
  onDeleteLine,
  onAddItem,
}: GroceryListViewProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
            onClick={() => {
              void onRestoreLines(list.id, removed);
            }}
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
  }, [list.id, onRemoveChecked, onRestoreLines, showErrorToast, toast]);

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
      />
    </div>
  );
}
