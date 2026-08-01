'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
  GroceriesVaultPayload,
  ListLine,
} from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import {
  loadDecryptedData,
  normalizeGroceries,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { useCallback, useEffect, useState } from 'react';

interface UseGroceriesVaultOptions {
  masterKeyBytes: Uint8Array;
}

/** Fields a caller may supply when adding an item to a Grocery List. */
export interface AddCatalogItemAndLineInput {
  name: string;
  category: GroceryCategoryType;
  price?: number;
  notes?: string;
  imageUrl?: string;
  links?: string[];
  amount?: string;
}

interface UseGroceriesVaultResult {
  lists: GroceryList[];
  catalog: CatalogItem[];
  loading: boolean;
  error: string | null;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  setError: (error: string | null) => void;
  persistPayload: (payload: GroceriesVaultPayload) => Promise<void>;
  createList: (name: string) => Promise<void>;
  renameList: (listId: string, newName: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  /** Toggle a single List Line's checked (bought-on-this-trip) state. */
  toggleLineChecked: (listId: string, lineId: string) => Promise<void>;
  /** Turn every Checked Item back to unchecked. Never removes lines. */
  uncheckAllLines: (listId: string) => Promise<void>;
  /**
   * Removes Checked Items from the list only (Catalog Items are untouched).
   * Returns the removed lines so the caller can offer an undo affordance.
   */
  removeCheckedLines: (listId: string) => Promise<ListLine[]>;
  /** Re-inserts previously removed lines (undo for removeCheckedLines). */
  restoreLines: (listId: string, lines: ListLine[]) => Promise<void>;
  /** Deletes one List Line only; the referenced Catalog Item remains. */
  deleteListLine: (listId: string, lineId: string) => Promise<void>;
  /**
   * Adds an item to a Grocery List: reuses an existing Catalog Item when the
   * name matches case-insensitively (updating its durable fields), otherwise
   * creates a new Catalog Item, then attaches a new List Line to the list.
   */
  addCatalogItemAndLine: (
    listId: string,
    input: AddCatalogItemAndLineInput,
  ) => Promise<void>;
}

/**
 * Custom hook for managing grocery lists with vault persistence.
 *
 * Handles:
 * - Loading grocery lists from encrypted vault storage (catalog + lists payload)
 * - Saving changes back to vault
 * - Normalizing data on load
 * - Error handling and reporting
 *
 * @param options Configuration with masterKeyBytes for encryption
 * @returns State and handlers for grocery list management
 *
 * @example
 * ```tsx
 * const vault = useGroceriesVault({ masterKeyBytes });
 * // Use vault.lists, vault.createList, vault.renameList, vault.deleteList
 * ```
 */
export function useGroceriesVault({
  masterKeyBytes,
}: UseGroceriesVaultOptions): UseGroceriesVaultResult {
  const [payload, setPayload] = useState<GroceriesVaultPayload>({
    catalog: [],
    lists: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load payload from vault on mount
  useEffect(() => {
    setError(null);
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'groceries',
      defaultValue: null,
    })
      .then(async (raw) => {
        const normalized = normalizeGroceries(raw);
        setPayload(normalized.value);
        if (normalized.value.lists.length > 0) {
          setSelectedListId(normalized.value.lists[0].id);
        }
        // Re-save if data was normalized (data migration or repair)
        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes,
            type: 'groceries',
            value: normalized.value,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load grocery lists from vault:', err);
        setError('Failed to load your grocery lists. Please try again.');
        setLoading(false);
      });
  }, [masterKeyBytes]);

  // Persist full payload to vault
  const persistPayload = useCallback(
    async (nextPayload: GroceriesVaultPayload) => {
      setError(null);
      try {
        await saveEncryptedData({
          masterKeyBytes,
          type: 'groceries',
          value: nextPayload,
        });
        setPayload(nextPayload);
      } catch (err) {
        console.error('Failed to save grocery lists to vault:', err);
        setError('Failed to save your changes. Please try again.');
        throw err;
      }
    },
    [masterKeyBytes],
  );

  // Create a new grocery list
  const createList = useCallback(
    async (name: string) => {
      try {
        const newList: GroceryList = {
          id: randomId(),
          name,
          lines: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: [...payload.lists, newList],
        };
        await persistPayload(nextPayload);
        setSelectedListId(newList.id);
      } catch (err) {
        console.error('Failed to create list:', err);
      }
    },
    [payload, persistPayload],
  );

  // Rename an existing grocery list
  const renameList = useCallback(
    async (listId: string, newName: string) => {
      try {
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: payload.lists.map((list) =>
            list.id === listId
              ? { ...list, name: newName, updatedAt: new Date().toISOString() }
              : list,
          ),
        };
        await persistPayload(nextPayload);
      } catch (err) {
        console.error('Failed to rename list:', err);
      }
    },
    [payload, persistPayload],
  );

  // Delete a grocery list
  const deleteList = useCallback(
    async (listId: string) => {
      try {
        const nextLists = payload.lists.filter((list) => list.id !== listId);
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: nextLists,
        };
        await persistPayload(nextPayload);
        if (selectedListId === listId) {
          setSelectedListId(nextLists.length > 0 ? nextLists[0].id : null);
        }
      } catch (err) {
        console.error('Failed to delete list:', err);
      }
    },
    [payload, selectedListId, persistPayload],
  );

  /** Toggle a single List Line's checked (bought-on-this-trip) state. */
  const toggleLineChecked = useCallback(
    async (listId: string, lineId: string) => {
      try {
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: payload.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  lines: list.lines.map((line) =>
                    line.id === lineId
                      ? {
                          ...line,
                          checked: !line.checked,
                          updatedAt: new Date().toISOString(),
                        }
                      : line,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : list,
          ),
        };
        await persistPayload(nextPayload);
      } catch (err) {
        console.error('Failed to toggle list line:', err);
      }
    },
    [payload, persistPayload],
  );

  /** Turn every Checked Item back to unchecked. Never removes lines. */
  const uncheckAllLines = useCallback(
    async (listId: string) => {
      try {
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: payload.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  lines: list.lines.map((line) =>
                    line.checked
                      ? {
                          ...line,
                          checked: false,
                          updatedAt: new Date().toISOString(),
                        }
                      : line,
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : list,
          ),
        };
        await persistPayload(nextPayload);
      } catch (err) {
        console.error('Failed to uncheck all list lines:', err);
      }
    },
    [payload, persistPayload],
  );

  /**
   * Removes Checked Items from the list only (Catalog Items are untouched).
   * Returns the removed lines so the caller can offer an undo affordance.
   */
  const removeCheckedLines = useCallback(
    async (listId: string): Promise<ListLine[]> => {
      const list = payload.lists.find((l) => l.id === listId);
      if (!list) return [];

      const removed = list.lines.filter((line) => line.checked);
      if (removed.length === 0) return [];

      try {
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: payload.lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  lines: l.lines.filter((line) => !line.checked),
                  updatedAt: new Date().toISOString(),
                }
              : l,
          ),
        };
        await persistPayload(nextPayload);
        return removed;
      } catch (err) {
        console.error('Failed to remove checked list lines:', err);
        return [];
      }
    },
    [payload, persistPayload],
  );

  /** Re-inserts previously removed lines (undo for removeCheckedLines). */
  const restoreLines = useCallback(
    async (listId: string, lines: ListLine[]) => {
      if (lines.length === 0) return;
      try {
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: payload.lists.map((list) => {
            if (list.id !== listId) return list;
            const existingIds = new Set(list.lines.map((line) => line.id));
            const toRestore = lines.filter((line) => !existingIds.has(line.id));
            return {
              ...list,
              lines: [...list.lines, ...toRestore],
              updatedAt: new Date().toISOString(),
            };
          }),
        };
        await persistPayload(nextPayload);
      } catch (err) {
        console.error('Failed to restore list lines:', err);
      }
    },
    [payload, persistPayload],
  );

  /** Deletes one List Line only; the referenced Catalog Item remains. */
  const deleteListLine = useCallback(
    async (listId: string, lineId: string) => {
      try {
        const nextPayload: GroceriesVaultPayload = {
          ...payload,
          lists: payload.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  lines: list.lines.filter((line) => line.id !== lineId),
                  updatedAt: new Date().toISOString(),
                }
              : list,
          ),
        };
        await persistPayload(nextPayload);
      } catch (err) {
        console.error('Failed to delete list line:', err);
      }
    },
    [payload, persistPayload],
  );

  /**
   * Adds an item to a Grocery List: reuses an existing Catalog Item when the
   * name matches case-insensitively (updating its durable fields), otherwise
   * creates a new Catalog Item, then attaches a new List Line to the list.
   */
  const addCatalogItemAndLine = useCallback(
    async (listId: string, input: AddCatalogItemAndLineInput) => {
      try {
        const now = new Date().toISOString();
        const trimmedName = input.name.trim();
        const existing = payload.catalog.find(
          (item) =>
            item.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        );

        let catalogItemId: string;
        let nextCatalog: CatalogItem[];

        if (existing) {
          catalogItemId = existing.id;
          nextCatalog = payload.catalog.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  name: trimmedName,
                  category: input.category,
                  price: input.price,
                  notes: input.notes,
                  imageUrl: input.imageUrl,
                  links: input.links,
                  updatedAt: now,
                }
              : item,
          );
        } else {
          const newCatalogItem: CatalogItem = {
            id: randomId(),
            name: trimmedName,
            category: input.category,
            price: input.price,
            notes: input.notes,
            imageUrl: input.imageUrl,
            links: input.links,
            createdAt: now,
            updatedAt: now,
          };
          catalogItemId = newCatalogItem.id;
          nextCatalog = [...payload.catalog, newCatalogItem];
        }

        const newLine: ListLine = {
          id: randomId(),
          catalogItemId,
          checked: false,
          amount: input.amount,
          createdAt: now,
          updatedAt: now,
        };

        const nextPayload: GroceriesVaultPayload = {
          catalog: nextCatalog,
          lists: payload.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  lines: [...list.lines, newLine],
                  updatedAt: now,
                }
              : list,
          ),
        };
        await persistPayload(nextPayload);
      } catch (err) {
        console.error('Failed to add item to list:', err);
        throw err;
      }
    },
    [payload, persistPayload],
  );

  return {
    lists: payload.lists,
    catalog: payload.catalog,
    loading,
    error,
    selectedListId,
    setSelectedListId,
    setError,
    persistPayload,
    createList,
    renameList,
    deleteList,
    toggleLineChecked,
    uncheckAllLines,
    removeCheckedLines,
    restoreLines,
    deleteListLine,
    addCatalogItemAndLine,
  };
}
