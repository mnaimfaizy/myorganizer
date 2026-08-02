'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
} from '@myorganizer/core';
import { Input, Label, useToast } from '@myorganizer/web-ui';
import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  AddExistingItemDialog,
  AddItemDialog,
  CatalogItemEditDialog,
} from '../../groceries-list-detail/components';
import type {
  AddItemFormResult,
  CatalogItemEditChanges,
} from '../../groceries-list-detail/components';
import type { AddCatalogItemAndLineInput } from '../../shared/hooks';
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
  onAddCatalogItem: (input: AddCatalogItemAndLineInput) => Promise<void>;
  onUpdateCatalogItem: (changes: CatalogItemEditChanges) => Promise<void>;
  isLoading?: boolean;
}

export function TripBoardIndex({
  lists,
  catalog,
  onRenameList,
  onDeleteList,
  onAddExistingItem,
  onAddCatalogItem,
  onUpdateCatalogItem,
  isLoading = false,
}: TripBoardIndexProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    GroceryCategoryType | 'all'
  >('all');
  const [addExistingCatalogItemId, setAddExistingCatalogItemId] = useState<
    string | null
  >(null);
  const [isAddStapleOpen, setIsAddStapleOpen] = useState(false);
  const [catalogItemPendingEdit, setCatalogItemPendingEdit] =
    useState<CatalogItem | null>(null);
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

  const handleOpenAddStaple = useCallback(() => {
    setIsAddStapleOpen(true);
  }, []);

  const handleCloseAddStaple = useCallback(() => {
    setIsAddStapleOpen(false);
  }, []);

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

  const showErrorToast = useCallback(() => {
    toast({
      title: 'Error',
      description: 'Failed to save your changes. Please try again.',
      variant: 'destructive',
    });
  }, [toast]);

  const mapFormResultToCatalogInput = useCallback(
    (values: AddItemFormResult): AddCatalogItemAndLineInput => ({
      name: values.name,
      category: values.category,
      ...(values.catalogItemId ? { catalogItemId: values.catalogItemId } : {}),
      ...(values.price !== undefined ? { price: values.price } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
      ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
      ...(values.links ? { links: values.links } : {}),
    }),
    [],
  );

  const handleAddCatalogItemSubmit = useCallback(
    async (values: AddItemFormResult) => {
      try {
        await onAddCatalogItem(mapFormResultToCatalogInput(values));
        toast({
          title: 'Added to catalog',
        });
      } catch (err) {
        console.error('Failed to add catalog item:', err);
        showErrorToast();
        throw err;
      }
    },
    [mapFormResultToCatalogInput, onAddCatalogItem, showErrorToast, toast],
  );

  const handleUpdateCatalogItemSubmit = useCallback(
    async (changes: CatalogItemEditChanges) => {
      try {
        await onUpdateCatalogItem(changes);
        setCatalogItemPendingEdit(null);
      } catch (err) {
        console.error('Failed to update catalog item:', err);
        showErrorToast();
        throw err;
      }
    },
    [onUpdateCatalogItem, showErrorToast],
  );

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
        onNewStaple={handleOpenAddStaple}
        onEditCatalogItem={handleEditCatalogItem}
        isLoading={isLoading}
      />

      <p
        id="trip-board-results"
        className="text-sm text-muted-foreground"
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

      <AddItemDialog
        isOpen={isAddStapleOpen}
        onClose={handleCloseAddStaple}
        onAdd={handleAddCatalogItemSubmit}
        isLoading={isLoading}
        catalog={catalog}
        mode="catalog"
      />

      <CatalogItemEditDialog
        item={catalogItemPendingEdit}
        isOpen={catalogItemPendingEdit !== null}
        onClose={handleCloseCatalogEdit}
        onSave={handleUpdateCatalogItemSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
