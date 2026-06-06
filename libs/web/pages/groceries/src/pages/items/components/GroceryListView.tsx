'use client';

import type {
  GroceryCategoryType,
  GroceryItem,
  GroceryList,
} from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import { Button, useToast } from '@myorganizer/web-ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { CategoryFilterBar } from '../../../shared/components/CategoryFilterBar';
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../../../shared/constants/categories';
import { AddItemInlineForm } from './AddItemInlineForm';
import { EditItemDialog } from './EditItemDialog';
import { GroceryItemRow } from './GroceryItemRow';

interface GroceryListViewProps {
  list: GroceryList;
  masterKeyBytes: Uint8Array;
  onListUpdated: (updated: GroceryList) => void;
  onClose: () => void;
  persistLists: (lists: GroceryList[]) => Promise<void>;
  allLists: GroceryList[];
}

/**
 * Main grocery list view component
 * Displays and manages items within a selected list
 */
export function GroceryListView({
  list,
  masterKeyBytes,
  onListUpdated,
  onClose,
  persistLists,
  allLists,
}: GroceryListViewProps) {
  const { toast } = useToast();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    GroceryCategoryType | 'all'
  >('all');

  const editingItem = list.items.find((item) => item.id === editingItemId);

  /**
   * Helper: update a single item and refresh updatedAt
   */
  const updateItem = (
    items: GroceryItem[],
    patch: Partial<GroceryItem> & { id: string },
  ): GroceryItem[] =>
    items.map((item) =>
      item.id === patch.id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item,
    );

  /**
   * Persist changes to the vault
   */
  const persistChanges = useCallback(
    async (updatedList: GroceryList) => {
      try {
        setIsLoading(true);
        onListUpdated(updatedList);
        const nextAllLists = allLists.map((l) =>
          l.id === updatedList.id ? updatedList : l,
        );
        await persistLists(nextAllLists);
      } catch (err) {
        console.error('Failed to persist changes:', err);
        toast({
          title: 'Error',
          description: 'Failed to save your changes. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [allLists, onListUpdated, persistLists, toast],
  );

  /**
   * Add a new item to the list
   */
  const handleAddItem = useCallback(
    async (name: string) => {
      const newItem: GroceryItem = {
        id: randomId(),
        name,
        category: 'other',
        checked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated: GroceryList = {
        ...list,
        items: [...list.items, newItem],
        updatedAt: new Date().toISOString(),
      };

      await persistChanges(updated);
      toast({
        title: 'Item added',
        description: `"${name}" has been added to your list.`,
      });
    },
    [list, persistChanges, toast],
  );

  /**
   * Toggle checked state of an item
   */
  const handleToggleChecked = useCallback(
    async (id: string) => {
      const item = list.items.find((i) => i.id === id);
      if (!item) return;

      const patched = updateItem(list.items, {
        id,
        checked: !item.checked,
      });

      const updated: GroceryList = {
        ...list,
        items: patched,
        updatedAt: new Date().toISOString(),
      };

      await persistChanges(updated);
    },
    [list, persistChanges],
  );

  /**
   * Edit an existing item
   */
  const handleEditItem = useCallback(
    async (id: string, changes: Partial<GroceryItem>) => {
      const patched = updateItem(list.items, {
        id,
        ...changes,
      });

      const updated: GroceryList = {
        ...list,
        items: patched,
        updatedAt: new Date().toISOString(),
      };

      await persistChanges(updated);
      setEditingItemId(null);

      const itemName = list.items.find((i) => i.id === id)?.name || 'Item';
      toast({
        title: 'Item updated',
        description: `"${itemName}" has been updated.`,
      });
    },
    [list, persistChanges, toast],
  );

  /**
   * Delete an item from the list
   */
  const handleDeleteItem = useCallback(
    async (id: string) => {
      const item = list.items.find((i) => i.id === id);
      if (!item) return;

      const patched = list.items.filter((i) => i.id !== id);

      const updated: GroceryList = {
        ...list,
        items: patched,
        updatedAt: new Date().toISOString(),
      };

      await persistChanges(updated);

      toast({
        title: 'Item deleted',
        description: `"${item.name}" has been removed from your list.`,
      });
    },
    [list, persistChanges, toast],
  );

  /**
   * Clear all checked items
   */
  const handleClearChecked = useCallback(async () => {
    const patched = list.items.filter((i) => !i.checked);
    const checkedCount = list.items.length - patched.length;

    if (checkedCount === 0) {
      toast({
        title: 'No items to clear',
        description: 'There are no checked items to remove.',
      });
      return;
    }

    const updated: GroceryList = {
      ...list,
      items: patched,
      updatedAt: new Date().toISOString(),
    };

    await persistChanges(updated);

    toast({
      title: 'Items cleared',
      description: `${checkedCount} completed item${checkedCount !== 1 ? 's' : ''} removed.`,
    });
  }, [list, persistChanges, toast]);

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    return selectedCategory === 'all'
      ? list.items
      : list.items.filter((item) => item.category === selectedCategory);
  }, [list.items, selectedCategory]);

  // Group items by category in the order defined
  const groupedItems = useMemo(() => {
    const groups: Record<GroceryCategoryType, GroceryItem[]> = {} as Record<
      GroceryCategoryType,
      GroceryItem[]
    >;

    // Initialize all categories
    CATEGORY_ORDER.forEach((cat) => {
      groups[cat] = [];
    });

    // Group items
    filteredItems.forEach((item) => {
      const category = (item.category as GroceryCategoryType) || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    // Return only non-empty categories in order
    return CATEGORY_ORDER.filter((cat) => groups[cat].length > 0).map(
      (cat) => ({
        category: cat,
        items: groups[cat],
      }),
    );
  }, [filteredItems]);

  const checkedCount = filteredItems.filter((item) => item.checked).length;
  const hasCheckedItems = checkedCount > 0;

  // Get all categories that have items in this list
  const categoriesWithItems = useMemo(() => {
    const cats = new Set<GroceryCategoryType>();
    list.items.forEach((item) => {
      cats.add((item.category as GroceryCategoryType) || 'other');
    });
    return Array.from(cats);
  }, [list.items]);

  return (
    <div className="space-y-lg px-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-md pb-md border-b border-outline-variant">
        <div className="flex items-center gap-md grow">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-secondary-container/20 transition-colors"
            aria-label="Back to groceries"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div>
            <h2 className="text-lg font-semibold text-on-surface md:text-xl">
              {list.name}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {list.items.length} item{list.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <AddItemInlineForm onAdd={handleAddItem} isLoading={isLoading} />

      {/* Category Filter Tabs */}
      <div className="-mx-md px-md border-b border-outline-variant">
        <CategoryFilterBar
          items={list.items}
          activeCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {/* Action Bar */}
      {hasCheckedItems && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearChecked}
            disabled={isLoading}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear checked ({checkedCount})</span>
          </Button>
        </div>
      )}

      {/* Items List */}
      {list.items.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block rounded-full bg-secondary-container p-4 mb-4">
            <svg
              className="h-8 w-8 text-on-secondary-container"
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
          <h3 className="text-lg font-semibold text-on-surface mb-2">
            No items yet
          </h3>
          <p className="text-sm text-on-surface-variant mb-6">
            Add your first item to get started
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-on-surface-variant">
            No items in this category
          </p>
        </div>
      ) : (
        <div className="space-y-md">
          {groupedItems.map((group) => (
            <div key={group.category}>
              {/* Category Header */}
              {selectedCategory === 'all' && (
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-md py-md">
                  {CATEGORY_EMOJIS[group.category]}{' '}
                  {CATEGORY_LABELS[group.category]}
                </h3>
              )}

              {/* Items in this category */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant shadow-sm">
                {group.items.map((item) => (
                  <GroceryItemRow
                    key={item.id}
                    item={item}
                    onToggleChecked={handleToggleChecked}
                    onEdit={(id) => setEditingItemId(id)}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Item Dialog — keyed by editingItemId so useForm re-initialises per item */}
      <EditItemDialog
        key={editingItemId ?? 'none'}
        item={editingItem || null}
        isOpen={editingItemId !== null}
        onClose={() => setEditingItemId(null)}
        onSave={(changes) => handleEditItem(changes.id, changes)}
        isLoading={isLoading}
      />
    </div>
  );
}
