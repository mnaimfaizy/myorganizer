'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
} from '@myorganizer/core';
import { Input, Label, useToast } from '@myorganizer/web-ui';
import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AddExistingItemDialog } from '../../groceries-list-detail/components';
import { TripBoardStaples } from './TripBoardStaples';
import { TripBoardTripCard } from './TripBoardTripCard';

export interface TripBoardIndexProps {
  lists: GroceryList[];
  catalog: CatalogItem[];
  onRenameList: (id: string) => void;
  onDeleteList: (id: string) => void;
  onAddExistingItem: (
    catalogItemId: string,
    listIds: string[],
    amount?: string,
  ) => Promise<string[]>;
  isLoading?: boolean;
}

export function TripBoardIndex({
  lists,
  catalog,
  onRenameList,
  onDeleteList,
  onAddExistingItem,
  isLoading = false,
}: TripBoardIndexProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    GroceryCategoryType | 'all'
  >('all');
  const [addExistingCatalogItemId, setAddExistingCatalogItemId] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  const normalizedSearch = searchText.trim().toLowerCase();

  const matchingCatalogIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>();

    return new Set(
      catalog
        .filter((item) => item.name.toLowerCase().includes(normalizedSearch))
        .map((item) => item.id),
    );
  }, [catalog, normalizedSearch]);

  const filteredLists = useMemo(() => {
    if (!normalizedSearch) return lists;

    return lists.filter(
      (list) =>
        list.name.toLowerCase().includes(normalizedSearch) ||
        list.lines.some((line) => matchingCatalogIds.has(line.catalogItemId)),
    );
  }, [lists, matchingCatalogIds, normalizedSearch]);

  const filteredCatalog = useMemo(
    () =>
      catalog.filter(
        (item) =>
          (!normalizedSearch ||
            item.name.toLowerCase().includes(normalizedSearch)) &&
          (selectedCategory === 'all' || item.category === selectedCategory),
      ),
    [catalog, normalizedSearch, selectedCategory],
  );

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchText(event.currentTarget.value);
    },
    [],
  );

  const handleSelectCategory = useCallback(
    (category: GroceryCategoryType | 'all') => {
      setSelectedCategory(category);
    },
    [],
  );

  const handleRenameList = useCallback(
    (id: string) => {
      onRenameList(id);
    },
    [onRenameList],
  );

  const handleDeleteList = useCallback(
    (id: string) => {
      onDeleteList(id);
    },
    [onDeleteList],
  );

  const handleAddToTrip = useCallback((catalogItemId: string) => {
    setAddExistingCatalogItemId(catalogItemId);
  }, []);

  const showErrorToast = useCallback(() => {
    toast({
      title: 'Error',
      description: 'Failed to save your changes. Please try again.',
      variant: 'destructive',
    });
  }, [toast]);

  const handleCloseAddExistingDialog = useCallback(() => {
    setAddExistingCatalogItemId(null);
  }, []);

  const handleAddExistingSubmit = useCallback(
    async (catalogItemId: string, listIds: string[], amount?: string) => {
      try {
        const addedListIds = await onAddExistingItem(
          catalogItemId,
          listIds,
          amount,
        );

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

        return addedListIds;
      } catch (err) {
        console.error('Failed to add existing catalog item to lists:', err);
        showErrorToast();
        throw err;
      }
    },
    [onAddExistingItem, showErrorToast, toast],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="trip-board-search">Search trips and staples</Label>
        <Input
          id="trip-board-search"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search lists or staple names..."
          aria-describedby="trip-board-results"
        />
      </div>

      <TripBoardStaples
        catalog={filteredCatalog}
        allCatalog={catalog}
        lists={lists}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onAddToTrip={handleAddToTrip}
        isLoading={isLoading}
      />

      <p
        id="trip-board-results"
        className="text-sm text-on-surface-variant"
        aria-live="polite"
      >
        Showing {filteredLists.length} of {lists.length} trip
        {lists.length === 1 ? '' : 's'}
        {normalizedSearch ? ` matching “${searchText.trim()}”` : ''}
      </p>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {filteredLists.map((list) => (
          <TripBoardTripCard
            key={list.id}
            list={list}
            catalog={catalog}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            isLoading={isLoading}
          />
        ))}
      </div>

      <AddExistingItemDialog
        isOpen={addExistingCatalogItemId !== null}
        onClose={handleCloseAddExistingDialog}
        catalog={catalog}
        lists={lists}
        defaultCatalogItemId={addExistingCatalogItemId ?? undefined}
        onAdd={handleAddExistingSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
