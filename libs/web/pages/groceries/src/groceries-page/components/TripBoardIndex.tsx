'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
} from '@myorganizer/core';
import { Input, Label } from '@myorganizer/web-ui';
import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { GroceryListSelector } from './GroceryListSelector';
import {
  CATEGORY_ORDER,
  getCategoryEmoji,
  getCategoryLabel,
} from '../../shared/constants/categories';
import { formatMoney } from '../../shared/utils';

export interface TripBoardIndexProps {
  lists: GroceryList[];
  catalog: CatalogItem[];
  onRenameList: (id: string) => void;
  onDeleteList: (id: string) => void;
  isLoading?: boolean;
}

export function TripBoardIndex({
  lists,
  catalog,
  onRenameList,
  onDeleteList,
  isLoading = false,
}: TripBoardIndexProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    GroceryCategoryType | 'all'
  >('all');

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

  const categoriesInUse = useMemo(() => {
    const categories = new Set(catalog.map((item) => item.category));
    return CATEGORY_ORDER.filter((category) => categories.has(category));
  }, [catalog]);

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchText(event.currentTarget.value);
    },
    [],
  );

  const createCategoryChangeHandler = useCallback(
    (category: GroceryCategoryType | 'all') => () => {
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

      <section aria-labelledby="staples-heading" className="space-y-3">
        <div>
          <h2
            id="staples-heading"
            className="text-lg font-semibold text-on-surface md:text-xl"
          >
            Staples
          </h2>
          <p className="text-sm text-on-surface-variant">
            Browse your catalog for the next trip.
          </p>
        </div>

        <div
          className="flex gap-2 overflow-x-auto py-1"
          role="group"
          aria-label="Filter staples by category"
        >
          <button
            type="button"
            aria-label="Show all staples"
            aria-pressed={selectedCategory === 'all'}
            onClick={createCategoryChangeHandler('all')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              selectedCategory === 'all'
                ? 'bg-secondary text-on-secondary'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            All
          </button>
          {categoriesInUse.map((category) => (
            <button
              key={category}
              type="button"
              aria-label={`Filter staples by ${getCategoryLabel(category)}`}
              aria-pressed={selectedCategory === category}
              onClick={createCategoryChangeHandler(category)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                selectedCategory === category
                  ? 'bg-secondary text-on-secondary'
                  : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              <span aria-hidden="true">{getCategoryEmoji(category)}</span>
              {getCategoryLabel(category)}
            </button>
          ))}
        </div>

        {filteredCatalog.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredCatalog.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-surface-variant bg-surface-container-lowest p-4"
              >
                <div className="flex items-start gap-2">
                  <span aria-hidden="true">
                    {getCategoryEmoji(item.category)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-on-surface">
                      {item.name}
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      {getCategoryLabel(item.category)}
                    </p>
                  </div>
                </div>
                {typeof item.price === 'number' && (
                  <p className="mt-3 text-sm font-semibold text-on-surface">
                    {formatMoney(item.price)}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p
            className="rounded-lg border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant"
            role="status"
          >
            No staples match the current filters.
          </p>
        )}
      </section>

      <p
        id="trip-board-results"
        className="text-sm text-on-surface-variant"
        aria-live="polite"
      >
        Showing {filteredLists.length} of {lists.length} trip
        {lists.length === 1 ? '' : 's'}
        {normalizedSearch ? ` matching “${searchText.trim()}”` : ''}
      </p>

      <GroceryListSelector
        lists={filteredLists}
        catalog={catalog}
        onRenameList={handleRenameList}
        onDeleteList={handleDeleteList}
        isLoading={isLoading}
      />
    </div>
  );
}
