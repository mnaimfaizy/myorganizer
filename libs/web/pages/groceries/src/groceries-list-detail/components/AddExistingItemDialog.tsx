'use client';

import type { CatalogItem, GroceryList } from '@myorganizer/core';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Input,
  Label,
  cn,
} from '@myorganizer/web-ui';
import { Lock, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategoryEmoji } from '../../shared/constants/categories';
import { formatMoney } from '../../shared/utils';

interface AddExistingItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  lists: GroceryList[];
  defaultListId?: string;
  defaultCatalogItemId?: string;
  onAdd: (
    catalogItemId: string,
    listIds: string[],
    amount?: string,
  ) => Promise<string[] | void>;
  isLoading?: boolean;
}

/**
 * Lets the user attach an EXISTING Catalog Item as a new List Line to one or
 * many Grocery Lists at once, without duplicating the Catalog Item's identity.
 */
export function AddExistingItemDialog({
  isOpen,
  onClose,
  catalog,
  lists,
  defaultListId,
  defaultCatalogItemId,
  onAdd,
  isLoading = false,
}: AddExistingItemDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<
    string | null
  >(null);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(
    new Set(),
  );
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedCatalogItemId(defaultCatalogItemId ?? null);
    setAmount('');
    setSelectedListIds(new Set(defaultListId ? [defaultListId] : []));
  }, [isOpen, defaultCatalogItemId, defaultListId]);

  const filteredCatalog = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return catalog;
    return catalog.filter((item) => item.name.toLowerCase().includes(trimmed));
  }, [catalog, query]);

  const handleSelectCatalogItem = useCallback((catalogItemId: string) => {
    setSelectedCatalogItemId(catalogItemId);
  }, []);

  const handleToggleList = useCallback((listId: string) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  const canSubmit =
    !isLoading && selectedCatalogItemId !== null && selectedListIds.size > 0;

  const handleSubmit = useCallback(async () => {
    if (!selectedCatalogItemId || selectedListIds.size === 0) return;
    try {
      await onAdd(
        selectedCatalogItemId,
        Array.from(selectedListIds),
        amount || undefined,
      );
      onClose();
    } catch (err) {
      console.error('Failed to add existing catalog item to lists:', err);
    }
  }, [selectedCatalogItemId, selectedListIds, amount, onAdd, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl p-0 gap-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-border-muted">
          <div className="flex items-start gap-3 mb-1">
            <h2 className="text-xl font-semibold text-primary">
              Add From Catalog
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-container text-action-cyan rounded-full border border-action-cyan/20 text-[10px] font-bold tracking-wider uppercase shrink-0 mt-0.5">
              <Lock className="w-3 h-3" />
              Encrypted Data
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            Attach an existing Catalog Item to one or more Grocery Lists.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {catalog.length === 0 ? (
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-6 text-center">
              <p className="text-sm text-on-surface-variant">
                There are no Catalog Items yet. Use "Add Item" to create one
                first.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label
                  htmlFor="add-existing-item-search"
                  className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                >
                  Catalog Item
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant" />
                  <Input
                    id="add-existing-item-search"
                    placeholder="Search catalog by name..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={isLoading}
                    className="pl-9 text-base md:text-sm"
                  />
                </div>

                <div
                  role="radiogroup"
                  aria-label="Select a Catalog Item"
                  className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-outline-variant divide-y divide-outline-variant"
                >
                  {filteredCatalog.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-on-surface-variant">
                      No Catalog Items match "{query}".
                    </p>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected = item.id === selectedCatalogItemId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => handleSelectCatalogItem(item.id)}
                          disabled={isLoading}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-50',
                            isSelected
                              ? 'bg-secondary-fixed/20'
                              : 'hover:bg-surface-container-low',
                          )}
                        >
                          <span
                            className="text-lg shrink-0 leading-none"
                            aria-hidden="true"
                          >
                            {getCategoryEmoji(item.category)}
                          </span>
                          <span className="grow min-w-0 truncate text-sm font-medium text-on-surface">
                            {item.name}
                          </span>
                          {typeof item.price === 'number' && (
                            <span className="shrink-0 text-xs font-medium text-on-surface-variant">
                              {formatMoney(item.price)}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                  Add to Lists
                </Label>
                <div className="space-y-2 rounded-lg border border-outline-variant p-3">
                  {lists.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">
                      There are no Grocery Lists yet.
                    </p>
                  ) : (
                    lists.map((list) => (
                      <label
                        key={list.id}
                        className="flex items-center gap-2 text-sm text-on-surface"
                      >
                        <Checkbox
                          checked={selectedListIds.has(list.id)}
                          onCheckedChange={() => handleToggleList(list.id)}
                          disabled={isLoading}
                          aria-label={`Add to ${list.name}`}
                        />
                        {list.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="add-existing-item-amount"
                  className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                >
                  Amount{' '}
                  <span className="text-xs normal-case font-normal text-text-muted">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="add-existing-item-amount"
                  placeholder="e.g. 2, 500g"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={isLoading}
                  className="text-base md:text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-surface-container-low border-t border-border-muted flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2"
          >
            Add to Lists
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
