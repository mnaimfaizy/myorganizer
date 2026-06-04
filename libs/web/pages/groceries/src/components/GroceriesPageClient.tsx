'use client';

import type { GroceryList } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import { Button, Skeleton } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeGroceries,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CreateListDialog } from './CreateListDialog';
import { DeleteListConfirmDialog } from './DeleteListConfirmDialog';
import { GroceryListSelector } from './GroceryListSelector';
import { RenameListDialog } from './RenameListDialog';

interface GroceriesInnerProps {
  masterKeyBytes: Uint8Array;
}

interface DialogState {
  type: 'create' | 'rename' | 'delete' | null;
  listId?: string;
  listName?: string;
  itemCount?: number;
}

function GroceriesInner({ masterKeyBytes }: GroceriesInnerProps) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [saving, setSaving] = useState(false);

  // Load lists from vault on mount
  useEffect(() => {
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
        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes,
            type: 'groceries',
            value: normalized.value,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [masterKeyBytes]);

  // Persist lists to vault
  const persistLists = useCallback(
    async (nextLists: GroceryList[]) => {
      setSaving(true);
      try {
        await saveEncryptedData({
          masterKeyBytes,
          type: 'groceries',
          value: nextLists,
        });
        setLists(nextLists);
      } finally {
        setSaving(false);
      }
    },
    [masterKeyBytes],
  );

  // Handlers
  const handleCreateList = useCallback(
    async (name: string) => {
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
      setDialog({ type: null });
    },
    [lists, persistLists],
  );

  const handleRenameList = useCallback(
    async (listId: string, newName: string) => {
      const nextLists = lists.map((list) =>
        list.id === listId
          ? { ...list, name: newName, updatedAt: new Date().toISOString() }
          : list,
      );
      await persistLists(nextLists);
      setDialog({ type: null });
    },
    [lists, persistLists],
  );

  const handleDeleteList = useCallback(
    async (listId: string) => {
      const nextLists = lists.filter((list) => list.id !== listId);
      await persistLists(nextLists);
      if (selectedListId === listId) {
        setSelectedListId(nextLists.length > 0 ? nextLists[0].id : null);
      }
      setDialog({ type: null });
    },
    [lists, selectedListId, persistLists],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          {/* Header skeleton */}
          <div className="mb-6 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* List cards skeleton */}
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
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-on-surface md:text-4xl">
              Groceries
            </h1>
            <p className="mt-1 text-on-surface-variant">
              Access and manage your shopping lists.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full gap-2 md:w-auto"
            onClick={() => setDialog({ type: 'create' })}
          >
            <Plus className="h-5 w-5" />
            New List
          </Button>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search your lists..."
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-secondary md:max-w-md"
          />
        </div>

        {/* Lists section */}
        {lists.length === 0 ? (
          // Empty state
          <div className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-8 text-center md:p-12">
            <div className="mb-4 inline-block rounded-full bg-secondary-container p-3">
              <svg
                className="h-8 w-8 text-on-secondary"
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
            <h2 className="text-xl font-semibold text-on-surface md:text-2xl">
              No grocery lists yet
            </h2>
            <p className="mt-2 text-on-surface-variant">
              Create your first list to get started organizing your shopping.
            </p>
            <Button
              className="mt-6"
              onClick={() => setDialog({ type: 'create' })}
            >
              Create Your First List
            </Button>
          </div>
        ) : (
          <GroceryListSelector
            lists={lists}
            selectedListId={selectedListId}
            onSelectList={setSelectedListId}
            onRenameList={(listId) => {
              const list = lists.find((l) => l.id === listId);
              if (list) {
                setDialog({
                  type: 'rename',
                  listId,
                  listName: list.name,
                });
              }
            }}
            onDeleteList={(listId) => {
              const list = lists.find((l) => l.id === listId);
              if (list) {
                setDialog({
                  type: 'delete',
                  listId,
                  listName: list.name,
                  itemCount: list.items.length,
                });
              }
            }}
            isLoading={saving}
          />
        )}
      </div>

      {/* Dialogs */}
      <CreateListDialog
        isOpen={dialog.type === 'create'}
        onClose={() => setDialog({ type: null })}
        onSubmit={handleCreateList}
        isLoading={saving}
      />

      {dialog.type === 'rename' && (
        <RenameListDialog
          isOpen={true}
          currentName={dialog.listName || ''}
          onClose={() => setDialog({ type: null })}
          onSubmit={(newName) => handleRenameList(dialog.listId!, newName)}
          isLoading={saving}
        />
      )}

      {dialog.type === 'delete' && (
        <DeleteListConfirmDialog
          isOpen={true}
          listName={dialog.listName || ''}
          itemCount={dialog.itemCount || 0}
          onClose={() => setDialog({ type: null })}
          onConfirm={() => handleDeleteList(dialog.listId!)}
          isLoading={saving}
        />
      )}
    </div>
  );
}

export function GroceriesPage() {
  return (
    <VaultGate title="Groceries">
      {(ctx) => <GroceriesInner masterKeyBytes={ctx.masterKeyBytes} />}
    </VaultGate>
  );
}
