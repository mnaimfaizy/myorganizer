'use client';

import { Button, Skeleton } from '@myorganizer/web-ui';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useGroceriesVault } from '../hooks';
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
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const vault = useGroceriesVault({ masterKeyBytes });

  if (vault.loading) {
    return (
      <div
        className="min-h-screen bg-surface"
        aria-busy="true"
        aria-label="Loading groceries list"
      >
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
        {/* Error banner */}
        {vault.error && (
          <div
            className="mb-4 flex items-start gap-3 rounded-lg border border-error bg-error-container p-4 text-error md:mb-6"
            role="alert"
            aria-live="polite"
          >
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0"
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
              <p className="font-medium text-on-error-container">
                {vault.error}
              </p>
              <button
                onClick={() => vault.setError(null)}
                className="mt-2 text-sm font-medium text-on-error-container underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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
            disabled={vault.loading}
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
            aria-label="Search grocery lists by name"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-secondary md:max-w-md"
          />
        </div>

        {/* Lists section */}
        {vault.lists.length === 0 ? (
          // Empty state
          <div
            className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-8 text-center md:p-12"
            role="status"
            aria-live="polite"
          >
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
            lists={vault.lists}
            selectedListIds={selectedListIds}
            onSelectLists={setSelectedListIds}
            onRenameList={(listId) => {
              const list = vault.lists.find((l) => l.id === listId);
              if (list) {
                setDialog({
                  type: 'rename',
                  listId,
                  listName: list.name,
                });
              }
            }}
            onDeleteList={(listId) => {
              const list = vault.lists.find((l) => l.id === listId);
              if (list) {
                setDialog({
                  type: 'delete',
                  listId,
                  listName: list.name,
                  itemCount: list.items.length,
                });
              }
            }}
            isLoading={vault.loading}
          />
        )}
      </div>

      {/* Dialogs */}
      <CreateListDialog
        isOpen={dialog.type === 'create'}
        onClose={() => setDialog({ type: null })}
        onSubmit={async (name) => {
          await vault.createList(name);
          // Auto-select newly created list (hook already sets vault.selectedListId)
          if (vault.selectedListId) {
            setSelectedListIds([vault.selectedListId]);
          }
          setDialog({ type: null });
        }}
        isLoading={vault.loading}
      />

      {dialog.type === 'rename' && (
        <RenameListDialog
          isOpen={true}
          currentName={dialog.listName || ''}
          onClose={() => setDialog({ type: null })}
          onSubmit={async (newName) => {
            await vault.renameList(dialog.listId!, newName);
            setDialog({ type: null });
          }}
          isLoading={vault.loading}
        />
      )}

      {dialog.type === 'delete' && (
        <DeleteListConfirmDialog
          isOpen={true}
          listName={dialog.listName || ''}
          itemCount={dialog.itemCount || 0}
          onClose={() => setDialog({ type: null })}
          onConfirm={async () => {
            await vault.deleteList(dialog.listId!);
            setDialog({ type: null });
          }}
          isLoading={vault.loading}
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
