'use client';

import type { GroceryList } from '@myorganizer/core';
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

interface UseGroceriesVaultResult {
  lists: GroceryList[];
  loading: boolean;
  error: string | null;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  setError: (error: string | null) => void;
  persistLists: (lists: GroceryList[]) => Promise<void>;
  createList: (name: string) => Promise<void>;
  renameList: (listId: string, newName: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
}

/**
 * Custom hook for managing grocery lists with vault persistence.
 *
 * Handles:
 * - Loading grocery lists from encrypted vault storage
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
 * // Use vault.lists, vault.persistLists, etc.
 * ```
 */
export function useGroceriesVault({
  masterKeyBytes,
}: UseGroceriesVaultOptions): UseGroceriesVaultResult {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load lists from vault on mount
  useEffect(() => {
    setError(null);
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'groceries',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeGroceries(raw);
        setLists(normalized.value);
        if (normalized.value.length > 0) {
          setSelectedListId(normalized.value[0].id);
        }
        // Re-save if data was normalized (data migration)
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

  // Persist lists to vault
  const persistLists = useCallback(
    async (nextLists: GroceryList[]) => {
      setError(null);
      try {
        await saveEncryptedData({
          masterKeyBytes,
          type: 'groceries',
          value: nextLists,
        });
        setLists(nextLists);
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
          items: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const nextLists = [...lists, newList];
        await persistLists(nextLists);
        setSelectedListId(newList.id);
      } catch (err) {
        console.error('Failed to create list:', err);
      }
    },
    [lists, persistLists],
  );

  // Rename an existing grocery list
  const renameList = useCallback(
    async (listId: string, newName: string) => {
      try {
        const nextLists = lists.map((list) =>
          list.id === listId
            ? { ...list, name: newName, updatedAt: new Date().toISOString() }
            : list,
        );
        await persistLists(nextLists);
      } catch (err) {
        console.error('Failed to rename list:', err);
      }
    },
    [lists, persistLists],
  );

  // Delete a grocery list
  const deleteList = useCallback(
    async (listId: string) => {
      try {
        const nextLists = lists.filter((list) => list.id !== listId);
        await persistLists(nextLists);
        if (selectedListId === listId) {
          setSelectedListId(nextLists.length > 0 ? nextLists[0].id : null);
        }
      } catch (err) {
        console.error('Failed to delete list:', err);
      }
    },
    [lists, selectedListId, persistLists],
  );

  return {
    lists,
    loading,
    error,
    selectedListId,
    setSelectedListId,
    setError,
    persistLists,
    createList,
    renameList,
    deleteList,
  };
}
