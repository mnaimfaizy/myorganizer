'use client';

import type { GroceryList, GroceriesVaultPayload } from '@myorganizer/core';
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
  persistPayload: (payload: GroceriesVaultPayload) => Promise<void>;
  createList: (name: string) => Promise<void>;
  renameList: (listId: string, newName: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
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

  return {
    lists: payload.lists,
    loading,
    error,
    selectedListId,
    setSelectedListId,
    setError,
    persistPayload,
    createList,
    renameList,
    deleteList,
  };
}
